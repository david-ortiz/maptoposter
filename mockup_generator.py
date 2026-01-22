"""
Mockup Generator for MapToPoster
Places generated posters into frame mockup templates.
"""

from PIL import Image
import json
import os
from pathlib import Path

MOCKUPS_DIR = Path(__file__).parent / "mockups"


def list_mockups():
    """Return list of available mockup templates with their metadata."""
    mockups = []

    if not MOCKUPS_DIR.exists():
        return mockups

    for json_file in MOCKUPS_DIR.glob("*.json"):
        try:
            with open(json_file, "r", encoding="utf-8") as f:
                metadata = json.load(f)

            mockup_id = json_file.stem
            image_file = MOCKUPS_DIR / f"{mockup_id}.png"

            # Also check for jpg
            if not image_file.exists():
                image_file = MOCKUPS_DIR / f"{mockup_id}.jpg"

            if image_file.exists():
                mockups.append({
                    "id": mockup_id,
                    "name": metadata.get("name", mockup_id),
                    "poster_rect": metadata.get("poster_rect", {}),
                    "poster_rotation": metadata.get("poster_rotation", 0),
                    "output_size": metadata.get("output_size"),
                    "thumbnail": f"/mockups/{image_file.name}"
                })
        except (json.JSONDecodeError, IOError) as e:
            print(f"Error loading mockup {json_file}: {e}")
            continue

    return mockups


def generate_mockup(poster_path, mockup_id, output_path, scale=1.0, offset_x=0, offset_y=0):
    """
    Generate a mockup by compositing a poster onto a template.

    Args:
        poster_path: Path to the poster image
        mockup_id: ID of the mockup template (filename without extension)
        output_path: Path where to save the generated mockup
        scale: User adjustment scale multiplier (default 1.0)
        offset_x: User adjustment X offset in pixels (default 0)
        offset_y: User adjustment Y offset in pixels (default 0)

    Returns:
        dict with success status and output path or error message
    """
    try:
        # Load mockup metadata
        metadata_path = MOCKUPS_DIR / f"{mockup_id}.json"
        if not metadata_path.exists():
            return {"success": False, "error": f"Mockup metadata not found: {mockup_id}"}

        with open(metadata_path, "r", encoding="utf-8") as f:
            metadata = json.load(f)

        # Find mockup image
        mockup_image_path = MOCKUPS_DIR / f"{mockup_id}.png"
        if not mockup_image_path.exists():
            mockup_image_path = MOCKUPS_DIR / f"{mockup_id}.jpg"

        if not mockup_image_path.exists():
            return {"success": False, "error": f"Mockup image not found: {mockup_id}"}

        # Load images
        mockup_img = Image.open(mockup_image_path).convert("RGBA")
        poster_img = Image.open(poster_path).convert("RGBA")

        # Get poster's original aspect ratio
        poster_aspect = poster_img.width / poster_img.height

        # Get poster placement rect
        rect = metadata.get("poster_rect", {})
        base_x = rect.get("x", 0)
        base_y = rect.get("y", 0)
        template_scale = rect.get("scale", 1.0)  # Template's scale factor
        rotation = metadata.get("poster_rotation", 0)

        # Auto-calculate width/height based on aspect ratio
        # User can specify width, height, or both
        # If only one is specified, the other is calculated from aspect ratio
        specified_width = rect.get("width")
        specified_height = rect.get("height")

        if specified_width and specified_height:
            # Both specified - use as-is
            width = int(specified_width * template_scale)
            height = int(specified_height * template_scale)
        elif specified_width:
            # Only width specified - calculate height from aspect ratio
            width = int(specified_width * template_scale)
            height = int(width / poster_aspect)
        elif specified_height:
            # Only height specified - calculate width from aspect ratio
            height = int(specified_height * template_scale)
            width = int(height * poster_aspect)
        else:
            # Neither specified - use poster's original size with scale
            width = int(poster_img.width * template_scale)
            height = int(poster_img.height * template_scale)

        # Apply user adjustments (scale multiplier and offsets)
        width = int(width * scale)
        height = int(height * scale)
        x = int(base_x + offset_x)
        y = int(base_y + offset_y)

        # Resize poster to fit the calculated area
        poster_resized = poster_img.resize((width, height), Image.Resampling.LANCZOS)

        # Apply rotation if specified
        if rotation != 0:
            poster_resized = poster_resized.rotate(
                rotation,
                expand=True,
                resample=Image.Resampling.BICUBIC
            )

        # Create a copy of mockup to work with
        result = mockup_img.copy()

        # Paste poster onto mockup
        # Use the poster's alpha channel as mask for proper transparency
        result.paste(poster_resized, (x, y), poster_resized)

        # Resize output if specified
        output_size = metadata.get("output_size")
        if output_size and len(output_size) == 2:
            result = result.resize(tuple(output_size), Image.Resampling.LANCZOS)

        # Convert to RGB if saving as JPEG
        output_path = Path(output_path)
        if output_path.suffix.lower() in [".jpg", ".jpeg"]:
            result = result.convert("RGB")

        # Save result
        result.save(output_path, quality=95)

        return {"success": True, "output_path": str(output_path)}

    except Exception as e:
        return {"success": False, "error": str(e)}


def create_sample_metadata():
    """
    Create a sample metadata file for reference.
    Users can copy this format for their own mockup templates.
    """
    sample = {
        "name": "White Frame on Wall",
        "poster_rect": {
            "x": 150,
            "y": 100,
            "height": 600,
            "scale": 1.0
        },
        "poster_rotation": 0,
        "output_size": [1200, 900],
        "_notes": "You can specify width, height, or both. If only one is given, the other is auto-calculated from poster aspect ratio. Use 'scale' to multiply dimensions."
    }

    sample_path = MOCKUPS_DIR / "_sample_template.json"
    MOCKUPS_DIR.mkdir(exist_ok=True)

    with open(sample_path, "w", encoding="utf-8") as f:
        json.dump(sample, f, indent=2)

    return sample_path


if __name__ == "__main__":
    # Create sample metadata when run directly
    path = create_sample_metadata()
    print(f"Sample metadata created at: {path}")
    print("\nTo create a mockup template:")
    print("1. Place your mockup image as mockups/your-mockup-name.png")
    print("2. Create mockups/your-mockup-name.json with the poster_rect coordinates")
    print("   - x, y: top-left corner where poster should be placed")
    print("   - width OR height: specify one, the other auto-calculates from aspect ratio")
    print("   - width AND height: specify both to override aspect ratio")
    print("   - scale: multiplier for dimensions (optional, default 1.0)")
    print("   - poster_rotation: degrees to rotate (optional)")
    print("   - output_size: [width, height] of final image (optional)")
