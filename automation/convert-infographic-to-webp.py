#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageOps


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Convert an infographic source image into a resized WebP asset."
    )
    parser.add_argument("--input", required=True, help="Source image path.")
    parser.add_argument("--output", required=True, help="Output WebP path.")
    parser.add_argument("--width", type=int, default=1920, help="Output width.")
    parser.add_argument("--height", type=int, default=1080, help="Output height.")
    parser.add_argument(
        "--quality", type=int, default=80, help="WebP quality (0-100)."
    )
    parser.add_argument(
        "--fit",
        choices=("cover", "contain"),
        default="cover",
        help="Resize mode. 'cover' fills target size by center-cropping. "
        "'contain' letterboxes inside target size.",
    )
    parser.add_argument(
        "--background",
        default="#ffffff",
        help="Background color used by contain mode or alpha flattening.",
    )
    return parser


def convert_image(
    source_path: Path,
    output_path: Path,
    width: int,
    height: int,
    quality: int,
    fit: str,
    background: str,
) -> None:
    with Image.open(source_path) as source_image:
        source_image = ImageOps.exif_transpose(source_image).convert("RGBA")
        target_size = (width, height)

        if fit == "cover":
            result = ImageOps.fit(
                source_image,
                target_size,
                method=Image.Resampling.LANCZOS,
                centering=(0.5, 0.5),
            )
        else:
            contained = source_image.copy()
            contained.thumbnail(target_size, Image.Resampling.LANCZOS)
            result = Image.new("RGBA", target_size, background)
            offset = (
                (width - contained.width) // 2,
                (height - contained.height) // 2,
            )
            result.paste(contained, offset, contained)

        output_path.parent.mkdir(parents=True, exist_ok=True)
        result.save(output_path, format="WEBP", quality=quality, method=6)


def main() -> int:
    args = build_parser().parse_args()
    source_path = Path(args.input).expanduser().resolve()
    output_path = Path(args.output).expanduser().resolve()

    if not source_path.exists():
        raise FileNotFoundError(f"Source image not found: {source_path}")

    if output_path.suffix.lower() != ".webp":
        raise ValueError(f"Output must be a .webp file: {output_path}")

    convert_image(
        source_path=source_path,
        output_path=output_path,
        width=args.width,
        height=args.height,
        quality=args.quality,
        fit=args.fit,
        background=args.background,
    )

    print(f"Saved {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
