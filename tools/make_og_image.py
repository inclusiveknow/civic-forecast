"""
Generate public/og-image.png — the 1200x630 social share card.

Most platforms (X/Twitter, Facebook, LinkedIn, iMessage, Slack, Discord) do NOT
render SVG OG images, so we ship a real PNG. Re-run after changing the design:

    python tools/make_og_image.py

Pillow only (no SVG rasterizer needed). Mirrors public/og-image.svg.
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

W, H = 1200, 630
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "og-image.png")

INK = (240, 242, 248)
MUTE = (168, 176, 194)
DIM = (108, 115, 136)
BG_DARK = (10, 14, 26)
BG_LIFT = (26, 34, 56)

TONE = {
    "PRESS": (110, 197, 232),
    "COURTS": (167, 212, 155),
    "SUNLIGHT": (232, 198, 110),
    "CHAMBER": (167, 212, 155),
    "STREETS": (232, 154, 79),
    "RECORD": (212, 82, 78),
}

WIN = "C:/Windows/Fonts/"


def font(names, size):
    for n in names:
        try:
            return ImageFont.truetype(WIN + n, size)
        except Exception:
            pass
    return ImageFont.load_default()


F_TITLE = font(["arialbi.ttf", "ariali.ttf", "arial.ttf"], 150)
F_TAG = font(["ariali.ttf", "arial.ttf"], 34)
F_KICK = font(["consola.ttf", "cour.ttf"], 22)
F_PILL = font(["consolab.ttf", "consola.ttf", "cour.ttf"], 17)
F_URL = font(["consolab.ttf", "consola.ttf", "cour.ttf"], 18)


def spaced(draw, xy, text, fnt, fill, spacing, anchor="ls"):
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=fnt, fill=fill, anchor=anchor)
        w = draw.textlength(ch, font=fnt)
        x += w + spacing
    return x


def glow(size, ellipses):
    """Soft atmospheric blobs on a transparent layer."""
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for (cx, cy, rx, ry, color, a) in ellipses:
        d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=color + (a,))
    return layer.filter(ImageFilter.GaussianBlur(70))


img = Image.new("RGB", (W, H), BG_DARK)

# radial lift near top-center (approximates the SVG bg gradient)
lift = glow((W, H), [(600, 130, 620, 430, BG_LIFT, 255)])
img.paste(Image.alpha_composite(img.convert("RGBA"), lift).convert("RGB"), (0, 0))

# atmospheric blobs
blobs = glow((W, H), [
    (780, 320, 360, 230, (232, 154, 79), 150),
    (820, 360, 240, 160, (212, 82, 78), 95),
    (320, 380, 300, 190, (110, 197, 232), 110),
    (980, 510, 210, 130, (232, 198, 110), 90),
])
img = Image.alpha_composite(img.convert("RGBA"), blobs).convert("RGB")

draw = ImageDraw.Draw(img)

# subtle grid
for gy in (157, 315, 472):
    draw.line([(0, gy), (W, gy)], fill=(168, 176, 194), width=1)
for gx in (300, 600, 900):
    draw.line([(gx, 0), (gx, H)], fill=(168, 176, 194), width=1)
# (lines drawn full-opacity then knocked back by overlaying a faint scrim)
scrim = Image.new("RGBA", (W, H), (0, 0, 0, 0))
ImageDraw.Draw(scrim).rectangle([0, 0, W, H], fill=(10, 14, 26, 235))
# instead of scrim (would hide everything), redraw grid faintly:
img2 = img  # keep
# Redo: easier to just draw faint grid from scratch on a fresh composite
img = Image.alpha_composite(
    Image.alpha_composite(Image.new("RGB", (W, H), BG_DARK).convert("RGBA"), lift),
    blobs,
).convert("RGB")
draw = ImageDraw.Draw(img, "RGBA")
for gy in (157, 315, 472):
    draw.line([(0, gy), (W, gy)], fill=(168, 176, 194, 14), width=1)
for gx in (300, 600, 900):
    draw.line([(gx, 0), (gx, H)], fill=(168, 176, 194, 14), width=1)

# kicker
spaced(draw, (80, 100), "A DAILY FORECAST FOR CIVIC LIFE", F_KICK, MUTE, 6)

# big italic title
draw.text((76, 285), "the civic", font=F_TITLE, fill=INK, anchor="ls")
draw.text((76, 435), "forecast", font=F_TITLE, fill=INK, anchor="ls")

# tagline
draw.text((80, 500), "what democracy feels like today.", font=F_TAG, fill=MUTE, anchor="ls")

# atmospheric mark (top-right)
mx, my = 1000, 90
draw.ellipse([mx - 50, my - 50, mx + 50, my + 50], outline=(168, 176, 194, 90), width=1)
draw.ellipse([mx - 40, my - 18, mx + 16, my + 2], fill=(110, 197, 232, 180))
draw.ellipse([mx - 18, my - 2, mx + 46, my + 22], fill=(232, 154, 79, 165))
draw.ellipse([mx - 8, my - 8, mx + 8, my + 8], fill=BG_DARK)

# indicator pills
px, py = 80, 545
for name in ["PRESS", "COURTS", "SUNLIGHT", "CHAMBER", "STREETS", "RECORD"]:
    draw.rounded_rectangle([px, py, px + 14, py + 14], radius=3, fill=TONE[name])
    end = spaced(draw, (px + 22, py + 13), name, F_PILL, DIM, 3)
    px = end + 34

# url bottom-right
spaced(draw, (820, 600), "CIVIC-FORECAST.PAGES.DEV", F_URL, DIM, 3)

img.save(OUT, "PNG")
print("wrote", os.path.abspath(OUT), img.size)
