import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseVote, createPoll } from '../src/domain/poll-logic.mjs';

// ---- parseVote ----

test('parseVote: letters, any case, with trimming', () => {
  assert.equal(parseVote('A', 3), 0);
  assert.equal(parseVote('a', 3), 0);
  assert.equal(parseVote(' b ', 3), 1);
  assert.equal(parseVote('B', 3), 1);
  assert.equal(parseVote('c', 3), 2);
  assert.equal(parseVote('\tC\n', 3), 2);
});

test('parseVote: digits', () => {
  assert.equal(parseVote('1', 3), 0);
  assert.equal(parseVote('2', 3), 1);
  assert.equal(parseVote('3', 3), 2);
});

test('parseVote: trailing . ! , ? are allowed', () => {
  assert.equal(parseVote('C.', 3), 2);
  assert.equal(parseVote('2!', 3), 1);
  assert.equal(parseVote('b!', 3), 1);
  assert.equal(parseVote('a?', 3), 0);
  assert.equal(parseVote('a,', 3), 0);
  assert.equal(parseVote('A!!!', 3), 0);
  assert.equal(parseVote('a ...', 3), 0);
});

test('parseVote: anything else is -1', () => {
  assert.equal(parseVote('ab', 3), -1);
  assert.equal(parseVote('a b', 3), -1);
  assert.equal(parseVote('4', 3), -1);
  assert.equal(parseVote('d', 3), -1);
  assert.equal(parseVote('0', 3), -1);
  assert.equal(parseVote('', 3), -1);
  assert.equal(parseVote('   ', 3), -1);
  assert.equal(parseVote('.', 3), -1);
  assert.equal(parseVote('!a', 3), -1);
  assert.equal(parseVote('a1', 3), -1);
  assert.equal(parseVote('1a', 3), -1);
  assert.equal(parseVote('chọn a', 3), -1);
  assert.equal(parseVote('phở', 3), -1);
});

test('parseVote: emoji, long text and non-strings', () => {
  assert.equal(parseVote('👍', 3), -1);
  assert.equal(parseVote('A👍', 3), -1);
  assert.equal(parseVote('🅰', 3), -1);
  assert.equal(parseVote('a'.repeat(5000), 3), -1);
  assert.equal(parseVote('a' + ' '.repeat(5000) + 'b', 3), -1);
  assert.equal(parseVote('A'.padEnd(5000, '.'), 3), -1); // over the length guard
  assert.equal(parseVote('A'.padEnd(20, '.'), 3), 0);
  assert.equal(parseVote(undefined, 3), -1);
  assert.equal(parseVote(null, 3), -1);
  assert.equal(parseVote(1, 3), -1);
  assert.equal(parseVote({}, 3), -1);
});

test('parseVote: index must be below nOptions', () => {
  assert.equal(parseVote('c', 2), -1);
  assert.equal(parseVote('3', 2), -1);
  assert.equal(parseVote('b', 2), 1);
  assert.equal(parseVote('a', 1), 0);
  assert.equal(parseVote('b', 1), -1);
  assert.equal(parseVote('a', 0), -1);
  assert.equal(parseVote('a', NaN), -1);
  assert.equal(parseVote('a', undefined), -1);
  assert.equal(parseVote('a', -1), -1);
});

// ---- createPoll ----

const OPTS = ['Phở', 'Bún', 'Cơm'];
const mk = (durationMs = 40000) => createPoll({ options: OPTS, durationMs });

test('createPoll: before begin everything is idle', () => {
  const p = mk();
  assert.equal(p.tick(0), 'idle');
  assert.equal(p.vote('u1', 'a', 0), false);
  assert.equal(p.result(), null);
  const v = p.view(0);
  assert.equal(v.active, false);
  assert.equal(v.state, 'idle');
  assert.equal(v.total, 0);
  assert.deepEqual(v.counts, [0, 0, 0]);
});

test('createPoll: votes are counted while running', () => {
  const p = mk(10000);
  p.begin(1000, 'Ăn gì?');
  assert.equal(p.vote('u1', 'A', 1500), true);
  assert.equal(p.vote('u2', '2', 1600), true);
  assert.equal(p.vote('u3', 'b.', 1700), true);
  const v = p.view(2000);
  assert.equal(v.active, true);
  assert.equal(v.state, 'running');
  assert.equal(v.question, 'Ăn gì?');
  assert.deepEqual(v.options, OPTS);
  assert.deepEqual(v.counts, [1, 2, 0]);
  assert.equal(v.total, 3);
  assert.equal(v.leftMs, 9000);
});

