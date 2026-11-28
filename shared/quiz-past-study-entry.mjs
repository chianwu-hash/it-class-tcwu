// Reviewed 115-material releases. This is navigation metadata, never media authority.
const releases = new Map([
 ['zhongzheng-113-1-g9-exam2-social', 'cf67c5c7-029c-4c83-9055-4947d5040178'],
 ['zhongzheng-114-1-g9-exam2-social', 'c04c3b2f-552d-442c-ae06-f33274cf8c0e'],
]);
const validGroup = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
export const pastStudyEntryError = '這個教材連結的試卷版本已變更或無法確認，請返回考前練功坊選擇試卷；原小隊與作答仍保留。';

export function partnerPastStudyHref(room, question) {
 const paper = room?.paperInfo?.past?.sourcePaper;
 const version = room?.paperInfo?.sourceVersion;
 const group = question?.past?.group;
 if (room?.paperInfo?.grade !== 9 || !releases.has(paper) || releases.get(paper) !== version || !validGroup(group)) return null;
 const params = new URLSearchParams({paper, study_version:version, study_group:group});
 return '/grade9/115-1/past-exam.html?' + params;
}

export function readPastStudyEntry(href, paperId) {
 const url = new URL(href);
 const p = url.searchParams;
 if (!p.has('study_version') && !p.has('study_group')) return null;
 if (url.pathname !== '/grade9/115-1/past-exam.html' ||
     ['paper','study_version','study_group'].some(key => p.getAll(key).length !== 1) ||
     p.get('paper') !== paperId || !releases.has(paperId) ||
     releases.get(paperId) !== p.get('study_version') || !validGroup(p.get('study_group'))) {
  throw Error(pastStudyEntryError);
 }
 return {paperId, version:p.get('study_version'), groupId:p.get('study_group')};
}

export function assertPastStudySource(entry, catalog) {
 if (!entry) return;
 const paper = catalog?.papers?.find(p => p.id === entry.paperId);
 if (!paper || paper.grade !== 9 || paper.enabled === false || paper.version !== entry.version) throw Error(pastStudyEntryError);
}

export function assertPastStudySnapshot(entry, snapshot) {
 if (!entry) return;
 if (snapshot?.version !== entry.version || !snapshot.groups?.some(g => g.id === entry.groupId)) throw Error(pastStudyEntryError);
}
