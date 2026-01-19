from matplotlib.figure import Figure
from networkx import MultiDiGraph
import osmnx as ox
import matplotlib.pyplot as plt
from matplotlib.font_manager import FontProperties
import matplotlib.colors as mcolors
import numpy as np
from geopy.geocoders import Nominatim
import time
import json
import os
import sys
from datetime import datetime
import argparse
import asyncio
import threading

# Enable osmnx caching - downloaded data is saved locally for faster repeat requests
# Use absolute path so cache works regardless of working directory
CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cache")
os.makedirs(CACHE_DIR, exist_ok=True)
ox.settings.use_cache = True
ox.settings.cache_folder = CACHE_DIR
ox.settings.log_console = True  # Show cache hits/misses in console

def log(message, end='\n'):
    """Print with immediate flush for better Windows terminal compatibility."""
    print(message, end=end, flush=True)

class Spinner:
    """Animated spinner to show activity during long operations."""

    def __init__(self, message=""):
        self.message = message
        self.running = False
        self.thread = None
        # Use simple ASCII characters that work in all terminals
        self.frames = ['|', '/', '-', '\\']
        self.current = 0

    def _spin(self):
        while self.running:
            frame = self.frames[self.current % len(self.frames)]
            # \r moves cursor to start of line, allowing overwrite
            print(f"\r{self.message} {frame} ", end='', flush=True)
            self.current += 1
            time.sleep(0.15)

    def start(self, message=""):
        if message:
            self.message = message
        self.running = True
        self.thread = threading.Thread(target=self._spin, daemon=True)
        self.thread.start()

    def stop(self, final_message=""):
        self.running = False
        if self.thread:
            self.thread.join(timeout=0.5)
        # Clear the spinner line and print final message
        print(f"\r{self.message} {final_message}    ", flush=True)

def run_with_spinner(message, func, *args, **kwargs):
    """Run a function while showing an animated spinner."""
    spinner = Spinner(message)
    spinner.start()
    try:
        result = func(*args, **kwargs)
        spinner.stop("✓ done")
        return result
    except Exception as e:
        spinner.stop(f"✗ failed")
        raise

THEMES_DIR = "themes"
FONTS_DIR = "fonts"
POSTERS_DIR = "posters"

def load_fonts():
    """
    Load Roboto fonts from the fonts directory.
    Returns dict with font paths for different weights.
    """
    fonts = {
        'bold': os.path.join(FONTS_DIR, 'Roboto-Bold.ttf'),
        'regular': os.path.join(FONTS_DIR, 'Roboto-Regular.ttf'),
        'light': os.path.join(FONTS_DIR, 'Roboto-Light.ttf')
    }
    
    # Verify fonts exist
    for weight, path in fonts.items():
        if not os.path.exists(path):
            log(f"⚠ Font not found: {path}")
            return None
    
    return fonts

FONTS = load_fonts()

def generate_output_filename(city, theme_name):
    """
    Generate unique output filename with city, theme, and datetime.
    """
    if not os.path.exists(POSTERS_DIR):
        os.makedirs(POSTERS_DIR)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    city_slug = city.lower().replace(' ', '_')
    filename = f"{city_slug}_{theme_name}_{timestamp}.png"
    return os.path.join(POSTERS_DIR, filename)

def get_available_themes():
    """
    Scans the themes directory and returns a list of available theme names.
    """
    if not os.path.exists(THEMES_DIR):
        os.makedirs(THEMES_DIR)
        return []
    
    themes = []
    for file in sorted(os.listdir(THEMES_DIR)):
        if file.endswith('.json'):
            theme_name = file[:-5]  # Remove .json extension
            themes.append(theme_name)
    return themes

