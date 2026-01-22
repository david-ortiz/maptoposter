# MapToPoster - Commercial Production Features

## All Features Completed!

- [x] Feature 1: Aspect Ratio Presets (2:3, 3:4, 4:5, 1:1, A4, A3)
- [x] Feature 2: Preset Bundles (save/load theme+font+settings combos)
- [x] Feature 3: Collections (organize posters into groups)
- [x] Feature 4: Batch Queue (queue multiple locations to generate)
- [x] Feature 5: Quick Variations (same location, multiple themes - leverages cache)
- [x] Feature 6: Mockup Generator (place poster in frame mockup images)

---

## Implementation Summary

### Feature 1: Aspect Ratio Presets
- Added `ASPECT_RATIOS` constant to `create_map_poster.py`
- Added `get_figure_size()` function for dynamic sizing
- Added aspect ratio dropdown in UI

### Feature 2: Preset Bundles
- Created `presets/` directory
- Added `/api/presets` endpoints (GET, POST, DELETE)
- Added preset selector and save button in UI

### Feature 3: Collections
- Added `collections.json` storage
- Added `/api/collections` endpoints
- Added `/api/posters/<file>/collection` PATCH endpoint
- Added collection filter tabs in gallery

### Feature 4: Batch Queue
- Removed single-job restriction, added queue capacity system
- Added `/api/queue` endpoints
- Added queue panel in UI with add/clear buttons

### Feature 5: Quick Variations
- Added `/api/variations` endpoint
- Added variation mode toggle in theme header
- Theme cards become checkable in variation mode
- Generate button shows variation count

### Feature 6: Mockup Generator
- Created `mockups/` directory for templates
- Created `mockup_generator.py` with PIL compositing
- Added `/api/mockups` endpoints
- Added mockup button in gallery items
- Added mockup template selector modal

---

## Testing Checklist

- [ ] Aspect Ratio: Generate poster, verify dimensions match ratio
- [ ] Presets: Save preset, reload page, apply preset, verify settings
- [ ] Collections: Create collection, assign poster, filter gallery
- [ ] Batch Queue: Add 3 locations, start batch, verify all complete
- [ ] Quick Variations: Select 3 themes, generate, verify fast (cache hit)
- [ ] Mockups: Select poster, choose frame, verify composite output

---

## Adding Mockup Templates

To add a mockup template:
1. Place your mockup image as `mockups/your-name.png` (or .jpg)
2. Create `mockups/your-name.json` with the following format:

```json
{
  "name": "Display Name for UI",
  "poster_rect": {
    "x": 150,
    "y": 100,
    "width": 400,
    "height": 600
  },
  "poster_rotation": 0,
  "output_size": [1200, 900]
}
```

- `poster_rect`: Position and size where the poster will be placed
- `poster_rotation`: Degrees to rotate the poster (optional, default 0)
- `output_size`: Final image dimensions (optional)
