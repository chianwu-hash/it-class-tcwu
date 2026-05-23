---
name: chatgpt-image-workflow
description: Use the local ChatGPT browser image-generation workflow for this project. Trigger when Codex needs to generate classroom images, infographic cards, teaching visuals, or presentation-style images through the user's already logged-in ChatGPT page, preferring the CDP batch wrapper for reliable download and metadata, with the Codex Chrome extension only as a manual fallback.
---

# ChatGPT Image Workflow

Use this skill when this project needs images generated through the user's logged-in ChatGPT browser session.

Preferred route:

1. Use the CDP batch wrapper against a Chrome profile that is already logged in to ChatGPT.
2. Keep the prompt in a UTF-8 `.txt` file.
3. Let the wrapper submit the prompt, wait for image generation, download the result, and write metadata.
4. Continue with the project asset workflow: WebP compression, Cloudinary upload, and page reference updates.

Fallback route:

- Use the Codex Chrome extension only when CDP is unavailable or for quick visual inspection. The extension route is less reliable for automated download and metadata.

## Source Workflow

The reusable automation lives in the sibling repo:

```text
C:\Users\user\projects\browser-automation-workflow
```

Main script:

```text
C:\Users\user\projects\browser-automation-workflow\scripts\chatgpt-image-batch.js
```

This project provides an npm wrapper for the default CDP route:

```bash
npm run chatgpt:image-batch -- --cdp-url http://127.0.0.1:9333 --prompt-file <prompt.txt> --count 1 --min-images 1 --output-dir <dir> --meta <meta.json>
```

The wrapper now defaults to direct-prompt image generation: it sends the image prompt into the normal ChatGPT composer and downloads generated images from the authenticated `backend-api/estuary/content` image DOM. Use `--image-mode` only when intentionally testing the older explicit image-tool picker.

The wrapper depends on a CDP URL. It is not the same as the Codex Chrome extension route.

## Encoding Rule

For Chinese prompts, always use a UTF-8 prompt file. Do not pass Chinese text through `--prompt-text` or a PowerShell inline command.

Preferred prompt location for this course site:

```text
automation/prompts/
```

Preferred image output location:

```text
grade3/images/week12/
```

## Typical Workflow

1. Confirm Chrome CDP is reachable at `http://127.0.0.1:9333` or the user-specified port.
2. Confirm the CDP Chrome profile is logged in to ChatGPT.
3. Confirm a ChatGPT page is open and logged in.
4. Write the image prompt to a UTF-8 `.txt` file.
5. Run `npm run chatgpt:image-batch` with `--prompt-file`; direct-prompt mode is the default.
6. Use `--reuse-chat` when the next image should preserve visual continuity with the current ChatGPT image conversation.
7. Check the generated metadata JSON and image file path.
8. Use the generated image in the lesson page only after the teacher has approved the lesson plan and image.

## Example

```bash
npm run chatgpt:image-batch -- --cdp-url http://127.0.0.1:9333 --prompt-file automation/prompts/week12-safety-card.txt --count 1 --min-images 1 --output-dir grade3/images/week12 --output-prefix week12-safety-card --meta automation/output/week12-safety-card.json
```

## Notes

- Use `--reuse-chat` only when continuity with the current ChatGPT conversation is intentional.
- Direct-prompt mode does not need the ChatGPT image-tool picker. It submits the prompt, waits for generated images, then downloads the image from the authenticated page.
- Use `--image-mode` only for the legacy explicit image-mode workflow.
- Treat image generation success and download success as separate states. The JSON metadata is the best local record of what was downloaded.