def load_theme(theme_name="feature_based"):
    """
    Load theme from JSON file in themes directory.
    """
    theme_file = os.path.join(THEMES_DIR, f"{theme_name}.json")
    
    if not os.path.exists(theme_file):
        log(f"⚠ Theme file '{theme_file}' not found. Using default feature_based theme.")
        # Fallback to embedded default theme
        return {
            "name": "Feature-Based Shading",
            "bg": "#FFFFFF",
            "text": "#000000",
            "gradient_color": "#FFFFFF",
            "water": "#C0C0C0",
            "parks": "#F0F0F0",
            "road_motorway": "#0A0A0A",
            "road_primary": "#1A1A1A",
            "road_secondary": "#2A2A2A",
            "road_tertiary": "#3A3A3A",
            "road_residential": "#4A4A4A",
            "road_default": "#3A3A3A"
        }
    
    with open(theme_file, 'r') as f:
        theme = json.load(f)
        log(f"✓ Loaded theme: {theme.get('name', theme_name)}")
        if 'description' in theme:
            log(f"  {theme['description']}")
        return theme

# Load theme (can be changed via command line or input)
THEME = dict[str, str]()  # Will be loaded later

def create_gradient_fade(ax, color, location='bottom', zorder=10):
    """
    Creates a fade effect at the top or bottom of the map.
    """
    vals = np.linspace(0, 1, 256).reshape(-1, 1)
    gradient = np.hstack((vals, vals))
    
    rgb = mcolors.to_rgb(color)
    my_colors = np.zeros((256, 4))
    my_colors[:, 0] = rgb[0]
    my_colors[:, 1] = rgb[1]
    my_colors[:, 2] = rgb[2]
    
    if location == 'bottom':
        my_colors[:, 3] = np.linspace(1, 0, 256)
        extent_y_start = 0
        extent_y_end = 0.25
    else:
        my_colors[:, 3] = np.linspace(0, 1, 256)
        extent_y_start = 0.75
        extent_y_end = 1.0

    custom_cmap = mcolors.ListedColormap(my_colors)
    
    xlim = ax.get_xlim()
    ylim = ax.get_ylim()
    y_range = ylim[1] - ylim[0]
    
    y_bottom = ylim[0] + y_range * extent_y_start
    y_top = ylim[0] + y_range * extent_y_end
    
    ax.imshow(gradient, extent=[xlim[0], xlim[1], y_bottom, y_top], 
              aspect='auto', cmap=custom_cmap, zorder=zorder, origin='lower')

def get_edge_colors_by_type(G):
    """
    Assigns colors to edges based on road type hierarchy.
    Returns a list of colors corresponding to each edge in the graph.
    """
    edge_colors = []
    
    for u, v, data in G.edges(data=True):
        # Get the highway type (can be a list or string)
        highway = data.get('highway', 'unclassified')
        
        # Handle list of highway types (take the first one)
        if isinstance(highway, list):
            highway = highway[0] if highway else 'unclassified'
        
        # Assign color based on road type
        if highway in ['motorway', 'motorway_link']:
            color = THEME['road_motorway']
        elif highway in ['trunk', 'trunk_link', 'primary', 'primary_link']:
            color = THEME['road_primary']
        elif highway in ['secondary', 'secondary_link']:
            color = THEME['road_secondary']
        elif highway in ['tertiary', 'tertiary_link']:
            color = THEME['road_tertiary']
        elif highway in ['residential', 'living_street', 'unclassified']:
            color = THEME['road_residential']
        else:
            color = THEME['road_default']
        
        edge_colors.append(color)
    
    return edge_colors

def get_edge_widths_by_type(G):
    """
    Assigns line widths to edges based on road type.
    Major roads get thicker lines.
    """
    edge_widths = []
    
    for u, v, data in G.edges(data=True):
        highway = data.get('highway', 'unclassified')
        
        if isinstance(highway, list):
            highway = highway[0] if highway else 'unclassified'
        
        # Assign width based on road importance
        if highway in ['motorway', 'motorway_link']:
            width = 1.2
        elif highway in ['trunk', 'trunk_link', 'primary', 'primary_link']:
            width = 1.0
        elif highway in ['secondary', 'secondary_link']:
            width = 0.8
        elif highway in ['tertiary', 'tertiary_link']:
            width = 0.6
        else:
            width = 0.4
        
        edge_widths.append(width)
    
    return edge_widths

