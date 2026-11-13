// Reviewed per-edition book IDs; reading direction follows binding, not subject or text layout.
const settings=Object.freeze({
  'c26493b9-ec9f-5f17-91af-99dc2d88a508':Object.freeze({readingDirection:'rtl'}), // 康軒115上三年級國語
  'c29f895f-17e1-59eb-b81e-49e58d2210f4':Object.freeze({readingDirection:'rtl'}), // 康軒115上六年級國語
});
export const textbookReadingDirection=bookId=>Object.hasOwn(settings,bookId)?settings[bookId].readingDirection:'ltr';
