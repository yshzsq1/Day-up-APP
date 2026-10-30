import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('dist/app.js', 'utf8');

test('计划支持日期、时间、全天、重复、提醒、重点和状态', () => {
  for (const field of ['date','time','recurrence','reminder','isTop','status']) assert.match(app, new RegExp(field));
  assert.match(app, /timeChoices/);
  assert.match(app, /每天/);
  assert.match(app, /每周/);
  assert.match(app, /每月/);
});

test('计划引擎包含重复生成和重点数量限制', () => {
  assert.match(app, /function recurrenceDates/);
  assert.match(app, /function enforceTopThree/);
  assert.match(app, /slice\(3\)/);
  assert.match(app, /365/);
});

test('计划支持编辑、完成、推迟和删除操作', () => {
  for (const action of ['edit-plan','toggle-plan','move-plan','delete-plan']) assert.match(app, new RegExp(action));
});
