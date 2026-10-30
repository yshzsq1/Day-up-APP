import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('dist/app.js', 'utf8');

test('健身模块包含目标和训练记录', () => {
  for (const field of ['fitnessPlans','workouts','frequency','duration','训练类型']) assert.match(app, new RegExp(field));
  for (const action of ['new-fitness-plan','edit-fitness-plan','new-workout']) assert.match(app, new RegExp(action));
});

test('饮食模块包含餐食、营养和饮水记录', () => {
  for (const field of ['meals','calories','protein','water','餐次']) assert.match(app, new RegExp(field));
  for (const action of ['new-meal','edit-meal','new-water']) assert.match(app, new RegExp(action));
});

test('游戏模块包含游戏库和游玩记录', () => {
  for (const field of ['games','gameSessions','platform','progress','lastPlayed']) assert.match(app, new RegExp(field));
  for (const action of ['new-game','edit-game','new-session']) assert.match(app, new RegExp(action));
});
