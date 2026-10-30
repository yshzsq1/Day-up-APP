import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('dist/app.js', 'utf8');

test('设置页提供导出、导入、提醒和清空入口', () => {
  for (const action of ['export-data','import-data','clear-data']) assert.match(app, new RegExp(action));
  assert.match(app, /data-setting="reminders"/);
});

test('导出文件包含完整状态，导入前有格式校验和覆盖确认', () => {
  assert.match(app, /JSON\.stringify\(state/);
  assert.match(app, /dayup-backup-/);
  assert.match(app, /Array\.isArray\(imported\.plans\)/);
  assert.match(app, /导入备份会覆盖当前本地数据/);
});

test('清空数据和删除重要记录都需要确认', () => {
  assert.match(app, /确定清空 DayUp 的全部本地数据/);
  assert.match(app, /确定删除这条计划吗/);
});
