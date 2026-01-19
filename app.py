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
                "colors": {
                    "bg": theme_data.get("bg", "#FFFFFF"),
                    "text": theme_data.get("text", "#111111"),
                    "water": theme_data.get("water", "#C0C0C0"),
                    "parks": theme_data.get("parks", "#F0F0F0"),
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


def run_job(job_id, city, country, theme, distance):
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
        coords = poster.get_coordinates(city, country, progress=progress)
        output_file = poster.generate_output_filename(city, theme)
        poster.create_poster(
            city, country, coords, distance, output_file, progress=progress
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


@app.route("/api/themes")
def api_themes():
    return jsonify(load_theme_catalog())


@app.route("/api/jobs", methods=["POST"])
def api_jobs():
    ensure_worker()
    payload = request.get_json(silent=True) or {}
    city = (payload.get("city") or "").strip()
    country = (payload.get("country") or "").strip()
    theme = (payload.get("theme") or "feature_based").strip()
    try:
        distance = int(payload.get("distance") or 29000)
    except (TypeError, ValueError):
        return jsonify({"error": "Distance must be a number."}), 400

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
    for filename in os.listdir(posters_dir):
        if not filename.lower().endswith(".png"):
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


@app.route("/api/posters/<path:filename>", methods=["DELETE"])
def delete_poster(filename):
    safe_name = os.path.basename(filename)
    if safe_name != filename or not safe_name.lower().endswith(".png"):
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
