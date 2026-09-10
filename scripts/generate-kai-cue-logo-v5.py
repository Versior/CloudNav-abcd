from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parents[1] / "public" / "branding" / "kai-cue" / "v5"
OUT.mkdir(parents=True, exist_ok=True)

CN_FONT = r"C:\Windows\Fonts\msyhbd.ttc"
EN_FONT = r"C:\Windows\Fonts\seguisb.ttf"


def load(path, size):
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default()


def mark(draw, x, y, s, main, accent):
    def p(px, py):
        return (int(x + px * s), int(y + py * s))
    width = max(1, int(18 * s))
    draw.line([p(78, 34), p(148, 34), p(180, 66), p(180, 158), p(148, 190), p(78, 190), p(46, 158), p(46, 66), p(78, 34)], fill=main, width=width, joint="curve")
    draw.line([p(112, 78), p(112, 146)], fill=accent, width=max(1, int(14 * s)))


def logo(dark=False):
    image = Image.new("RGBA", (1600, 450), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    main = "#F5F2EA" if dark else "#111316"
    accent = "#FF806C" if dark else "#E5523D"
    mark(draw, 72, 120, 1.55, main, accent)
    cn = load(CN_FONT, 138)
    en = load(EN_FONT, 36)
    draw.text((470, 115), "开镜", font=cn, fill=main)
    x = 484
    for ch in "KAI.CUE":
        draw.text((x, 285), ch, font=en, fill=accent)
        x += draw.textlength(ch, font=en) + 12
    return image


def mark_only(dark=False):
    image = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    mark(draw, 0, 0, 4.2, "#F5F2EA" if dark else "#111316", "#FF806C" if dark else "#E5523D")
    return image


light = logo(False)
dark = logo(True)
light.save(OUT / "kai-cue-logo-light.png")
dark.save(OUT / "kai-cue-logo-dark.png")
mark_only(False).save(OUT / "kai-cue-mark.png")

preview = Image.new("RGB", (1800, 1120), "#F2EEE7")
preview.paste(light.convert("RGB"), (100, 100), light)
dark_panel = Image.new("RGB", (1600, 450), "#111318")
dark_panel.paste(dark.convert("RGB"), (0, 0), dark)
preview.paste(dark_panel, (100, 570))
preview.save(OUT / "kai-cue-v5-preview.png")
