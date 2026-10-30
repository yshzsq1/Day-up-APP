import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('dist/app.js', 'utf8');

test('统一数据对象包含所有 PRD 模块', () => {
  for (const key of ['plans','memos','projects','devLogs','clients','consultLogs','fitnessPlans','workouts','meals','games','gameSessions','settings']) {
    assert.match(app, new RegExp(`${key}:`));
  }
});

test('数据层具有版本化、规范化和持久化入口', () => {
  assert.match(app, /version:1/);
  assert.match(app, /normaliseState/);
  assert.match(app, /function save\(\)/);
  assert.match(app, /localStorage/);
  assert.match(app, /indexedDB/);
});

test('本地应用没有网络请求入口', () => {
  assert.doesNotMatch(app, /fetch\s*\(/);
  assert.doesNotMatch(app, /XMLHttpRequest/);
});
