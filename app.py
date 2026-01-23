import glob
import json
import os
import queue
import threading
import uuid
import subprocess
import sys
import time

from flask import Flask, Response, jsonify, render_template, request, send_from_directory

os.environ.setdefault("MPLBACKEND", "Agg")

import create_map_poster as poster
import mockup_generator


app = Flask(__name__, static_folder="static", template_folder="templates")

JOBS = {}
JOBS_LOCK = threading.Lock()
JOB_QUEUE = queue.Queue()
WORKER_STARTED = False
MAX_CONCURRENT_JOBS = 1  # Can be increased for multi-worker setup


def load_theme_catalog():
    themes = []
    for theme_name in poster.get_available_themes():
        theme_path = os.path.join(poster.THEMES_DIR, f"{theme_name}.json")
        try:
            with open(theme_path, "r") as handle:
                theme_data = json.load(handle)
        except Exception:
            theme_data = {}
        themes.append(
            {
                "id": theme_name,
                "name": theme_data.get("name", theme_name),
                "description": theme_data.get("description", ""),
                "category": theme_data.get("category", "other"),
                "colors": {
                    "bg": theme_data.get("bg", "#FFFFFF"),
                    "text": theme_data.get("text", "#111111"),
                    "water": theme_data.get("water", "#C0C0C0"),
                    "parks": theme_data.get("parks", "#F0F0F0"),
                    "road_motorway": theme_data.get("road_motorway", theme_data.get("road_primary", "#1A1A1A")),
                    "road_primary": theme_data.get("road_primary", "#1A1A1A"),
                    "road_secondary": theme_data.get("road_secondary", "#2A2A2A"),
                    "road_tertiary": theme_data.get("road_tertiary", "#3A3A3A"),
                },
            }
        )
    return themes


def push_event(job_id, payload):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if not job:
            return
        if "status" in payload:
            job["status"] = payload["status"]
        if "stage" in payload:
            job["stage"] = payload["stage"]
        if "percent" in payload:
            job["progress"] = payload["percent"]
        if "message" in payload:
            job["message"] = payload["message"]
        if "output" in payload:
            job["output"] = payload["output"]
        if "output_url" in payload:
            job["output_url"] = payload["output_url"]
        if "error" in payload:
            job["error"] = payload["error"]
        event = {
            "status": job["status"],
            "stage": job["stage"],
            "percent": job["progress"],
            "message": job["message"],
            "output": job["output"],
            "output_url": job["output_url"],
            "error": job["error"],
        }
        job["queue"].put(event)


