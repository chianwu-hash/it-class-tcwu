// Compact submits omit only the immutable question document. Never merge across attempts.
export function mergeQuizSnapshot(previous, next) {
  if (!next?.compact) return next;
  if (!previous?.document || !['attempt_id', 'session_id', 'version_id'].every(key =>
    typeof next[key] === 'string' && next[key] === previous[key])) {
    const error = new Error('正在重新確認已儲存的作答，請稍候。');
    error.code = 'quiz_snapshot_mismatch';
    throw error;
  }
  return { ...next, document: previous.document };
}
