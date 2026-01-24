"""
Mockup Generator for MapToPoster
Places generated posters into frame mockup templates.
"""

from PIL import Image, ImageDraw, ImageFont, ImageFilter
import json
import os
from pathlib import Path

FONTS_DIR = Path(__file__).parent / "fonts"

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
                # Get modification time for sorting
                mtime = json_file.stat().st_mtime
                mockups.append({
                    "id": mockup_id,
                    "name": metadata.get("name", mockup_id),
                    "poster_rect": metadata.get("poster_rect", {}),
                    "poster_rotation": metadata.get("poster_rotation", 0),
                    "output_size": metadata.get("output_size"),
                    "thumbnail": f"/mockups/{image_file.name}",
                    "guides": metadata.get("guides", []),
                    "labels": metadata.get("labels", []),
                    "recommended_aspect": metadata.get("recommended_aspect"),
                    "mtime": mtime
                })
        except (json.JSONDecodeError, IOError) as e:
            print(f"Error loading mockup {json_file}: {e}")
            continue

    # Sort by creation date, newest first
    mockups.sort(key=lambda x: x.get("mtime", 0), reverse=True)
    return mockups


def find_font_path(font_name):
    """Find the font file path for a given font name."""
    # Check app fonts directory
    for ext in [".ttf", ".otf", ".TTF", ".OTF"]:
        font_path = FONTS_DIR / f"{font_name}{ext}"
        if font_path.exists():
            return str(font_path)

    # Check subdirectories
    for subdir in FONTS_DIR.iterdir():
        if subdir.is_dir():
            for ext in [".ttf", ".otf", ".TTF", ".OTF"]:
                font_path = subdir / f"{font_name}{ext}"
                if font_path.exists():
                    return str(font_path)

    # Fallback to system fonts (common paths)
    system_font_dirs = [
        Path("C:/Windows/Fonts"),
        Path("/usr/share/fonts"),
        Path("/System/Library/Fonts"),
        Path.home() / ".fonts",
    ]

    for font_dir in system_font_dirs:
        if font_dir.exists():
            for ext in [".ttf", ".otf", ".TTF", ".OTF"]:
                font_path = font_dir / f"{font_name}{ext}"
                if font_path.exists():
                    return str(font_path)

    return None


def generate_mockup(poster_path, mockup_id, output_path, scale=1.0, offset_x=0, offset_y=0, labels=None):
    """
    Generate a mockup by compositing a poster onto a template.

    Args:
        poster_path: Path to the poster image
        mockup_id: ID of the mockup template (filename without extension)
        output_path: Path where to save the generated mockup
        scale: User adjustment scale multiplier (default 1.0)
        offset_x: User adjustment X offset in pixels (default 0)
        offset_y: User adjustment Y offset in pixels (default 0)
        labels: List of label objects with text, x, y, font, size, color, shadow

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

        # Draw labels on top
        if labels:
            draw = ImageDraw.Draw(result)
            img_width, img_height = result.size

            for label in labels:
                label_text = label.get("text", "")
                if not label_text:
                    continue

                # Position is percentage based (0-100)
                label_x = int((label.get("x", 50) / 100) * img_width)
                label_y = int((label.get("y", 50) / 100) * img_height)
                font_name = label.get("font", "Arial")
                font_size = label.get("size", 24)
                font_color = label.get("color", "#ffffff")
                has_shadow = label.get("shadow", True)

                # Try to load the font
                font = None
                font_path = find_font_path(font_name)
                if font_path:
                    try:
                        font = ImageFont.truetype(font_path, font_size)
                    except Exception:
                        pass

                # Fallback to default font
                if font is None:
                    try:
                        font = ImageFont.truetype("arial.ttf", font_size)
                    except Exception:
                        font = ImageFont.load_default()

                # Draw shadow if enabled
                if has_shadow:
                    shadow_offset = max(2, font_size // 12)
                    shadow_color = (0, 0, 0, 180)  # Semi-transparent black
                    draw.text(
                        (label_x + shadow_offset, label_y + shadow_offset),
                        label_text,
                        font=font,
                        fill=shadow_color
                    )

                # Draw main text
                draw.text((label_x, label_y), label_text, font=font, fill=font_color)

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
