import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('dist/app.js', 'utf8');

test('首页包含今日驾驶舱的五个核心区域', () => {
  for (const label of ['今日驾驶舱','今天最重要的事','需要关注','今日时间线','快速备忘','今日状态摘要']) assert.match(app, new RegExp(label));
});

test('首页读取计划和模块数据，而不是维护另一份计划', () => {
  assert.match(app, /dayPlans\(today\(\)\)/);
  assert.match(app, /function attentionItems/);
  assert.match(app, /data-view="development"/);
  assert.match(app, /data-action="memo-to-plan"/);
});

test('首页支持直接完成计划和打开模块摘要', () => {
  assert.match(app, /data-action="toggle-plan"/);
  assert.match(app, /class="summary-row"/);
});
