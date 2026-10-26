let resolveMedia = null;
export const isSavedMedia = url => /^https:\/\/quiz-media\.invalid\/[0-9a-f-]{36}\/[0-9a-f]{64}$/.test(url);
export function configureQuizMedia(resolver) { resolveMedia = resolver; }
export async function resolveQuizMedia(url) {
  if (!isSavedMedia(url)) return url;
  if (!resolveMedia) throw new Error('媒體服務尚未就緒。');
  return resolveMedia(url);
}
