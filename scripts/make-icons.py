"""Makes the app icon, Android adaptive icon layers, splash and favicon from the PumpHisaab
drop mark (teal square, white drop, saffron line; docs/design-tokens.json). Run: python3 scripts/make-icons.py"""
import math
from PIL import Image, ImageDraw

TEAL = (0x0F, 0x76, 0x6E, 255)
WHITE = (255, 255, 255, 255)
SAFFRON = (0xF4, 0xA3, 0x00, 255)
S = 4  # draw 4× bigger, then shrink: smooth edges


def drop_points(cx, cy, h):
    """A filled drop h tall, centred on (cx, cy): point at the top, round at the bottom."""
    pts = []
    for i in range(720):
        t = 2 * math.pi * i / 720
        x = math.sin(t) * math.sin(t / 2) ** 1.25
        y = -math.cos(t)
        pts.append((cx + x * h * 0.5, cy + y * h * 0.5))
    return pts


def mark(size, square=True, radius=0.22, drop=0.52, line=True, bg=TEAL, fg=WHITE, transparent=False):
    n = size * S
    im = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if square and not transparent:
        d.rounded_rectangle([0, 0, n - 1, n - 1], radius=int(n * radius), fill=bg)
    h = n * drop
    cy = n * 0.47
    d.polygon(drop_points(n / 2, cy, h), fill=fg)
    if line:
        w, t = n * 0.30, max(n * 0.035, 2)
        y = cy + h * 0.5 + n * 0.07
        d.rounded_rectangle([n / 2 - w / 2, y, n / 2 + w / 2, y + t], radius=int(t / 2), fill=SAFFRON)
    return im.resize((size, size), Image.LANCZOS)


out = "assets/images/"
mark(1024, radius=0).save(out + "icon.png")  # iPhone / web round the corners themselves
Image.new("RGBA", (512, 512), TEAL).save(out + "android-icon-background.png")
# Adaptive icon: the launcher crops to the middle ~66%, so the drop stays small and centred.
mark(512, transparent=True, drop=0.34).save(out + "android-icon-foreground.png")
mark(432, transparent=True, drop=0.34, line=False).save(out + "android-icon-monochrome.png")
mark(512, radius=0.22, drop=0.5).save(out + "splash-icon.png")
mark(48, radius=0.22, drop=0.56, line=False).save(out + "favicon.png")
print("icons written")
