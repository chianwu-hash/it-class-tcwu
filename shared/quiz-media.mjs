let resolveMedia = null;
export const isSavedMedia = url => /^https:\/\/quiz-media\.invalid\/[0-9a-f-]{36}\/[0-9a-f]{64}$/.test(url);
export function configureQuizMedia(resolver) { resolveMedia = resolver; }
export async function resolveQuizMedia(url) {
  if (!isSavedMedia(url)) return url;
  if (!resolveMedia) throw new Error('媒體服務尚未就緒。');
  try {return await resolveMedia(url);}catch(error){
    // Only retry this read on a transient service/network failure. Never replay writes
    // or retry an expired/changed login; the transport rechecks identity each time.
    if(!['media_unavailable','service_unavailable'].includes(error.code)&&!/^(連線逾時|網路中斷)/.test(error.message))throw error;
    await new Promise(resolve=>setTimeout(resolve,600));
    return resolveMedia(url);
  }
}
