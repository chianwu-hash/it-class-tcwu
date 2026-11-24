import assert from 'node:assert/strict';
/** Header sniffing only; source SHA and browser decoding are separate checks. */
export function sniffQuestionImageMime(value){
 const bytes=Buffer.from(value);if(bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a')return 'image/png';
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if(bytes.length>=12&&bytes.subarray(0,4).toString('ascii')==='RIFF'&&bytes.subarray(8,12).toString('ascii')==='WEBP')return 'image/webp';
 assert.fail('Unsupported source image encoding; do not infer MIME from an extension');
}
