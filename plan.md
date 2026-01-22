# MapToPoster - Remaining Commercial Features

## Completed Features
- [x] Feature 1: Aspect Ratio Presets (2:3, 3:4, 4:5, 1:1, A4, A3)
- [x] Feature 2: Preset Bundles (save/load theme+font+settings combos)
- [x] Feature 3: Collections (organize posters into groups)

---

## Remaining Features

### Feature 4: Batch Queue

**Purpose:** Queue multiple locations to generate overnight

#### Backend Changes (app.py)

1. Remove single-job restriction at line ~590:
```python
# Change from:
for existing in JOBS.values():
    if existing["status"] in {"queued", "running"}:
        return jsonify({"error": "A job is already running."}), 409

# To:
running = sum(1 for j in JOBS.values() if j["status"] == "running")
if running >= MAX_CONCURRENT_JOBS:  # MAX_CONCURRENT_JOBS = 1
    return jsonify({"error": "Maximum concurrent jobs reached."}), 409
```

2. Add new endpoints:
   - `POST /api/batch` - Create batch of jobs
   - `GET /api/queue` - Get queue status
   - `DELETE /api/batch/<id>` - Cancel batch

3. Add batch_id and position fields to job object

#### Frontend Changes

1. Add to state: `batchQueue = []`
2. Add UI elements:
   - "+ Queue" button next to Generate button
   - Queue panel showing pending jobs with remove buttons
   - "Start Batch" / "Clear Queue" buttons

---

### Feature 5: Quick Variations

**Purpose:** Generate same location with multiple themes (leverages cache)

#### Key Insight
Cache key = `lat/lng/dist` only. Themes don't affect cache, so variations are fast.

#### Backend Changes

1. Add endpoint `POST /api/variations`:
```python
@app.route("/api/variations", methods=["POST"])
def api_variations():
    payload = request.get_json()
    themes = payload.get("themes", [])
    batch_id = uuid.uuid4().hex

    for i, theme in enumerate(themes):
        job_payload = {**payload, "theme": theme, "batch_id": batch_id}
        # Create job...

    return jsonify({"batch_id": batch_id, "count": len(themes)})
```

#### Frontend Changes

1. Add state: `variationMode: false`, `selectedThemes: []`
2. Add multi-select toggle in theme header
3. Theme carousel cards become checkable when in variation mode
4. Generate button shows "Generate X Variations" count

---

### Feature 6: Mockup Generator

**Purpose:** Place generated poster in frame mockup images

#### New Files

1. Create `mockups/` directory for PNG templates + JSON metadata
2. Create `mockup_generator.py`:
```python
from PIL import Image
import json, os

MOCKUPS_DIR = "mockups"

def list_mockups():
    # Return list of available mockup templates
    pass

def generate_mockup(poster_path, mockup_id, output_path):
    # Load mockup template and metadata
    # Resize poster to fit frame area
    # Composite poster onto mockup
    # Save result
    pass
```

#### Mockup Metadata Format (mockups/{name}.json)
```json
{
  "name": "White Frame on Wall",
  "poster_rect": {"x": 150, "y": 100, "width": 400, "height": 600},
  "poster_rotation": 0,
  "output_size": [1200, 900]
}
```

#### Backend Changes

1. Add endpoints:
   - `GET /api/mockups` - List available templates
   - `POST /api/mockups/generate` - Generate mockup for a poster

#### Frontend Changes

1. Add "Mockup" button in gallery item actions
2. Add mockup template selector modal
3. Display generated mockup in lightbox

---

## Testing Checklist

- [ ] Batch Queue: Add 3 locations, start batch, verify all complete
- [ ] Quick Variations: Select 3 themes, generate, verify fast (cache hit)
- [ ] Mockups: Select poster, choose frame, verify composite output