def get_coordinates(city, country, progress=None):
    """
    Fetches coordinates for a given city and country using geopy.
    Includes rate limiting to be respectful to the geocoding service.
    """
    if progress:
        progress({"stage": "geocode", "percent": 5, "message": "Looking up coordinates"})

    geolocator = Nominatim(user_agent="city_map_poster")

    # Add a small delay to respect Nominatim's usage policy
    time.sleep(1)

    spinner = Spinner("Looking up coordinates...")
    spinner.start()

    location = geolocator.geocode(f"{city}, {country}")

    # If geocode returned a coroutine in some environments, run it to get the result.
    if asyncio.iscoroutine(location):
        try:
            location = asyncio.run(location)
        except RuntimeError:
            # If an event loop is already running, try using it to complete the coroutine.
            loop = asyncio.get_event_loop()
            if loop.is_running():
                spinner.stop("✗ failed")
                raise RuntimeError("Geocoder returned a coroutine while an event loop is already running.")
            location = loop.run_until_complete(location)

    if location:
        spinner.stop("✓ found")
        # Use getattr to safely access address (helps static analyzers)
        addr = getattr(location, "address", None)
        if addr:
            log(f"  Address: {addr}")
        log(f"  Coordinates: {location.latitude}, {location.longitude}")
        if progress:
            progress({"stage": "geocode", "percent": 12, "message": "Coordinates found"})
        return (location.latitude, location.longitude)
    else:
        spinner.stop("✗ not found")
        raise ValueError(f"Could not find coordinates for {city}, {country}")
    
def get_crop_limits(G: MultiDiGraph, fig: Figure) -> tuple[tuple[float, float], tuple[float, float]]:
    """
    Determine cropping limits to maintain aspect ratio of the figure.

    This function calculates the extents of the graph's nodes and adjusts
    the x and y limits to match the aspect ratio of the provided figure.
    
    :param G: The graph to be plotted
    :type G: MultiDiGraph
    :param fig: The matplotlib figure object
    :type fig: Figure
    :return: Tuple of x and y limits for cropping
    :rtype: tuple[tuple[float, float], tuple[float, float]]
    """
    # Compute node extents in projected coordinates
    xs = [data['x'] for _, data in G.nodes(data=True)]
    ys = [data['y'] for _, data in G.nodes(data=True)]
    minx, maxx = min(xs), max(xs)
    miny, maxy = min(ys), max(ys)
    x_range = maxx - minx
    y_range = maxy - miny

    fig_width, fig_height = fig.get_size_inches()
    desired_aspect = fig_width / fig_height
    current_aspect = x_range / y_range

    center_x = (minx + maxx) / 2
    center_y = (miny + maxy) / 2

    if current_aspect > desired_aspect:
        # Too wide, need to crop horizontally
        desired_x_range = y_range * desired_aspect
        new_minx = center_x - desired_x_range / 2
        new_maxx = center_x + desired_x_range / 2
        new_miny, new_maxy = miny, maxy
        crop_xlim = (new_minx, new_maxx)
        crop_ylim = (new_miny, new_maxy)
    elif current_aspect < desired_aspect:
        # Too tall, need to crop vertically
        desired_y_range = x_range / desired_aspect
        new_miny = center_y - desired_y_range / 2
        new_maxy = center_y + desired_y_range / 2
        new_minx, new_maxx = minx, maxx
        crop_xlim = (new_minx, new_maxx)
        crop_ylim = (new_miny, new_maxy)
    else:
        # Otherwise, keep original extents (no horizontal crop)
        crop_xlim = (minx, maxx)
        crop_ylim = (miny, maxy)
    
    return crop_xlim, crop_ylim

