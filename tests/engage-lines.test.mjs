import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickIndex, HEART_LINES, SHARE_LINES, POLL_WIN_LINES, POLL_TIE_LINES, pollStartLine } from '../src/domain/engage-lines.mjs';

test('pickIndex: không bao giờ trùng chỉ số trước, luôn trong khoảng', () => {
  for (const len of [2, 3, 5]) for (let last = -1; last < len; last++) {
    for (const r of [0, 0.1, 0.3, 0.5, 0.7, 0.99, 1]) {
      const i = pickIndex(len, last, () => r);
      assert.ok(i >= 0 && i < len);
      if (len > 1 && last >= 0) assert.notEqual(i, last);
    }
  }
  assert.equal(pickIndex(1, 0, () => 0.5), 0);
  assert.equal(pickIndex(0, -1, () => 0.5), 0);
});

test('lời MC: ít nhất 4 mẫu, không nhắc quà / xu / tặng, có chèn giá trị', () => {
  assert.ok(HEART_LINES.length >= 4 && SHARE_LINES.length >= 4);
  const bad = /quà|\bxu\b|tặng|tiền|donate/i;
  const all = [
    ...HEART_LINES.map(f => f(3000)), ...SHARE_LINES.map(f => f('Lan')),
    ...POLL_WIN_LINES.map(f => f('Phở', 61)), ...POLL_TIE_LINES.map(f => f()),
    pollStartLine('Sáng nay bạn ăn gì?', ['Phở', 'Bánh mì', 'Xôi'], 40),
  ];
  for (const s of all) assert.doesNotMatch(s, bad, s);
  assert.ok(HEART_LINES.every(f => f(3000).includes('3000')));
  assert.ok(SHARE_LINES.every(f => f('Lan').includes('Lan')));
  assert.ok(POLL_WIN_LINES.every(f => f('Phở', 61).includes('Phở') && f('Phở', 61).includes('61%')));
  assert.equal(new Set(HEART_LINES.map(f => f(1000))).size, HEART_LINES.length);
  assert.equal(new Set(SHARE_LINES.map(f => f('Lan'))).size, SHARE_LINES.length);
});

test('pollStartLine: gán chữ cái A/B/C cho từng lựa chọn', () => {
  const s = pollStartLine('Q?', ['x', 'y'], 30);
  assert.match(s, /30 giây/);
  assert.match(s, /A là x, B là y/);
  assert.doesNotMatch(s, /C là/);
});
