---
name: builtin-image-workflow
description: Use the Codex/ChatGPT built-in image generation tool for quick classroom visuals, TV-wall posters, teaching cards, and A/B image tests when the user wants convenience over the browser-based ChatGPT CDP workflow. Prefer this skill when the user asks to try built-in image generation, compare it with ChatGPT Images through 9233, or quickly generate Traditional Chinese educational images without using an API key or browser automation.
---

# Builtin Image Workflow

Use this workflow as the experimental default on the `experiment/builtin-image-workflow` branch. Keep the existing `chatgpt-image-workflow` available for browser-based ChatGPT generation through CDP ports such as `9233`.

## Decision Rule

Use built-in image generation when:

- The user wants a fast one-off image, poster, card, or classroom visual.
- The image does not need continuity with an existing ChatGPT web conversation.
- The user wants to test whether built-in generation is good enough.
- The user does not need the ChatGPT web DOM/download workflow.

Use `chatgpt-image-workflow` instead when:

- The user explicitly says to use `9233`, ChatGPT web, CDP, browser, or ChatGPT Images.
- The work must preserve style continuity inside a ChatGPT web conversation.
- The user is debugging browser login, download DOM, or ChatGPT web behavior.
- The output must be generated from the user's logged-in ChatGPT session.

If the user asks which one to use and gives no preference, use built-in generation first during this branch trial, then offer to compare with the `9233` workflow when quality matters.

## Built-In Generation Steps

1. Draft the prompt in the conversation or read an existing prompt file.
2. Call the built-in image tool directly with the full prompt.
3. Do not claim a model/version number unless the tool exposes one. Current observed behavior saves PNG files only, without metadata.
4. Find generated files under:

```text
C:\Users\user\.codex\generated_images\
```

5. If the user needs the image in the repo, copy the generated PNG to a project path and leave the original in place.
6. If the output is for a live class page, inspect the image manually with `view_image` before using it.

## Output Handling

For ad hoc images:

- Leave the generated file in `.codex/generated_images`.
- Report the exact path.

For project assets:

- Copy the selected image into the appropriate repo folder, usually:

```text
grade3/images/weekXX/
grade6/images/weekXX/
tmp/<topic>/
```

- Use descriptive file names, for example:

```text
international-nurses-day-tv-wall-2026.png
week14-safety-card-01-builtin-test-a.png
```

For A/B tests:

- Generate two images from the same prompt.
- Copy or list both output paths.
- Compare:
  - Traditional Chinese text accuracy
  - Visual clarity at classroom/projector distance
  - 16:9 composition
  - Brand/logo safety
  - Whether the content matches the lesson objective

## Prompt Guidance

For Traditional Chinese teaching visuals:

- Ask for `繁體中文` explicitly.
- Include exact text blocks to render.
- Ask for large, readable, classroom-slide typography.
- Say `不要出現簡體字、亂碼、真實商標、真實網址、真實 QR Code`.
- For safety or scam topics, keep the tone child-friendly and non-scary.

For TV-wall posters:

- Ask for `16:9 橫式`.
- Keep text short: one main title, one subtitle, one small line.
- Ask for high contrast and readable text from a distance.

## Known Limits

- The built-in tool is not tied to the user's OpenAI API key.
- The built-in tool is not the `9233` ChatGPT browser session.
- The current workflow cannot identify the underlying image model/version.
- The tool may produce good Traditional Chinese, but still inspect every image before live use.
- For generated Chinese text, visual inspection is mandatory because OCR-like mistakes can still happen.

## Branch Trial Notes

During this branch trial:

- Prefer built-in generation for new quick visuals unless the user explicitly asks for `9233`.
- Keep prompt files optional; direct prompting is acceptable for simple images.
- Record notable successes or failures in the final response or a project note when they affect the future default choice.
- Do not remove or rewrite `skills/chatgpt-image-workflow`; the goal is comparison, not replacement yet.