def create_poster(city, country, point, dist, output_file, dpi=300, progress=None):
    log(f"\nGenerating map for {city}, {country}...")
    log("")

    # 1. Fetch Street Network
    if progress:
        progress({"stage": "network", "percent": 20, "message": "Downloading street network"})
    G = run_with_spinner(
        "[1/3] Downloading street network...",
        ox.graph_from_point,
        point, dist=dist, dist_type='bbox', network_type='all'
    )
    if progress:
        progress({"stage": "network", "percent": 30, "message": "Street network downloaded"})
    time.sleep(0.5)  # Rate limit between requests

    # 2. Fetch Water Features
    if progress:
        progress({"stage": "water", "percent": 38, "message": "Downloading water features"})
    water = None
    spinner = Spinner("[2/3] Downloading water features...")
    spinner.start()
    try:
        water = ox.features_from_point(point, tags={'natural': 'water', 'waterway': 'riverbank'}, dist=dist)
        spinner.stop("✓ done")
    except Exception as e:
        spinner.stop(f"⚠ skipped (no data)")
    if progress:
        progress({"stage": "water", "percent": 45, "message": "Water features downloaded"})
    time.sleep(0.3)

    # 3. Fetch Parks
    if progress:
        progress({"stage": "parks", "percent": 50, "message": "Downloading parks/green spaces"})
    parks = None
    spinner = Spinner("[3/3] Downloading parks/green spaces...")
    spinner.start()
    try:
        parks = ox.features_from_point(point, tags={'leisure': 'park', 'landuse': 'grass'}, dist=dist)
        spinner.stop("✓ done")
    except Exception as e:
        spinner.stop(f"⚠ skipped (no data)")
    if progress:
        progress({"stage": "parks", "percent": 60, "message": "Parks downloaded"})

    log("\n✓ All data downloaded successfully!\n")

    # 2. Setup Plot
    if progress:
        progress({"stage": "render", "percent": 70, "message": "Rendering map"})

    spinner = Spinner("Rendering map...")
    spinner.start()

    fig, ax = plt.subplots(figsize=(12, 16), facecolor=THEME['bg'])
    ax.set_facecolor(THEME['bg'])
    ax.set_position((0.0, 0.0, 1.0, 1.0))

    # Project graph to a metric CRS so distances and aspect are linear (meters)
    G_proj = ox.project_graph(G)

    # 3. Plot Layers
    # Layer 1: Polygons (filter out Point geometries to avoid orange dot artifacts)
    if water is not None and not water.empty:
        # Filter to only Polygon/MultiPolygon geometries
        water = water[water.geometry.type.isin(['Polygon', 'MultiPolygon'])]
        if not water.empty:
            try:
                water = ox.projection.project_gdf(water)
            except Exception:
                water = water.to_crs(G_proj.graph['crs'])
            water.plot(ax=ax, facecolor=THEME['water'], edgecolor='none', zorder=1)
    if parks is not None and not parks.empty:
        # Filter to only Polygon/MultiPolygon geometries
        parks = parks[parks.geometry.type.isin(['Polygon', 'MultiPolygon'])]
        if not parks.empty:
            try:
                parks = ox.projection.project_gdf(parks)
            except Exception:
                parks = parks.to_crs(G_proj.graph['crs'])
            parks.plot(ax=ax, facecolor=THEME['parks'], edgecolor='none', zorder=2)

    # Layer 2: Roads with hierarchy coloring
    edge_colors = get_edge_colors_by_type(G_proj)
    edge_widths = get_edge_widths_by_type(G_proj)

    # Determine cropping limits to maintain the poster aspect ratio
    crop_xlim, crop_ylim = get_crop_limits(G_proj, fig)

    # Plot the projected graph and then apply the cropped limits
    ox.plot_graph(
        G_proj, ax=ax, bgcolor=THEME['bg'],
        node_size=0,
        node_color=THEME['bg'],  # Hide any node artifacts by matching background
        edge_color=edge_colors,
        edge_linewidth=edge_widths,
        show=False, close=False
    )
    ax.set_aspect('equal', adjustable='box')
    ax.set_xlim(crop_xlim)
    ax.set_ylim(crop_ylim)
    
    # Layer 3: Gradients (Top and Bottom)
    create_gradient_fade(ax, THEME['gradient_color'], location='bottom', zorder=10)
    create_gradient_fade(ax, THEME['gradient_color'], location='top', zorder=10)
    
    # 4. Typography using Roboto font
    if FONTS:
        font_main = FontProperties(fname=FONTS['bold'], size=60)
        font_top = FontProperties(fname=FONTS['bold'], size=40)
        font_sub = FontProperties(fname=FONTS['light'], size=22)
        font_coords = FontProperties(fname=FONTS['regular'], size=14)
    else:
        # Fallback to system fonts
        font_main = FontProperties(family='monospace', weight='bold', size=60)
        font_top = FontProperties(family='monospace', weight='bold', size=40)
        font_sub = FontProperties(family='monospace', weight='normal', size=22)
        font_coords = FontProperties(family='monospace', size=14)
    
    spaced_city = "  ".join(list(city.upper()))

    # --- BOTTOM TEXT ---
    ax.text(0.5, 0.14, spaced_city, transform=ax.transAxes,
            color=THEME['text'], ha='center', fontproperties=font_main, zorder=11)
    
    ax.text(0.5, 0.10, country.upper(), transform=ax.transAxes,
            color=THEME['text'], ha='center', fontproperties=font_sub, zorder=11)
    
    lat, lon = point
    coords = f"{lat:.4f}° N / {lon:.4f}° E" if lat >= 0 else f"{abs(lat):.4f}° S / {lon:.4f}° E"
    if lon < 0:
        coords = coords.replace("E", "W")
    
    ax.text(0.5, 0.07, coords, transform=ax.transAxes,
            color=THEME['text'], alpha=0.7, ha='center', fontproperties=font_coords, zorder=11)
    
    ax.plot([0.4, 0.6], [0.125, 0.125], transform=ax.transAxes, 
            color=THEME['text'], linewidth=1, zorder=11)

    # --- ATTRIBUTION (bottom right) ---
    if FONTS:
        font_attr = FontProperties(fname=FONTS['light'], size=8)
    else:
        font_attr = FontProperties(family='monospace', size=8)
    
    ax.text(0.98, 0.02, "© OpenStreetMap contributors", transform=ax.transAxes,
            color=THEME['text'], alpha=0.5, ha='right', va='bottom',
            fontproperties=font_attr, zorder=11)

    spinner.stop("✓ done")

    # 5. Save
    if progress:
        progress({"stage": "save", "percent": 90, "message": "Saving poster"})
    spinner = Spinner(f"Saving to {output_file} ({dpi} DPI)...")
    spinner.start()
    plt.savefig(output_file, dpi=dpi, facecolor=THEME['bg'])
    plt.close()
    spinner.stop("✓ done")
    log(f"\n✓ Poster saved as {output_file}")

