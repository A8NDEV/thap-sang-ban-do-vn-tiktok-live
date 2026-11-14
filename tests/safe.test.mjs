import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isGiftSolicitation, filterIdleLines, createSpokenMemory } from '../src/domain/safe.mjs';
import { INTERACT_CATS, INTERACT_LINES, allInteractLines, createInteractPicker } from '../src/audio/mc-interact.mjs';
import { idleLine, resetIdleMemory, staticLines } from '../src/audio/mc.mjs';
import { settings } from '../src/domain/settings.mjs';
import { S } from '../src/domain/store.mjs';
import { raceTail, snapshot } from '../src/domain/game.mjs';

// Các câu thật lấy từ donateLines() / nhánh race / kết vòng / rương trong mc.mjs, game.mjs, chest.mjs
const REAL_SOLICITING = [
  'Muốn quê mình thắng vòng đua thì một bông hồng cũng giúp được đó bà con.',
  'Mỗi món quà là một ngọn đèn sáng hơn cho quê hương mình.',
  'Quê nào nhận nhiều quà nhất sẽ được ghi tên trên bảng Quê nhận nhiều quà suốt buổi live.',
  'Ai tặng nhiều nhất sẽ được đứng trên bục vinh danh cuối màn hình nhé.',
  'Comment là được 1 điểm, còn tặng quà thì điểm nhân lên gấp nhiều lần, quê bạn bứt lên ngay.',
  'Đồng hương ơi, quê mình đang cần điểm, tặng một món quà nhỏ để kéo quê lên nào!',
  'Thả một bông hồng cho quê nhà, đèn quê bạn sẽ nháy sáng ngay trên bản đồ.',
  'Mỗi lần bạn tặng quà, camera sẽ bay tới quê bạn và ngọn đèn sẽ nháy sáng cho cả phòng cùng thấy.',
  'Tặng một bông hồng 1 xu là quê bạn được cộng 3 điểm ngay.',
  'Quà từ 5 xu được cộng hẳn 30 điểm, gấp 10 lần bông hồng đó.',
  'Tim ngón tay 5 xu thôi là quê bạn có 30 điểm rồi.',
  'Quà từ 30 xu được cộng luôn 100 điểm, đủ đưa quê bạn lên top!',
  'Một chiếc bánh donut 30 xu là quê bạn có ngay 100 điểm.',
  'Ai tặng đủ 500 xu sẽ thắp sáng cả nước, 34 tỉnh, thành rực sáng cùng lúc, tên bạn hiện to giữa màn hình!',
  'Cả nước đang chờ một người thắp sáng tất cả, chỉ cần 500 xu là 34 tỉnh, thành cùng rực sáng.',
  'Đồng hương ơi, tặng quà kéo quê mình lên nào!',
  'Chỉ cần thêm quà 5 xu là Hà Nội vượt Huế lên dẫn đầu!',
  'Ai sẽ vượt lên đứng đầu bục vinh danh đây?',
  'Vòng mới bắt đầu rồi, tặng quà để quê mình về nhất nhé!',
  'Bà con Huế hãy bình luận và tặng quà để mở rương nhận thưởng 3000 điểm!',
];
const THANKS = ['Cảm ơn Nam đã tặng Hoa hồng!', 'Cộng 30 điểm cho Hà Nội.', 'ơi, cảm ơn bạn đã tặng quà mã 8825!', 'Đại gia An chơi lớn quá!', 'Woa, cảm ơn Lan đã tặng Tim ngón tay!', 'Cảm ơn bà con đã ủng hộ.'];

test('isGiftSolicitation bắt mọi câu kêu gọi thật, giữ câu cảm ơn', () => {
  for (const l of REAL_SOLICITING) assert.equal(isGiftSolicitation(l), true, l);
  for (const l of THANKS) assert.equal(isGiftSolicitation(l), false, l);
  assert.equal(isGiftSolicitation('TẶNG QUÀ nào!'), true);       // không phân biệt hoa thường
  assert.equal(isGiftSolicitation('Cảm ơn Nam đã tặng Hoa hồng! Tặng quà nữa nhé!'), true);   // cảm ơn + kêu gọi trong cùng đoạn
  assert.equal(isGiftSolicitation(''), false);
  assert.equal(isGiftSolicitation(null), false);
});

test('filterIdleLines', () => {
  const lines = [...REAL_SOLICITING, ...THANKS, { t: 'Tặng quà nhé', nc: true }, { t: 'Bà con comment tên tỉnh nhé.' }];
  const safe = filterIdleLines(lines, true);
  assert.deepEqual(safe, [...THANKS, { t: 'Bà con comment tên tỉnh nhé.' }]);
  const plain = filterIdleLines(lines, false);
  assert.deepEqual(plain, lines);
  assert.notEqual(plain, lines);
  assert.deepEqual(filterIdleLines(undefined, true), []);
});

test('createSpokenMemory: không lặp trong cửa sổ, tự dọn khi quá hạn', () => {
  const m = createSpokenMemory(1000);
  assert.equal(m.recent('a', 0), false);
  m.mark('a', 0);
  assert.equal(m.recent('a', 999), true);
  assert.equal(m.recent('a', 1000), false);
  assert.equal(m.size(), 0);
  m.mark('b', 5000);
  assert.equal(m.at('b', 5500), 5000);
  assert.equal(m.at('zzz', 5500), undefined);
});

