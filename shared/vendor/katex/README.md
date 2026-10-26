# KaTeX

本機固定使用 KaTeX 0.16.22（MIT），來自 `katex@0.16.22` npm 套件的 `dist/`。
保留原始 `LICENSE`、JS、CSS 與字型。題庫排版不依賴外部公式 CDN。

`shared/quiz-render.mjs` 使用 `trust: false`、`throwOnError: true`，以 HTML＋MathML 排版。
變更版本時需同步 JS、CSS、字型並重新驗證分數、根號、上下標與不安全指令。