def print_examples():
    """Print usage examples."""
    print("""
City Map Poster Generator
=========================

Usage:
  python create_map_poster.py --city <city> --country <country> [options]

Examples:
  # Iconic grid patterns
  python create_map_poster.py -c "New York" -C "USA" -t noir -d 12000           # Manhattan grid
  python create_map_poster.py -c "Barcelona" -C "Spain" -t warm_beige -d 8000   # Eixample district grid
  
  # Waterfront & canals
  python create_map_poster.py -c "Venice" -C "Italy" -t blueprint -d 4000       # Canal network
  python create_map_poster.py -c "Amsterdam" -C "Netherlands" -t ocean -d 6000  # Concentric canals
  python create_map_poster.py -c "Dubai" -C "UAE" -t midnight_blue -d 15000     # Palm & coastline
  
  # Radial patterns
  python create_map_poster.py -c "Paris" -C "France" -t pastel_dream -d 10000   # Haussmann boulevards
  python create_map_poster.py -c "Moscow" -C "Russia" -t noir -d 12000          # Ring roads
  
  # Organic old cities
  python create_map_poster.py -c "Tokyo" -C "Japan" -t japanese_ink -d 15000    # Dense organic streets
  python create_map_poster.py -c "Marrakech" -C "Morocco" -t terracotta -d 5000 # Medina maze
  python create_map_poster.py -c "Rome" -C "Italy" -t warm_beige -d 8000        # Ancient street layout
  
  # Coastal cities
  python create_map_poster.py -c "San Francisco" -C "USA" -t sunset -d 10000    # Peninsula grid
  python create_map_poster.py -c "Sydney" -C "Australia" -t ocean -d 12000      # Harbor city
  python create_map_poster.py -c "Mumbai" -C "India" -t contrast_zones -d 18000 # Coastal peninsula
  
  # River cities
  python create_map_poster.py -c "London" -C "UK" -t noir -d 15000              # Thames curves
  python create_map_poster.py -c "Budapest" -C "Hungary" -t copper_patina -d 8000  # Danube split
  
  # List themes
  python create_map_poster.py --list-themes

Options:
  --city, -c        City name (required)
  --country, -C     Country name (required)
  --theme, -t       Theme name (default: feature_based)
  --distance, -d    Map radius in meters (default: 29000)
  --list-themes     List all available themes

Distance guide:
  4000-6000m   Small/dense cities (Venice, Amsterdam old center)
  8000-12000m  Medium cities, focused downtown (Paris, Barcelona)
  15000-20000m Large metros, full city view (Tokyo, Mumbai)

Available themes can be found in the 'themes/' directory.
Generated posters are saved to 'posters/' directory.
""")