/* ---------- câu mời tương tác (mc-interact) ---------- */
test('pool tương tác: 4 nhóm, ≥ 12 câu, không trùng, không chèo kéo quà', () => {
  assert.deepEqual(INTERACT_CATS, ['tim', 'follow', 'comment', 'share']);
  const all = allInteractLines();
  assert.equal(new Set(all).size, all.length, 'có câu trùng');
  for (const c of INTERACT_CATS) assert.ok(INTERACT_LINES[c].length >= 12, c);
  for (const l of all) {
    assert.equal(isGiftSolicitation(l), false, l);
    assert.doesNotMatch(l, /quà|\bxu\b|tặng|kim cương|tiền/iu, l);
  }
});

test('picker xoay 4 nhóm, không lặp câu cho tới khi hết nhóm', () => {
  const p = createInteractPicker();
  const seen = Object.fromEntries(INTERACT_CATS.map(c => [c, []]));
  for (let i = 0; i < 4 * 25; i++) {
    const { cat, line } = p.next();
    assert.equal(cat, INTERACT_CATS[i % 4]);
    assert.ok(INTERACT_LINES[cat].includes(line));
    seen[cat].push(line);
  }
  for (const c of INTERACT_CATS) {
    const n = INTERACT_LINES[c].length;
    for (let s = 0; s + n <= seen[c].length; s += n) assert.equal(new Set(seen[c].slice(s, s + n)).size, n, `${c}: lặp trong một lượt`);
    for (let i = 1; i < seen[c].length; i++) assert.notEqual(seen[c][i], seen[c][i - 1], `${c}: lặp liền kề`);
  }
});

/* ---------- mc.mjs / game.mjs ---------- */
const saved = { cta: settings.mcGiftCta, pts: S.pts, donors: S.donors, lit: S.lit, roundEnd: S.roundEnd };
function seedState(){
  S.pts = { 'Hà Nội': 120, 'Huế': 80, 'Đà Nẵng': 40 };
  S.donors = { u1: { name: 'Nam', coins: 300 } };
  S.lit = { 'Hà Nội': { by: { name: 'A' }, last: { name: 'A' }, people: ['u1'], at: 1 } };
  S.roundEnd = Date.now() + 120_000;
}
const textOf = p => (p && typeof p === 'object' ? p.t : p);

test('mc idleLine: an toàn → không câu chèo kéo quà, câu mời tương tác thế chỗ câu quà với tỉ lệ cũ, không im lặng', () => {
  seedState(); settings.mcGiftCta = false; resetIdleMemory();
  const interact = new Set(allInteractLines());
  let inFirst16 = 0;
  for (let i = 0; i < 1500; i++) {
    const parts = idleLine();
    assert.ok(parts, 'MC không được im lặng (lần ' + i + ')');
    for (const p of parts) assert.equal(isGiftSolicitation(textOf(p)), false, textOf(p));
    if (i < 16 && parts.some(p => interact.has(textOf(p)))) inFirst16++;
  }
  assert.ok(inFirst16 >= 4 && inFirst16 <= 10, 'số câu mời tương tác trong 16 câu đầu: ' + inFirst16);
  resetIdleMemory();
});

test('mc idleLine: 40 câu đầu không câu nào lặp (cửa sổ 30 phút)', () => {
  seedState(); settings.mcGiftCta = false; resetIdleMemory();
  const keys = [];
  for (let i = 0; i < 40; i++) keys.push(idleLine().map(textOf).join(' '));
  assert.equal(new Set(keys).size, keys.length);
  resetIdleMemory();
});

test('mc idleLine: bật mcGiftCta → vẫn là kịch bản cũ (có câu kêu gọi quà)', () => {
  seedState(); settings.mcGiftCta = true; resetIdleMemory();
  let solicit = 0;
  for (let i = 0; i < 200; i++) { const p = idleLine(); if (p && p.some(x => isGiftSolicitation(textOf(x)))) solicit++; }
  assert.ok(solicit > 20, 'đã có ' + solicit);
});

test('staticLines (tải sẵn giọng): an toàn không có câu kêu gọi quà, có câu mời tương tác; bật lại thì như cũ', () => {
  settings.mcGiftCta = false;
  const safe = staticLines();
  assert.equal(safe.filter(isGiftSolicitation).length, 0, safe.filter(isGiftSolicitation).join(' | '));
  for (const l of allInteractLines()) assert.ok(safe.includes(l), l);
  settings.mcGiftCta = true;
  assert.ok(staticLines().filter(isGiftSolicitation).length > 10);
});

test('game: mcGiftCta chỉ đổi lời MC, snapshot / menu / look không đổi', () => {
  seedState();
  settings.mcGiftCta = false;
  assert.equal(raceTail('Đà Nẵng'), 'Đà Nẵng đang đứng thứ 3, cố lên!');
  const off = snapshot();
  assert.equal('safe' in off.look, false);
  settings.mcGiftCta = true;
  assert.match(raceTail('Đà Nẵng'), /Chỉ cần thêm quà/);
  const on = snapshot();
  assert.deepEqual(off.menu, on.menu);                // thực đơn quà không bị ẩn
  assert.equal(settings.giftMenuOn ? on.menu.length > 0 : on.menu.length === 0, true);
  assert.deepEqual(Object.keys(off.look), Object.keys(on.look));
  assert.deepEqual(off.rules, on.rules);
  assert.equal(raceTail('Hà Nội'), 'Hà Nội đang dẫn đầu vòng đua, hơn Huế 40 điểm!');
});

test.after(() => { settings.mcGiftCta = saved.cta; S.pts = saved.pts; S.donors = saved.donors; S.lit = saved.lit; S.roundEnd = saved.roundEnd; });
