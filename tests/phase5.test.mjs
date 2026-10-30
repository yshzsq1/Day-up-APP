import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('dist/app.js', 'utf8');

test('开发模块包含项目和日志数据', () => {
  for (const field of ['projects','devLogs','nextAction','blockers']) assert.match(app, new RegExp(field));
  for (const action of ['new-project','edit-project','new-devlog','delete-project']) assert.match(app, new RegExp(action));
});

test('咨询模块包含客户、沟通和跟进数据', () => {
  for (const field of ['clients','consultLogs','nextFollowup','channel','summary']) assert.match(app, new RegExp(field));
  for (const action of ['new-client','edit-client','new-consult-log','delete-client']) assert.match(app, new RegExp(action));
});

test('开发日志和沟通记录显示可读的关联名称', () => {
  assert.match(app, /esc\(item\.name\)/);
  assert.match(app, /projectName/);
  assert.match(app, /clientName/);
});
