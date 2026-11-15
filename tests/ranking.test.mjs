import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankList, detectOvertake } from '../src/domain/ranking.mjs';

const d = (name, coins, avatar) => (avatar === undefined ? { name, coins } : { name, coins, avatar });

// ---- rankList ----

test('rankList sorts by coins desc and shapes rows', () => {
  const donors = { u1: d('An', 5, 'a.png'), u2: d('Bình', 50), u3: d('Chi', 20, 'c.png') };
  assert.deepEqual(rankList(donors), [
    { uid: 'u2', name: 'Bình', avatar: '', coins: 50 },
    { uid: 'u3', name: 'Chi', avatar: 'c.png', coins: 20 },
    { uid: 'u1', name: 'An', avatar: 'a.png', coins: 5 },
  ]);
});

test('rankList ties: name asc then uid asc', () => {
  const donors = { z9: d('An', 10), a1: d('An', 10), m5: d('Bảo', 10), q0: d('Aaron', 10) };
  assert.deepEqual(rankList(donors).map((r) => r.uid), ['q0', 'a1', 'z9', 'm5']);
});

test('rankList is stable regardless of key insertion order', () => {
  const a = { u1: d('X', 7), u2: d('X', 7), u3: d('Y', 7) };
  const b = { u3: d('Y', 7), u2: d('X', 7), u1: d('X', 7) };
  assert.deepEqual(rankList(a), rankList(b));
});

test('rankList empty / bad containers', () => {
  assert.deepEqual(rankList({}), []);
  assert.deepEqual(rankList(null), []);
  assert.deepEqual(rankList(undefined), []);
  assert.deepEqual(rankList('x'), []);
});

test('rankList skips invalid coins and bad rows', () => {
  const donors = {
    ok: d('Ok', 3),
    zero: d('Zero', 0),
    neg: d('Neg', -4),
    nan: d('Nan', NaN),
    inf: d('Inf', Infinity),
    str: d('Str', '50'),
    none: { name: 'None' },
    nul: null,
    num: 12,
  };
  assert.deepEqual(rankList(donors).map((r) => r.uid), ['ok']);
});

test('rankList limits to n (default 10)', () => {
  const donors = {};
  for (let i = 1; i <= 15; i++) donors['u' + i] = d('N' + i, i);
  assert.equal(rankList(donors).length, 10);
  assert.equal(rankList(donors)[0].uid, 'u15');
  assert.equal(rankList(donors, 3).length, 3);
  assert.equal(rankList(donors, 100).length, 15);
  assert.deepEqual(rankList(donors, 0), []);
});

test('rankList does not mutate input', () => {
  const donors = { u1: d('A', 1), u2: d('B', 2) };
  const snap = JSON.stringify(donors);
  const out = rankList(donors);
  out[0].coins = 9999;
  out[0].name = 'changed';
  assert.equal(JSON.stringify(donors), snap);
});

// ---- detectOvertake ----

const row = (uid, coins, name = uid.toUpperCase(), avatar = '') => ({ uid, name, avatar, coins });

test('detectOvertake: climbs and passes the person right below', () => {
  const before = [row('a', 50), row('b', 40), row('c', 30)];
  const after = [row('a', 50), row('c', 45), row('b', 40)];
  assert.deepEqual(detectOvertake(before, after, 'c'), {
    rank: 2,
    passed: { uid: 'b', name: 'B', avatar: '' },
  });
});

test('detectOvertake: passed carries name and avatar', () => {
  const before = [row('a', 50, 'An', 'a.png'), row('b', 40, 'Bình', 'b.png')];
  const after = [row('b', 60, 'Bình', 'b.png'), row('a', 50, 'An', 'a.png')];
  assert.deepEqual(detectOvertake(before, after, 'b'), {
    rank: 1,
    passed: { uid: 'a', name: 'An', avatar: 'a.png' },
  });
});

test('detectOvertake: enters top 5 from outside the list', () => {
  const before = [row('a', 50), row('b', 40), row('c', 30), row('d', 20), row('e', 10)];
  const after = [row('a', 50), row('b', 40), row('c', 30), row('n', 25), row('d', 20)];
  assert.deepEqual(detectOvertake(before, after, 'n'), {
    rank: 4,
    passed: { uid: 'd', name: 'D', avatar: '' },
  });
});

test('detectOvertake: brand new donor entering at the bottom of top 5, nobody below', () => {
  const before = [row('a', 50), row('b', 40)];
  const after = [row('a', 50), row('b', 40), row('n', 5)];
  assert.deepEqual(detectOvertake(before, after, 'n'), { rank: 3, passed: null });
});

test('detectOvertake: first ever donor ranks 1 with nobody passed', () => {
  assert.deepEqual(detectOvertake([], [row('n', 5)], 'n'), { rank: 1, passed: null });
});

test('detectOvertake: new donor takes first place over existing', () => {
  const before = [row('a', 10)];
  const after = [row('n', 99), row('a', 10)];
  assert.deepEqual(detectOvertake(before, after, 'n'), {
    rank: 1,
    passed: { uid: 'a', name: 'A', avatar: '' },
  });
});

test('detectOvertake: no progress returns null (same rank)', () => {
  const before = [row('a', 50), row('b', 40), row('c', 30)];
  const after = [row('a', 50), row('b', 45), row('c', 30)];
  assert.equal(detectOvertake(before, after, 'b'), null);
});

