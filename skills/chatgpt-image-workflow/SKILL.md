---
name: chatgpt-image-workflow
description: Use the local ChatGPT browser image-generation workflow for this project. Trigger when Codex needs to generate classroom images, infographic cards, teaching visuals, or presentation-style images through the already logged-in ChatGPT page on CDP port 9333, especially with Chinese prompt files and downloadable image outputs.
---

# ChatGPT Image Workflow

Use this skill when this project needs images generated through the user's logged-in ChatGPT browser session.

## Source Workflow

The reusable automation lives in the sibling repo:

```text
C:\Users\user\projects\browser-automation-workflow
```

Main script:

```text
C:\Users\user\projects\browser-automation-workflow\scripts\chatgpt-image-batch.js
```

This project provides an npm wrapper:

```bash
npm run chatgpt:image-batch -- --cdp-url http://127.0.0.1:9333 --prompt-file <prompt.txt> --count 1 --min-images 1 --output-dir <dir> --meta <meta.json>
```

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

1. Confirm Chrome CDP is reachable at `http://127.0.0.1:9333`.
2. Confirm a ChatGPT page is open and logged in.
3. Write the image prompt to a UTF-8 `.txt` file.
4. Run `npm run chatgpt:image-batch` with `--prompt-file`.
5. Check the generated metadata JSON and image file path.
6. Use the generated image in the lesson page only after the teacher has approved the lesson plan and image.

## Example

```bash
npm run chatgpt:image-batch -- --cdp-url http://127.0.0.1:9333 --prompt-file automation/prompts/week12-safety-card.txt --count 1 --min-images 1 --output-dir grade3/images/week12 --output-prefix week12-safety-card --meta automation/output/week12-safety-card.json
```

## Notes

- Use `--reuse-chat` only when continuity with the current ChatGPT conversation is intentional.
- The automation enables ChatGPT image mode, submits the prompt, waits for generated images, then downloads the image from the authenticated page.
- Treat image generation success and download success as separate states. The JSON metadata is the best local record of what was downloaded.
