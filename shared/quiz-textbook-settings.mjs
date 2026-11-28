// Reviewed per-edition book IDs; reading direction follows binding, not subject or text layout.
const settings=Object.freeze({
  'c26493b9-ec9f-5f17-91af-99dc2d88a508':Object.freeze({readingDirection:'rtl'}), // 康軒115上三年級國語
  // 康軒115上四年級國語第七至第十二課，依同版原頁裝訂。
  '479f5606-b8ff-53a3-a398-398f42ddea55':Object.freeze({readingDirection:'rtl'}),
  'ddc22746-f922-505c-a65f-6c7fea35b6e3':Object.freeze({readingDirection:'rtl'}),
  '0da18d0c-4269-5b72-aed7-31c439dcb638':Object.freeze({readingDirection:'rtl'}),
  'b33e5c9e-66f9-5b39-adff-85c98e5e2d9b':Object.freeze({readingDirection:'rtl'}),
  '060de546-bc07-5fc7-ad05-43bbceb92979':Object.freeze({readingDirection:'rtl'}),
  '75ede99a-853e-55f9-9f01-2093b0fc9333':Object.freeze({readingDirection:'rtl'}),
  '3d465a46-a690-5917-b5ae-290a9893ab1c':Object.freeze({readingDirection:'rtl'}), // 第十至十二課合冊
  'c29f895f-17e1-59eb-b81e-49e58d2210f4':Object.freeze({readingDirection:'rtl'}), // 康軒115上六年級國語
});
export const textbookReadingDirection=bookId=>Object.hasOwn(settings,bookId)?settings[bookId].readingDirection:'ltr';
