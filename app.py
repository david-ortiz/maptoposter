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


app = Flask(__name__, static_folder="static", template_folder="templates")

JOBS = {}
JOBS_LOCK = threading.Lock()
JOB_QUEUE = queue.Queue()
WORKER_STARTED = False


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


def run_job(job_id, city, country, theme, distance, dpi, output_format, lat=None, lng=None, font=None, tagline=None, pin=None):
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
            city, country, coords, distance, output_file, output_format, dpi=dpi, progress=progress, font_family=font, tagline=tagline, pin=pin
        )

        output_url = f"/posters/{os.path.basename(output_file)}"
        push_event(
            job_id,
            {
                "status": "done",
                "stage": "done",
                "percent": 100,
                "message": "Poster ready",
                "output": output_file,
                "output_url": output_url,
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
        "created_at": uuid.uuid1().time,
    }

    with JOBS_LOCK:
        for existing in JOBS.values():
            if existing["status"] in {"queued", "running"}:
                return jsonify({"error": "A job is already running."}), 409
        JOBS[job_id] = job

    JOB_QUEUE.put(job_id)

    return jsonify({"job_id": job_id})


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


@app.route("/api/posters")
def build_posters_payload():
    posters_dir = poster.POSTERS_DIR
    abs_dir = os.path.abspath(posters_dir)
    if not os.path.exists(posters_dir):
        return {"path": abs_dir, "items": []}
    items = []
    valid_extensions = (".png", ".svg", ".pdf")
    for filename in os.listdir(posters_dir):
        if not filename.lower().endswith(valid_extensions):
            continue
        path = os.path.join(posters_dir, filename)
        try:
            mtime = os.path.getmtime(path)
        except OSError:
            mtime = 0
        items.append(
            {
                "filename": filename,
                "url": f"/posters/{filename}",
                "path": os.path.abspath(path),
                "mtime": mtime,
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
    except OSError as exc:
        return jsonify({"error": str(exc)}), 500
    return jsonify({"ok": True})


if __name__ == "__main__":
    ensure_worker()
    app.run(debug=True, use_reloader=False)