test('createPoll: invalid comments are not counted and do not erase an earlier vote', () => {
  const p = mk();
  p.begin(0, 'q');
  assert.equal(p.vote('u1', 'a', 10), true);
  assert.equal(p.vote('u1', 'hello', 20), false);
  assert.equal(p.vote('u1', 'd', 30), false);
  assert.equal(p.vote('u1', 'ab', 40), false);
  assert.deepEqual(p.view(50).counts, [1, 0, 0]);
  assert.equal(p.vote('', 'a', 60), false);
  assert.equal(p.vote(undefined, 'a', 60), false);
  assert.equal(p.view(70).total, 1);
});

test('createPoll: one vote per uid, the latest valid vote wins', () => {
  const p = mk();
  p.begin(0, 'q');
  p.vote('u1', 'a', 10);
  p.vote('u1', 'b', 20);
  p.vote('u1', 'c', 30);
  p.vote('u2', 'a', 40);
  p.vote('u2', 'a', 50);
  const v = p.view(60);
  assert.deepEqual(v.counts, [1, 0, 1]);
  assert.equal(v.total, 2);
});

test('createPoll: votes outside the time window are rejected', () => {
  const p = mk(1000);
  assert.equal(p.vote('u0', 'a', 0), false); // before begin
  p.begin(5000, 'q');
  assert.equal(p.vote('u1', 'a', 5999), true);
  assert.equal(p.vote('u2', 'a', 6000), false); // exactly at the deadline is out
  assert.equal(p.vote('u3', 'a', 9999), false);
  assert.equal(p.vote('u4', 'a', 4999), false); // earlier than begin
  assert.equal(p.vote('u5', 'a', NaN), false);
  assert.equal(p.tick(NaN), 'running');
  assert.equal(p.view(6000).total, 1);
});

test('createPoll: done is returned exactly once, then idle; result stays', () => {
  const p = mk(1000);
  p.begin(0, 'q');
  p.vote('u1', 'b', 100);
  assert.equal(p.tick(500), 'running');
  assert.equal(p.result(), null);
  assert.equal(p.tick(999), 'running');
  assert.equal(p.tick(1000), 'done');
  assert.equal(p.tick(1001), 'idle');
  assert.equal(p.tick(5000), 'idle');
  assert.deepEqual(p.result(), { winner: 1, counts: [0, 1, 0], total: 1, tie: false });
  assert.equal(p.vote('u9', 'a', 1100), false); // closed after done
  assert.deepEqual(p.result().counts, [0, 1, 0]);
  const v = p.view(1200);
  assert.equal(v.active, false);
  assert.equal(v.state, 'done');
  assert.equal(v.leftMs, 0);
});

test('createPoll: done even when tick is late, votes after the deadline never count', () => {
  const p = mk(1000);
  p.begin(0, 'q');
  p.vote('u1', 'a', 500);
  assert.equal(p.vote('u2', 'b', 1500), false); // late, tick has not run yet
  assert.equal(p.tick(9000), 'done');
  assert.deepEqual(p.result(), { winner: 0, counts: [1, 0, 0], total: 1, tie: false });
});

test('createPoll: tie at the top gives no winner', () => {
  const p = mk(1000);
  p.begin(0, 'q');
  p.vote('u1', 'a', 1);
  p.vote('u2', 'b', 2);
  p.tick(1000);
  assert.deepEqual(p.result(), { winner: -1, counts: [1, 1, 0], total: 2, tie: true });
});

test('createPoll: three-way tie and a tie that is not at the top', () => {
  const p = mk(1000);
  p.begin(0, 'q');
  p.vote('u1', 'a', 1);
  p.vote('u2', 'b', 2);
  p.vote('u3', 'c', 3);
  p.tick(1000);
  assert.equal(p.result().tie, true);
  assert.equal(p.result().winner, -1);

  p.begin(2000, 'q2');
  p.vote('u1', 'a', 2001);
  p.vote('u2', 'a', 2002);
  p.vote('u3', 'b', 2003);
  p.vote('u4', 'c', 2004);
  p.tick(3000);
  assert.deepEqual(p.result(), { winner: 0, counts: [2, 1, 1], total: 4, tie: false });
});

