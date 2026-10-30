import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('dist/index.html', 'utf8');
const app = fs.readFileSync('dist/app.js', 'utf8');

test('导航包含四个产品分组和八个页面入口', () => {
  for (const label of ['总览','工作','生活','系统']) assert.match(html, new RegExp(label));
  for (const view of ['overview','plans','development','consulting','fitness','diet','games','settings']) assert.match(html, new RegExp(`data-view="${view}"`));
});

test('每个页面都有明确的渲染入口', () => {
  for (const view of ['overview','plans','development','consulting','fitness','diet','games','settings']) assert.match(app, new RegExp(`function render${view[0].toUpperCase()}${view.slice(1)}`));
});

test('页面外壳保留快速添加和页面标题', () => {
  assert.match(html, /id="page-title"/);
  assert.match(html, /id="quick-add"/);
  assert.match(html, /id="modal-root"/);
});
