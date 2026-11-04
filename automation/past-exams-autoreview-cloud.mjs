// Shared guarded register/rollback/activate pipeline; no new permissions or schema.
process.env.PAST_REVISION_ROOT='automation/output/past-exams-autoreview-20261101';
process.env.PAST_REVISION_PAPERS='4';process.env.PAST_REVISION_BLOCKED='26';
await import('./past-exams-approved11-cloud.mjs');
