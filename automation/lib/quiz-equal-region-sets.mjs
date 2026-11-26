// Existing fields-v1 grading compares whole sets against an allowlist.
// Geometry and stable option IDs come from the separately reviewed source.
export function equalRegionAnswers(regionIds, selectedCount) {
  if (!Array.isArray(regionIds) || regionIds.length < 2 || regionIds.length > 8 ||
      new Set(regionIds).size !== regionIds.length ||
      regionIds.some(id => typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(id))) {
    throw new Error('等分圖須有 2 至 8 個不同的區域代號');
  }
  if (!Number.isInteger(selectedCount) || selectedCount < 1 || selectedCount >= regionIds.length) {
    throw new Error('塗色數量須介於 1 與總區域數之間');
  }

  const answers = [];
  function collect(start, selected) {
    if (selected.length === selectedCount) {
      answers.push(selected);
      if (answers.length > 20) throw new Error('合法塗法超過現行上限 20 組');
      return;
    }
    const needed = selectedCount - selected.length;
    for (let index = start; index <= regionIds.length - needed; index++) {
      collect(index + 1, [...selected, regionIds[index]]);
    }
  }
  collect(0, []);
  return answers;
}
