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
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    r = int(S * 0.16)
    # back, middle, front cards, offset up-right to suggest several vaults
    layers = [
        ((int(S * 0.30), int(S * 0.04), int(S * 0.96), int(S * 0.70)), (94, 234, 212), TEAL, 150),
        ((int(S * 0.17), int(S * 0.17), int(S * 0.83), int(S * 0.83)), (129, 140, 248), VIOLET, 200),
        ((int(S * 0.04), int(S * 0.30), int(S * 0.70), int(S * 0.96)), (99, 102, 241), INDIGO, 255),
    ]
    for box, top, bottom, alpha in layers:
        # soft shadow
        sh = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        ImageDraw.Draw(sh).rounded_rectangle(
            [box[0] + 10, box[1] + 18, box[2] + 10, box[3] + 18], radius=r, fill=(15, 23, 42, 90)
        )
        img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(18)))
        fill, mask = card(box, r, top, bottom)
        mask = mask.point(lambda v: v * alpha // 255)
        img.paste(fill, box[:2], mask)

    # keyhole on the front card
    fx0, fy0, fx1, fy1 = layers[-1][0]
    cx, cy = (fx0 + fx1) // 2, (fy0 + fy1) // 2
    d = ImageDraw.Draw(img)
    hr = int(S * 0.085)
    d.ellipse([cx - hr, cy - hr - int(S * 0.04), cx + hr, cy + hr - int(S * 0.04)], fill="white")
    d.polygon(
        [
            (cx - int(S * 0.045), cy),
            (cx + int(S * 0.045), cy),
            (cx + int(S * 0.075), cy + int(S * 0.17)),
            (cx - int(S * 0.075), cy + int(S * 0.17)),
        ],
        fill="white",
    )

    if locked:
        img = ImageEnhance.Color(img).enhance(0.0)
        img = ImageEnhance.Brightness(img).enhance(0.9)
    return img


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
    normal.resize((128, 128), Image.LANCZOS).save(OUT / "store-icon128.png")
    normal.resize((512, 512), Image.LANCZOS).save(OUT / "logo512.png")


if __name__ == "__main__":
    save_all()
