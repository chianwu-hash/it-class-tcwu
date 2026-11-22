// Compact release checks for payloads too large to repeat in every SQL request.
// PostgreSQL hashes its own JSONB representation on both the fixture and live DB.
const fingerprint = expression => `encode(sha256(convert_to((${expression})::text, 'UTF8')), 'hex')`;

export async function releaseFingerprints(db, candidates) {
  const projections = candidates.map(({ study, course_id, knowledge_reliable, ...pool }) => {
    const identity = { question_id: pool.question_id, course_id };
    return {
      id: pool.question_id,
      source_item_id: pool.source_item_id,
      group_key: pool.group_key,
      pool,
      membership: { ...identity, knowledge_reliable },
      study: { ...study, ...identity, question: pool.question },
    };
  });
  const { rows } = await db.query(`
    select e->>'id' id, e->>'source_item_id' source_item_id, e->>'group_key' group_key,
      ${fingerprint("e->'pool'")} pool,
      ${fingerprint("e->'membership'")} membership,
      ${fingerprint("e->'study'")} study
    from jsonb_array_elements($1::jsonb) with ordinality as incoming(e, position)
    order by position
  `, [JSON.stringify(projections)]);
  return rows;
}

// The enclosing query supplies an expected relation with id and the three fingerprints.
export const releaseFingerprintReadback = `
  select e.id,
    coalesce(p.usable, false) usable,
    coalesce(s.enabled, false) study_enabled,
    coalesce(${fingerprint("to_jsonb(p) - 'usable'")} = e.pool, false) pool_exact,
    coalesce(${fingerprint('to_jsonb(m)')} = e.membership, false) membership_exact,
    coalesce(${fingerprint("to_jsonb(s) - 'enabled'")} = e.study, false) study_exact
  from expected e
  left join public.quiz_question_pool p on p.question_id = e.id
  left join public.quiz_pool_membership m on m.question_id = e.id
  left join public.quiz_pool_study_sources s on s.question_id = e.id
`;
