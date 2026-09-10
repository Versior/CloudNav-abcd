from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parents[1] / "public" / "branding" / "kai-cue" / "v3"
OUT.mkdir(parents=True, exist_ok=True)

FONT_SEMI = r"C:\Windows\Fonts\seguisb.ttf"
FONT_REG = r"C:\Windows\Fonts\segoeui.ttf"


def load(path, size):
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default()


def wordmark(dark=False):
    image = Image.new("RGBA", (1600, 360), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    main = "#F5F2EA" if dark else "#141517"
    accent = "#FF806C" if dark else "#F05A47"
    semi = load(FONT_SEMI, 122)
    regular = load(FONT_REG, 122)
    x, y = 92, 102
    tracking = 10
    for ch in "KAI":
        draw.text((x, y), ch, font=semi, fill=main)
        x += draw.textlength(ch, font=semi) + tracking
    draw.text((x, y), ".", font=semi, fill=accent)
    x += draw.textlength(".", font=semi) + tracking
    for ch in "CUE":
        draw.text((x, y), ch, font=regular, fill=main)
        x += draw.textlength(ch, font=regular) + tracking
    return image


def mark(dark=False):
    bg = "#F5F2EA" if dark else "#141517"
    accent = "#FF806C" if dark else "#F05A47"
    image = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((180, 180, 844, 844), radius=190, fill=bg)
    draw.ellipse((430, 430, 594, 594), fill=accent)
    return image


light = wordmark(False)
dark = wordmark(True)
light.save(OUT / "kai-cue-wordmark-light.png")
dark.save(OUT / "kai-cue-wordmark-dark.png")
mark(False).save(OUT / "kai-cue-dot-mark.png")

preview = Image.new("RGB", (1800, 920), "#F1EEE8")
preview.paste(light.convert("RGB"), (100, 100), light)
dark_panel = Image.new("RGB", (1600, 360), "#111318")
dark_panel.paste(dark.convert("RGB"), (0, 0), dark)
preview.paste(dark_panel, (100, 500))
preview.save(OUT / "kai-cue-v3-preview.png")
