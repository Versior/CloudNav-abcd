from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parents[1] / "public" / "branding" / "kai-cue" / "v2"
OUT.mkdir(parents=True, exist_ok=True)

FONT = r"C:\Windows\Fonts\seguisb.ttf"


def get_font(size):
    try:
        return ImageFont.truetype(FONT, size)
    except OSError:
        return ImageFont.truetype(r"C:\Windows\Fonts\segoeui.ttf", size)


def tracked(draw, xy, text, fnt, fill, tracking):
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=fnt, fill=fill)
        x += draw.textlength(ch, font=fnt) + tracking


def mark(draw, x, y, scale, main, accent):
    box = [int(x + 0 * scale), int(y + 0 * scale), int(x + 160 * scale), int(y + 160 * scale)]
    # Open lens arc, leaving the right-side cue gap.
    draw.arc(box, start=45, end=315, fill=main, width=max(1, int(9 * scale)))
    def p(px, py):
        return (int(x + px * scale), int(y + py * scale))
    w = max(1, int(7 * scale))
    draw.line([p(64, 58), p(64, 142)], fill=main, width=w)
    draw.line([p(64, 100), p(112, 68)], fill=main, width=w)
    draw.line([p(64, 100), p(112, 132)], fill=main, width=w)
    r = 7 * scale
    cx, cy = p(160, 40)
    draw.ellipse((int(cx-r), int(cy-r), int(cx+r), int(cy+r)), fill=accent)


def logo(dark=False):
    image = Image.new("RGBA", (1400, 300), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    main = "#F4F2EB" if dark else "#111316"
    accent = "#D2FF6A"
    mark(draw, 48, 70, 1.0, main, accent)
    word_font = get_font(92)
    tracked(draw, (300, 92), "KAI.CUE", word_font, main, 8)
    return image


def mark_only(dark=False):
    image = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    mark(draw, 192, 192, 4.0, "#F4F2EB" if dark else "#111316", "#D2FF6A")
    return image


logo(False).save(OUT / "kai-cue-logo-light.png")
logo(True).save(OUT / "kai-cue-logo-dark.png")
mark_only(False).save(OUT / "kai-cue-mark.png")

preview = Image.new("RGB", (1600, 920), "#F0EEE8")
light = logo(False)
preview.paste(light.convert("RGB"), (100, 90), light)
dark_panel = Image.new("RGB", (1400, 300), "#101216")
dark = logo(True)
dark_panel.paste(dark.convert("RGB"), (0, 0), dark)
preview.paste(dark_panel, (100, 530))
preview.save(OUT / "kai-cue-preview.png")