test('detectOvertake: rank worsened returns null', () => {
  const before = [row('a', 50), row('b', 40)];
  const after = [row('b', 60), row('a', 50)];
  assert.equal(detectOvertake(before, after, 'a'), null);
});

test('detectOvertake: ties do not jump (tie broken by name keeps order)', () => {
  const before = [row('a', 40, 'An'), row('b', 30, 'Bảo')];
  const after = [row('a', 40, 'An'), row('b', 40, 'Bảo')];
  assert.equal(detectOvertake(before, after, 'b'), null);
});

test('detectOvertake: outside top maxRank returns null', () => {
  const before = [row('a', 60), row('b', 50), row('c', 40), row('d', 30), row('e', 20), row('f', 10)];
  const after = [row('a', 60), row('b', 50), row('c', 40), row('d', 30), row('e', 20), row('f', 15)];
  assert.equal(detectOvertake(before, after, 'f'), null);
  const after2 = [row('a', 60), row('b', 50), row('c', 40), row('d', 30), row('f', 25), row('e', 20)];
  assert.equal(detectOvertake(before, after2, 'f').rank, 5);
});

test('detectOvertake: custom maxRank', () => {
  const before = [row('a', 50), row('b', 40), row('c', 30)];
  const after = [row('a', 50), row('b', 40), row('n', 35), row('c', 30)];
  assert.equal(detectOvertake(before, after, 'n', 2), null);
  assert.equal(detectOvertake(before, after, 'n', 3).rank, 3);
});

test('detectOvertake: uid absent from after returns null', () => {
  assert.equal(detectOvertake([row('a', 5)], [row('a', 5)], 'ghost'), null);
});

test('detectOvertake: empty inputs return null', () => {
  assert.equal(detectOvertake([], [], 'x'), null);
  assert.equal(detectOvertake(null, null, 'x'), null);
  assert.equal(detectOvertake(undefined, [row('x', 1)], 'x').rank, 1);
});

test('detectOvertake: climbing one place passes the old occupant, others stay put', () => {
  const before = [row('a', 50), row('b', 40), row('x', 30), row('d', 20)];
  const after = [row('a', 50), row('x', 45), row('b', 40), row('d', 20)];
  assert.deepEqual(detectOvertake(before, after, 'x'), {
    rank: 2,
    passed: { uid: 'b', name: 'B', avatar: '' },
  });
});

test('detectOvertake: new donor inserted mid-list passes the one directly below', () => {
  const before = [row('a', 50), row('b', 40), row('c', 30)];
  const after = [row('a', 50), row('n', 45), row('b', 40), row('c', 30)];
  assert.deepEqual(detectOvertake(before, after, 'n'), {
    rank: 2,
    passed: { uid: 'b', name: 'B', avatar: '' },
  });
});

test('detectOvertake does not mutate its inputs', () => {
  const before = [row('a', 50), row('b', 40)];
  const after = [row('b', 60), row('a', 50)];
  const s1 = JSON.stringify(before);
  const s2 = JSON.stringify(after);
  const r = detectOvertake(before, after, 'b');
  r.passed.name = 'changed';
  assert.equal(JSON.stringify(before), s1);
  assert.equal(JSON.stringify(after), s2);
});

test('detectOvertake: passed is null when the person directly below was already below uid before', () => {
  // dữ liệu "before" cũ/lệch: d vốn đã ở dưới x nên không tính là bị vượt
  const before = [row('a', 50), row('x', 30), row('d', 20)];
  const after = [row('x', 60), row('a', 50), row('d', 20)];
  assert.deepEqual(detectOvertake(before, after, 'x'), { rank: 1, passed: { uid: 'a', name: 'A', avatar: '' } });
  const after2 = [row('a', 50), row('x', 45), row('d', 20)];
  assert.equal(detectOvertake(before, after2, 'x'), null);
});

// ---- hòa xu: chỉ vượt khi xu mới LỚN HƠN hẳn ----

test('detectOvertake: tying the person above by coins is not an overtake (name order only)', () => {
  const before = [row('z', 40, 'Zed'), row('a', 30, 'An')];
  const after = [row('a', 40, 'An'), row('z', 40, 'Zed')];   // hòa 40: An đứng trước chỉ nhờ tên
  assert.equal(detectOvertake(before, after, 'a'), null);
});

test('detectOvertake: strictly more coins passes the person above', () => {
  const before = [row('z', 40, 'Zed'), row('a', 30, 'An')];
  const after = [row('a', 41, 'An'), row('z', 40, 'Zed')];
  assert.deepEqual(detectOvertake(before, after, 'a'), { rank: 1, passed: { uid: 'z', name: 'Zed', avatar: '' } });
});

test('detectOvertake: new donor tying the person below enters the top but passes nobody', () => {
  const before = [row('a', 50, 'An'), row('z', 40, 'Zed')];
  const after = [row('a', 50, 'An'), row('n', 40, 'Nam'), row('z', 40, 'Zed')];
  assert.deepEqual(detectOvertake(before, after, 'n'), { rank: 2, passed: null });
});

test('detectOvertake: first donor of the session has nothing to pass (game.mjs skips the event for an empty before)', () => {
  assert.deepEqual(detectOvertake([], [row('n', 5)], 'n'), { rank: 1, passed: null });
});