def run_job(job_id, city, country, theme, distance, dpi, output_format, lat=None, lng=None, font=None, tagline=None, pin=None, pin_color=None, aspect_ratio="2:3", collection=None):
    def progress(info):
        payload = dict(info)
        payload["status"] = "running"
        push_event(job_id, payload)

    try:
        push_event(
            job_id,
            {
                "status": "running",
                "stage": "queued",
                "percent": 0,
                "message": "Preparing map generation",
            },
        )

        available_themes = poster.get_available_themes()
        if theme not in available_themes:
            raise ValueError(
                f"Theme '{theme}' not found. Available themes: {', '.join(available_themes)}"
            )

        poster.THEME = poster.load_theme(theme)

        # Use direct coordinates if provided, otherwise geocode city/country
        if lat is not None and lng is not None:
            coords = (lat, lng)
            progress({"stage": "geocode", "percent": 10, "message": "Using provided coordinates"})
        else:
            coords = poster.get_coordinates(city, country, progress=progress)

        output_file = poster.generate_output_filename(city, theme, output_format)
        poster.create_poster(
            city, country, coords, distance, output_file, output_format, dpi=dpi, progress=progress, font_family=font, tagline=tagline, pin=pin, pin_color=pin_color, aspect_ratio=aspect_ratio
        )

        # Save config JSON for this poster
        config = {
            "city": city,
            "country": country,
            "lat": coords[0],
            "lng": coords[1],
            "distance": distance,
            "theme": theme,
            "font": font,
            "dpi": dpi,
            "format": output_format,
            "tagline": tagline,
            "pin": pin,
            "pin_color": pin_color,
            "aspect_ratio": aspect_ratio,
            "collection": collection,
            "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        }
        config_file = output_file.rsplit('.', 1)[0] + '_config.json'
        with open(config_file, 'w') as f:
            json.dump(config, f, indent=2)

        output_url = f"/posters/{os.path.basename(output_file)}"
        thumb_url = f"/posters/{os.path.basename(output_file).rsplit('.', 1)[0]}_thumb.png"
        push_event(
            job_id,
            {
                "status": "done",
                "stage": "done",
                "percent": 100,
                "message": "Poster ready",
                "output": output_file,
                "output_url": output_url,
                "thumb_url": thumb_url,
            },
        )
    except Exception as exc:
        push_event(
            job_id,
            {
                "status": "error",
                "stage": "error",
                "percent": 100,
                "message": "Generation failed",
                "error": str(exc),
            },
        )


def job_worker():
    while True:
        job_id = JOB_QUEUE.get()
        try:
            with JOBS_LOCK:
                job = JOBS.get(job_id)
            if not job:
                continue
            if job["status"] != "queued":
                continue
            run_job(
                job_id,
                job["city"],
                job["country"],
                job["theme"],
                job["distance"],
                job["dpi"],
                job["format"],
                lat=job.get("lat"),
                lng=job.get("lng"),
                font=job.get("font"),
                tagline=job.get("tagline"),
                pin=job.get("pin"),
                pin_color=job.get("pin_color"),
                aspect_ratio=job.get("aspect_ratio", "2:3"),
                collection=job.get("collection"),
            )
        finally:
            JOB_QUEUE.task_done()


def ensure_worker():
    global WORKER_STARTED
    if WORKER_STARTED:
        return
    worker = threading.Thread(target=job_worker, daemon=True)
    worker.start()
    WORKER_STARTED = True


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/font-samples")
def font_samples():
    return render_template("font-samples.html")


@app.route("/theme-samples")
def theme_samples():
    return render_template("theme-samples.html")


@app.route("/api/themes")
def api_themes():
    return jsonify(load_theme_catalog())


@app.route("/api/themes/categories")
def api_theme_categories():
    """Return list of valid theme categories."""
    return jsonify([
        "dark", "light", "nature", "urban", "vintage",
        "vibrant", "pastel", "luxury", "monochrome", "cultural", "other"
    ])


@app.route("/api/themes/<theme_id>", methods=["GET"])
def api_theme_get(theme_id):
    """Get a single theme by ID."""
    safe_id = os.path.basename(theme_id)
    theme_path = os.path.join(poster.THEMES_DIR, f"{safe_id}.json")

    if not os.path.exists(theme_path):
        return jsonify({"error": "Theme not found"}), 404

    try:
        with open(theme_path, "r", encoding="utf-8") as f:
            theme_data = json.load(f)
        theme_data["id"] = safe_id
        return jsonify(theme_data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/themes", methods=["POST"])
def api_theme_create():
    """Create a new theme."""
    payload = request.get_json(silent=True) or {}

    name = (payload.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Theme name is required"}), 400

    # Generate ID from name
    theme_id = name.lower().replace(" ", "_")
    theme_id = "".join(c for c in theme_id if c.isalnum() or c == "_")
    theme_id = theme_id[:50]

    if not theme_id:
        return jsonify({"error": "Invalid theme name"}), 400

    theme_path = os.path.join(poster.THEMES_DIR, f"{theme_id}.json")

    # Check if already exists
    if os.path.exists(theme_path):
        return jsonify({"error": "A theme with this name already exists"}), 409

    # Build theme data
    theme_data = {
        "name": name,
        "description": payload.get("description", ""),
        "category": payload.get("category", "other"),
        "bg": payload.get("bg", "#FFFFFF"),
        "text": payload.get("text", "#000000"),
        "gradient_color": payload.get("gradient_color", "#FFFFFF"),
        "water": payload.get("water", "#C0C0C0"),
        "parks": payload.get("parks", "#F0F0F0"),
        "road_motorway": payload.get("road_motorway", "#0A0A0A"),
        "road_primary": payload.get("road_primary", "#1A1A1A"),
        "road_secondary": payload.get("road_secondary", "#2A2A2A"),
        "road_tertiary": payload.get("road_tertiary", "#3A3A3A"),
        "road_residential": payload.get("road_residential", "#4A4A4A"),
        "road_default": payload.get("road_default", "#3A3A3A"),
    }

    try:
        with open(theme_path, "w", encoding="utf-8") as f:
            json.dump(theme_data, f, indent=2)
        return jsonify({"ok": True, "id": theme_id, "name": name})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/themes/<theme_id>", methods=["PUT"])
def api_theme_update(theme_id):
    """Update an existing theme."""
    safe_id = os.path.basename(theme_id)
    theme_path = os.path.join(poster.THEMES_DIR, f"{safe_id}.json")

    if not os.path.exists(theme_path):
        return jsonify({"error": "Theme not found"}), 404

    payload = request.get_json(silent=True) or {}

    # Load existing theme to preserve any extra fields
    try:
        with open(theme_path, "r", encoding="utf-8") as f:
            theme_data = json.load(f)
    except Exception:
        theme_data = {}

    # Update fields
    if "name" in payload:
        theme_data["name"] = payload["name"]
    if "description" in payload:
        theme_data["description"] = payload["description"]
    if "category" in payload:
        theme_data["category"] = payload["category"]

    # Color fields
    color_fields = [
        "bg", "text", "gradient_color", "water", "parks",
        "road_motorway", "road_primary", "road_secondary",
        "road_tertiary", "road_residential", "road_default"
    ]
    for field in color_fields:
        if field in payload:
            theme_data[field] = payload[field]

    try:
        with open(theme_path, "w", encoding="utf-8") as f:
            json.dump(theme_data, f, indent=2)
        return jsonify({"ok": True, "id": safe_id})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/themes/<theme_id>", methods=["DELETE"])
def api_theme_delete(theme_id):
    """Delete a theme."""
    safe_id = os.path.basename(theme_id)
    theme_path = os.path.join(poster.THEMES_DIR, f"{safe_id}.json")

    if not os.path.exists(theme_path):
        return jsonify({"error": "Theme not found"}), 404

    try:
        os.remove(theme_path)
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/themes/<theme_id>/duplicate", methods=["POST"])
def api_theme_duplicate(theme_id):
    """Duplicate a theme with a new name."""
    safe_id = os.path.basename(theme_id)
    theme_path = os.path.join(poster.THEMES_DIR, f"{safe_id}.json")

    if not os.path.exists(theme_path):
        return jsonify({"error": "Theme not found"}), 404

    payload = request.get_json(silent=True) or {}
    new_name = (payload.get("name") or f"{safe_id}_copy").strip()

    # Generate new ID
    new_id = new_name.lower().replace(" ", "_")
    new_id = "".join(c for c in new_id if c.isalnum() or c == "_")
    new_id = new_id[:50]

    if not new_id:
        return jsonify({"error": "Invalid theme name"}), 400

    new_path = os.path.join(poster.THEMES_DIR, f"{new_id}.json")

    # Ensure unique ID
    counter = 1
    while os.path.exists(new_path):
        new_id = f"{new_id}_{counter}"
        new_path = os.path.join(poster.THEMES_DIR, f"{new_id}.json")
        counter += 1

    try:
        with open(theme_path, "r", encoding="utf-8") as f:
            theme_data = json.load(f)

        theme_data["name"] = new_name

        with open(new_path, "w", encoding="utf-8") as f:
            json.dump(theme_data, f, indent=2)

        return jsonify({"ok": True, "id": new_id, "name": new_name})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/editor")
def theme_editor():
    """Serve the theme editor page."""
    return render_template("theme-editor.html")


@app.route("/api/editor-preview-svg")
def api_editor_preview_svg():
    """
    Generate a real map SVG preview from cached geometry.
    Uses a sample cached map for the preview.
    """
    import pickle
    import io
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    from matplotlib.patches import Rectangle, Polygon as MplPolygon
    import osmnx as ox

    # Find a good sample cached map
    cache_dir = os.path.join(os.path.dirname(__file__), "cache", "map_data")
    cache_files = glob.glob(os.path.join(cache_dir, "*.pkl"))

    if not cache_files:
        return jsonify({"error": "No cached maps available"}), 404

    # Prefer a medium-sized map (around 5000m)
    sample_file = None
    for f in cache_files:
        if "_5000_" in f or "_4000_" in f or "_6000_" in f:
            sample_file = f
            break
    if not sample_file:
        sample_file = cache_files[0]

    # Load cached geometry
    try:
        with open(sample_file, "rb") as f:
            data = pickle.load(f)
        graph = data["graph"]
        water = data.get("water")
        parks = data.get("parks")
    except Exception as e:
        return jsonify({"error": f"Failed to load cache: {e}"}), 500

    # Create figure
    fig, ax = plt.subplots(figsize=(6, 8))
    ax.set_aspect('equal')
    ax.axis('off')

    # Get bounds from graph
    nodes = ox.graph_to_gdfs(graph, edges=False)
    minx, miny, maxx, maxy = nodes.total_bounds
    padding = (maxx - minx) * 0.02
    ax.set_xlim(minx - padding, maxx + padding)
    ax.set_ylim(miny - padding, maxy + padding)

    # Draw background with gid
    bg = Rectangle((minx - padding, miny - padding),
                   (maxx - minx) + 2*padding, (maxy - miny) + 2*padding,
                   facecolor='#FFFFFF', edgecolor='none', zorder=0)
    bg.set_gid('preview-bg')
    ax.add_patch(bg)

    # Draw water
    if water is not None and len(water) > 0:
        for idx, (_, row) in enumerate(water.iterrows()):
            geom = row.geometry
            if geom.geom_type == 'Polygon':
                patch = MplPolygon(list(geom.exterior.coords), closed=True,
                                  facecolor='#C0C0C0', edgecolor='none', zorder=1)
                patch.set_gid(f'preview-water-{idx}')
                ax.add_patch(patch)
            elif geom.geom_type == 'MultiPolygon':
                for j, poly in enumerate(geom.geoms):
                    patch = MplPolygon(list(poly.exterior.coords), closed=True,
                                      facecolor='#C0C0C0', edgecolor='none', zorder=1)
                    patch.set_gid(f'preview-water-{idx}-{j}')
                    ax.add_patch(patch)

    # Draw parks
    if parks is not None and len(parks) > 0:
        for idx, (_, row) in enumerate(parks.iterrows()):
            geom = row.geometry
            if geom.geom_type == 'Polygon':
                patch = MplPolygon(list(geom.exterior.coords), closed=True,
                                  facecolor='#F0F0F0', edgecolor='none', zorder=2)
                patch.set_gid(f'preview-parks-{idx}')
                ax.add_patch(patch)
            elif geom.geom_type == 'MultiPolygon':
                for j, poly in enumerate(geom.geoms):
                    patch = MplPolygon(list(poly.exterior.coords), closed=True,
                                      facecolor='#F0F0F0', edgecolor='none', zorder=2)
                    patch.set_gid(f'preview-parks-{idx}-{j}')
                    ax.add_patch(patch)

    # Draw roads by type with different gids
    road_types = {
        'motorway': (['motorway', 'motorway_link'], 2.5, '#0A0A0A'),
        'primary': (['trunk', 'trunk_link', 'primary', 'primary_link'], 1.8, '#1A1A1A'),
        'secondary': (['secondary', 'secondary_link'], 1.2, '#2A2A2A'),
        'tertiary': (['tertiary', 'tertiary_link'], 0.8, '#3A3A3A'),
        'residential': (['residential', 'living_street', 'unclassified'], 0.5, '#4A4A4A'),
    }

    edges = ox.graph_to_gdfs(graph, nodes=False)

    for road_name, (types, width, color) in road_types.items():
        road_edges = edges[edges['highway'].apply(
            lambda x: any(t in (x if isinstance(x, list) else [x]) for t in types)
        )]
        if len(road_edges) > 0:
            for idx, (_, edge) in enumerate(road_edges.iterrows()):
                xs, ys = edge.geometry.xy
                line, = ax.plot(xs, ys, color=color, linewidth=width, solid_capstyle='round', zorder=3)
                line.set_gid(f'preview-road-{road_name}-{idx}')

    # Draw default roads (anything not matched above)
    matched_types = [t for types, _, _ in road_types.values() for t in types]
    default_edges = edges[~edges['highway'].apply(
        lambda x: any(t in (x if isinstance(x, list) else [x]) for t in matched_types)
    )]
    if len(default_edges) > 0:
        for idx, (_, edge) in enumerate(default_edges.iterrows()):
            xs, ys = edge.geometry.xy
            line, = ax.plot(xs, ys, color='#3A3A3A', linewidth=0.4, solid_capstyle='round', zorder=3)
            line.set_gid(f'preview-road-default-{idx}')

    plt.tight_layout(pad=0)

    # Save to SVG
    svg_buffer = io.BytesIO()
    fig.savefig(svg_buffer, format='svg', bbox_inches='tight', pad_inches=0,
                transparent=True, dpi=100)
    plt.close(fig)

    svg_buffer.seek(0)
    svg_content = svg_buffer.read().decode('utf-8')

    return Response(svg_content, mimetype='image/svg+xml')


@app.route("/api/cached-maps")
def api_cached_maps():
    """List available cached maps for preview selection."""
    cache_dir = os.path.join(os.path.dirname(__file__), "cache", "map_data")
    cache_files = glob.glob(os.path.join(cache_dir, "*.pkl"))

    maps = []
    for f in cache_files:
        basename = os.path.basename(f)
        # Parse the filename: map_lat_lon_dist_hash.pkl
        parts = basename.replace('.pkl', '').split('_')
        if len(parts) >= 4:
            try:
                lat = float(parts[1])
                lon = float(parts[2])
                dist = int(parts[3])
                maps.append({
                    "file": basename,
                    "lat": lat,
                    "lon": lon,
                    "dist": dist,
                    "label": f"{lat:.2f}, {lon:.2f} ({dist}m)"
                })
            except:
                pass

    # Sort by distance (medium maps first)
    maps.sort(key=lambda x: abs(x['dist'] - 5000))
    return jsonify(maps)


@app.route("/api/fonts")
def api_fonts():
    """Return list of available font families."""
    fonts = poster.list_available_fonts()
    return jsonify(fonts)


# ===== STARRED SYSTEM =====
STARRED_DIR = os.path.join(os.path.dirname(__file__), "starred")


def ensure_starred_dir():
    if not os.path.exists(STARRED_DIR):
        os.makedirs(STARRED_DIR)


def load_starred(item_type):
    """Load starred items from JSON file. item_type is 'fonts' or 'themes'."""
    ensure_starred_dir()
    filepath = os.path.join(STARRED_DIR, f"{item_type}.json")
    if not os.path.exists(filepath):
        return []
    try:
        with open(filepath, "r") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return []


def save_starred(item_type, items):
    """Save starred items to JSON file."""
    ensure_starred_dir()
    filepath = os.path.join(STARRED_DIR, f"{item_type}.json")
    with open(filepath, "w") as f:
        json.dump(items, f, indent=2)


@app.route("/api/starred/<item_type>")
def api_starred_get(item_type):
    """Get starred items for fonts or themes."""
    if item_type not in ("fonts", "themes"):
        return jsonify({"error": "Invalid type. Use 'fonts' or 'themes'."}), 400
    return jsonify(load_starred(item_type))


@app.route("/api/starred/<item_type>/<item_id>", methods=["POST"])
def api_starred_add(item_type, item_id):
    """Add an item to starred list."""
    if item_type not in ("fonts", "themes"):
        return jsonify({"error": "Invalid type. Use 'fonts' or 'themes'."}), 400
    starred = load_starred(item_type)
    if item_id not in starred:
        starred.append(item_id)
        save_starred(item_type, starred)
    return jsonify({"ok": True, "starred": starred})


@app.route("/api/starred/<item_type>/<item_id>", methods=["DELETE"])
def api_starred_remove(item_type, item_id):
    """Remove an item from starred list."""
    if item_type not in ("fonts", "themes"):
        return jsonify({"error": "Invalid type. Use 'fonts' or 'themes'."}), 400
    starred = load_starred(item_type)
    if item_id in starred:
        starred.remove(item_id)
        save_starred(item_type, starred)
    return jsonify({"ok": True, "starred": starred})


# ===== PRESETS =====
PRESETS_DIR = os.path.join(os.path.dirname(__file__), "presets")


def ensure_presets_dir():
    if not os.path.exists(PRESETS_DIR):
        os.makedirs(PRESETS_DIR)


def sanitize_preset_name(name):
    """Convert preset name to safe filename."""
    import re
    # Remove special characters, replace spaces with underscores
    safe = re.sub(r'[^\w\s-]', '', name.strip())
    safe = re.sub(r'[\s]+', '_', safe)
    return safe.lower()[:50]  # Limit length


@app.route("/api/presets")
def api_presets_list():
    """List all saved presets."""
    ensure_presets_dir()
    presets = []
    for filename in os.listdir(PRESETS_DIR):
        if filename.endswith(".json"):
            filepath = os.path.join(PRESETS_DIR, filename)
            try:
                with open(filepath, "r") as f:
                    preset = json.load(f)
                    preset["id"] = filename[:-5]  # Remove .json extension
                    presets.append(preset)
            except Exception:
                pass
    # Sort by name
    presets.sort(key=lambda x: x.get("name", "").lower())
    return jsonify(presets)


@app.route("/api/presets", methods=["POST"])
def api_presets_create():
    """Create a new preset."""
    ensure_presets_dir()
    payload = request.get_json(silent=True) or {}

    name = (payload.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Preset name is required."}), 400

    preset_id = sanitize_preset_name(name)
    if not preset_id:
        return jsonify({"error": "Invalid preset name."}), 400

    filepath = os.path.join(PRESETS_DIR, f"{preset_id}.json")

    preset = {
        "name": name,
        "theme": payload.get("theme", "feature_based"),
        "font": payload.get("font", ""),
        "pin": payload.get("pin", "none"),
        "pin_color": payload.get("pin_color"),
        "format": payload.get("format", "png"),
        "dpi": payload.get("dpi", 300),
        "aspect_ratio": payload.get("aspect_ratio", "2:3"),
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
    }

    with open(filepath, "w") as f:
        json.dump(preset, f, indent=2)

    preset["id"] = preset_id
    return jsonify(preset)


@app.route("/api/presets/<preset_id>", methods=["DELETE"])
def api_presets_delete(preset_id):
    """Delete a preset."""
    ensure_presets_dir()
    filepath = os.path.join(PRESETS_DIR, f"{preset_id}.json")

    if not os.path.exists(filepath):
        return jsonify({"error": "Preset not found."}), 404

    os.remove(filepath)
    return jsonify({"ok": True})


# ===== COLLECTIONS =====
COLLECTIONS_FILE = os.path.join(os.path.dirname(__file__), "collections.json")


def load_collections():
    """Load collections from JSON file."""
    if not os.path.exists(COLLECTIONS_FILE):
        return []
    try:
        with open(COLLECTIONS_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return []


def save_collections(collections):
    """Save collections to JSON file."""
    with open(COLLECTIONS_FILE, "w") as f:
        json.dump(collections, f, indent=2)


@app.route("/api/collections")
def api_collections_list():
    """List all collections."""
    return jsonify(load_collections())


@app.route("/api/collections", methods=["POST"])
def api_collections_create():
    """Create a new collection."""
    payload = request.get_json(silent=True) or {}
    name = (payload.get("name") or "").strip()

    if not name:
        return jsonify({"error": "Collection name is required."}), 400

    collections = load_collections()

    # Generate ID from name
    import re
    coll_id = re.sub(r'[^\w\s-]', '', name.lower())
    coll_id = re.sub(r'[\s]+', '-', coll_id)[:30]

    # Ensure unique ID
    base_id = coll_id
    counter = 1
    while any(c["id"] == coll_id for c in collections):
        coll_id = f"{base_id}-{counter}"
        counter += 1

    collection = {
        "id": coll_id,
        "name": name,
        "color": payload.get("color", "#667eea"),
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
    }

    collections.append(collection)
    save_collections(collections)

    return jsonify(collection)


@app.route("/api/collections/<coll_id>", methods=["DELETE", "PATCH"])
def api_collections_modify(coll_id):
    """Delete or rename a collection."""
    if request.method == "DELETE":
        # Delete collection and unlink all posters
        collections = load_collections()
        collections = [c for c in collections if c["id"] != coll_id]
        save_collections(collections)

        # Unlink all posters from this collection
        unlinked_count = 0
        for config_file in glob.glob(os.path.join(poster.POSTERS_DIR, "*_config.json")):
            try:
                with open(config_file, "r") as f:
                    config = json.load(f)
                if config.get("collection") == coll_id:
                    config["collection"] = None
                    with open(config_file, "w") as f:
                        json.dump(config, f, indent=2)
                    unlinked_count += 1
            except Exception:
                continue

        return jsonify({"ok": True, "unlinked": unlinked_count})

    else:  # PATCH - Rename collection
        payload = request.get_json(silent=True) or {}
        new_name = (payload.get("name") or "").strip()

        if not new_name:
            return jsonify({"error": "Name is required."}), 400

        collections = load_collections()
        found = False
        for coll in collections:
            if coll["id"] == coll_id:
                coll["name"] = new_name
                found = True
                break

        if not found:
            return jsonify({"error": "Collection not found."}), 404

        save_collections(collections)
        return jsonify({"ok": True, "id": coll_id, "name": new_name})


@app.route("/api/posters/<path:filename>/collection", methods=["PATCH"])
def api_poster_collection(filename):
    """Assign a poster to a collection."""
    payload = request.get_json(silent=True) or {}
    collection = payload.get("collection")  # Can be null to remove from collection

    # Find config file
    base_name = filename.rsplit('.', 1)[0]
    config_path = os.path.join(poster.POSTERS_DIR, f"{base_name}_config.json")

    if not os.path.exists(config_path):
        return jsonify({"error": "Config not found for this poster."}), 404

    try:
        with open(config_path, "r") as f:
            config = json.load(f)

        config["collection"] = collection

        with open(config_path, "w") as f:
            json.dump(config, f, indent=2)

        return jsonify({"ok": True, "collection": collection})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ===== THEME COLLECTIONS =====
THEME_COLLECTIONS_FILE = os.path.join(os.path.dirname(__file__), "theme_collections.json")
THEME_COLLECTION_ITEMS_FILE = os.path.join(os.path.dirname(__file__), "theme_collection_items.json")


def load_theme_collections():
    """Load theme collections from JSON file."""
    if not os.path.exists(THEME_COLLECTIONS_FILE):
        return []
    try:
        with open(THEME_COLLECTIONS_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return []


def save_theme_collections(collections):
    """Save theme collections to JSON file."""
    with open(THEME_COLLECTIONS_FILE, "w") as f:
        json.dump(collections, f, indent=2)


def load_theme_collection_items():
    """Load theme-to-collection mappings."""
    if not os.path.exists(THEME_COLLECTION_ITEMS_FILE):
        return {}
    try:
        with open(THEME_COLLECTION_ITEMS_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return {}


def save_theme_collection_items(items):
    """Save theme-to-collection mappings."""
    with open(THEME_COLLECTION_ITEMS_FILE, "w") as f:
        json.dump(items, f, indent=2)


@app.route("/api/theme-collections")
def api_theme_collections_list():
    """List all theme collections with their items."""
    collections = load_theme_collections()
    items = load_theme_collection_items()
    return jsonify({"collections": collections, "items": items})


@app.route("/api/theme-collections", methods=["POST"])
def api_theme_collections_create():
    """Create a new theme collection."""
    payload = request.get_json(silent=True) or {}
    name = (payload.get("name") or "").strip()

    if not name:
        return jsonify({"error": "Collection name is required."}), 400

    collections = load_theme_collections()

    # Generate ID from name
    import re
    coll_id = re.sub(r'[^\w\s-]', '', name.lower())
    coll_id = re.sub(r'[\s]+', '-', coll_id)[:30]

    # Ensure unique ID
    base_id = coll_id
    counter = 1
    while any(c["id"] == coll_id for c in collections):
        coll_id = f"{base_id}-{counter}"
        counter += 1

    collection = {
        "id": coll_id,
        "name": name,
        "color": payload.get("color", "#667eea"),
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
    }

    collections.append(collection)
    save_theme_collections(collections)

    # Initialize empty items list for this collection
    items = load_theme_collection_items()
    items[coll_id] = []
    save_theme_collection_items(items)

    return jsonify(collection)


@app.route("/api/theme-collections/<coll_id>", methods=["DELETE", "PATCH"])
def api_theme_collections_modify(coll_id):
    """Delete or rename a theme collection."""
    if request.method == "DELETE":
        collections = load_theme_collections()
        collections = [c for c in collections if c["id"] != coll_id]
        save_theme_collections(collections)

        # Remove items for this collection
        items = load_theme_collection_items()
        if coll_id in items:
            del items[coll_id]
        save_theme_collection_items(items)

        return jsonify({"ok": True})

    else:  # PATCH - rename
        payload = request.get_json(silent=True) or {}
        new_name = (payload.get("name") or "").strip()

        if not new_name:
            return jsonify({"error": "Name is required."}), 400

        collections = load_theme_collections()
        found = False
        for coll in collections:
            if coll["id"] == coll_id:
                coll["name"] = new_name
                found = True
                break

        if not found:
            return jsonify({"error": "Collection not found."}), 404

        save_theme_collections(collections)
        return jsonify({"ok": True, "id": coll_id, "name": new_name})


@app.route("/api/theme-collections/<coll_id>/themes/<theme_id>", methods=["POST", "DELETE"])
def api_theme_collection_item(coll_id, theme_id):
    """Add or remove a theme from a collection."""
    items = load_theme_collection_items()

    if coll_id not in items:
        items[coll_id] = []

    if request.method == "POST":
        # Add theme to collection
        if theme_id not in items[coll_id]:
            items[coll_id].append(theme_id)
        save_theme_collection_items(items)
        return jsonify({"ok": True, "action": "added"})

    else:  # DELETE
        # Remove theme from collection
        if theme_id in items[coll_id]:
            items[coll_id].remove(theme_id)
        save_theme_collection_items(items)
        return jsonify({"ok": True, "action": "removed"})


# ===== FONT COLLECTIONS =====
FONT_COLLECTIONS_FILE = os.path.join(os.path.dirname(__file__), "font_collections.json")
FONT_COLLECTION_ITEMS_FILE = os.path.join(os.path.dirname(__file__), "font_collection_items.json")


def load_font_collections():
    """Load font collections from JSON file."""
    if not os.path.exists(FONT_COLLECTIONS_FILE):
        return []
    try:
        with open(FONT_COLLECTIONS_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return []


def save_font_collections(collections):
    """Save font collections to JSON file."""
    with open(FONT_COLLECTIONS_FILE, "w") as f:
        json.dump(collections, f, indent=2)


def load_font_collection_items():
    """Load font-to-collection mappings."""
    if not os.path.exists(FONT_COLLECTION_ITEMS_FILE):
        return {}
    try:
        with open(FONT_COLLECTION_ITEMS_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return {}


def save_font_collection_items(items):
    """Save font-to-collection mappings."""
    with open(FONT_COLLECTION_ITEMS_FILE, "w") as f:
        json.dump(items, f, indent=2)


@app.route("/api/font-collections")
def api_font_collections_list():
    """List all font collections with their items."""
    collections = load_font_collections()
    items = load_font_collection_items()
    return jsonify({"collections": collections, "items": items})


@app.route("/api/font-collections", methods=["POST"])
def api_font_collections_create():
    """Create a new font collection."""
    payload = request.get_json(silent=True) or {}
    name = (payload.get("name") or "").strip()

    if not name:
        return jsonify({"error": "Collection name is required."}), 400

    collections = load_font_collections()

    # Generate ID from name
    import re
    coll_id = re.sub(r'[^\w\s-]', '', name.lower())
    coll_id = re.sub(r'[\s]+', '-', coll_id)[:30]

    # Ensure unique ID
    base_id = coll_id
    counter = 1
    while any(c["id"] == coll_id for c in collections):
        coll_id = f"{base_id}-{counter}"
        counter += 1

    collection = {
        "id": coll_id,
        "name": name,
        "color": payload.get("color", "#667eea"),
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
    }

    collections.append(collection)
    save_font_collections(collections)

    # Initialize empty items list for this collection
    items = load_font_collection_items()
    items[coll_id] = []
    save_font_collection_items(items)

    return jsonify(collection)


@app.route("/api/font-collections/<coll_id>", methods=["DELETE", "PATCH"])
def api_font_collections_modify(coll_id):
    """Delete or rename a font collection."""
    if request.method == "DELETE":
        collections = load_font_collections()
        collections = [c for c in collections if c["id"] != coll_id]
        save_font_collections(collections)

        # Remove items for this collection
        items = load_font_collection_items()
        if coll_id in items:
            del items[coll_id]
        save_font_collection_items(items)

        return jsonify({"ok": True})

    else:  # PATCH - rename
        payload = request.get_json(silent=True) or {}
        new_name = (payload.get("name") or "").strip()

        if not new_name:
            return jsonify({"error": "Name is required."}), 400

        collections = load_font_collections()
        found = False
        for coll in collections:
            if coll["id"] == coll_id:
                coll["name"] = new_name
                found = True
                break

        if not found:
            return jsonify({"error": "Collection not found."}), 404

        save_font_collections(collections)
        return jsonify({"ok": True, "id": coll_id, "name": new_name})


@app.route("/api/font-collections/<coll_id>/fonts/<path:font_name>", methods=["POST", "DELETE"])
def api_font_collection_item(coll_id, font_name):
    """Add or remove a font from a collection."""
    items = load_font_collection_items()

    if coll_id not in items:
        items[coll_id] = []

    if request.method == "POST":
        # Add font to collection
        if font_name not in items[coll_id]:
            items[coll_id].append(font_name)
        save_font_collection_items(items)
        return jsonify({"ok": True, "action": "added"})

    else:  # DELETE
        # Remove font from collection
        if font_name in items[coll_id]:
            items[coll_id].remove(font_name)
        save_font_collection_items(items)
        return jsonify({"ok": True, "action": "removed"})


@app.route("/fonts/<path:filename>")
def serve_font(filename):
    """Serve font files from the fonts directory."""
    return send_from_directory(poster.FONTS_DIR, filename)


@app.route("/api/jobs", methods=["POST"])
def api_jobs():
    ensure_worker()
    payload = request.get_json(silent=True) or {}
    city = (payload.get("city") or "").strip()
    country = (payload.get("country") or "").strip()
    theme = (payload.get("theme") or "feature_based").strip()

    # Optional direct coordinates (skip geocoding if provided)
    lat = payload.get("lat")
    lng = payload.get("lng")
    if lat is not None:
        try:
            lat = float(lat)
        except (TypeError, ValueError):
            return jsonify({"error": "Latitude must be a number."}), 400
    if lng is not None:
        try:
            lng = float(lng)
            # Normalize longitude to -180 to 180 range (Leaflet can send wrapped values)
            while lng > 180:
                lng -= 360
            while lng < -180:
                lng += 360
        except (TypeError, ValueError):
            return jsonify({"error": "Longitude must be a number."}), 400

    try:
        distance = int(payload.get("distance") or 29000)
    except (TypeError, ValueError):
        return jsonify({"error": "Distance must be a number."}), 400
    try:
        dpi = int(payload.get("dpi") or 300)
        if dpi < 72 or dpi > 600:
            return jsonify({"error": "DPI must be between 72 and 600."}), 400
    except (TypeError, ValueError):
        return jsonify({"error": "DPI must be a number."}), 400

    output_format = (payload.get("format") or "png").strip().lower()
    if output_format not in ("png", "svg", "pdf", "svg-laser"):
        return jsonify({"error": "Format must be png, svg, pdf, or svg-laser."}), 400

    font = (payload.get("font") or "").strip() or None
    available_fonts = poster.list_available_fonts()
    if font and font not in available_fonts:
        return jsonify({"error": f"Font '{font}' not found. Available: {', '.join(available_fonts)}"}), 400

    # Optional tagline (replaces coordinates if provided)
    tagline = (payload.get("tagline") or "").strip() or None

    # Optional center pin icon
    pin = (payload.get("pin") or "").strip() or None
    valid_pins = ("marker", "heart", "star", "home", "circle")
    if pin and pin not in valid_pins:
        return jsonify({"error": f"Pin must be one of: {', '.join(valid_pins)}"}), 400

    # Optional pin color (hex color from theme)
    pin_color = (payload.get("pin_color") or "").strip() or None

    # Aspect ratio for poster dimensions
    aspect_ratio = (payload.get("aspect_ratio") or "").strip() or "2:3"
    valid_aspects = ("2:3", "3:4", "4:5", "5:7", "11:14", "1:1", "16:9", "9:16", "A4", "A3")
    if aspect_ratio not in valid_aspects:
        aspect_ratio = "2:3"

    # Collection assignment
    collection = (payload.get("collection") or "").strip() or None

    if not city or not country:
        return jsonify({"error": "City and country are required."}), 400

    job_id = uuid.uuid4().hex
    job = {
        "id": job_id,
        "status": "queued",
        "stage": "queued",
        "progress": 0,
        "message": "Queued",
        "output": None,
        "output_url": None,
        "error": None,
        "queue": queue.Queue(),
        "city": city,
        "country": country,
        "theme": theme,
        "distance": distance,
        "dpi": dpi,
        "format": output_format,
        "font": font,
        "lat": lat,
        "lng": lng,
        "tagline": tagline,
        "pin": pin,
        "pin_color": pin_color,
        "aspect_ratio": aspect_ratio,
        "collection": collection,
        "created_at": uuid.uuid1().time,
    }

    with JOBS_LOCK:
        # Count queued jobs for position calculation
        queued_count = sum(1 for j in JOBS.values() if j["status"] == "queued")

        # Calculate queue position
        job["queue_position"] = queued_count + 1
        JOBS[job_id] = job

    JOB_QUEUE.put(job_id)

    return jsonify({"job_id": job_id, "queue_position": job["queue_position"]})


@app.route("/api/jobs/<job_id>")
def api_job_status(job_id):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if not job:
            return jsonify({"error": "Job not found."}), 404
        return jsonify(
            {
                "id": job_id,
                "status": job["status"],
                "stage": job["stage"],
                "percent": job["progress"],
                "message": job["message"],
                "output": job["output"],
                "output_url": job["output_url"],
                "error": job["error"],
            }
        )


@app.route("/api/jobs", methods=["GET"])
def api_jobs_list():
    with JOBS_LOCK:
        jobs = sorted(JOBS.values(), key=lambda item: item.get("created_at", 0))
        payload = []
        for job in jobs:
            payload.append(
                {
                    "id": job["id"],
                    "status": job["status"],
                    "stage": job["stage"],
                    "percent": job["progress"],
                    "message": job["message"],
                    "output": job["output"],
                    "output_url": job["output_url"],
                    "error": job["error"],
                    "city": job["city"],
                    "country": job["country"],
                    "theme": job["theme"],
                    "distance": job["distance"],
                }
            )
        return jsonify(payload)


@app.route("/api/queue")
def api_queue_status():
    """Get current queue status."""
    with JOBS_LOCK:
        queued = [j for j in JOBS.values() if j["status"] == "queued"]
        running = [j for j in JOBS.values() if j["status"] == "running"]

        # Sort by creation time
        queued.sort(key=lambda x: x.get("created_at", 0))
        running.sort(key=lambda x: x.get("created_at", 0))

        return jsonify({
            "queued": [{
                "id": j["id"],
                "city": j["city"],
                "country": j["country"],
                "theme": j["theme"],
                "position": i + 1,
            } for i, j in enumerate(queued)],
            "running": [{
                "id": j["id"],
                "city": j["city"],
                "country": j["country"],
                "theme": j["theme"],
                "percent": j["progress"],
            } for j in running],
            "queued_count": len(queued),
            "running_count": len(running),
        })


@app.route("/api/queue/<job_id>", methods=["DELETE"])
def api_queue_remove(job_id):
    """Remove a job from the queue (only if still queued)."""
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if not job:
            return jsonify({"error": "Job not found."}), 404
        if job["status"] != "queued":
            return jsonify({"error": "Can only remove queued jobs."}), 400

        job["status"] = "cancelled"
        push_event(job_id, {"status": "cancelled", "message": "Removed from queue"})

    return jsonify({"ok": True})


@app.route("/api/queue/clear", methods=["POST"])
def api_queue_clear():
    """Clear all queued jobs."""
    with JOBS_LOCK:
        cancelled_count = 0
        for job_id, job in JOBS.items():
            if job["status"] == "queued":
                job["status"] = "cancelled"
                push_event(job_id, {"status": "cancelled", "message": "Queue cleared"})
                cancelled_count += 1

    return jsonify({"ok": True, "cancelled": cancelled_count})


@app.route("/api/variations", methods=["POST"])
def api_variations():
    """Generate same location with multiple themes (quick variations)."""
    ensure_worker()
    payload = request.get_json(silent=True) or {}

    themes = payload.get("themes", [])
    if not themes:
        return jsonify({"error": "At least one theme is required."}), 400

    # Validate required fields
    city = (payload.get("city") or "").strip()
    country = (payload.get("country") or "").strip()
    if not city or not country:
        return jsonify({"error": "City and country are required."}), 400

    # Get common parameters
    lat = payload.get("lat")
    lng = payload.get("lng")
    distance = int(payload.get("distance") or 29000)
    dpi = int(payload.get("dpi") or 300)
    output_format = (payload.get("format") or "png").strip()
    font = (payload.get("font") or "").strip()
    tagline = payload.get("tagline")
    pin = (payload.get("pin") or "").strip() or None
    pin_color = (payload.get("pin_color") or "").strip() or None
    aspect_ratio = (payload.get("aspect_ratio") or "").strip() or "2:3"
    collection = (payload.get("collection") or "").strip() or None

    batch_id = uuid.uuid4().hex
    job_ids = []

    with JOBS_LOCK:
        # Count queued jobs for position calculation
        queued_count = sum(1 for j in JOBS.values() if j["status"] == "queued")

        for i, theme in enumerate(themes):
            job_id = uuid.uuid4().hex
            job = {
                "id": job_id,
                "batch_id": batch_id,
                "batch_position": i + 1,
                "batch_total": len(themes),
                "status": "queued",
                "stage": "queued",
                "progress": 0,
                "message": "Queued",
                "output": None,
                "output_url": None,
                "error": None,
                "queue": queue.Queue(),
                "city": city,
                "country": country,
                "theme": theme,
                "distance": distance,
                "dpi": dpi,
                "format": output_format,
                "font": font,
                "lat": lat,
                "lng": lng,
                "tagline": tagline,
                "pin": pin,
                "pin_color": pin_color,
                "aspect_ratio": aspect_ratio,
                "collection": collection,
                "queue_position": queued_count + i + 1,
                "created_at": uuid.uuid1().time,
            }
            JOBS[job_id] = job
            JOB_QUEUE.put(job_id)
            job_ids.append(job_id)

    return jsonify({
        "batch_id": batch_id,
        "job_ids": job_ids,
        "count": len(themes),
    })


# ===== MOCKUPS =====
MOCKUPS_DIR = os.path.join(os.path.dirname(__file__), "mockups")
MOCKUP_OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "mockup_output")


def ensure_mockup_output_dir():
    if not os.path.exists(MOCKUP_OUTPUT_DIR):
        os.makedirs(MOCKUP_OUTPUT_DIR)


@app.route("/mockups/<path:filename>")
def serve_mockup_file(filename):
    """Serve mockup template files."""
    return send_from_directory(MOCKUPS_DIR, filename)


@app.route("/mockup_output/<path:filename>")
def serve_mockup_output(filename):
    """Serve generated mockup images."""
    return send_from_directory(MOCKUP_OUTPUT_DIR, filename)


@app.route("/api/mockup_output")
def api_mockup_output_list():
    """List all generated mockup images."""
    ensure_mockup_output_dir()
    items = []
    valid_extensions = (".png", ".jpg", ".jpeg")

    for filename in os.listdir(MOCKUP_OUTPUT_DIR):
        if not filename.lower().endswith(valid_extensions):
            continue
        path = os.path.join(MOCKUP_OUTPUT_DIR, filename)
        try:
            mtime = os.path.getmtime(path)
            size = os.path.getsize(path)
        except OSError:
            mtime = 0
            size = 0

        items.append({
            "filename": filename,
            "url": f"/mockup_output/{filename}",
            "mtime": mtime,
            "size": size,
        })

    # Sort by modification time (newest first)
    items.sort(key=lambda x: x["mtime"], reverse=True)
    return jsonify({"items": items})


@app.route("/api/mockup_output/<path:filename>", methods=["DELETE"])
def delete_mockup_output(filename):
    """Delete a generated mockup image."""
    safe_name = os.path.basename(filename)
    valid_extensions = (".png", ".jpg", ".jpeg")
    if safe_name != filename or not safe_name.lower().endswith(valid_extensions):
        return jsonify({"error": "Invalid filename."}), 400

    path = os.path.join(MOCKUP_OUTPUT_DIR, safe_name)
    if not os.path.exists(path):
        return jsonify({"error": "File not found."}), 404

    try:
        os.remove(path)
    except OSError as exc:
        return jsonify({"error": str(exc)}), 500

    return jsonify({"ok": True})


@app.route("/api/mockup_output/open", methods=["POST"])
def open_mockup_output_folder():
    """Open the mockup output folder in file explorer."""
    ensure_mockup_output_dir()
    folder_path = os.path.abspath(MOCKUP_OUTPUT_DIR)
    try:
        if sys.platform == "darwin":
            subprocess.run(["open", folder_path], check=False)
        elif sys.platform.startswith("win"):
            os.startfile(folder_path)
        else:
            subprocess.run(["xdg-open", folder_path], check=False)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    return jsonify({"ok": True})


@app.route("/api/mockups")
def api_mockups_list():
    """List available mockup templates."""
    mockups = mockup_generator.list_mockups()
    return jsonify(mockups)


@app.route("/api/mockups", methods=["POST"])
def api_mockups_create():
    """Create a new mockup template from uploaded image and rect data."""
    # Ensure mockups directory exists
    os.makedirs(MOCKUPS_DIR, exist_ok=True)

    if "image" not in request.files:
        return jsonify({"error": "No image uploaded."}), 400

    image_file = request.files["image"]
    name = request.form.get("name", "").strip()
    rect_data = request.form.get("rect", "")

    if not name:
        return jsonify({"error": "Template name is required."}), 400

    try:
        rect = json.loads(rect_data) if rect_data else {}
    except json.JSONDecodeError:
        return jsonify({"error": "Invalid rect data."}), 400

    # Generate safe ID from name
    import re
    mockup_id = re.sub(r'[^\w\s-]', '', name.lower())
    mockup_id = re.sub(r'[\s]+', '-', mockup_id)[:30]

    # Ensure unique ID
    base_id = mockup_id
    counter = 1
    while os.path.exists(os.path.join(MOCKUPS_DIR, f"{mockup_id}.json")):
        mockup_id = f"{base_id}-{counter}"
        counter += 1

    # Save image
    ext = os.path.splitext(image_file.filename)[1].lower() or ".png"
    if ext not in [".png", ".jpg", ".jpeg"]:
        ext = ".png"
    image_path = os.path.join(MOCKUPS_DIR, f"{mockup_id}{ext}")
    image_file.save(image_path)

    # Create metadata
    metadata = {
        "name": name,
        "poster_rect": rect.get("poster_rect", {"x": 0, "y": 0, "width": 400, "height": 600}),
        "poster_rotation": rect.get("poster_rotation", 0),
        "output_size": rect.get("output_size"),
    }

    # Save metadata
    metadata_path = os.path.join(MOCKUPS_DIR, f"{mockup_id}.json")
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)

    return jsonify({
        "ok": True,
        "id": mockup_id,
        "name": name,
    })


@app.route("/api/mockups/<mockup_id>", methods=["DELETE", "PATCH"])
def api_mockups_modify(mockup_id):
    """Delete or update a mockup template."""
    metadata_path = os.path.join(MOCKUPS_DIR, f"{mockup_id}.json")

    if request.method == "DELETE":
        # Find and delete image and metadata
        deleted = False
        for ext in [".png", ".jpg", ".jpeg"]:
            image_path = os.path.join(MOCKUPS_DIR, f"{mockup_id}{ext}")
            if os.path.exists(image_path):
                os.remove(image_path)
                deleted = True
                break

        if os.path.exists(metadata_path):
            os.remove(metadata_path)
            deleted = True

        if not deleted:
            return jsonify({"error": "Template not found."}), 404

        return jsonify({"ok": True})

    else:  # PATCH - Update template metadata (guides, labels, etc.)
        if not os.path.exists(metadata_path):
            return jsonify({"error": "Template not found."}), 404

        payload = request.get_json(silent=True) or {}

        # Load existing metadata
        with open(metadata_path, "r", encoding="utf-8") as f:
            metadata = json.load(f)

        # Update guides if provided
        if "guides" in payload:
            metadata["guides"] = payload["guides"]

        # Update labels if provided
        if "labels" in payload:
            metadata["labels"] = payload["labels"]

        # Update assets if provided
        if "assets" in payload:
            metadata["assets"] = payload["assets"]

        # Save updated metadata
        with open(metadata_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2)

        return jsonify({"ok": True})


@app.route("/api/mockups/save", methods=["POST"])
def api_mockups_save():
    """Save a client-rendered mockup image."""
    ensure_mockup_output_dir()

    if "image" not in request.files:
        return jsonify({"error": "No image uploaded."}), 400

    image_file = request.files["image"]
    poster_filename = request.form.get("poster", "")
    mockup_id = request.form.get("mockup_id", "")

    if not poster_filename:
        return jsonify({"error": "Poster filename is required."}), 400
    if not mockup_id:
        return jsonify({"error": "Mockup ID is required."}), 400

    # Generate output filename
    base_name = os.path.basename(poster_filename).rsplit('.', 1)[0]
    output_filename = f"{base_name}_mockup_{mockup_id}.png"
    output_path = os.path.join(MOCKUP_OUTPUT_DIR, output_filename)

    try:
        image_file.save(output_path)
        return jsonify({
            "ok": True,
            "filename": output_filename,
            "url": f"/mockup_output/{output_filename}",
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/mockups/generate", methods=["POST"])
def api_mockups_generate():
    """Generate a mockup for a poster (server-side fallback)."""
    ensure_mockup_output_dir()
    payload = request.get_json(silent=True) or {}

    poster_filename = payload.get("poster")
    mockup_id = payload.get("mockup_id")
    scale = payload.get("scale", 1.0)
    offset_x = payload.get("offset_x", 0)
    offset_y = payload.get("offset_y", 0)
    labels = payload.get("labels", [])  # Array of label objects

    if not poster_filename:
        return jsonify({"error": "Poster filename is required."}), 400
    if not mockup_id:
        return jsonify({"error": "Mockup ID is required."}), 400

    # Validate poster exists
    poster_path = os.path.join(poster.POSTERS_DIR, os.path.basename(poster_filename))
    if not os.path.exists(poster_path):
        return jsonify({"error": "Poster not found."}), 404

    # Generate output filename
    base_name = os.path.basename(poster_filename).rsplit('.', 1)[0]
    output_filename = f"{base_name}_mockup_{mockup_id}.png"
    output_path = os.path.join(MOCKUP_OUTPUT_DIR, output_filename)

    # Generate the mockup with adjustments and labels
    result = mockup_generator.generate_mockup(
        poster_path, mockup_id, output_path,
        scale=scale, offset_x=offset_x, offset_y=offset_y,
        labels=labels
    )

    if result["success"]:
        return jsonify({
            "ok": True,
            "filename": output_filename,
            "url": f"/mockup_output/{output_filename}",
        })
    else:
        return jsonify({"error": result.get("error", "Unknown error")}), 500


@app.route("/api/jobs/<job_id>/stream")
def api_job_stream(job_id):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if not job:
            return Response("event: error\ndata: {}\n\n", mimetype="text/event-stream")
        job_queue = job["queue"]

    def event_stream():
        while True:
            try:
                event = job_queue.get(timeout=1)
            except queue.Empty:
                with JOBS_LOCK:
                    status = JOBS.get(job_id, {}).get("status")
                if status in {"done", "error", "cancelled"}:
                    break
                continue
            yield f"data: {json.dumps(event)}\n\n"
            if event.get("status") in {"done", "error", "cancelled"}:
                break

    return Response(event_stream(), mimetype="text/event-stream")


@app.route("/posters/<path:filename>")
def poster_file(filename):
    return send_from_directory(poster.POSTERS_DIR, filename, as_attachment=False)


def build_posters_payload():
    posters_dir = poster.POSTERS_DIR
    abs_dir = os.path.abspath(posters_dir)
    if not os.path.exists(posters_dir):
        return {"path": abs_dir, "items": []}
    items = []
    valid_extensions = (".png", ".svg", ".pdf")
    for filename in os.listdir(posters_dir):
        # Skip thumbnails and config files
        if "_thumb.png" in filename or "_config.json" in filename:
            continue
        if not filename.lower().endswith(valid_extensions):
            continue
        path = os.path.join(posters_dir, filename)
        try:
            mtime = os.path.getmtime(path)
        except OSError:
            mtime = 0

        # Check for thumbnail
        base_name = filename.rsplit('.', 1)[0]
        thumb_filename = f"{base_name}_thumb.png"
        thumb_path = os.path.join(posters_dir, thumb_filename)
        has_thumb = os.path.exists(thumb_path)

        # Check for config
        config_filename = f"{base_name}_config.json"
        config_path = os.path.join(posters_dir, config_filename)
        config_data = None
        if os.path.exists(config_path):
            try:
                with open(config_path, 'r') as f:
                    config_data = json.load(f)
            except:
                pass

        items.append(
            {
                "filename": filename,
                "url": f"/posters/{filename}",
                "thumb_url": f"/posters/{thumb_filename}" if has_thumb else None,
                "config": config_data,
                "path": os.path.abspath(path),
                "mtime": mtime,
                "has_thumb": has_thumb,
            }
        )
    items.sort(key=lambda item: item["mtime"], reverse=True)
    return {"path": abs_dir, "items": items}


@app.route("/api/posters")
def api_posters():
    return jsonify(build_posters_payload())


@app.route("/api/posters/stream")
def api_posters_stream():
    def event_stream():
        last_signature = None
        while True:
            payload = build_posters_payload()
            signature = "|".join(
                f"{item['filename']}:{item['mtime']}" for item in payload["items"]
            )
            if signature != last_signature:
                last_signature = signature
                yield f"data: {json.dumps(payload)}\n\n"
            time.sleep(2)

    return Response(event_stream(), mimetype="text/event-stream")


@app.route("/api/posters/open", methods=["POST"])
def open_posters_folder():
    posters_dir = os.path.abspath(poster.POSTERS_DIR)
    try:
        if sys.platform == "darwin":
            subprocess.run(["open", posters_dir], check=False)
        elif sys.platform.startswith("win"):
            os.startfile(posters_dir)
        else:
            subprocess.run(["xdg-open", posters_dir], check=False)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    return jsonify({"ok": True})


@app.route("/api/examples")
def api_examples():
    path = os.path.join(os.getcwd(), "examples.csv")
    if not os.path.exists(path):
        return ("", 404)
    with open(path, "r") as handle:
        content = handle.read()
    return Response(content, mimetype="text/plain")


@app.route("/api/geocode/reverse")
def api_geocode_reverse():
    """Reverse geocode lat/lng to city/country names."""
    from geopy.geocoders import Nominatim

    lat = request.args.get("lat", type=float)
    lng = request.args.get("lng", type=float)

    if lat is None or lng is None:
        return jsonify({"error": "lat and lng parameters are required"}), 400

    try:
        geolocator = Nominatim(user_agent="maptoposter_web")
        location = geolocator.reverse((lat, lng), language="en", timeout=10)

        if location:
            addr = location.raw.get("address", {})
            # Try multiple address fields for city name
            city = (
                addr.get("city")
                or addr.get("town")
                or addr.get("village")
                or addr.get("municipality")
                or addr.get("county")
                or ""
            )
            country = addr.get("country", "")
            return jsonify({
                "city": city,
                "country": country,
                "display": location.address,
                "lat": lat,
                "lng": lng
            })
        return jsonify({
            "city": "",
            "country": "",
            "display": "Unknown location",
            "lat": lat,
            "lng": lng
        })
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/geocode/search")
def api_geocode_search():
    """Forward geocode search - find locations by name for map panning."""
    from geopy.geocoders import Nominatim

    query = request.args.get("q", "").strip()
    limit = request.args.get("limit", 5, type=int)

    if not query or len(query) < 2:
        return jsonify({"results": []})

    try:
        geolocator = Nominatim(user_agent="maptoposter_web")
        locations = geolocator.geocode(
            query,
            exactly_one=False,
            limit=min(limit, 10),
            language="en",
            timeout=10
        )

        results = []
        for loc in (locations or []):
            addr = loc.raw.get("address", {})
            city = (
                addr.get("city")
                or addr.get("town")
                or addr.get("village")
                or addr.get("municipality")
                or ""
            )
            results.append({
                "display": loc.address,
                "lat": loc.latitude,
                "lng": loc.longitude,
                "city": city,
                "country": addr.get("country", ""),
                "type": loc.raw.get("type", ""),
            })

        return jsonify({"results": results})
    except Exception as exc:
        return jsonify({"error": str(exc), "results": []}), 500


@app.route("/api/posters/<path:filename>", methods=["DELETE"])
def delete_poster(filename):
    safe_name = os.path.basename(filename)
    valid_extensions = (".png", ".svg", ".pdf")
    if safe_name != filename or not safe_name.lower().endswith(valid_extensions):
        return jsonify({"error": "Invalid filename."}), 400
    posters_dir = poster.POSTERS_DIR
    path = os.path.join(posters_dir, safe_name)
    if not os.path.exists(path):
        return jsonify({"error": "File not found."}), 404
    try:
        os.remove(path)
        # Also delete thumbnail and config if they exist
        base_name = safe_name.rsplit('.', 1)[0]
        thumb_path = os.path.join(posters_dir, f"{base_name}_thumb.png")
        config_path = os.path.join(posters_dir, f"{base_name}_config.json")
        if os.path.exists(thumb_path):
            os.remove(thumb_path)
        if os.path.exists(config_path):
            os.remove(config_path)
    except OSError as exc:
        return jsonify({"error": str(exc)}), 500
    return jsonify({"ok": True})


@app.route("/api/composite", methods=["POST"])
def create_composite():
    """Create a composite image from multiple poster thumbnails."""
    from PIL import Image, ImageDraw, ImageFont
    import io

    payload = request.get_json(silent=True) or {}
    filenames = payload.get("filenames", [])

    if not filenames:
        return jsonify({"error": "No files specified"}), 400

    posters_dir = poster.POSTERS_DIR
    images_data = []

    # Load thumbnails and configs
    for filename in filenames:
        safe_name = os.path.basename(filename)
        base_name = safe_name.rsplit('.', 1)[0]
        thumb_path = os.path.join(posters_dir, f"{base_name}_thumb.png")
        config_path = os.path.join(posters_dir, f"{base_name}_config.json")

        if not os.path.exists(thumb_path):
            continue

        # Load config
        config = {}
        if os.path.exists(config_path):
            try:
                with open(config_path, "r") as f:
                    config = json.load(f)
            except Exception:
                pass

        try:
            img = Image.open(thumb_path)
            images_data.append({
                "image": img,
                "theme": config.get("theme", "unknown"),
                "aspect_ratio": config.get("aspect_ratio", "2:3"),
                "font": config.get("font", "unknown")
            })
        except Exception as e:
            print(f"Failed to load {thumb_path}: {e}")
            continue

    if not images_data:
        return jsonify({"error": "No valid images found"}), 400

    # Calculate grid layout (max 5 per row)
    max_per_row = 5
    num_images = len(images_data)
    cols = min(num_images, max_per_row)
    rows = (num_images + cols - 1) // cols

    # Find max dimensions for uniform sizing
    max_width = max(d["image"].width for d in images_data)
    max_height = max(d["image"].height for d in images_data)

    # Add padding for text overlay
    text_height = 60
    padding = 10

    # Create composite canvas
    canvas_width = cols * (max_width + padding) + padding
    canvas_height = rows * (max_height + text_height + padding) + padding
    composite = Image.new("RGB", (canvas_width, canvas_height), (30, 30, 30))
    draw = ImageDraw.Draw(composite)

    # Try to load a font, fall back to default
    try:
        font = ImageFont.truetype("arial.ttf", 14)
        font_small = ImageFont.truetype("arial.ttf", 11)
    except Exception:
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 14)
            font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 11)
        except Exception:
            font = ImageFont.load_default()
            font_small = font

    # Place images with overlay text
    for idx, data in enumerate(images_data):
        row = idx // cols
        col = idx % cols

        x = padding + col * (max_width + padding)
        y = padding + row * (max_height + text_height + padding)

        img = data["image"]

        # Center image if smaller than max dimensions
        offset_x = (max_width - img.width) // 2
        offset_y = (max_height - img.height) // 2

        composite.paste(img, (x + offset_x, y + offset_y))

        # Draw semi-transparent overlay for text background
        overlay_y = y
        draw.rectangle(
            [(x, overlay_y), (x + max_width, overlay_y + text_height - 5)],
            fill=(0, 0, 0, 180)
        )

        # Draw text overlay
        theme_text = data["theme"].replace("_", " ").title()
        info_text = f"{data['aspect_ratio']} | {data['font']}"

        draw.text((x + 8, overlay_y + 8), theme_text, fill=(255, 255, 255), font=font)
        draw.text((x + 8, overlay_y + 28), info_text, fill=(200, 200, 200), font=font_small)

    # Save to bytes
    output = io.BytesIO()
    composite.save(output, format="PNG", optimize=True)
    output.seek(0)

    return Response(
        output.getvalue(),
        mimetype="image/png",
        headers={"Content-Disposition": f"attachment; filename=composite_{int(time.time())}.png"}
    )


if __name__ == "__main__":
    ensure_worker()
    app.run(debug=True, use_reloader=False)
