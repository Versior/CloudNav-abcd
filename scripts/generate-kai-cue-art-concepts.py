from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parents[1] / "public" / "branding" / "kai-cue" / "concepts"
OUT.mkdir(parents=True, exist_ok=True)

BG = "#F3EEE6"
INK = "#131416"
RED = "#D95B4A"
MUTED = "#8A837A"


def fnt(path, size):
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default()


SERIF = r"C:\Windows\Fonts\georgia.ttf"
SANS = r"C:\Windows\Fonts\segoeui.ttf"
SEMIBOLD = r"C:\Windows\Fonts\seguisb.ttf"


def centered(draw, xy, text, font, fill):
    box = draw.textbbox((0, 0), text, font=font)
    draw.text((xy[0] - (box[2] - box[0]) / 2, xy[1] - (box[3] - box[1]) / 2), text, font=font, fill=fill)


def wordmark(draw, x, y):
    semi = fnt(SEMIBOLD, 62)
    regular = fnt(SANS, 62)
    draw.text((x, y), "KAI", font=semi, fill=INK)
    width = draw.textlength("KAI", font=semi)
    draw.text((x + width + 7, y), ".", font=semi, fill=RED)
    dot_width = draw.textlength(".", font=semi)
    draw.text((x + width + dot_width + 14, y), "CUE", font=regular, fill=INK)


def concept_a(draw, cx, cy):
    r = 112
    box = [cx - r, cy - r, cx + r, cy + r]
    draw.arc(box, start=42, end=320, fill=INK, width=14)
    draw.line((cx - 74, cy + 74, cx + 65, cy - 65), fill=INK, width=9)
    draw.ellipse((cx + 72, cy - 118, cx + 94, cy - 96), fill=RED)


def concept_b(draw, cx, cy):
    # Two curtain-like planes opening around a single cue of light.
    draw.line((cx - 100, cy - 112, cx - 40, cy - 46, cx - 40, cy + 46, cx - 100, cy + 112), fill=INK, width=15, joint="curve")
    draw.line((cx + 100, cy - 112, cx + 40, cy - 46, cx + 40, cy + 46, cx + 100, cy + 112), fill=INK, width=15, joint="curve")
    draw.rounded_rectangle((cx - 8, cy - 74, cx + 8, cy + 74), radius=8, fill=RED)


def concept_c(draw, cx, cy):
    # A film-line / eye-line reduced to one continuous gesture.
    draw.arc((cx - 126, cy - 82, cx + 126, cy + 82), start=202, end=338, fill=INK, width=13)
    draw.arc((cx - 126, cy - 82, cx + 126, cy + 82), start=22, end=158, fill=INK, width=13)
    draw.line((cx - 60, cy, cx + 78, cy), fill=INK, width=8)
    draw.ellipse((cx + 64, cy - 15, cx + 94, cy + 15), fill=RED)


canvas = Image.new("RGB", (1800, 1040), BG)
draw = ImageDraw.Draw(canvas)
title_font = fnt(SERIF, 34)
label_font = fnt(SANS, 18)
small_font = fnt(SANS, 17)

draw.text((120, 70), "KAI.CUE", font=title_font, fill=INK)
draw.text((120, 120), "ART FILM MARKS / OPENING SHOT STUDY", font=label_font, fill=MUTED)

cards = [(130, "A", "CUT ARC", concept_a), (640, "B", "OPENING", concept_b), (1150, "C", "EYE-LINE", concept_c)]
for x, letter, label, painter in cards:
    draw.rounded_rectangle((x, 220, x + 420, 820), radius=22, fill="#FAF7F1", outline="#DED7CD", width=2)
    centered(draw, (x + 210, 360), letter, fnt(SERIF, 30), RED)
    painter(draw, x + 210, 500)
    centered(draw, (x + 210, 680), label, fnt(SEMIBOLD, 22), INK)
    centered(draw, (x + 210, 720), "KAI.CUE", fnt(SANS, 19), MUTED)

draw.text((120, 900), "A quiet symbol for the first frame, the cue point, and the moment a story opens.", font=small_font, fill=MUTED)
canvas.save(OUT / "kai-cue-art-concepts.png")
