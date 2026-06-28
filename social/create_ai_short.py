#!/usr/bin/env python3
from pathlib import Path
import subprocess
import textwrap

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
AUDIO_DIR = ROOT / "audio"
ASSET_DIR = ROOT / "assets"
VIDEO_DIR = ROOT / "videos"

WIDTH = 1080
HEIGHT = 1920
DURATION = 8

BOLD_FONT = Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf")
REGULAR_FONT = Path("/System/Library/Fonts/Supplemental/Arial.ttf")


def run(command):
    subprocess.run(command, check=True)


def wrapped_lines(draw, text, font, max_width):
    words = text.split()
    lines = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if draw.textbbox((0, 0), candidate, font=font)[2] <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def make_text_overlay(filename, text, font_size, color, max_width=900):
    font = ImageFont.truetype(str(BOLD_FONT), font_size)
    image = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    lines = wrapped_lines(draw, text, font, max_width)
    line_height = int(font_size * 1.15)
    block_height = line_height * len(lines)
    y = (HEIGHT - block_height) // 2

    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font)
        x = (WIDTH - (bbox[2] - bbox[0])) // 2
        draw.text((x + 4, y + 4), line, font=font, fill=(0, 0, 0, 120))
        draw.text((x, y), line, font=font, fill=color)
        y += line_height

    output = ASSET_DIR / filename
    image.save(output)
    return output


def make_footer(filename, text):
    font = ImageFont.truetype(str(REGULAR_FONT), 38)
    image = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    bbox = draw.textbbox((0, 0), text, font=font)
    x = (WIDTH - (bbox[2] - bbox[0])) // 2
    y = 1710
    draw.rounded_rectangle((x - 36, y - 22, x + (bbox[2] - bbox[0]) + 36, y + 64), radius=36, fill=(0, 0, 0, 95))
    draw.text((x, y), text, font=font, fill=(255, 255, 255, 210))
    output = ASSET_DIR / filename
    image.save(output)
    return output


def main():
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    VIDEO_DIR.mkdir(parents=True, exist_ok=True)

    script = (
        "This is the first AI generated short made from inside our workspace. "
        "Type the idea here, and Codex can turn it into a vertical video."
    )
    audio_path = AUDIO_DIR / "proof-of-work.aiff"
    run(["say", "-v", "Samantha", "-o", str(audio_path), script])

    overlays = [
        make_text_overlay("proof-title.png", "TYPE THE IDEA HERE", 82, (255, 255, 255, 255)),
        make_text_overlay("proof-middle.png", "CODEX MAKES THE SHORT", 74, (255, 255, 255, 255)),
        make_text_overlay("proof-end.png", "VERTICAL MP4 READY TO POST", 66, (255, 224, 138, 255)),
        make_footer("proof-footer.png", "AI VIDEO PIPELINE ONLINE"),
    ]

    output_path = VIDEO_DIR / "proof-of-work.mp4"
    filter_graph = textwrap.dedent(
        """
        [0:v]format=rgba,colorchannelmixer=aa=0.88[base];
        [base][2:v]overlay=0:0:enable='between(t,0,2.6)'[v1];
        [v1][3:v]overlay=0:0:enable='between(t,2.2,5.0)'[v2];
        [v2][4:v]overlay=0:0:enable='between(t,4.7,8.0)'[v3];
        [v3][5:v]overlay=0:0[vout]
        """
    ).strip()

    command = [
        "ffmpeg",
        "-y",
        "-f",
        "lavfi",
        "-i",
        "gradients=size=1080x1920:duration=8:rate=30:c0=0x101820:c1=0x0E6F73:c2=0xD7A93B:c3=0xD85C3A:speed=0.12",
        "-i",
        str(audio_path),
    ]
    for overlay in overlays:
        command.extend(["-loop", "1", "-i", str(overlay)])

    command.extend(
        [
            "-filter_complex",
            filter_graph,
            "-map",
            "[vout]",
            "-map",
            "1:a",
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "20",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-shortest",
            "-pix_fmt",
            "yuv420p",
            str(output_path),
        ]
    )
    run(command)
    print(output_path)


if __name__ == "__main__":
    main()
