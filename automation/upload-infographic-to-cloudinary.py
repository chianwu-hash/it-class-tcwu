#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import time
from pathlib import Path
from urllib import request


def load_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip()
    return env


def derive_folder(image_path: Path, grade: str | None, week: str | None) -> str:
    if grade and week:
        return f"it-class-tcwu/{grade}/{week}"
    parts = [part.lower() for part in image_path.parts]
    for index, part in enumerate(parts):
        if part in {"grade3", "grade6"} and index + 2 < len(parts) and parts[index + 1] == "images":
            return f"it-class-tcwu/{part}/{parts[index + 2].lower()}"
    raise ValueError("Unable to derive Cloudinary folder. Pass --grade and --week explicitly.")


def build_signature(params: dict[str, str], api_secret: str) -> str:
    sign_base = "&".join(f"{key}={params[key]}" for key in sorted(params)) + api_secret
    return hashlib.sha1(sign_base.encode("utf-8")).hexdigest()


def upload_image(
    *,
    env_path: Path,
    image_path: Path,
    folder: str,
    public_id: str,
    overwrite: bool,
    dry_run: bool,
) -> dict[str, str]:
    env = load_env(env_path)
    cloud_name = env.get("CLOUDINARY_CLOUD_NAME")
    api_key = env.get("CLOUDINARY_API_KEY")
    api_secret = env.get("CLOUDINARY_API_SECRET")
    if not all((cloud_name, api_key, api_secret)):
        raise RuntimeError("Cloudinary credentials are incomplete in .env")

    timestamp = str(int(time.time()))
    params = {
        "folder": folder,
        "public_id": public_id,
        "timestamp": timestamp,
        "overwrite": "true" if overwrite else "false",
        "use_filename": "false",
        "unique_filename": "false",
    }
    signature = build_signature(params, api_secret)
    secure_url = f"https://res.cloudinary.com/{cloud_name}/image/upload/{folder}/{public_id}{image_path.suffix.lower()}"

    if dry_run:
        return {
            "mode": "dry-run",
            "folder": folder,
            "public_id": public_id,
            "secure_url_guess": secure_url,
        }

    boundary = "----CodexCloudinaryBoundary" + timestamp
    content_type = mimetypes.guess_type(str(image_path))[0] or "application/octet-stream"
    body_parts: list[bytes] = []
    for key, value in {**params, "api_key": api_key, "signature": signature}.items():
        body_parts.append(
            (
                f"--{boundary}\r\n"
                f'Content-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'
            ).encode("utf-8")
        )
    file_header = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{image_path.name}"\r\n'
        f"Content-Type: {content_type}\r\n\r\n"
    ).encode("utf-8")
    body = b"".join(body_parts) + file_header + image_path.read_bytes() + f"\r\n--{boundary}--\r\n".encode("utf-8")

    url = f"https://api.cloudinary.com/v1_1/{cloud_name}/image/upload"
    req = request.Request(
        url,
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    with request.urlopen(req, timeout=180) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(description="Upload a course infographic to Cloudinary.")
    parser.add_argument("--input", required=True, help="Input image path.")
    parser.add_argument("--env-file", default="tools/cloudinary_upload/.env", help="Cloudinary .env path.")
    parser.add_argument("--grade", help="grade3 or grade6")
    parser.add_argument("--week", help="weekXX")
    parser.add_argument("--folder", help="Cloudinary folder override.")
    parser.add_argument("--public-id", help="Cloudinary public_id. Defaults to input stem.")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing asset with same public_id.")
    parser.add_argument("--dry-run", action="store_true", help="Validate parameters without uploading.")
    parser.add_argument("--json-out", help="Optional JSON output path.")
    args = parser.parse_args()

    image_path = Path(args.input).expanduser().resolve()
    env_path = Path(args.env_file).expanduser().resolve()
    if not image_path.exists():
        raise FileNotFoundError(f"Input image not found: {image_path}")
    if not env_path.exists():
        raise FileNotFoundError(f"Cloudinary .env not found: {env_path}")

    folder = args.folder or derive_folder(image_path, args.grade, args.week)
    public_id = args.public_id or image_path.stem
    result = upload_image(
        env_path=env_path,
        image_path=image_path,
        folder=folder,
        public_id=public_id,
        overwrite=args.overwrite,
        dry_run=args.dry_run,
    )

    if args.json_out:
        json_path = Path(args.json_out).expanduser().resolve()
        json_path.parent.mkdir(parents=True, exist_ok=True)
        json_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
