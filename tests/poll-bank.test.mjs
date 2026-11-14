import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POLL_BANK, pickPoll } from '../src/domain/poll-bank.mjs';

const FORBIDDEN_SUBSTR = ['quà', 'tặng', 'tiền', 'donate'];
const FORBIDDEN_WORDS = ['xu'];
const norm = (s) => s.normalize('NFC').toLowerCase();

test('bank has at least 24 questions', () => {
  assert.ok(Array.isArray(POLL_BANK));
  assert.ok(POLL_BANK.length >= 24, `only ${POLL_BANK.length}`);
});

test('every entry has a question and 2 or 3 short distinct options', () => {
  for (const p of POLL_BANK) {
    assert.equal(typeof p.q, 'string');
    assert.ok(p.q.trim().length >= 8 && p.q.length <= 60, `question length: ${p.q}`);
    assert.equal(p.q, p.q.trim());
    assert.ok(Array.isArray(p.options), p.q);
    assert.ok(p.options.length === 2 || p.options.length === 3, `${p.q}: ${p.options.length} options`);
    for (const o of p.options) {
      assert.equal(typeof o, 'string');
      assert.ok(o.trim().length > 0, `${p.q}: empty option`);
      assert.equal(o, o.trim(), `${p.q}: untrimmed option`);
      assert.ok([...o].length <= 22, `${p.q}: option too long "${o}"`);
    }
    const lowered = p.options.map(norm);
    assert.equal(new Set(lowered).size, lowered.length, `${p.q}: duplicate options`);
  }
});

test('no duplicate questions', () => {
  const qs = POLL_BANK.map((p) => norm(p.q));
  assert.equal(new Set(qs).size, qs.length);
});

test('no money/gift words anywhere', () => {
  for (const p of POLL_BANK) {
    for (const text of [p.q, ...p.options]) {
      const t = norm(text);
      for (const bad of FORBIDDEN_SUBSTR) assert.ok(!t.includes(bad), `"${text}" contains "${bad}"`);
      const tokens = t.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
      for (const bad of FORBIDDEN_WORDS) assert.ok(!tokens.includes(bad), `"${text}" contains word "${bad}"`);
    }
  }
});

test('pickPoll returns a bank entry shape (copy, not the bank object)', () => {
  const p = pickPoll(() => 0);
  assert.deepEqual(Object.keys(p).sort(), ['options', 'q']);
  assert.deepEqual(p, POLL_BANK[0]);
  p.options.push('x');
  assert.ok(!POLL_BANK[0].options.includes('x'));
});

test('pickPoll covers the full range of the random source, including rand() of 1', () => {
  assert.equal(pickPoll(() => 0).q, POLL_BANK[0].q);
  assert.equal(pickPoll(() => 0.999999999).q, POLL_BANK[POLL_BANK.length - 1].q);
  assert.equal(pickPoll(() => 1).q, POLL_BANK[POLL_BANK.length - 1].q);
});

test('pickPoll avoids recent (by index and by question text)', () => {
  assert.equal(pickPoll(() => 0, [0, 1, 2]).q, POLL_BANK[3].q);
  assert.equal(pickPoll(() => 0, [POLL_BANK[0].q, POLL_BANK[1].q]).q, POLL_BANK[2].q);
  const mixed = [0, POLL_BANK[1].q, 2, 3, 4];
  for (let i = 0; i < 200; i++) {
    const r = pickPoll(Math.random, mixed);
    assert.ok(![0, 1, 2, 3, 4].some((k) => POLL_BANK[k].q === r.q));
  }
});

test('pickPoll with everything recent reuses the oldest (first) recent entry', () => {
  const all = POLL_BANK.map((_, i) => i);
  assert.equal(pickPoll(() => 0.5, all).q, POLL_BANK[0].q);
  const shuffled = [5, ...all.filter((i) => i !== 5)];
  assert.equal(pickPoll(() => 0.5, shuffled).q, POLL_BANK[5].q);
  const byText = POLL_BANK.map((p) => p.q).reverse();
  assert.equal(pickPoll(() => 0.5, byText).q, POLL_BANK[POLL_BANK.length - 1].q);
});

test('pickPoll tolerates junk in recent and a missing recent', () => {
  assert.ok(pickPoll(() => 0, undefined).q);
  assert.ok(pickPoll(() => 0, null).q);
  assert.equal(pickPoll(() => 0, [-1, 9999, 'không có', null, NaN]).q, POLL_BANK[0].q);
});
