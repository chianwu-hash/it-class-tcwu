// Printed student-textbook pages, bound to the reviewed past-exam version and group.
const citations={
 '2f1f3092-8c07-42f5-96db-cfff37ae5070':{year:113,rows:{
  'choice-01':[false,[2,[38]]],
  'choice-02':[false,[2,[42]]],
  'choice-03':[false,[2,[43,44]]],
  'choice-04':[true,[2,[38,46]]],
  'choice-05':[false,[3,[66,67]],[2,[38]]],
  'choice-06':[false,[3,[68,71,73]]],
  'choice-07':[false,[3,[66,73]]],
  'choice-08':[false,[3,[73]]],
  'choice-09':[true,[2,[46]],[3,[74,76]]],
  'choice-10':[false,[6,[166,167]]],
  'choice-11':[false,[6,[176,177]]],
  'choice-12':[false,[6,[178,179]]],
  'choice-13':[false,[6,[167]]],
  'choice-14':[false,[2,[33,34]]],
  'choice-15':[true,[2,[36,37,38]]],
  'choice-16':[false,[2,[41]]],
  'choice-17':[false,[6,[166,167]]],
  'choice-18':[false,[6,[167,174]]],
  'choice-19':[false,[6,[173]]],
  'choice-20':[false,[2,[43,44,45]]],
  'choice-21':[false,[2,[41,46]]],
  'choice-22':[false,[3,[66,71]]],
  'choice-23':[false,[3,[73]]],
  'choice-24':[false,[2,[53,55]]],
  'choice-25':[false,[3,[80]]],
  'choice-26':[false,[3,[78,79]]],
  'choice-27':[false,[3,[74,75,76]]],
  'choice-28':[true,[6,[162,181]]],
  'choice-29':[false,[6,[179,180]]],
  'choice-30':[false,[6,[170,176,178]],[5,[143,145]]],
  'choice-31':[true,[3,[78,79]]],
  'choice-32':[true,[2,[41]],[3,[81]]],
  'choice-33':[true,[3,[81]],[2,[38,41]]],
 }},
 '0bb00384-8a6a-49ec-9941-fa4a4896a26a':{year:114,rows:{
  'choice-01':[true,[2,[35,38]]],
  'choice-02':[false,[2,[38]]],
  'choice-03':[false,[2,[38]]],
  'choice-04':[false,[2,[41]]],
  'choice-05':[false,[2,[40,41]]],
  'choice-06':[false,[2,[43,44,45]]],
  'choice-07':[false,[3,[65,66]],[2,[38]]],
  'choice-08':[true,[3,[67,69,86]]],
  'choice-09':[false,[3,[68,71,73]]],
  'choice-10':[false,[3,[69,74]]],
  'choice-11':[false,[2,[48,49]]],
  'choice-12':[false,[2,[53,55]]],
  'choice-13':[false,[6,[166,167]]],
  'choice-14':[false,[6,[173]]],
  'choice-15':[false,[6,[170,176]],[5,[152]]],
  'choice-16':[false,[6,[180]]],
  'choice-17':[false,[2,[34,41]]],
  'choice-18':[false,[2,[38]]],
  'choice-19':[false,[2,[38]]],
  'choice-20':[false,[2,[38,39]]],
  'choice-21':[false,[2,[38,41]]],
  'choice-22':[false,[2,[38,41]]],
  'choice-23':[false,[2,[46]]],
  'choice-24':[false,[2,[43,44]]],
  'choice-25':[false,[3,[65,66]],[2,[38]]],
  'choice-26':[false,[3,[67,71]]],
  'choice-27':[false,[3,[66,69]]],
  'choice-28':[true,[3,[68,71]]],
  'choice-29':[false,[3,[68,73]]],
  'choice-30':[false,[3,[66,69,74]]],
  'choice-31':[false,[2,[48,49]]],
  'choice-32':[false,[2,[53,55]]],
  'choice-33':[false,[6,[166]]],
  'choice-34':[false,[6,[164,165,178]]],
  'choice-35':[false,[6,[166,176,178]]],
  'choice-36':[false,[6,[167,170]]],
  'choice-37':[false,[6,[167,178]],[5,[143,145]]],
  'choice-38':[false,[5,[152,153]]],
  'choice-39':[false,[6,[178,179]]],
  'choice-40':[false,[6,[179,181]]],
 }},
};

// Original student textbook files. The publisher serves these as PDF downloads.
const chapterFiles={
 113:{
  2:'03-113國中自然3上課本CH2(113f254841).pdf',
  3:'04-113國中自然3上課本CH3(113f254842).pdf',
  5:'07-113國中自然3上課本CH5(113f254845).pdf',
  6:'08-113國中自然3上課本CH6(113f254846).pdf',
 },
 114:{
  2:'03-114國中自然3上課本CH2-理化(114f245111).pdf',
  3:'04-114國中自然3上課本CH3-理化(114f245112).pdf',
  5:'07-114國中自然3上課本CH5-地科(114f245115).pdf',
  6:'08-114國中自然3上課本CH6-地科(114f245116).pdf',
 },
};
const firstPrintedPage={2:30,3:62,5:130,6:162};

export function pastTextbookCitation(version,groupId){
 if(!Object.hasOwn(citations,version))return null;
 const {year,rows}=citations[version];
 if(!Object.hasOwn(rows,groupId))return null;
 const [related,...locations]=rows[groupId];
 const sections=locations.map(([chapter,pages])=>({
  chapter,
  pages:[...pages],
  pdfPages:pages.map(page=>page-firstPrintedPage[chapter]+1),
  downloadUrl:'https://resource.hle.com.tw/Books/BooksResource/'+encodeURIComponent(chapterFiles[year][chapter]),
 }));
 return {book:year+'上學期翰林版《國中自然科學 3 上》課本',related,sections};
}
