// Fixed lesson scope and key counts; only the actual exercise changes.
export const exercisePlans = [
  { focus: 'fj', learned: 'fj', lengths: [16, 16, 24] },
  { focus: 'dk', learned: 'fdjk', lengths: [16, 16, 24] },
  { focus: 'sl', learned: 'sdfjkl', lengths: [16, 16, 24] },
  { focus: 'a;', learned: 'asdfjkl;', lengths: [16, 16, 24] },
  { focus: 'gh', learned: 'asdfghjkl;', lengths: [16, 16, 24] },
  { focus: null, learned: 'asdfghjkl;', lengths: [32, 32, 32] },
];

function shuffle(values, random) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function nextPermutation(values) {
  let i = values.length - 2;
  while (i >= 0 && values[i] >= values[i + 1]) i--;
  if (i < 0) return false;
  let j = values.length - 1;
  while (values[j] <= values[i]) j--;
  [values[i], values[j]] = [values[j], values[i]];
  const tail = values.splice(i + 1).reverse();
  values.push(...tail);
  return true;
}

function format(keys) {
  const groups = [];
  for (let i = 0; i < keys.length; i += 4) groups.push(keys.slice(i, i + 4).join(''));
  return groups.join(' ');
}

// Every line differs from every line of the previous attempt and this attempt.
// The deterministic fallback also guarantees termination if RNG keeps repeating.
function freshLine(keys, excluded, random) {
  for (let attempt = 0; attempt < 32; attempt++) {
    const candidate = format(shuffle(keys, random));
    if (!excluded.has(candidate)) return candidate;
  }
  const ordered = [...keys].sort();
  do {
    const candidate = format(ordered);
    if (!excluded.has(candidate)) return candidate;
  } while (nextPermutation(ordered));
  throw new Error('Exercise pool exhausted');
}

import {getLesson,lessonKind,wordPool,sentenceRows} from '../../../shared/typing-foundation-curriculum.mjs';
export function generateExercise(stageIndex, previous = [], random = Math.random, lessonKey) {
  const lesson=getLesson(lessonKey);
  const kind=lessonKind(lesson,stageIndex);
  if(kind==='sentences'||kind==='mixed') {
    const excluded=new Set(previous);let offset=0;
    // Rotate choices as a deterministic fallback when randomness repeats.
    for(let attempt=0;attempt<64;attempt++) {
      const result=sentenceRows(xs=>xs[(Math.floor(random()*xs.length)+offset++)%xs.length],kind==='mixed');
      if(result.every(row=>!excluded.has(row)))return result;
      offset=attempt+1;
    }
    throw new Error('Sentence pool exhausted');
  }
  if(kind==='words') {
    const excluded=new Set(previous);
    return (stageIndex===5?[8,8,8]:[4,4,6]).map(count=>{
      for(let offset=0;offset<wordPool.length;offset++) {
        const line=Array.from({length:count},(_,i)=>wordPool[(Math.floor(random()*wordPool.length)+i+offset)%wordPool.length]).join(' ');
        if(!excluded.has(line)){excluded.add(line);return line;}
      }
      throw new Error('Word pool exhausted');
    });
  }
  const plan = lessonKey ? {...lesson.stages[stageIndex]} : exercisePlans[stageIndex];
  if(kind==='numbers')plan.learned='0123456789';
  if(kind==='symbols')plan.learned='!@#$%&*()-_=+[]{}<>?';
  if (!plan) throw new RangeError('Unknown lesson stage');
  const excluded = new Set(previous);
  let reviewBag = [];
  function takeReviewKey() {
    if (!reviewBag.length) reviewBag = shuffle(plan.learned, random);
    return reviewBag.pop();
  }
  return plan.lengths.map((length, row) => {
    // Each new key appears equally often in the two introductory rows.
    // Review draws without replacement, so the final challenge covers all keys.
    const keys = plan.focus && row < 2
      ? Array.from({ length }, (_, i) => plan.focus[i % plan.focus.length])
      : Array.from({ length }, takeReviewKey);
    const line = freshLine(keys, excluded, random);
    excluded.add(line);
    return line;
  });
}