def list_themes():
    """List all available themes with descriptions."""
    available_themes = get_available_themes()
    if not available_themes:
        print("No themes found in 'themes/' directory.")
        return
    
    print("\nAvailable Themes:")
    print("-" * 60)
    for theme_name in available_themes:
        theme_path = os.path.join(THEMES_DIR, f"{theme_name}.json")
        try:
            with open(theme_path, 'r') as f:
                theme_data = json.load(f)
                display_name = theme_data.get('name', theme_name)
                description = theme_data.get('description', '')
        except:
            display_name = theme_name
            description = ''
        print(f"  {theme_name}")
        print(f"    {display_name}")
        if description:
            print(f"    {description}")
        print()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Generate beautiful map posters for any city",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python create_map_poster.py --city "New York" --country "USA"
  python create_map_poster.py --city Tokyo --country Japan --theme midnight_blue
  python create_map_poster.py --city Paris --country France --theme noir --distance 15000
  python create_map_poster.py --list-themes
        """
    )
    
    parser.add_argument('--city', '-c', type=str, help='City name')
    parser.add_argument('--country', '-C', type=str, help='Country name')
    parser.add_argument('--theme', '-t', type=str, default='feature_based', help='Theme name (default: feature_based)')
    parser.add_argument('--distance', '-d', type=int, default=29000, help='Map radius in meters (default: 29000)')
    parser.add_argument('--dpi', type=int, default=300, help='Output resolution in DPI (default: 300). Use 150 for smaller files, 72 for preview.')
    parser.add_argument('--list-themes', action='store_true', help='List all available themes')
    
    args = parser.parse_args()
    
    # If no arguments provided, show examples
    if len(sys.argv) == 1:
        print_examples()
        sys.exit(0)
    
    # List themes if requested
    if args.list_themes:
        list_themes()
        sys.exit(0)
    
    # Validate required arguments
    if not args.city or not args.country:
        print("Error: --city and --country are required.\n")
        print_examples()
        sys.exit(1)
    
    # Validate theme exists
    available_themes = get_available_themes()
    if args.theme not in available_themes:
        print(f"Error: Theme '{args.theme}' not found.")
        print(f"Available themes: {', '.join(available_themes)}")
        sys.exit(1)
    
    print("=" * 50)
    print("City Map Poster Generator")
    print("=" * 50)
    
    # Load theme
    THEME = load_theme(args.theme)
    
    # Get coordinates and generate poster
    try:
        coords = get_coordinates(args.city, args.country)
        output_file = generate_output_filename(args.city, args.theme)
        create_poster(args.city, args.country, coords, args.distance, output_file, dpi=args.dpi)
        
        print("\n" + "=" * 50)
        print("✓ Poster generation complete!")
        print("=" * 50)
        
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
