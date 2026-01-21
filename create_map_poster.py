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
import pickle
import hashlib
from shapely.geometry import LineString, Polygon, MultiPolygon, box
from shapely.ops import unary_union, polygonize
import geopandas as gpd

# Enable osmnx caching - downloaded data is saved locally for faster repeat requests
# Use absolute path so cache works regardless of working directory
CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cache")
MAP_CACHE_DIR = os.path.join(CACHE_DIR, "map_data")
os.makedirs(CACHE_DIR, exist_ok=True)
os.makedirs(MAP_CACHE_DIR, exist_ok=True)
ox.settings.use_cache = True
ox.settings.cache_folder = CACHE_DIR
ox.settings.log_console = True  # Show cache hits/misses in console
# Use alternative Overpass endpoint (German mirror)
ox.settings.overpass_url = "https://gall.openstreetmap.de/api/"
ox.settings.timeout = 180  # 3 minute timeout for slower servers


def get_cache_key(lat, lon, dist):
    """
    Generate a cache key from coordinates and distance.
    Coordinates are rounded to 4 decimal places (~11m precision).
    """
    # Round coordinates to avoid floating point issues
    lat_r = round(lat, 4)
    lon_r = round(lon, 4)
    key_str = f"{lat_r}_{lon_r}_{dist}"
    # Create a short hash for the filename
    key_hash = hashlib.md5(key_str.encode()).hexdigest()[:12]
    return f"map_{lat_r}_{lon_r}_{dist}_{key_hash}"


def save_map_cache(cache_key, graph, water, parks, coastlines=None):
    """Save downloaded map data to cache."""
    cache_file = os.path.join(MAP_CACHE_DIR, f"{cache_key}.pkl")
    data = {
        "graph": graph,
        "water": water,
        "parks": parks,
        "coastlines": coastlines,
        "cached_at": datetime.now().isoformat()
    }
    with open(cache_file, "wb") as f:
        pickle.dump(data, f)
    log(f"  [Cache] Saved map data to {cache_key}.pkl")


def load_map_cache(cache_key):
    """
    Load map data from cache if available.
    Returns (graph, water, parks, coastlines) tuple or None if not cached.
    """
    cache_file = os.path.join(MAP_CACHE_DIR, f"{cache_key}.pkl")
    if not os.path.exists(cache_file):
        return None
    try:
        with open(cache_file, "rb") as f:
            data = pickle.load(f)
        log(f"  [Cache] Loaded map data from {cache_key}.pkl")
        if "cached_at" in data:
            log(f"  [Cache] Data cached at: {data['cached_at']}")
        # Support older cache files without coastlines
        coastlines = data.get("coastlines", None)
        return data["graph"], data["water"], data["parks"], coastlines
    except Exception as e:
        log(f"  [Cache] Failed to load cache: {e}")
        return None


def clear_map_cache():
    """Clear all cached map data."""
    count = 0
    for f in os.listdir(MAP_CACHE_DIR):
        if f.endswith(".pkl"):
            os.remove(os.path.join(MAP_CACHE_DIR, f))
            count += 1
    log(f"Cleared {count} cached map files.")

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

def discover_font_families():
    """
    Discover available font families from the fonts directory.
    Expects fonts named: FontFamily-Bold.ttf, FontFamily-Regular.ttf, FontFamily-Light.ttf
    Returns dict of font families with their available weights.
    """
    if not os.path.exists(FONTS_DIR):
        return {}

    font_families = {}

    # Scan for .ttf and .otf files
    for filename in os.listdir(FONTS_DIR):
        if not (filename.endswith('.ttf') or filename.endswith('.otf')):
            continue

        filepath = os.path.join(FONTS_DIR, filename)
        name = filename.rsplit('.', 1)[0]  # Remove extension

        # Parse font name - expect "Family-Weight" format
        if '-' in name:
            parts = name.rsplit('-', 1)
            family = parts[0]
            weight = parts[1].lower()
        else:
            # Single name, assume regular weight
            family = name
            weight = 'regular'

        # Normalize weight names
        weight_map = {
            'bold': 'bold', 'black': 'bold', 'heavy': 'bold',
            'regular': 'regular', 'normal': 'regular', 'medium': 'regular',
            'light': 'light', 'thin': 'light', 'extralight': 'light'
        }
        weight = weight_map.get(weight, 'regular')

        if family not in font_families:
            font_families[family] = {}
        font_families[family][weight] = filepath

    return font_families

def get_font_family(family_name=None):
    """
    Get font paths for a specific family. Falls back to first available or None.
    Returns dict with 'bold', 'regular', 'light' keys (some may be missing).
    """
    families = discover_font_families()

    if not families:
        return None

    # Try requested family first
    if family_name and family_name in families:
        return families[family_name]

    # Fall back to Roboto if available
    if 'Roboto' in families:
        return families['Roboto']

    # Fall back to first available family
    first_family = next(iter(families.values()))
    return first_family

