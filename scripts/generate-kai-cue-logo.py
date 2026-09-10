from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parents[1] / "public" / "branding" / "kai-cue"
OUT.mkdir(parents=True, exist_ok=True)

FONT_BOLD = r"C:\Windows\Fonts\segoeuib.ttf"
FONT_CN = r"C:\Windows\Fonts\msyh.ttc"


def font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default()


def mark(draw, x, y, scale, main, violet, coral):
    def p(px, py):
        return (int(x + px * scale), int(y + py * scale))

    w = max(1, int(28 * scale))
    inner_w = max(1, int(22 * scale))
    points = [p(112, 64), p(198, 64)]
    draw.line(points, fill=main, width=w)
    outline = [p(256, 122), p(256, 208), p(208, 256), p(112, 256), p(64, 208), p(64, 112), p(112, 64)]
    draw.line(outline, fill=main, width=w, joint="curve")
    draw.line([p(112, 112), p(112, 208)], fill=violet, width=inner_w)
    draw.line([p(112, 160), p(192, 112)], fill=violet, width=inner_w)
    draw.line([p(112, 160), p(192, 208)], fill=violet, width=inner_w)
    r = 15 * scale
    cx, cy = p(232, 64)
    draw.ellipse((int(cx - r), int(cy - r), int(cx + r), int(cy + r)), fill=coral)


def tracked_text(draw, xy, text, fnt, fill, tracking):
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=fnt, fill=fill)
        x += draw.textlength(ch, font=fnt) + tracking


def logo(dark=False):
    size = (1600, 480)
    image = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    main = "#F7F5F0" if dark else "#101114"
    violet = "#9D93FF" if dark else "#6658D8"
    coral = "#FF795C" if dark else "#FF6B4A"
    muted = "#B4B1BC" if dark else "#74747D"
    mark(draw, 44, 80, 1.25, main, violet, coral)
    word_font = font(FONT_BOLD, 116)
    cn_font = font(FONT_CN, 38)
    x, y = 450, 140
    draw.text((x, y), "KAI", font=word_font, fill=main)
    x += draw.textlength("KAI", font=word_font)
    draw.text((x, y), ".", font=word_font, fill=coral)
    x += draw.textlength(".", font=word_font)
    draw.text((x, y), "CUE", font=word_font, fill=main)
    tracked_text(draw, (456, 294), "开镜", cn_font, muted, 14)
    return image


def mark_only(dark=False):
    image = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    main = "#F7F5F0" if dark else "#101114"
    violet = "#9D93FF" if dark else "#6658D8"
    coral = "#FF795C" if dark else "#FF6B4A"
    mark(draw, 0, 0, 3.2, main, violet, coral)
    return image


logo(False).save(OUT / "kai-cue-logo-light.png")
logo(True).save(OUT / "kai-cue-logo-dark.png")
mark_only(False).save(OUT / "kai-cue-mark.png")

preview = Image.new("RGB", (1800, 1080), "#F1EEE8")
preview.paste(logo(False).convert("RGB"), (100, 70), logo(False))
dark_panel = Image.new("RGB", (1600, 480), "#111217")
dark_logo = logo(True)
dark_panel.paste(dark_logo.convert("RGB"), (0, 0), dark_logo)
preview.paste(dark_panel, (100, 560))
preview.save(OUT / "kai-cue-preview.png")
