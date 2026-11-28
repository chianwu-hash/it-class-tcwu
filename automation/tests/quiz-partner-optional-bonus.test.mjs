import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setupProductionQuizDB} from '../fixtures/production-quiz-db.mjs';

const readMigration = async filename => (await readFile(filename, 'utf8')).replaceAll('\r\n', '\n');
const migration = await readMigration('supabase/quiz-partner-optional-bonus.sql');
const rollback = await readMigration('supabase/quiz-partner-optional-bonus-rollback.sql');
const names = ['action_core', 'learning_snapshot_pre_message_media', 'team_rooms', 'required_progress'];

test('夥伴選做題遷移可恢復原函式與權限，拒絕覆蓋換版後的函式', async () => {
  const {db} = await setupProductionQuizDB({snapshot: true});
  const definitions = async () => (await db.query(
    "select proname, md5(pg_get_functiondef(oid)) as fingerprint, proacl::text as acl, prosecdef from pg_proc where pronamespace='partner_pilot'::regnamespace and proname=any($1) order by proname",
    [names]
  )).rows;

  try {
    if ((await definitions()).some(entry => entry.proname === 'required_progress')) await db.exec(rollback);
    const original = await definitions();
    assert.equal(original.length, 3);
    await db.exec(migration);
    const applied = await definitions();
    const helper = applied.find(entry => entry.proname === 'required_progress');
    assert.ok(helper);
    assert.equal(helper.prosecdef, false);
    assert.match(helper.acl, /^\{postgres=X\/postgres\}$/);
    for (const entry of original) {
      const updated = applied.find(candidate => candidate.proname === entry.proname);
      assert.equal(updated.acl, entry.acl);
      assert.equal(updated.prosecdef, entry.prosecdef);
    }
    await db.exec(rollback);
    assert.deepEqual(await definitions(), original);

    await db.exec(migration);
    const {definition} = (await db.query(
      "select pg_get_functiondef('partner_pilot.team_rooms()'::regprocedure) as definition"
    )).rows[0];
    const modified = definition.replace('AS $function$', 'AS $function$\n-- Fixture: newer revision');
    await db.exec(modified);
    const updated = await definitions();
    await assert.rejects(db.exec(rollback), /Unexpected partner_pilot.team_rooms/);
    await db.exec('ROLLBACK');
    assert.deepEqual(await definitions(), updated);
  } finally {
    await db.close();
  }
});