def list_available_fonts():
    """
    List all available font families.
    Returns list of font family names.
    """
    families = discover_font_families()
    return sorted(families.keys())

# Default font (Roboto or first available)
FONTS = get_font_family('Roboto')

def generate_output_filename(city, theme_name, output_format):
    """
    Generate unique output filename with city, theme, and datetime.
    """
    if not os.path.exists(POSTERS_DIR):
        os.makedirs(POSTERS_DIR)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    city_slug = city.lower().replace(' ', '_')
    fmt = output_format.lower()
    # Handle svg-laser format (produces .svg file with _laser suffix)
    if fmt == 'svg-laser':
        ext = 'svg'
        suffix = '_laser'
    else:
        ext = fmt
        suffix = ''
    filename = f"{city_slug}_{theme_name}{suffix}_{timestamp}.{ext}"
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

def draw_center_pin(ax, crop_xlim, crop_ylim, pin_type, theme, pin_color=None):
    """
    Draws a center pin/marker icon on the map.

    pin_type: 'marker', 'heart', 'star', 'home', 'circle'
    pin_color: hex color string, or None to use theme text color
    """
    from matplotlib.patches import Circle, Polygon, FancyBboxPatch, PathPatch
    from matplotlib.path import Path
    import matplotlib.transforms as transforms

    # Calculate center of map
    center_x = (crop_xlim[0] + crop_xlim[1]) / 2
    center_y = (crop_ylim[0] + crop_ylim[1]) / 2

    # Scale based on map size (make pin ~3% of map width)
    map_width = crop_xlim[1] - crop_xlim[0]
    scale = map_width * 0.025

    # Use provided color or fall back to theme text color
    if pin_color is None:
        pin_color = theme.get('text', '#1A1A1A')

    if pin_type == 'marker':
        # Google Maps style pin - teardrop with hollow circle
        pin_size = scale * 1.5

        # Teardrop: circle on top, point at bottom
        n_pts = 50

        # Top semicircle (from left to right)
        t_top = np.linspace(np.pi, 0, n_pts)
        x_top = pin_size * 0.6 * np.cos(t_top)
        y_top = pin_size * 0.6 * np.sin(t_top) + pin_size * 0.4

        # Bottom curves tapering to point
        t_right = np.linspace(0, 1, n_pts//2)
        x_right = pin_size * 0.6 * (1 - t_right)**1.5
        y_right = pin_size * 0.4 * (1 - t_right) - pin_size * 0.8 * t_right

        t_left = np.linspace(0, 1, n_pts//2)
        x_left = -pin_size * 0.6 * t_left**1.5
        y_left = -pin_size * 0.8 * (1 - t_left) + pin_size * 0.4 * t_left

        # Combine outer shape
        x_outer = np.concatenate([x_top, x_right, x_left])
        y_outer = np.concatenate([y_top, y_right, y_left])

        # Draw teardrop shape
        teardrop = Polygon(np.column_stack([x_outer + center_x, y_outer + center_y]),
                          closed=True, facecolor=pin_color, edgecolor='none', zorder=15)
        ax.add_patch(teardrop)

        # Draw hollow circle on top using background color
        bg_color = theme.get('bg', '#FFFFFF')
        circle_radius = pin_size * 0.25
        circle_y = center_y + pin_size * 0.4
        hollow_circle = Circle((center_x, circle_y), circle_radius,
                               facecolor=bg_color, edgecolor='none', zorder=16)
        ax.add_patch(hollow_circle)

    elif pin_type == 'heart':
        # Heart shape using classic parametric equation
        heart_scale = scale * 0.08

        # Classic heart parametric: x = 16sin³(t), y = 13cos(t) - 5cos(2t) - 2cos(3t) - cos(4t)
        t = np.linspace(0, 2 * np.pi, 100)
        x = heart_scale * 16 * np.sin(t)**3
        y = heart_scale * (13 * np.cos(t) - 5 * np.cos(2*t) - 2 * np.cos(3*t) - np.cos(4*t))

        # Center on map
        x = x + center_x
        y = y + center_y

        heart = Polygon(np.column_stack([x, y]), closed=True,
                       facecolor=pin_color, edgecolor='none',
                       zorder=15)
        ax.add_patch(heart)

    elif pin_type == 'star':
        # 5-pointed star - single solid shape
        star_size = scale * 1.2
        n_points = 5
        outer_angles = np.linspace(np.pi/2, np.pi/2 + 2*np.pi, n_points, endpoint=False)
        inner_angles = outer_angles + np.pi/n_points

        outer_radius = star_size
        inner_radius = star_size * 0.4

        points = []
        for i in range(n_points):
            # Outer point
            points.append([center_x + outer_radius * np.cos(outer_angles[i]),
                          center_y + outer_radius * np.sin(outer_angles[i])])
            # Inner point
            points.append([center_x + inner_radius * np.cos(inner_angles[i]),
                          center_y + inner_radius * np.sin(inner_angles[i])])

        star = Polygon(points, closed=True, facecolor=pin_color, edgecolor='none',
                      zorder=15)
        ax.add_patch(star)

    elif pin_type == 'home':
        # House shape - single unified polygon (body + roof combined)
        house_size = scale * 1.2

        body_width = house_size * 1.2
        body_height = house_size * 0.8
        body_bottom = center_y - house_size * 0.5
        roof_height = house_size * 0.7
        roof_overhang = house_size * 0.15

        # Single polygon: bottom-left -> top-left -> roof-left -> roof-peak -> roof-right -> top-right -> bottom-right
        house_points = [
            (center_x - body_width/2, body_bottom),                           # bottom-left
            (center_x - body_width/2, body_bottom + body_height),             # top-left
            (center_x - body_width/2 - roof_overhang, body_bottom + body_height),  # roof-left
            (center_x, body_bottom + body_height + roof_height),              # roof-peak
            (center_x + body_width/2 + roof_overhang, body_bottom + body_height),  # roof-right
            (center_x + body_width/2, body_bottom + body_height),             # top-right
            (center_x + body_width/2, body_bottom),                           # bottom-right
        ]

        house = Polygon(house_points, closed=True, facecolor=pin_color, edgecolor='none',
                       zorder=15)
        ax.add_patch(house)

    elif pin_type == 'circle':
        # Simple filled circle - single solid shape
        circle = Circle((center_x, center_y), scale * 0.8,
                        facecolor=pin_color, edgecolor='none',
                        zorder=15)
        ax.add_patch(circle)

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


def get_road_buffer_width(highway_type):
    """
    Returns buffer width in meters for converting road lines to polygons.
    These values create closed polygons suitable for laser cutting.
    """
    if highway_type in ['motorway', 'motorway_link']:
        return 12.0  # ~24m total width
    elif highway_type in ['trunk', 'trunk_link', 'primary', 'primary_link']:
        return 8.0   # ~16m total width
    elif highway_type in ['secondary', 'secondary_link']:
        return 6.0   # ~12m total width
    elif highway_type in ['tertiary', 'tertiary_link']:
        return 4.5   # ~9m total width
    elif highway_type in ['residential', 'living_street']:
        return 3.5   # ~7m total width
    else:
        return 2.5   # ~5m total width for minor roads


def fetch_coastline_data(point, dist, progress=None):
    """
    Fetch coastline data from OSM for ocean polygon creation.
    Returns a GeoDataFrame of coastline LineStrings or None if no coastlines found.
    """
    if progress:
        progress({"stage": "coastline", "percent": 55, "message": "Downloading coastline data"})

    spinner = Spinner("[4/4] Downloading coastline data...")
    spinner.start()

    try:
        # Query for coastlines - these are lines where water is on the right side
        coastlines = ox.features_from_point(point, tags={'natural': 'coastline'}, dist=dist)
        spinner.stop("✓ done")
        return coastlines
    except Exception as e:
        spinner.stop(f"⚠ skipped (no coastline)")
        return None


def create_ocean_polygon(coastlines, clip_box, crs):
    """
    Create ocean polygon from coastline data and bounding box.

    OSM coastlines follow the convention that water is on the right-hand side
    of the line when following its direction. This function:
    1. Extracts LineStrings from coastline data
    2. Creates a polygon by "flooding" from edges that touch the bounding box
    3. Uses the coastlines as barriers to determine land vs water

    Returns a shapely Polygon/MultiPolygon representing ocean areas, or None.
    """
    if coastlines is None or coastlines.empty:
        return None

    # Extract only LineString geometries from coastlines
    coast_lines = []
    for geom in coastlines.geometry:
        if geom.geom_type == 'LineString':
            coast_lines.append(geom)
        elif geom.geom_type == 'MultiLineString':
            for line in geom.geoms:
                coast_lines.append(line)

    if not coast_lines:
        return None

    # Merge all coastlines
    merged_coastlines = unary_union(coast_lines)

    # Clip coastlines to bounding box (with small buffer to ensure intersection)
    clipped_coastlines = merged_coastlines.intersection(clip_box.buffer(1))

    if clipped_coastlines.is_empty:
        return None

    try:
        # Strategy: Split the bounding box using coastlines
        # The resulting polygons are either land or water
        # We identify water polygons by checking if they touch the bbox edges
        # (since oceans extend to the edge of the map)

        # Create a slightly buffered version of coastlines for splitting
        coast_buffer = clipped_coastlines.buffer(0.1)  # Small buffer for robustness

        # Try to split the bbox by the coastlines
        # First, create lines from the coastlines
        if clipped_coastlines.geom_type == 'LineString':
            split_lines = [clipped_coastlines]
        elif clipped_coastlines.geom_type == 'MultiLineString':
            split_lines = list(clipped_coastlines.geoms)
        else:
            split_lines = []

        if not split_lines:
            return None

        # Create the boundary of the clip box
        bbox_boundary = clip_box.boundary

        # Combine coastlines with bbox boundary to create closed regions
        all_lines = unary_union([bbox_boundary] + split_lines)

        # Polygonize to get all enclosed regions
        polygons = list(polygonize(all_lines))

        if not polygons:
            return None

        # Determine which polygons are water (ocean)
        # Heuristic: Polygons that touch the bbox boundary are likely ocean
        # if coastlines separate them from the center
        ocean_polygons = []
        bbox_center = clip_box.centroid

        for poly in polygons:
            # Check if polygon is outside the coastlines (water side)
            # by checking if it shares significant boundary with the bbox edge
            # but is separated from center by coastlines

            poly_boundary = poly.boundary
            shared_with_bbox = poly_boundary.intersection(bbox_boundary)

            # If significant boundary is shared with bbox, check if it's water
            if not shared_with_bbox.is_empty:
                shared_length = shared_with_bbox.length if hasattr(shared_with_bbox, 'length') else 0
                if shared_length > 0:
                    # Check if coastline separates this polygon from center
                    # by seeing if the line from poly centroid to bbox center crosses coastlines
                    poly_center = poly.centroid
                    line_to_center = LineString([poly_center, bbox_center])

                    if clipped_coastlines.intersects(line_to_center):
                        # Coastline separates this polygon from center - it's likely ocean
                        ocean_polygons.append(poly)

        if ocean_polygons:
            ocean = unary_union(ocean_polygons)
            # Clip to bbox to ensure clean edges
            ocean = ocean.intersection(clip_box)
            return ocean if not ocean.is_empty else None

        return None

    except Exception as e:
        log(f"  Warning: Could not create ocean polygon: {e}")
        return None


def geometry_to_svg_path(geom, transform_func=None):
    """
    Convert a shapely geometry to SVG path data.
    Returns a string suitable for the 'd' attribute of an SVG path.
    """
    def coords_to_path(coords, close=True):
        if not coords:
            return ""
        points = list(coords)
        if transform_func:
            points = [transform_func(p) for p in points]
        if not points:
            return ""
        path = f"M {points[0][0]:.2f},{points[0][1]:.2f}"
        for p in points[1:]:
            path += f" L {p[0]:.2f},{p[1]:.2f}"
        if close:
            path += " Z"
        return path

    if geom.is_empty:
        return ""

    if geom.geom_type == 'Polygon':
        # Exterior ring
        path = coords_to_path(geom.exterior.coords)
        # Interior rings (holes)
        for interior in geom.interiors:
            path += " " + coords_to_path(interior.coords)
        return path
    elif geom.geom_type == 'MultiPolygon':
        paths = []
        for poly in geom.geoms:
            p = geometry_to_svg_path(poly, transform_func)
            if p:
                paths.append(p)
        return " ".join(paths)
    elif geom.geom_type == 'LineString':
        return coords_to_path(geom.coords, close=False)
    elif geom.geom_type == 'MultiLineString':
        paths = []
        for line in geom.geoms:
            p = coords_to_path(line.coords, close=False)
            if p:
                paths.append(p)
        return " ".join(paths)
    return ""


def export_laser_svg(output_file, G_proj, water, parks, coastlines, crop_xlim, crop_ylim, city, country, theme, point):
    """
    Export map as layered SVG optimized for laser cutting.

    Creates separate layers for:
    - Background (frame/border)
    - Ocean (coastal water from coastlines)
    - Water features (inland lakes, rivers - closed polygons)
    - Parks/green spaces (closed polygons)
    - Roads by type (buffered to closed polygons)
    - Text elements

    All elements are closed polygons suitable for laser cutting.
    Uses Inkscape-compatible layer groups.
    """
    log("Generating laser-cut optimized SVG...")

    # SVG dimensions (in mm for laser cutting)
    width_mm = 300  # A3-ish width
    height_mm = 400  # Poster aspect ratio

    # Calculate transform from map coordinates to SVG coordinates
    map_width = crop_xlim[1] - crop_xlim[0]
    map_height = crop_ylim[1] - crop_ylim[0]

    # Scale to fit, maintaining aspect ratio
    scale_x = width_mm / map_width
    scale_y = height_mm / map_height
    scale = min(scale_x, scale_y)

    # Center the map
    svg_map_width = map_width * scale
    svg_map_height = map_height * scale
    offset_x = (width_mm - svg_map_width) / 2
    offset_y = (height_mm - svg_map_height) / 2

    def transform(coord):
        """Transform map coordinates to SVG coordinates (Y flipped)."""
        x = (coord[0] - crop_xlim[0]) * scale + offset_x
        y = height_mm - ((coord[1] - crop_ylim[0]) * scale + offset_y)
        return (x, y)

    # Create clipping box
    clip_box = box(crop_xlim[0], crop_ylim[0], crop_xlim[1], crop_ylim[1])

    # Collect roads by type
    road_layers = {
        'motorway': [],
        'primary': [],
        'secondary': [],
        'tertiary': [],
        'residential': [],
        'minor': []
    }

    log("  Processing roads into polygons...")
    for u, v, data in G_proj.edges(data=True):
        highway = data.get('highway', 'unclassified')
        if isinstance(highway, list):
            highway = highway[0] if highway else 'unclassified'

        # Get geometry
        if 'geometry' in data:
            line = data['geometry']
        else:
            # Create line from node coordinates
            u_data = G_proj.nodes[u]
            v_data = G_proj.nodes[v]
            line = LineString([(u_data['x'], u_data['y']), (v_data['x'], v_data['y'])])

        # Buffer the line to create a polygon
        buffer_width = get_road_buffer_width(highway)
        road_poly = line.buffer(buffer_width, cap_style=2, join_style=2)  # flat caps, mitre joins

        # Clip to bounds
        try:
            road_poly = road_poly.intersection(clip_box)
        except:
            continue

        if road_poly.is_empty:
            continue

        # Categorize
        if highway in ['motorway', 'motorway_link']:
            road_layers['motorway'].append(road_poly)
        elif highway in ['trunk', 'trunk_link', 'primary', 'primary_link']:
            road_layers['primary'].append(road_poly)
        elif highway in ['secondary', 'secondary_link']:
            road_layers['secondary'].append(road_poly)
        elif highway in ['tertiary', 'tertiary_link']:
            road_layers['tertiary'].append(road_poly)
        elif highway in ['residential', 'living_street']:
            road_layers['residential'].append(road_poly)
        else:
            road_layers['minor'].append(road_poly)

    # Merge overlapping roads in each layer
    log("  Merging road polygons...")
    for layer_name in road_layers:
        if road_layers[layer_name]:
            try:
                road_layers[layer_name] = unary_union(road_layers[layer_name])
            except:
                pass

    # Process water
    water_geom = None
    if water is not None and not water.empty:
        log("  Processing water features...")
        water_polys = []
        for geom in water.geometry:
            if geom.geom_type in ['Polygon', 'MultiPolygon']:
                try:
                    clipped = geom.intersection(clip_box)
                    if not clipped.is_empty:
                        water_polys.append(clipped)
                except:
                    pass
        if water_polys:
            water_geom = unary_union(water_polys)

    # Process parks
    parks_geom = None
    if parks is not None and not parks.empty:
        log("  Processing park features...")
        parks_polys = []
        for geom in parks.geometry:
            if geom.geom_type in ['Polygon', 'MultiPolygon']:
                try:
                    clipped = geom.intersection(clip_box)
                    if not clipped.is_empty:
                        parks_polys.append(clipped)
                except:
                    pass
        if parks_polys:
            parks_geom = unary_union(parks_polys)

    # Process ocean (from coastlines)
    ocean_geom = None
    if coastlines is not None and not coastlines.empty:
        log("  Processing coastline for ocean polygon...")
        # Project coastlines to same CRS as graph
        try:
            coastlines_proj = ox.projection.project_gdf(coastlines)
        except Exception:
            try:
                coastlines_proj = coastlines.to_crs(G_proj.graph['crs'])
            except:
                coastlines_proj = coastlines

        ocean_geom = create_ocean_polygon(coastlines_proj, clip_box, G_proj.graph.get('crs'))
        if ocean_geom:
            log("    ✓ Ocean polygon created")
        else:
            log("    ⚠ No ocean polygon could be created (city may not be coastal)")

    # Build SVG
    log("  Writing SVG file...")

    # SVG header with Inkscape namespace for layers
    svg_parts = [
        f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
     width="{width_mm}mm" height="{height_mm}mm"
     viewBox="0 0 {width_mm} {height_mm}">
  <title>{city}, {country} - Laser Cut Map</title>
  <desc>Generated by Maptoposter for laser cutting. Each layer contains closed polygons.</desc>
'''
    ]

    # Layer: Frame/Border
    svg_parts.append(f'''
  <g inkscape:groupmode="layer" inkscape:label="01_Frame" id="layer_frame">
    <rect x="0" y="0" width="{width_mm}" height="{height_mm}"
          fill="none" stroke="{theme.get('text', '#000000')}" stroke-width="0.5"/>
  </g>
''')

    # Layer: Ocean (from coastlines - larger water bodies that extend to map edges)
    if ocean_geom and not ocean_geom.is_empty:
        path_data = geometry_to_svg_path(ocean_geom, transform)
        if path_data:
            # Use a slightly different shade for ocean vs inland water for visual distinction
            ocean_color = theme.get('ocean', theme.get('water', '#C0C0C0'))
            svg_parts.append(f'''
  <g inkscape:groupmode="layer" inkscape:label="02_Ocean" id="layer_ocean">
    <path d="{path_data}" fill="{ocean_color}" stroke="none"/>
  </g>
''')

    # Layer: Water (inland lakes, rivers)
    if water_geom and not water_geom.is_empty:
        path_data = geometry_to_svg_path(water_geom, transform)
        if path_data:
            svg_parts.append(f'''
  <g inkscape:groupmode="layer" inkscape:label="03_Water" id="layer_water">
    <path d="{path_data}" fill="{theme.get('water', '#C0C0C0')}" stroke="none"/>
  </g>
''')

    # Layer: Parks
    if parks_geom and not parks_geom.is_empty:
        path_data = geometry_to_svg_path(parks_geom, transform)
        if path_data:
            svg_parts.append(f'''
  <g inkscape:groupmode="layer" inkscape:label="04_Parks" id="layer_parks">
    <path d="{path_data}" fill="{theme.get('parks', '#F0F0F0')}" stroke="none"/>
  </g>
''')

    # Road layers (from minor to major, so major roads are on top)
    road_layer_config = [
        ('minor', '05_Roads_Minor', theme.get('road_default', '#3A3A3A')),
        ('residential', '06_Roads_Residential', theme.get('road_residential', '#4A4A4A')),
        ('tertiary', '07_Roads_Tertiary', theme.get('road_tertiary', '#3A3A3A')),
        ('secondary', '08_Roads_Secondary', theme.get('road_secondary', '#2A2A2A')),
        ('primary', '09_Roads_Primary', theme.get('road_primary', '#1A1A1A')),
        ('motorway', '10_Roads_Motorway', theme.get('road_motorway', '#0A0A0A')),
    ]

    for layer_key, layer_name, color in road_layer_config:
        geom = road_layers.get(layer_key)
        if geom and not (hasattr(geom, 'is_empty') and geom.is_empty):
            # Handle both single geometry and list
            if isinstance(geom, list):
                if not geom:
                    continue
                geom = unary_union(geom)
            path_data = geometry_to_svg_path(geom, transform)
            if path_data:
                svg_parts.append(f'''
  <g inkscape:groupmode="layer" inkscape:label="{layer_name}" id="layer_{layer_key}">
    <path d="{path_data}" fill="{color}" stroke="none"/>
  </g>
''')

    # Layer: Text (as paths would require font rendering, so we use text elements)
    lat, lon = point
    coords_text = f"{lat:.4f}°N / {lon:.4f}°E" if lat >= 0 else f"{abs(lat):.4f}°S / {lon:.4f}°E"
    if lon < 0:
        coords_text = coords_text.replace("E", "W")

    text_y_city = height_mm - 25
    text_y_country = height_mm - 15
    text_y_coords = height_mm - 8

    svg_parts.append(f'''
  <g inkscape:groupmode="layer" inkscape:label="11_Text" id="layer_text">
    <text x="{width_mm/2}" y="{text_y_city}"
          font-family="Roboto, Arial, sans-serif" font-size="14" font-weight="bold"
          text-anchor="middle" fill="{theme.get('text', '#000000')}">{city.upper()}</text>
    <text x="{width_mm/2}" y="{text_y_country}"
          font-family="Roboto, Arial, sans-serif" font-size="8"
          text-anchor="middle" fill="{theme.get('text', '#000000')}">{country.upper()}</text>
    <text x="{width_mm/2}" y="{text_y_coords}"
          font-family="Roboto, Arial, sans-serif" font-size="5"
          text-anchor="middle" fill="{theme.get('text', '#000000')}" opacity="0.7">{coords_text}</text>
    <line x1="{width_mm*0.35}" y1="{text_y_city + 3}" x2="{width_mm*0.65}" y2="{text_y_city + 3}"
          stroke="{theme.get('text', '#000000')}" stroke-width="0.3"/>
  </g>
''')

    # Close SVG
    svg_parts.append('</svg>')

    # Write file
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(''.join(svg_parts))

    log(f"  ✓ Laser-cut SVG saved: {output_file}")
    log(f"    Dimensions: {width_mm}mm x {height_mm}mm")
    log(f"    Layers: Frame, Ocean, Water, Parks, 6 road types, Text")


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

def create_poster(city, country, point, dist, output_file, output_format='png', dpi=300, progress=None, use_cache=True, font_family=None, tagline=None, pin=None, pin_color=None):
    log(f"\nGenerating map for {city}, {country}...")
    log("")

    # Check for cached map data first
    cache_key = get_cache_key(point[0], point[1], dist)
    cached_data = load_map_cache(cache_key) if use_cache else None

    if cached_data:
        # Use cached data - skip all API calls
        G, water, parks, coastlines = cached_data
        log("✓ Using cached map data (no API calls needed)\n")
        if progress:
            progress({"stage": "network", "percent": 20, "message": "Loading from cache"})
            progress({"stage": "water", "percent": 40, "message": "Loading from cache"})
            progress({"stage": "parks", "percent": 55, "message": "Loading from cache"})
            progress({"stage": "coastline", "percent": 60, "message": "Loaded from cache"})
    else:
        # Fetch fresh data from API
        log("No cache found, downloading from OpenStreetMap...\n")

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
            progress({"stage": "parks", "percent": 45, "message": "Downloading parks/green spaces"})
        parks = None
        spinner = Spinner("[3/4] Downloading parks/green spaces...")
        spinner.start()
        try:
            parks = ox.features_from_point(point, tags={'leisure': 'park', 'landuse': 'grass'}, dist=dist)
            spinner.stop("✓ done")
        except Exception as e:
            spinner.stop(f"⚠ skipped (no data)")
        if progress:
            progress({"stage": "parks", "percent": 52, "message": "Parks downloaded"})
        time.sleep(0.3)

        # 4. Fetch Coastlines (for ocean polygons in coastal cities)
        coastlines = fetch_coastline_data(point, dist, progress=progress)
        if progress:
            progress({"stage": "coastline", "percent": 60, "message": "Coastline data processed"})

        # Save to cache for next time
        save_map_cache(cache_key, G, water, parks, coastlines)
        log("\n✓ All data downloaded and cached!\n")

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

    # Pre-calculate crop limits for ocean polygon
    crop_xlim, crop_ylim = get_crop_limits(G_proj, fig)

    # 3. Plot Layers
    # Layer 0: Ocean (from coastlines - creates land/water boundary)
    if coastlines is not None and not coastlines.empty:
        try:
            # Project coastlines to same CRS as graph
            try:
                coastlines_proj = ox.projection.project_gdf(coastlines)
            except Exception:
                try:
                    coastlines_proj = coastlines.to_crs(G_proj.graph['crs'])
                except Exception:
                    coastlines_proj = coastlines

            # Create clip box from crop limits
            clip_box = box(crop_xlim[0], crop_ylim[0], crop_xlim[1], crop_ylim[1])

            # Create ocean polygon
            ocean_geom = create_ocean_polygon(coastlines_proj, clip_box, G_proj.graph.get('crs'))

            if ocean_geom is not None and not ocean_geom.is_empty:
                # Create a GeoDataFrame for plotting
                ocean_gdf = gpd.GeoDataFrame(geometry=[ocean_geom], crs=G_proj.graph.get('crs'))
                ocean_gdf.plot(ax=ax, facecolor=THEME['water'], edgecolor='none', zorder=0)
        except Exception as e:
            log(f"  Note: Could not render ocean polygon: {e}")

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
    
    # 4. Typography - use selected font family or default
    selected_fonts = get_font_family(font_family) if font_family else FONTS
    log(f"Font family requested: {font_family}, resolved fonts: {selected_fonts}")

    if selected_fonts:
        # Get font paths, with fallbacks for missing weights
        bold_font = selected_fonts.get('bold') or selected_fonts.get('regular')
        regular_font = selected_fonts.get('regular') or selected_fonts.get('bold')
        light_font = selected_fonts.get('light') or selected_fonts.get('regular') or selected_fonts.get('bold')

        font_main = FontProperties(fname=bold_font, size=60)
        font_top = FontProperties(fname=bold_font, size=40)
        font_sub = FontProperties(fname=light_font, size=22)
        font_coords = FontProperties(fname=regular_font, size=14)
        log(f"Using font_coords with regular_font: {regular_font}")
    else:
        # Fallback to system fonts
        log("WARNING: No custom fonts available, falling back to monospace")
        font_main = FontProperties(family='monospace', weight='bold', size=60)
        font_top = FontProperties(family='monospace', weight='bold', size=40)
        font_sub = FontProperties(family='monospace', weight='normal', size=22)
        font_coords = FontProperties(family='monospace', size=14)

    spaced_city = "  ".join(list(city.upper()))

    # Dynamically adjust font size based on city name length to prevent truncation
    base_font_size = 60
    city_char_count = len(city)
    if city_char_count > 10:
        # Scale down font size for longer names
        scale_factor = 10 / city_char_count
        adjusted_font_size = max(base_font_size * scale_factor, 24)  # Minimum size of 24
    else:
        adjusted_font_size = base_font_size

    if selected_fonts:
        bold_font = selected_fonts.get('bold') or selected_fonts.get('regular')
        font_main_adjusted = FontProperties(fname=bold_font, size=adjusted_font_size)
    else:
        font_main_adjusted = FontProperties(family='monospace', weight='bold', size=adjusted_font_size)

    # --- BOTTOM TEXT ---
    ax.text(0.5, 0.14, spaced_city, transform=ax.transAxes,
            color=THEME['text'], ha='center', fontproperties=font_main_adjusted, zorder=11)
    
    ax.text(0.5, 0.10, country.upper(), transform=ax.transAxes,
            color=THEME['text'], ha='center', fontproperties=font_sub, zorder=11)
    
    # Third line: custom tagline or coordinates
    if tagline:
        third_line = tagline
    else:
        lat, lon = point
        coords = f"{lat:.4f}° N / {lon:.4f}° E" if lat >= 0 else f"{abs(lat):.4f}° S / {lon:.4f}° E"
        if lon < 0:
            coords = coords.replace("E", "W")
        third_line = coords

    ax.text(0.5, 0.07, third_line, transform=ax.transAxes,
            color=THEME['text'], alpha=0.7, ha='center', fontproperties=font_coords, zorder=11)
    
    ax.plot([0.4, 0.6], [0.125, 0.125], transform=ax.transAxes,
            color=THEME['text'], linewidth=1, zorder=11)

    # 5. Center Pin Icon (if selected)
    if pin:
        draw_center_pin(ax, crop_xlim, crop_ylim, pin, THEME, pin_color=pin_color)

    spinner.stop("✓ done")

    # 6. Save
    if progress:
        progress({"stage": "save", "percent": 90, "message": "Saving poster"})

    fmt = output_format.lower()

    # Handle laser-cut SVG format separately
    if fmt == "svg-laser":
        plt.close()  # Don't need the matplotlib figure for laser export
        spinner = Spinner(f"Generating laser-cut SVG: {output_file}...")
        spinner.start()
        try:
            export_laser_svg(output_file, G_proj, water, parks, coastlines, crop_xlim, crop_ylim, city, country, THEME, point)
            spinner.stop("✓ done")
        except Exception as e:
            spinner.stop(f"✗ failed: {e}")
            raise
    else:
        # Standard matplotlib export (png, svg, pdf)
        spinner = Spinner(f"Saving to {output_file} ({fmt.upper()}, {dpi} DPI)...")
        spinner.start()

        save_kwargs = dict(facecolor=THEME["bg"], bbox_inches="tight", pad_inches=0.05)

        # DPI matters mainly for raster formats (PNG)
        if fmt == "png":
            save_kwargs["dpi"] = dpi

        plt.savefig(output_file, format=fmt if fmt != "svg-laser" else "svg", **save_kwargs)

        # Generate thumbnail for gallery (low DPI PNG)
        thumb_file = output_file.rsplit('.', 1)[0] + '_thumb.png'
        thumb_kwargs = dict(facecolor=THEME["bg"], bbox_inches="tight", pad_inches=0.02, dpi=72)
        plt.savefig(thumb_file, format='png', **thumb_kwargs)

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
    parser.add_argument('--format', '-f', default='png', choices=['png', 'svg', 'pdf', 'svg-laser'],
                        help='Output format: png, svg, pdf, or svg-laser (layered SVG for laser cutting)')
    parser.add_argument('--clear-cache', action='store_true', help='Clear all cached map data')
    parser.add_argument('--no-cache', action='store_true', help='Skip cache and always download fresh data')

    args = parser.parse_args()

    # If no arguments provided, show examples
    if len(sys.argv) == 1:
        print_examples()
        sys.exit(0)

    # Clear cache if requested
    if args.clear_cache:
        clear_map_cache()
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
        output_file = generate_output_filename(args.city, args.theme, args.format)
        create_poster(args.city, args.country, coords, args.distance, output_file, args.format, dpi=args.dpi, use_cache=not args.no_cache)
        
        print("\n" + "=" * 50)
        print("✓ Poster generation complete!")
        print("=" * 50)
        
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
