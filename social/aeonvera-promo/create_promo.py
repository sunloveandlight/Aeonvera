#!/usr/bin/env python3
from pathlib import Path
import subprocess
import textwrap

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
ASSET_DIR = ROOT / "assets"
AUDIO_DIR = ROOT / "audio"
VIDEO_DIR = ROOT / "videos"

WIDTH = 1080
HEIGHT = 1920
FPS = 30
DURATION = 30

BOLD_FONT = Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf")
REGULAR_FONT = Path("/System/Library/Fonts/Supplemental/Arial.ttf")

VOICE = "Shelley (English (US))"

VOICEOVER = (
    "Events should feel effortless. "
    "Not scattered across tabs, spreadsheets, and last minute messages. "
    "AeonVera brings registration, ticketing, waivers, schedules, communication, "
    "and payments into one calm place. "
    "Your team gets clarity before every guest arrives, "
    "and confidence through every check in. "
    "Less noise. More flow. "
    "AeonVera. Beautifully organized events."
)

CAPTIONS = [
    (0.4, 5.2, "Events should feel effortless.", 78, "white"),
    (
        5.8,
        11.3,
        "Registration, ticketing, waivers, schedules, and payments in one calm place.",
        58,
        "dark",
    ),
    (12.0, 17.2, "Give your team clarity before every guest arrives.", 64, "dark"),
    (
        17.9,
        23.4,
        "Move from first sign up to final check in with confidence.",
        62,
        "dark",
    ),
    (24.2, 29.6, "AeonVera\nBeautifully organized events.", 70, "gold"),
]


def run(command):
    subprocess.run(command, check=True)


def text_size(draw, text, font):
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]


def wrap(draw, text, font, max_width):
    lines = []
    for paragraph in text.split("\n"):
        words = paragraph.split()
        current = ""
        for word in words:
            candidate = f"{current} {word}".strip()
            if text_size(draw, candidate, font)[0] <= max_width:
                current = candidate
            else:
                if current:
                    lines.append(current)
                current = word
        if current:
            lines.append(current)
    return lines


def make_caption(filename, text, font_size, tone):
    font = ImageFont.truetype(str(BOLD_FONT), font_size)
    image = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    lines = wrap(draw, text, font, 860)
    line_height = int(font_size * 1.18)
    block_height = line_height * len(lines)
    y = int((HEIGHT - block_height) * 0.47)

    if tone == "white":
        fill = (255, 255, 255, 255)
        shadow = (150, 112, 38, 95)
    elif tone == "gold":
        fill = (177, 118, 21, 255)
        shadow = (255, 255, 255, 180)
    else:
        fill = (61, 55, 47, 235)
        shadow = (255, 255, 255, 210)

    for line in lines:
        line_width, _ = text_size(draw, line, font)
        x = (WIDTH - line_width) // 2
        draw.text((x + 3, y + 3), line, font=font, fill=shadow)
        draw.text((x, y), line, font=font, fill=fill)
        y += line_height

    path = ASSET_DIR / filename
    image.save(path)
    return path


def make_vignette():
    image = Image.new("RGBA", (WIDTH, HEIGHT), (255, 255, 255, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((70, 260, WIDTH - 70, HEIGHT - 260), radius=80, fill=(255, 255, 255, 40))
    for y in range(HEIGHT):
        edge_alpha = int(max(0, (abs(y - HEIGHT / 2) - 640) / 300) * 55)
        if edge_alpha:
            draw.line((0, y, WIDTH, y), fill=(255, 255, 255, min(edge_alpha, 55)))
    path = ASSET_DIR / "soft-vignette.png"
    image.save(path)
    return path


def main():
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    VIDEO_DIR.mkdir(parents=True, exist_ok=True)

    background = ASSET_DIR / "aeonvera-style-background.png"
    if not background.exists():
        raise SystemExit(f"Missing background image: {background}")

    audio = AUDIO_DIR / "aeonvera-promo-voiceover.aiff"
    run(["say", "-v", VOICE, "-r", "160", "-o", str(audio), VOICEOVER])

    caption_paths = []
    for index, (_, _, text, size, tone) in enumerate(CAPTIONS, start=1):
        caption_paths.append(make_caption(f"caption-{index:02}.png", text, size, tone))

    vignette = make_vignette()
    output = VIDEO_DIR / "aeonvera-30s-promo.mp4"

    command = [
        "ffmpeg",
        "-y",
        "-loop",
        "1",
        "-t",
        str(DURATION),
        "-i",
        str(background),
        "-i",
        str(audio),
        "-loop",
        "1",
        "-i",
        str(vignette),
    ]

    for caption in caption_paths:
        command.extend(["-loop", "1", "-i", str(caption)])

    overlays = ["[base][2:v]overlay=0:0[v0]"]
    previous = "v0"
    for caption_number, (start, end, *_rest) in enumerate(CAPTIONS, start=1):
        input_index = caption_number + 2
        next_label = "video" if caption_number == len(CAPTIONS) else f"v{caption_number}"
        overlays.append(
            f"[{previous}][{input_index}:v]overlay=0:0:enable='between(t,{start},{end})'[{next_label}]"
        )
        previous = next_label

    filter_graph = textwrap.dedent(
        f"""
        [0:v]scale=1200:2134,
        zoompan=z='1+0.035*on/{DURATION * FPS}':x='iw/2-(iw/zoom/2)+18*sin(on/150)':y='ih/2-(ih/zoom/2)-24*cos(on/180)':d={DURATION * FPS}:s={WIDTH}x{HEIGHT}:fps={FPS},
        eq=brightness=0.025:saturation=0.95,
        fade=t=in:st=0:d=1.2,
        fade=t=out:st=28.8:d=1.2[base];
        {';'.join(overlays)};
        anullsrc=channel_layout=mono:sample_rate=44100:d={DURATION}[silence];
        [silence]volume=0.03[silent];
        [1:a]volume=1.45,afade=t=in:st=0:d=0.4,afade=t=out:st=29.2:d=0.8[voice];
        [voice][silent]amix=inputs=2:duration=first:dropout_transition=0[audio]
        """
    ).replace("\n", "")

    command.extend(
        [
            "-filter_complex",
            filter_graph,
            "-map",
            "[video]",
            "-map",
            "[audio]",
            "-t",
            str(DURATION),
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "19",
            "-c:a",
            "aac",
            "-b:a",
            "160k",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(output),
        ]
    )

    run(command)
    print(output)


if __name__ == "__main__":
    main()
