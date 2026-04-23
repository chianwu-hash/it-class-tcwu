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


def build_signature(params: dict[str, str], api_secret: str) -> str:
    sign_base = "&".join(f"{key}={params[key]}" for key in sorted(params)) + api_secret
    return hashlib.sha1(sign_base.encode("utf-8")).hexdigest()


def upload_asset(
    *,
    env_path: Path,
    input_path: Path,
    folder: str,
    public_id: str,
    resource_type: str,
    overwrite: bool,
    dry_run: bool,
) -> dict[str, object]:
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
    secure_url_guess = (
        f"https://res.cloudinary.com/{cloud_name}/{resource_type}/upload/"
        f"{folder}/{public_id}{input_path.suffix.lower()}"
    )

    if dry_run:
        return {
            "mode": "dry-run",
            "folder": folder,
            "public_id": public_id,
            "resource_type": resource_type,
            "secure_url_guess": secure_url_guess,
        }

    boundary = "----CodexCloudinaryBoundary" + timestamp
    content_type = mimetypes.guess_type(str(input_path))[0] or "application/octet-stream"
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
        f'Content-Disposition: form-data; name="file"; filename="{input_path.name}"\r\n'
        f"Content-Type: {content_type}\r\n\r\n"
    ).encode("utf-8")
    body = b"".join(body_parts) + file_header + input_path.read_bytes() + f"\r\n--{boundary}--\r\n".encode("utf-8")

    url = f"https://api.cloudinary.com/v1_1/{cloud_name}/{resource_type}/upload"
    req = request.Request(
        url,
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    with request.urlopen(req, timeout=300) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(description="Upload a generic course asset to Cloudinary.")
    parser.add_argument("--input", required=True, help="Input asset path.")
    parser.add_argument("--env-file", default="tools/cloudinary_upload/.env", help="Cloudinary .env path.")
    parser.add_argument("--folder", required=True, help="Cloudinary folder.")
    parser.add_argument("--public-id", help="Cloudinary public_id. Defaults to input stem.")
    parser.add_argument(
        "--resource-type",
        default="image",
        choices=("image", "video", "raw", "auto"),
        help="Cloudinary resource type. Use video for audio files such as MP3.",
    )
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing asset with same public_id.")
    parser.add_argument("--dry-run", action="store_true", help="Validate parameters without uploading.")
    parser.add_argument("--json-out", help="Optional JSON output path.")
    args = parser.parse_args()

    input_path = Path(args.input).expanduser().resolve()
    env_path = Path(args.env_file).expanduser().resolve()
    if not input_path.exists():
        raise FileNotFoundError(f"Input asset not found: {input_path}")
    if not env_path.exists():
        raise FileNotFoundError(f"Cloudinary .env not found: {env_path}")

    result = upload_asset(
        env_path=env_path,
        input_path=input_path,
        folder=args.folder,
        public_id=args.public_id or input_path.stem,
        resource_type=args.resource_type,
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
