# File Reference Response Format

Use this mini reference whenever an AI needs to report local files back to the user.

## Core rule

Never return only an editor-only or UI-only internal link.
Always include a plain Windows absolute path that the user can copy directly.

## Required format

When mentioning a local file, use this pattern:

```text
檔案名稱：C:\Users\user\projects\it-class-tcwu\path\to\file.ext
```

If the interface also supports clickable local-file links, you may add one, but the Windows path must still remain in the response.

## Good examples

```text
題庫檔案：C:\Users\user\projects\it-class-tcwu\automation\question-banks\grade6-chinese-midterm-lessons1-3.md
```

```text
Gemini round1：
C:\Users\user\projects\it-class-tcwu\automation\output\gemini-reviews\grade6-chinese-role-reset-2026-04-10-round1\grade6-chinese-midterm-lessons1-3.txt
```

```text
Gemini round2：
C:\Users\user\projects\it-class-tcwu\automation\output\gemini-reviews\grade6-chinese-role-reset-2026-04-10-round2\grade6-chinese-midterm-lessons1-3.txt
```

## Bad examples

Do not use these as the only reference:

```text
round1
round2
round3
```

```text
file+.vscode-resource...
```

```text
請看輸出資料夾裡的那三個檔案
```

## When listing multiple files

- Give every file its own full absolute path.
- Do not force the user to infer the directory structure.
- If the files are related, label them clearly, for example `round1`, `round2`, `round3`.
