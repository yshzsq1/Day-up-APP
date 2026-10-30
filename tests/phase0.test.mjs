import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('dist/app.js', 'utf8');
const html = fs.readFileSync('dist/index.html', 'utf8');

test('基础页面文件存在且加载核心脚本', () => {
  assert.match(html, /styles\.css/);
  assert.match(html, /app\.js/);
});

test('核心脚本包含本地保存、弹窗关闭和时间选择', () => {
  assert.match(app, /localStorage/);
  assert.match(app, /indexedDB/);
  assert.match(app, /data-action="close-modal"/);
  assert.match(app, /function timeChoices/);
  assert.match(app, /event\.key==='Escape'/);
});

test('导航中没有自媒体入口', () => {
  assert.doesNotMatch(html, /自媒体/);
  assert.doesNotMatch(app, /自媒体/);
});
