import test from 'node:test';
import assert from 'node:assert/strict';
import {formatExplanationMath as format} from '../../shared/quiz-explanation-render.mjs';

test('學生解析中的帶分數與完整算式排版，數值及運算順序保持',()=>{
 assert.equal(format('第一批是1又2/3倍。'),'第一批是$1\\frac{2}{3}$倍。');
 assert.equal(format('105÷（1又2/3－1）×1又2/3。'),'$105\\div \\left(1\\frac{2}{3}-1\\right)\\times 1\\frac{2}{3}$。');
 assert.equal(format('加上 ２又１／４ 倍。'),'加上 $2\\frac{1}{4}$ 倍。');
 assert.equal(format('占2/3，剩1/3。'),'占$\\frac{2}{3}$，剩$\\frac{1}{3}$。');
 assert.equal(format('3×4=12。'),'$3\\times 4=12$。');
});
test('保留已有公式，接受AI常用的兩種TeX括號標記',()=>{
 assert.equal(format('原式 $\\frac{2}{3}$，再乘1又2/3。'),'原式 $\\frac{2}{3}$，再乘$1\\frac{2}{3}$。');
 assert.equal(format('\\(\\frac{2}{3}\\) 與 \\[1+2\\]'),'$\\frac{2}{3}$ 與 $$1+2$$');
});
test('日期、頁題標籤、識別字及不完整式子不猜測、不改寫',()=>{
 for(const text of ['2026/11/14','11/14日','第3/4題','見第3/4頁','ID_1/2','abc1/2','1/2/3','（1又2/3','1又2/3）','3×','有105公斤，分成3批。','<img src=x onerror=alert(1)>'])assert.equal(format(text),text,text);
});
