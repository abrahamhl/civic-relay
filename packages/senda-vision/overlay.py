"""SENDA · Dibujo sobrio de las detecciones (PIL, tipografía Inter): esquinas, etiqueta, estela y panel."""
from PIL import Image, ImageDraw, ImageFont
import numpy as np

FONT_DIR = "/usr/share/fonts/opentype/inter/"
def font(size, weight="SemiBold"):
    try: return ImageFont.truetype(f"{FONT_DIR}Inter-{weight}.otf", size)
    except OSError: return ImageFont.load_default()

CYAN, AMBER, RED, GREEN, WHITE = (145, 215, 232), (251, 191, 36), (255, 91, 110), (52, 211, 153), (242, 244, 244)

def to_pil(bgr): return Image.fromarray(bgr[:, :, ::-1].copy())
def to_bgr(img): return np.asarray(img)[:, :, ::-1].copy()

def corners(d, b, col, k=0.22, w=3):
    x1, y1, x2, y2 = b; lx, ly = (x2 - x1) * k, (y2 - y1) * k
    for (ax, ay, bx, by) in [(x1, y1, x1 + lx, y1), (x1, y1, x1, y1 + ly), (x2, y1, x2 - lx, y1), (x2, y1, x2, y1 + ly),
                             (x1, y2, x1 + lx, y2), (x1, y2, x1, y2 - ly), (x2, y2, x2 - lx, y2), (x2, y2, x2, y2 - ly)]:
        d.line([(ax, ay), (bx, by)], fill=col, width=w)
    d.rectangle(b, outline=col + (90,), width=1)

def chip(d, xy, text, col, f, dark=(8, 14, 20, 200)):
    x, y = xy; tw = d.textlength(text, font=f); h = f.size + 8
    d.rounded_rectangle([x, y - h, x + tw + 12, y], 5, fill=dark); d.rectangle([x, y - h, x + 3, y], fill=col); d.text((x + 8, y - h + 3), text, font=f, fill=WHITE)

def panel(d, xy, lines, w=330):
    x, y = xy; h = 12 + sum(f.size + 6 for _, f, _ in lines)
    d.rounded_rectangle([x, y, x + w, y + h], 10, fill=(8, 14, 20, 205), outline=(32, 50, 64, 255))
    yy = y + 8
    for text, f, col in lines: d.text((x + 12, yy), text, font=f, fill=col); yy += f.size + 6

from PIL import Image
def begin(bgr):
    """Imagen base y capa transparente: lo que se dibuja en la capa se mezcla con su transparencia."""
    base = to_pil(bgr).convert("RGBA"); layer = Image.new("RGBA", base.size, (0, 0, 0, 0)); return base, layer, ImageDraw.Draw(layer)
def end(base, layer): return to_bgr(Image.alpha_composite(base, layer).convert("RGB"))
