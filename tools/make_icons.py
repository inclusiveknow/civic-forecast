"""
Generate the home-screen icons (PNG; iPhones ignore SVG touch icons).

    python tools/make_icons.py

Writes public/icons/: icon-192.png, icon-512.png, icon-maskable-512.png,
apple-touch-icon.png (180). The mark is the brand's two fronts, a cool one
and a warm one, meeting around a still center.
"""
from PIL import Image, ImageDraw, ImageFilter
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "icons")
S = 1024


def mark(size, inset):
    """Draw the mark on a full-bleed square. `inset` shrinks the art (maskable safe zone)."""
    img = Image.new("RGB", (size, size), (10, 14, 26))
    # sky: a soft lift toward the top
    sky = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(sky).ellipse([-size * 0.2, -size * 0.55, size * 1.2, size * 0.75], fill=(28, 38, 66, 255))
    img = Image.alpha_composite(img.convert("RGBA"), sky.filter(ImageFilter.GaussianBlur(size * 0.12)))

    k = 1 - inset  # scale of the art
    c = size / 2

    def box(cx, cy, rx, ry):
        return [c + (cx - c) * k - rx * k, c + (cy - c) * k - ry * k, c + (cx - c) * k + rx * k, c + (cy - c) * k + ry * k]

    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    g = ImageDraw.Draw(glow)
    g.ellipse(box(size * 0.40, size * 0.42, size * 0.36, size * 0.17), fill=(57, 135, 229, 200))
    g.ellipse(box(size * 0.62, size * 0.60, size * 0.38, size * 0.17), fill=(232, 154, 79, 190))
    img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(size * 0.045)))

    crisp = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(crisp)
    d.ellipse(box(size * 0.40, size * 0.42, size * 0.30, size * 0.12), fill=(110, 197, 232, 235))
    d.ellipse(box(size * 0.62, size * 0.60, size * 0.32, size * 0.12), fill=(232, 154, 79, 230))
    ring = size * 0.40 * k
    d.ellipse([c - ring, c - ring, c + ring, c + ring], outline=(168, 176, 194, 70), width=max(2, int(size * 0.008)))
    dot = size * 0.075 * k
    d.ellipse([c - dot, c - dot, c + dot, c + dot], fill=(10, 14, 26, 255))
    img = Image.alpha_composite(img, crisp)
    return img.convert("RGB")


def main():
    os.makedirs(OUT, exist_ok=True)
    full = mark(S, 0.0)
    safe = mark(S, 0.22)  # maskable icons get cropped to a circle; keep the art inside 80%
    for name, img, px in [("icon-512.png", full, 512), ("icon-192.png", full, 192),
                          ("apple-touch-icon.png", full, 180), ("icon-maskable-512.png", safe, 512)]:
        img.resize((px, px), Image.LANCZOS).save(os.path.join(OUT, name), optimize=True)
        print("wrote", name, px)


if __name__ == "__main__":
    main()
