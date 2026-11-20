import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { challenges, courseId, weekCode } from '../../grade6/115-1/week12-typing-content.mjs';
import { buildKeyboardGuideModel } from '../../shared/typing-guide-model.mjs';
import { splitSnapshot } from '../lib/db-snapshot.mjs';
import { setup } from '../lib/garden-level2-local-db.mjs';

async function loadShared(file) {
    const asUrl = text => 'data:text/javascript;base64,' + Buffer.from(text).toString('base64');
    const config = asUrl(await fs.readFile('shared/reward-tree-config.js', 'utf8'));
    return import(file === 'reward-tree-config.js'
        ? config
        : asUrl((await fs.readFile('shared/' + file, 'utf8')).replace('./reward-tree-config.js', config)));
}

test('六關、兩個魔王、各兩組換題及每行按鍵完整', () => {
    assert.deepEqual(Object.values(challenges).map(c => c.levels.length), [6, 1, 1]);
    for (const challenge of Object.values(challenges)) {
        for (const [index, level] of challenge.levels.entries()) {
            assert.equal(level.id, index + 1);
            const prompts = [level.main, ...level.replays];
            assert.equal(new Set(prompts.map(p => p.ans)).size, 3);
            for (const prompt of prompts) {
                assert.ok(prompt.source);
                assert.equal(prompt.ans, prompt.lines.map(line => typeof line === 'string' ? line : line.text).join('\n'));
                for (const line of prompt.lines) {
                    const model = buildKeyboardGuideModel(typeof line === 'string' ? { text: line } : line);
                    const text = typeof line === 'string' ? line : line.text;
                    assert.equal(model.items.map(i => i.char).join(''), text);
                    assert.equal(model.warning, '', text);
                    assert.ok(model.items.filter(i => i.kind === 'han').every(i => i.keys.length > 0), text);
                    if (typeof line === 'string') assert.equal(model.lang, 'en');
                    else assert.equal(model.lang, 'zh');
                }
            }
        }
    }
    const polyphones = buildKeyboardGuideModel(challenges.zh.levels[0].main.lines[2]).items.filter(i => i.char === '為');
    assert.deepEqual(polyphones.map(i => i.syllable), ['ㄨㄟˊ', 'ㄨㄟˋ']);
});

test('第 12 週 SQL 可重跑，與努力樹的前端及正式函式獎勵一致', async () => {
    const { getRewardTreeCourse } = await loadShared('reward-tree-config.js');
    const { deriveRewardTreeModel } = await loadShared('reward-tree-model.js');
    const activities = getRewardTreeCourse(courseId).activities;
    const current = activities.filter(a => a.weekCode === weekCode);
    assert.deepEqual(current.map(a => a.activityKey), Object.values(challenges).map(c => c.key));
    assert.ok(activities.some(a => a.weekCode === '11' && a.activityKey === challenges.regular.key));
    const db = await setup();
    try {
        await db.exec(`alter table garden_growth add column foundation_reward_version integer default 1;
            create table foundation_milestone_policy(id boolean,activated_at timestamptz);
            create function foundation_milestone_rewards(text,jsonb) returns jsonb language sql as $$select '[]'::jsonb$$;
            create function quiz_partner_reward_ids(text) returns jsonb language sql as $$select '[]'::jsonb$$;
            update student_enrollments set class_code='604';
            insert into garden_reward_catalog select 'grade6-115-1',week_code,activity_key,kind,total_levels,reward_mode from garden_reward_catalog where course_id='grade3-115-1';
            insert into student_progress select user_id,'grade6-115-1',week_code,activity_key,current_level,completed from student_progress where course_id='grade3-115-1';`);
        const snapshot = await fs.readFile('supabase/production-snapshot/functions.sql', 'utf8');
        const growth = splitSnapshot(snapshot).find(f => f.signature === 'garden_growth(text,text)');
        await db.exec(growth.definition + ';');
        const sql = await fs.readFile('supabase/grade6-week12-catalog.sql', 'utf8');
        const previous = (await db.query('select * from student_progress')).rows;
        await db.exec(sql);
        await db.exec(sql);
        assert.deepEqual((await db.query('select * from student_progress')).rows, previous);
        const fetchGrowth = async () => (await db.query('select garden_growth($1) result', [courseId])).rows[0].result;
        await fetchGrowth();
        for (let n = 0; n <= 6; n++) {
            await db.query('delete from student_progress where course_id=$1 and week_code=$2', [courseId, weekCode]);
            const row = { course_id: courseId, week_code: weekCode, activity_key: challenges.regular.key, current_level: Math.min(n + 1, 6), completed: n === 6 };
            if (n) await db.query('insert into student_progress values(auth.uid(),$1,$2,$3,$4,$5)', Object.values(row));
            const frontend = deriveRewardTreeModel(n ? [row] : [], current);
            const backend = await fetchGrowth();
            assert.equal(backend.newLeaves, n >= 5 ? 1 : 0);
            assert.equal(backend.newFlowers, n === 6 ? 1 : 0);
            assert.deepEqual(new Set(backend.order.filter(reward => reward.id.startsWith(courseId + ':' + weekCode + ':')).map(reward => reward.id)), new Set(frontend.rewards.map(reward => reward.id)));
        }
        for (const boss of [challenges.zh, challenges.en]) {
            await db.query('insert into student_progress values(auth.uid(),$1,$2,$3,1,true)', [courseId, weekCode, boss.key]);
        }
        const full = await fetchGrowth();
        assert.deepEqual([full.newLeaves, full.newFlowers], [1, 3]);
        assert.deepEqual((await fetchGrowth()).order, full.order);
        await db.query('update garden_reward_catalog set total_levels=5 where course_id=$1 and week_code=$2 and activity_key=$3', [courseId, weekCode, challenges.regular.key]);
        await assert.rejects(db.exec(sql), /catalogue conflict/);
        await db.exec('rollback');
    } finally {
        await db.close();
    }
});
