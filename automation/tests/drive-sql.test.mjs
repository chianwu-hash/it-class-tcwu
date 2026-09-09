import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

// Install PGlite outside the repository; no production dependency is added.
const require = createRequire(path.join(process.env.TEMP, 'codex-drive-validation', 'package.json'));
const { PGlite } = require('@electric-sql/pglite');
test('PostgreSQL migration, RLS grants, expiration and atomic state consumption', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      grant usage on schema public to anon, authenticated, service_role;
      insert into auth.users values ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');`);
    const sql = await readFile(new URL('../../supabase/drive_connections.sql', import.meta.url), 'utf8');
    await db.exec(sql); await db.exec(sql); // Existing deployment can safely reapply.
    const user = '00000000-0000-0000-0000-000000000001';
    const other = '00000000-0000-0000-0000-000000000002';
    const hash = 'A'.repeat(43), proof = 'B'.repeat(43);
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query('select * from public.drive_connections'), /permission denied/);
      await assert.rejects(db.query('select * from public.drive_oauth_states'), /permission denied/);
      await assert.rejects(db.query('select public.drive_begin_oauth($1,$2,$3)', [user, hash, proof]), /permission denied/);
      await assert.rejects(db.query('select public.drive_claim_oauth($1,$2,$3)', [user, hash, proof]), /permission denied/);
      await db.exec('reset role');
    }
    await db.exec('set role service_role');
    await db.query('select public.drive_begin_oauth($1,$2,$3)', [user, hash, proof]);
    const claim = async (u, h, p) => (await db.query('select public.drive_claim_oauth($1,$2,$3) as ok', [u, h, p])).rows[0].ok;
    assert.equal(await claim(other, hash, proof), false);
    assert.equal(await claim(user, hash, 'C'.repeat(43)), false);
    assert.equal(await claim(user, hash, proof), true);
    assert.equal(await claim(user, hash, proof), false);
    await db.query('select public.drive_begin_oauth($1,$2,$3)', [user, hash, proof]);
    await db.query('select public.drive_begin_oauth($1,$2,$3)', [user, 'D'.repeat(43), proof]);
    assert.equal(await claim(user, hash, proof), false);
    await db.exec('reset role');
    await db.exec("update public.drive_oauth_states set expires_at=now()-interval '1 second'");
    await db.exec('set role service_role');
    assert.equal(await claim(user, 'D'.repeat(43), proof), false);
    await db.query(`insert into public.drive_connections(owner_user_id,drive_email,google_subject,token_envelope,scopes)
      values ($1,'th990821@mail.thps.ntpc.edu.tw','subject','{}','{}')`, [user]);
    assert.equal((await db.query('select count(*)::integer as n from public.drive_connections')).rows[0].n, 1);
    await assert.rejects(db.query(`update public.drive_connections set drive_email='wrong@gmail.com'`), /check constraint/);
  } finally { await db.close(); }
});