test('createPoll: no votes ends quietly with no winner and no tie', () => {
  const p = mk(1000);
  p.begin(0, 'q');
  assert.equal(p.tick(1000), 'done');
  assert.deepEqual(p.result(), { winner: -1, counts: [0, 0, 0], total: 0, tie: false });
});

test('createPoll: the same uid may vote again in a fresh round', () => {
  const p = mk(1000);
  p.begin(0, 'one');
  p.vote('u1', 'a', 1);
  p.tick(1000);
  p.begin(5000, 'two');
  assert.equal(p.result(), null);
  assert.equal(p.view(5000).question, 'two');
  assert.deepEqual(p.view(5000).counts, [0, 0, 0]);
  assert.equal(p.vote('u1', 'c', 5001), true);
  assert.equal(p.tick(6000), 'done');
  assert.deepEqual(p.result().counts, [0, 0, 1]);
});

test('createPoll: with two options, C is not a valid vote', () => {
  const p = createPoll({ options: ['Có', 'Không'], durationMs: 1000 });
  p.begin(0, 'q');
  assert.equal(p.vote('u1', 'c', 1), false);
  assert.equal(p.vote('u1', '3', 1), false);
  assert.equal(p.vote('u1', 'b', 1), true);
  assert.deepEqual(p.view(2).counts, [0, 1]);
  assert.equal(p.view(2).pct.length, 2);
});

test('createPoll.view: countdown never goes negative, percentages never exceed 100', () => {
  const p = mk(1000);
  p.begin(0, 'q');
  assert.equal(p.view(0).leftMs, 1000);
  assert.equal(p.view(400).leftMs, 600);
  assert.equal(p.view(1000).leftMs, 0);
  assert.equal(p.view(99999).leftMs, 0);
  assert.equal(p.view(-500).leftMs, 1000); // clock before begin does not exceed duration

  // 1,1,6 would round to 13+13+75 = 101 with plain rounding
  const counts = [[1, 1, 6], [1, 1, 1], [3, 3, 1], [5, 0, 0], [1, 2, 0], [2, 7, 9], [0, 0, 0]];
  for (const c of counts) {
    const q = createPoll({ options: OPTS, durationMs: 1000 });
    q.begin(0, 'q');
    let n = 0;
    c.forEach((k, idx) => { for (let i = 0; i < k; i++) q.vote(`u${n++}`, 'abc'[idx], 1); });
    const v = q.view(10);
    assert.equal(v.total, n);
    assert.equal(v.pct.length, 3);
    const sum = v.pct.reduce((a, b) => a + b, 0);
    assert.ok(sum <= 100, `${c} -> ${v.pct} sum ${sum}`);
    assert.equal(sum, n === 0 ? 0 : 100);
    v.pct.forEach((x, i) => {
      assert.ok(Number.isInteger(x) && x >= 0 && x <= 100);
      if (c[i] === 0) assert.equal(x, 0);
    });
  }
});

test('createPoll.view: percentages follow the votes', () => {
  const p = mk(1000);
  p.begin(0, 'q');
  p.vote('u1', 'a', 1);
  p.vote('u2', 'a', 1);
  p.vote('u3', 'a', 1);
  p.vote('u4', 'b', 1);
  assert.deepEqual(p.view(5).pct, [75, 25, 0]);
});

test('createPoll: view returns copies, callers cannot corrupt the poll', () => {
  const p = mk(1000);
  p.begin(0, 'q');
  p.vote('u1', 'a', 1);
  const v = p.view(2);
  v.counts[0] = 99;
  v.options[0] = 'hack';
  assert.deepEqual(p.view(2).counts, [1, 0, 0]);
  assert.deepEqual(p.view(2).options, OPTS);
  p.tick(1000);
  const r = p.result();
  r.counts[0] = 99;
  assert.deepEqual(p.result().counts, [1, 0, 0]);
});

test('createPoll: caller options array is copied at creation', () => {
  const opts = ['A1', 'B1'];
  const p = createPoll({ options: opts, durationMs: 1000 });
  opts.push('C1');
  opts[0] = 'zzz';
  p.begin(0, 'q');
  assert.deepEqual(p.view(0).options, ['A1', 'B1']);
});
