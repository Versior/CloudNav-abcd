from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parents[1] / "public" / "branding" / "kai-cue" / "v6"
OUT.mkdir(parents=True, exist_ok=True)

CN = r"C:\Windows\Fonts\msyhbd.ttc"
EN = r"C:\Windows\Fonts\seguisb.ttf"


def font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default()


def mark(draw, x, y, s, main, accent):
    def p(px, py):
        return (int(x + px * s), int(y + py * s))
    left = [p(24, 18), p(80, 18), p(124, 61), p(124, 155), p(80, 198), p(24, 198), p(62, 155), p(62, 61)]
    right = [p(216, 18), p(160, 18), p(116, 61), p(116, 155), p(160, 198), p(216, 198), p(178, 155), p(178, 61)]
    draw.polygon(left, fill=main)
    draw.polygon(right, fill=main)
    center = [p(120, 0), p(112, 64), p(112, 152), p(120, 216), p(128, 152), p(128, 64)]
    draw.polygon(center, fill=accent)


def tracked(draw, x, y, text, fnt, fill, gap):
    for ch in text:
        draw.text((x, y), ch, font=fnt, fill=fill)
        x += draw.textlength(ch, font=fnt) + gap


def logo(dark=False):
    image = Image.new("RGBA", (1600, 475), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    main = "#F5F2EA" if dark else "#121416"
    accent = "#FF806C" if dark else "#E5523D"
    mark(draw, 66, 130, 1.45, main, accent)
    tracked(draw, 450, 118, "开镜", font(CN, 142), main, 16)
    tracked(draw, 466, 300, "KAI.CUE", font(EN, 37), accent, 13)
    return image


def icon(dark=False):
    image = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    mark(draw, 0, 0, 4.25, "#F5F2EA" if dark else "#121416", "#FF806C" if dark else "#E5523D")
    return image


light = logo(False)
dark = logo(True)
light.save(OUT / "kai-cue-logo-light.png")
dark.save(OUT / "kai-cue-logo-dark.png")
icon(False).save(OUT / "kai-cue-mark.png")

preview = Image.new("RGB", (1800, 1180), "#F1ECE4")
preview.paste(light.convert("RGB"), (100, 100), light)
dark_panel = Image.new("RGB", (1600, 475), "#111318")
dark_panel.paste(dark.convert("RGB"), (0, 0), dark)
preview.paste(dark_panel, (100, 600))
preview.save(OUT / "kai-cue-v6-preview.png")
