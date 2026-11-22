"""Generates Multiwarden's original extension icons: three stacked vault cards with a keyhole.

Run: python3 multiwarden/branding/generate-icons.py
Writes PNGs to multiwarden/branding/icons/ using the file names the extension expects.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

OUT = Path(__file__).parent / "icons"
S = 1024  # master size

TEAL = (20, 184, 166)
INDIGO = (67, 56, 202)
VIOLET = (124, 58, 237)


def gradient(size, top, bottom):
    img = Image.new("RGBA", (size, size))
    d = ImageDraw.Draw(img)
    for y in range(size):
        t = y / (size - 1)
        c = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)) + (255,)
        d.line([(0, y), (size, y)], fill=c)
    return img


def card(box, radius, top, bottom):
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    fill = gradient(max(w, h), top, bottom).resize((w, h))
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, h - 1], radius=radius, fill=255)
    return fill, mask


def master(locked=False):
    """Front vault filling most of the square, with a second vault peeking out top-right."""
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    r = int(S * 0.20)
    back = (int(S * 0.20), int(S * 0.0), int(S * 1.0), int(S * 0.80))
    front = (int(S * 0.0), int(S * 0.16), int(S * 0.84), int(S * 1.0))

    fill, mask = card(back, r, (94, 234, 212), TEAL)
    img.paste(fill, back[:2], mask)

    # a thin transparent gap so the two cards read as separate at small sizes
    gap = Image.new("L", (S, S), 0)
    g = int(S * 0.045)
    ImageDraw.Draw(gap).rounded_rectangle(
        [front[0] - g, front[1] - g, front[2] + g, front[3] + g], radius=r + g, fill=255
    )
    alpha = img.getchannel("A")
    alpha = Image.composite(Image.new("L", (S, S), 0), alpha, gap)
    img.putalpha(alpha)

    fill, mask = card(front, r, (99, 102, 241), INDIGO)
    img.paste(fill, front[:2], mask)

    fx0, fy0, fx1, fy1 = front
    cx, cy = (fx0 + fx1) // 2, (fy0 + fy1) // 2
    d = ImageDraw.Draw(img)
    hr = int(S * 0.12)
    oy = int(S * 0.06)
    d.ellipse([cx - hr, cy - hr - oy, cx + hr, cy + hr - oy], fill="white")
    d.polygon(
        [
            (cx - int(S * 0.06), cy),
            (cx + int(S * 0.06), cy),
            (cx + int(S * 0.10), cy + int(S * 0.24)),
            (cx - int(S * 0.10), cy + int(S * 0.24)),
        ],
        fill="white",
    )

    if locked:
        img = ImageEnhance.Color(img).enhance(0.0)
        img = ImageEnhance.Brightness(img).enhance(0.9)
    return img


def padded(img, size, padding):
    """Chrome Web Store icons: artwork centred with transparent padding."""
    inner = size - 2 * padding
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(img.resize((inner, inner), Image.LANCZOS), (padding, padding))
    return out


def save_all():
    OUT.mkdir(parents=True, exist_ok=True)
    normal = master()
    gray = master(locked=True)
    sizes = [16, 19, 32, 38, 48, 96, 128]
    for size in sizes:
        normal.resize((size, size), Image.LANCZOS).save(OUT / f"icon{size}.png")
        gray.resize((size, size), Image.LANCZOS).save(OUT / f"icon{size}_gray.png")
    for size in (19, 38):
        gray.resize((size, size), Image.LANCZOS).save(OUT / f"icon{size}_locked.png")
    # Chrome Web Store assets
    padded(normal, 128, 16).save(OUT / "store-icon128.png")
    normal.resize((512, 512), Image.LANCZOS).save(OUT / "logo512.png")


if __name__ == "__main__":
    save_all()
