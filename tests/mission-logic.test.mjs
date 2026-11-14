import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMission } from '../src/domain/mission-logic.mjs';

const mk = (o = {}) => createMission({ target: 3, durationMs: 60000, ...o });

test('idle before begin: hit refused, tick idle, view inactive', () => {
  const m = mk();
  assert.equal(m.hit('u1', 0), false);
  assert.equal(m.tick(0), 'idle');
  assert.deepEqual(m.view(0), { active: false, label: '', count: 0, target: 3, leftMs: 0, state: 'idle' });
});

test('begin starts a running mission', () => {
  const m = mk();
  m.begin(1000, 'Thả tim');
  assert.deepEqual(m.view(1000), { active: true, label: 'Thả tim', count: 0, target: 3, leftMs: 60000, state: 'running' });
  assert.equal(m.tick(1000), 'running');
});

test('view countdown never goes negative', () => {
  const m = mk();
  m.begin(0, 'x');
  assert.equal(m.view(15000).leftMs, 45000);
  assert.equal(m.view(60000).leftMs, 0);
  assert.equal(m.view(99999).leftMs, 0);
  assert.equal(m.view(-500).leftMs, 60000);
});

test('hit counts, then wins early exactly once', () => {
  const m = mk();
  m.begin(0, 'x');
  assert.equal(m.hit('u1', 100), true);
  assert.equal(m.hit('u2', 200), true);
  assert.equal(m.tick(300), 'running');
  assert.equal(m.hit('u3', 400), true);
  assert.equal(m.tick(500), 'won');
  assert.equal(m.tick(501), 'idle');
  assert.equal(m.tick(999999), 'idle');
  assert.equal(m.view(600).active, false);
  assert.equal(m.view(600).state, 'idle');
});

test('hits after reaching target are refused before tick', () => {
  const m = mk({ target: 2 });
  m.begin(0, 'x');
  assert.equal(m.hit('u1', 1), true);
  assert.equal(m.hit('u2', 2), true);
  assert.equal(m.hit('u3', 3), false);
  assert.equal(m.view(3).count, 2);
  assert.equal(m.tick(4), 'won');
});

test('timeout without reaching target loses exactly once', () => {
  const m = mk();
  m.begin(0, 'x');
  m.hit('u1', 10);
  assert.equal(m.tick(59999), 'running');
  assert.equal(m.tick(60000), 'lost');
  assert.equal(m.tick(60001), 'idle');
  assert.equal(m.tick(120000), 'idle');
  assert.equal(m.view(60001).active, false);
});

test('tick long after the deadline still reports lost once', () => {
  const m = mk();
  m.begin(0, 'x');
  assert.equal(m.tick(10 * 60000), 'lost');
  assert.equal(m.tick(10 * 60000 + 1), 'idle');
});

test('target reached in time but ticked after deadline is still won', () => {
  const m = mk({ target: 1 });
  m.begin(0, 'x');
  assert.equal(m.hit('u1', 59999), true);
  assert.equal(m.tick(70000), 'won');
  assert.equal(m.tick(70001), 'idle');
});

test('per-user cap: a single user cannot complete alone', () => {
  const m = mk({ target: 10, perUserCap: 5 });
  m.begin(0, 'x');
  const results = [];
  for (let i = 0; i < 8; i++) results.push(m.hit('solo', i));
  assert.deepEqual(results, [true, true, true, true, true, false, false, false]);
  assert.equal(m.view(10).count, 5);
  assert.equal(m.tick(10), 'running');
  assert.equal(m.tick(60000), 'lost');
});

test('default per-user cap is 5; cap is per uid', () => {
  const m = mk({ target: 100 });
  m.begin(0, 'x');
  for (let i = 0; i < 5; i++) assert.equal(m.hit('a', i), true);
  assert.equal(m.hit('a', 6), false);
  assert.equal(m.hit('b', 7), true);
  assert.equal(m.view(8).count, 6);
});

test('custom perUserCap of 1', () => {
  const m = mk({ target: 2, perUserCap: 1 });
  m.begin(0, 'x');
  assert.equal(m.hit('a', 1), true);
  assert.equal(m.hit('a', 2), false);
  assert.equal(m.hit('b', 3), true);
  assert.equal(m.tick(4), 'won');
});

test('hit at or after the deadline is refused', () => {
  const m = mk({ target: 5 });
  m.begin(1000, 'x');
  assert.equal(m.hit('a', 60999), true);
  assert.equal(m.hit('b', 61000), false);
  assert.equal(m.hit('c', 70000), false);
  assert.equal(m.view(70000).count, 1);
  assert.equal(m.tick(70000), 'lost');
});

test('hit with a missing uid or bad time is refused', () => {
  const m = mk();
  m.begin(0, 'x');
  assert.equal(m.hit('', 1), false);
  assert.equal(m.hit(undefined, 1), false);
  assert.equal(m.hit(null, 1), false);
  assert.equal(m.hit('a', NaN), false);
  assert.equal(m.view(1).count, 0);
});

test('begin while running is ignored (label, deadline, count kept)', () => {
  const m = mk();
  m.begin(0, 'first');
  m.hit('a', 10);
  m.begin(30000, 'second');
  const v = m.view(30000);
  assert.equal(v.label, 'first');
  assert.equal(v.count, 1);
  assert.equal(v.leftMs, 30000);
  assert.equal(m.tick(60000), 'lost');
});

test('a new mission can start after the previous one ended, with clean state', () => {
  const m = mk({ target: 1, perUserCap: 1 });
  m.begin(0, 'one');
  m.hit('a', 1);
  assert.equal(m.tick(2), 'won');
  m.begin(100000, 'two');
  assert.deepEqual(m.view(100000), { active: true, label: 'two', count: 0, target: 1, leftMs: 60000, state: 'running' });
  assert.equal(m.hit('a', 100001), true); // cap counters reset
  assert.equal(m.tick(100002), 'won');
  assert.equal(m.tick(100003), 'idle');
});

test('begin with a non-finite time is ignored', () => {
  const m = mk();
  m.begin(NaN, 'x');
  assert.equal(m.view(0).active, false);
  assert.equal(m.tick(0), 'idle');
});

test('missing label becomes empty string', () => {
  const m = mk();
  m.begin(0);
  assert.equal(m.view(0).label, '');
});

test('two missions are independent instances', () => {
  const a = mk();
  const b = mk();
  a.begin(0, 'a');
  assert.equal(b.view(0).active, false);
  assert.equal(b.hit('u', 1), false);
});
