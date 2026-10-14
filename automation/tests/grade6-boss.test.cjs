const fs = require('node:fs');
const assert = require('node:assert/strict');
const asModule = s => 'data:text/javascript;base64,' + Buffer.from(s).toString('base64');
(async () => {
    const configUrl = asModule(fs.readFileSync('shared/reward-tree-config.js', 'utf8'));
    const config = await import(configUrl);
    const { deriveRewardTreeModel } = await import(asModule(fs.readFileSync('shared/reward-tree-model.js', 'utf8').replace('./reward-tree-config.js', configUrl)));
    const activities = config.getRewardTreeCourse('grade6-115-1').activities;
    const row = (key, completed = true, week = '05') => ({ course_id: 'grade6-115-1', week_code: week, activity_key: key, completed, current_level: key === 'typing_task_5' ? 5 : 1 });
    const base = [row('typing_task_5', true, '03'), row('typing_task_5')];
    assert.equal(deriveRewardTreeModel(base, activities).stats.flowerCount, 2);
    const all = [...base, row('typing_boss_zh_1'), row('typing_boss_en_1')];
    const model = deriveRewardTreeModel(all, activities);
    assert.equal(model.stats.leafCount, 8);
    assert.equal(model.stats.flowerCount, 4);
    assert.equal(model.stats.skippedActivityCount, 0);
    assert.equal(model.stats.unknownRowCount, 0);
    assert.equal(deriveRewardTreeModel([...all, row('typing_boss_zh_1')], activities).stats.flowerCount, 4);
    assert.equal(deriveRewardTreeModel([...base, row('typing_boss_zh_1', false)], activities).stats.flowerCount, 2);
    assert.equal(deriveRewardTreeModel([...base, row('typing_boss_en_1')], activities).stats.flowerCount, 3);
    assert.equal(deriveRewardTreeModel([{...row('typing_boss_zh_1'),course_id:'grade3-115-1'}], activities).stats.flowerCount, 0);
    const { challenges } = await import(asModule(fs.readFileSync('grade6/115-1/week05-typing-data.js','utf8')));
    assert.equal(new Set(Object.values(challenges).map(c=>c.key)).size, 3);
    assert.equal(challenges.regular.levels.length, 5);
    assert.equal(challenges.zh.levels[0].ans.split('\n').length, 25);
    assert.equal(challenges.en.levels[0].ans.split('\n').length, 9);
    // Week 07 reuses the boss activity keys under weekCode 07; it must be counted separately from week 05.
    const week07 = [...all, row('typing_task_5', true, '07'), row('typing_boss_zh_1', true, '07'), row('typing_boss_en_1', true, '07')];
    const model07 = deriveRewardTreeModel(week07, activities);
    assert.equal(model07.stats.flowerCount, 7);
    assert.equal(model07.stats.unknownRowCount, 0);
    assert.equal(deriveRewardTreeModel([...week07, row('typing_boss_zh_1', true, '07')], activities).stats.flowerCount, 7);
    assert.equal(deriveRewardTreeModel([...all, row('typing_boss_en_1', true, '07')], activities).stats.flowerCount, 5);
    assert.equal(activities.filter(a => a.rewardMode === 'boss').length, 4);
    const w07 = (await import(asModule(fs.readFileSync('grade6/115-1/week07-typing-data.js','utf8')))).challenges;
    assert.deepEqual(Object.values(w07).map(c=>c.key), ['typing_task_5','typing_boss_zh_1','typing_boss_en_1']);
    assert.equal(w07.regular.levels.length, 5);
    assert.deepEqual(w07.regular.levels.map(l=>l.id), [1,2,3,4,5]);
    assert.equal(w07.zh.levels[0].ans.split('\n').length, 10);
    assert.equal(w07.en.levels[0].ans.split('\n').length, 9);
    for (const c of Object.values(w07)) for (const l of c.levels) {
        assert.ok(!/[’‘“”]/.test(l.ans), `curly quote in ${c.key} ${l.id}`);
        assert.equal(l.ans, l.ans.trim());
        assert.ok(!l.ans.includes('\n\n'));
    }
    const used05 = new Set(Object.values(challenges).flatMap(c=>c.levels.flatMap(l=>l.ans.split('\n'))));
    const reused = Object.values(w07).flatMap(c=>c.levels.flatMap(l=>l.ans.split('\n'))).filter(line=>used05.has(line));
    // Story panels 7–8 intentionally review the Sentence B pattern from week 05.
    assert.deepEqual(reused, ['Does he have a fever?', 'Yes, he does.']);
    console.log('PASS: ordinary rewards, independent bosses, deduplication, reset, course isolation, question data, week07 separation');
})().catch(e => {console.error(e);process.exitCode=1;});
