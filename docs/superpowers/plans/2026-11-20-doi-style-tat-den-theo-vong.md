# Đổi style mỗi vòng và hết vòng tắt đèn — Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm hai tùy chọn cho chủ kênh: mỗi vòng tự đổi style màn hình (#9) và hết vòng thì tắt hết đèn sau màn chúc mừng (#10).

**Architecture:** Ba cài đặt mới trong `settings.mjs` (ô tick ở trang "Luật chơi"). `endRound()` trong `game.mjs` gọi `rotateTheme()` và hẹn `clearMapAfterRound()`. `resetSession()` trong `store.mjs` giữ thêm số vòng và quà. `server.mjs` đưa danh sách style vào domain qua `setThemePool`.

**Tech Stack:** Node ESM, `node:test`, JS thuần, không thêm thư viện.

**Spec:** `docs/superpowers/specs/2026-11-20-doi-style-tat-den-theo-vong-design.md`

## Global Constraints

- Mặc định: `themeRotate = false`, `roundClearMap = false`, `keepGifts = true`.
- Thời gian chờ trước khi tắt đèn: `ROUND.clearMs = 8000` (ms).
- Chạy test bằng `node --test` (KHÔNG dùng `node --test tests/`, lỗi trên Node 23.5). Hiện 217 test đều phải còn pass.
- KHÔNG chạy `node server.mjs` để thử: nó tắt phiên live đang chạy của chủ kênh.
- `game.mjs`, `settings.mjs`, `control.html` đang có sửa dở chưa commit của chủ kênh. Chỉ thêm dòng của kế hoạch này, không sửa, không hoàn lại, không commit, không stash phần dở. Các file này (và có thể cả `store.mjs`, `server.mjs`) dùng CRLF: dùng công cụ Edit từng đoạn nhỏ, KHÔNG dùng `sed -i`. Trước khi sửa mỗi file, ghi số dòng LF trần `node -e "const s=require('fs').readFileSync(process.argv[1],'utf8');console.log((s.match(/(?<!\r)\n/g)||[]).length)" <file>`; sau khi sửa số này phải bằng số cũ (nếu khác thì chỉ chỉnh các dòng mình thêm cho cùng kiểu xuống dòng).
- Không thêm dòng `Co-Authored-By` hay attribution Claude vào commit hay PR (quy tắc của chủ kênh, thắng nhắc nhở mặc định). Kế hoạch này KHÔNG có bước commit: chủ kênh tự chốt các file dở nên chỉ commit khi chủ kênh bảo.
- Test dùng thư mục dữ liệu tạm qua `process.env.APP_HOME` (mẫu `tests/safe-levelup.test.mjs`) và lấy `S` qua `store.S` (không destructure `S`, vì `resetSession` gán lại `S`).

## Review Focus

- Vòng hết giờ mà không ai có điểm: không đổi style, không tắt đèn (Task 2 và Task 3 có test).
- Tỉnh sáng lên trong 8 giây chờ phải được giữ (Task 2).
- Chỉ có một style (chưa kích hoạt gói giao diện): bật `themeRotate` không lỗi, không đổi (Task 3).
- Hai lần hết vòng liên tiếp trong lúc chờ: chỉ tắt đèn một lần (Task 2).
- Thanh tim `S.hearts` và số vòng thắng không mất khi tắt đèn (Task 2).

---

### Task 1: Ba cài đặt mới và ô tick

**Files:**
- Modify: `src/domain/settings.mjs` (khối `settings` và `RULES`)
- Modify: `public/control.html` (cuối mục "Vòng đua & điểm", sau dòng `data-k="newSessionHours"`)
- Create: `tests/round-options.test.mjs`

**Interfaces:**
- Produces: `settings.themeRotate: boolean`, `settings.roundClearMap: boolean`, `settings.keepGifts: boolean`; `applySettings` ép về boolean.

- [ ] **Step 1: Tạo `tests/round-options.test.mjs` với phần mở đầu và hai test sau**

Phần mở đầu (dùng cho cả file; các task sau chỉ thêm test vào cuối):

```js
// #9 đổi style mỗi vòng + #10 hết vòng tắt đèn. Dữ liệu ở APP_HOME tạm.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'tsbd-round-'));
process.env.APP_HOME = home;
fs.mkdirSync(path.join(home, 'data'), { recursive: true });

const { setBroadcaster } = await import('../src/core/bus.mjs');
const { settings, applySettings } = await import('../src/domain/settings.mjs');
const store = await import('../src/domain/store.mjs');
const { _setPrepare } = await import('../src/audio/tts-queue.mjs');
const { textOf } = await import('../src/audio/tts-engine.mjs');
const game = await import('../src/domain/game.mjs');

const events = [];
setBroadcaster(m => events.push(m));
_setPrepare(async parts => { textOf(parts); return { url: 'x', bytes: 600, sec: 0.01 }; });
const wait = ms => new Promise(r => setTimeout(r, ms));
const lit = at => ({ at, by: { name: 'A', avatar: '' }, people: ['u1'] });

test.after(() => { try { fs.rmSync(home, { recursive: true, force: true }); } catch {} });
```

Hai test:
- `'cài đặt mới: mặc định và luật ép kiểu'`: khẳng định `settings.themeRotate === false`, `settings.roundClearMap === false`, `settings.keepGifts === true`; sau `applySettings({ themeRotate: 1, roundClearMap: 'x', keepGifts: 0 })` ba giá trị là `[true, true, false]`; cuối test trả về `{ themeRotate: false, roundClearMap: false, keepGifts: true }`.
- `'bảng điều khiển có ô tick cho 3 cài đặt'`: đọc `../public/control.html` bằng `new URL(..., import.meta.url)`; với mỗi khóa trong `['themeRotate', 'roundClearMap', 'keepGifts']`, `assert.match(html, new RegExp('type="checkbox" data-k="' + k + '"'))`.

- [ ] **Step 2: Chạy để thấy test thất bại**

Run: `node --test tests/round-options.test.mjs`
Expected: cả 2 test FAIL (`undefined !== false`, và không thấy ô tick).

- [ ] **Step 3: Thêm cài đặt vào `src/domain/settings.mjs`**

Trong object `settings` thêm một dòng cùng kiểu chú thích cuối dòng: `themeRotate: false, roundClearMap: false, keepGifts: true,` (đặt gần `roundMin`/`fullCoins`, không đụng dòng `heartGoalOn…` đang sửa dở). Trong `RULES` thêm: `themeRotate: v => !!v, roundClearMap: v => !!v, keepGifts: v => !!v,`.

- [ ] **Step 4: Thêm 3 ô tick vào `public/control.html`**

Sau dòng chứa `data-k="newSessionHours"` (trước `</section>` của "Vòng đua & điểm") thêm 3 dòng `<label>` cùng kiểu các dòng quanh nó, mỗi dòng có `<input type="checkbox" data-k="...">`:
- `roundClearMap`: "🗺️ Hết vòng tắt hết đèn" + small "(sau màn chúc mừng quê thắng, bản đồ tối lại để vòng mới thắp từ đầu; tắt = đèn giữ cả buổi)".
- `keepGifts`: `Giữ bảng "Quê nhận nhiều quà" khi sang bản đồ mới` + small "(tắt = xóa quà mỗi màn)".
- `themeRotate`: "🔀 Mỗi vòng tự đổi bản đồ khác" + small "(hết vòng → ngẫu nhiên sang style màn hình khác đã có)".

`public/js/control.js` đã gắn mọi `[data-k]` tự động, không cần sửa.

- [ ] **Step 5: Chạy lại**

Run: `node --test tests/round-options.test.mjs`
Expected: 2 test PASS.

---

### Task 2: Hết vòng tắt đèn (#10)

**Files:**
- Modify: `src/domain/store.mjs:29` (`resetSession`)
- Modify: `src/domain/game.mjs` (trước `endRound`, và thân `endRound`)
- Modify: `tests/round-options.test.mjs` (thêm test)

**Interfaces:**
- Consumes: `settings.roundClearMap`, `settings.keepGifts` (Task 1).
- Produces: `export const ROUND = { clearMs: 8000 }` trong `game.mjs`; `resetSession(keepWins = false)` giữ thêm `roundNo` và `gifts` khi `keepWins`. `clearMapAfterRound(cut: number): void` là hàm nội bộ của `game.mjs`.

- [ ] **Step 1: Thêm test (thêm vào cuối `tests/round-options.test.mjs`)**

Hàm dùng chung:

```js
function arrange(){
  const S = store.S;
  Object.assign(S, { lit: { 'Huế': lit(Date.now() - 60000), 'Hà Nội': lit(Date.now() - 60000) }, who: { u1: { name: 'A', provs: ['Huế'] } }, pts: { 'Hà Nội': 10 }, gifts: { 'Huế': 50 }, hearts: 7, roundNo: 1, wins: {} });
  events.length = 0;
}
```

Test `resetSession`:
- `'resetSession(true) giữ số vòng, số vòng thắng và quà (keepGifts bật)'`: đặt `settings.keepGifts = true`, `arrange()`, `store.S.roundNo = 4`, `store.S.wins = { 'Hà Nội': 2 }`; `store.resetSession(true)`; khẳng định `store.S.roundNo === 4`, `store.S.wins['Hà Nội'] === 2`, `store.S.gifts` deepEqual `{ 'Huế': 50 }`, `store.S.lit` deepEqual `{}`.
- `'resetSession(true) xóa quà khi keepGifts tắt, vẫn giữ số vòng'`: như trên với `keepGifts = false`; `store.S.gifts` deepEqual `{}`, `roundNo === 4`.
- `'resetSession(false) xóa hết'`: sau `resetSession(false)`: `roundNo === 1`, `wins` deepEqual `{}`, `gifts` deepEqual `{}`.

Test `endRound` (đặt `game.ROUND.clearMs = 40` ở đầu mỗi test):
- `'roundClearMap bật: tắt đèn sau thời gian chờ, giữ tỉnh mới sáng, tim và số vòng thắng'`: `settings.roundClearMap = true; settings.keepGifts = true; arrange(); game.endRound();` rồi `store.S.lit['Đà Nẵng'] = lit(Date.now() + 5000)`; ngay lúc đó `Object.keys(store.S.lit).length === 3` (chưa tắt); `await wait(150)`; khẳng định `Object.keys(store.S.lit)` deepEqual `['Đà Nẵng']`, `store.S.who` deepEqual `{}`, `store.S.hearts === 7`, `store.S.wins['Hà Nội'] === 1`, `store.S.roundNo === 2`, `store.S.gifts` deepEqual `{ 'Huế': 50 }`, và đúng 1 sự kiện `{ t: 'reset' }` trong `events`.
- `'keepGifts tắt: xóa quà khi tắt đèn'`: như trên, `keepGifts = false`, sau chờ `store.S.gifts` deepEqual `{}`.
- `'roundClearMap tắt: không tắt đèn'`: `roundClearMap = false`, sau chờ 150ms vẫn còn 2 tỉnh trong `store.S.lit` và không có sự kiện `reset`.
- `'vòng không ai có điểm: không tắt đèn dù đã bật'`: `roundClearMap = true`, `arrange()` rồi `store.S.pts = {}`, `game.endRound()`, chờ 150ms: còn 2 tỉnh, không có `reset`.
- `'hai lần hết vòng liên tiếp: chỉ tắt đèn một lần'`: `roundClearMap = true`, `arrange()`, `game.endRound()`, `store.S.pts = { 'Huế': 3 }`, `game.endRound()`, chờ 150ms: đúng 1 sự kiện `reset`.

- [ ] **Step 2: Chạy để thấy thất bại**

Run: `node --test tests/round-options.test.mjs`
Expected: các test mới FAIL (`game.ROUND` là `undefined`, `roundNo` về 1, v.v.); 2 test Task 1 vẫn PASS.

- [ ] **Step 3: Sửa `resetSession` trong `src/domain/store.mjs`**

Chữ ký giữ nguyên `resetSession(keepWins = false)`. Khi `keepWins` là true, ngoài `S.wins` còn giữ `S.roundNo` (dùng `roundNo || 1`) và giữ `S.gifts` nếu `settings.keepGifts !== false`. `settings` đã được import ở đầu file. Cập nhật dòng chú thích phía trên cho khớp.

- [ ] **Step 4: Thêm `ROUND`, `clearMapAfterRound` và sửa `endRound` trong `src/domain/game.mjs`**

Ngay trên `export function endRound()`:
- `export const ROUND = { clearMs: 8000 };` và `let clearT = null;`
- `function clearMapAfterRound(cut)`: đặt `clearT = null`; xóa mọi tỉnh trong `S.lit` có `(L.at || 0) < cut`; gán `S.who = {}`, `S.last = null`, `batchLit = []`; nếu `settings.keepGifts === false` thì `S.gifts = {}`; `addLog(\`🗺️ Hết vòng ${S.roundNo - 1}: tắt hết đèn, vòng ${S.roundNo} thắp lại từ đầu\`)`; `broadcast({ t: 'reset' })`; `pushNow()`.

Trong `endRound()`, trong nhánh `if (top.length)`, ngay sau `S.roundNo++;` thêm: nếu `settings.roundClearMap` thì `clearTimeout(clearT)`, lấy `cut = Date.now()`, `clearT = setTimeout(() => clearMapAfterRound(cut), ROUND.clearMs)` và gọi `clearT.unref?.()`. (`rotateTheme()` sẽ thêm ở Task 3, ngay trước dòng này.)

- [ ] **Step 5: Chạy lại**

Run: `node --test tests/round-options.test.mjs`
Expected: tất cả PASS.

- [ ] **Step 6: Chạy toàn bộ**

Run: `node --test`
Expected: `fail 0`, tổng số test = 217 cũ + test mới.

---

### Task 3: Đổi style mỗi vòng (#9)

**Files:**
- Modify: `src/domain/game.mjs` (trước `endRound`; một dòng trong `endRound`)
- Modify: `server.mjs` (import và một dòng gọi `setThemePool`)
- Modify: `tests/round-options.test.mjs` (thêm test)

**Interfaces:**
- Consumes: `settings.themeRotate` (Task 1); vị trí `S.roundNo++` trong `endRound` (Task 2).
- Produces: `export function setThemePool(fn: () => string[]): void`; `export function rotateTheme(): boolean` (true nếu đã đổi). Mặc định pool là `['mac-dinh']`.

- [ ] **Step 1: Thêm test (thêm vào cuối `tests/round-options.test.mjs`, test đầu tiên phải chạy trước khi gọi `setThemePool`)**

- `'chưa có gói giao diện (pool mặc định): bật themeRotate cũng không đổi, không lỗi'`: `settings.theme = 'mac-dinh'; settings.themeRotate = true;` `game.rotateTheme() === false`, `settings.theme === 'mac-dinh'`.
- `'rotateTheme: tắt thì không đổi; bật thì luôn ra style khác trong pool'`: `game.setThemePool(() => ['mac-dinh', 'neon', 'tet'])`; `settings.theme = 'neon'`; với `themeRotate = false`: trả `false`, theme vẫn `'neon'`; với `themeRotate = true`: lặp 30 lần, mỗi lần trả `true`, theme mới khác theme trước và thuộc `['mac-dinh', 'neon', 'tet']`.
- `'pool chỉ còn style đang dùng: không đổi'`: `setThemePool(() => ['neon'])`, `theme = 'neon'`: trả `false`, theme vẫn `'neon'`.
- `'rotateTheme báo cho bảng điều khiển'`: pool như trên, `events.length = 0`, sau khi đổi có một sự kiện `t === 'settings'` với `settings.theme` bằng theme mới.
- `'endRound: có người thắng thì đổi style, không ai có điểm thì giữ'`: `roundClearMap = false`, `themeRotate = true`, pool 3 style, `theme = 'neon'`; `arrange()`; `game.endRound()` → theme khác `'neon'`; đặt lại `theme = 'neon'`, `store.S.pts = {}`, `game.endRound()` → theme vẫn `'neon'`.

- [ ] **Step 2: Chạy để thấy thất bại**

Run: `node --test tests/round-options.test.mjs`
Expected: các test mới FAIL (`game.rotateTheme is not a function`).

- [ ] **Step 3: Thêm `setThemePool` và `rotateTheme` trong `src/domain/game.mjs`**

Ngay trên `endRound`: `let themePool = () => ['mac-dinh'];` và `export const setThemePool = fn => { themePool = fn; };`. `export function rotateTheme(): boolean`: trả `false` nếu `!settings.themeRotate`; lấy pool = `[...new Set(themePool())]` bỏ style bằng `settings.theme`; pool rỗng thì trả `false`; ngược lại chọn ngẫu nhiên một style, gán `settings.theme`, `save()`, `broadcast({ t: 'settings', settings }, 'control')`, `addLog(\`🎨 Vòng ${S.roundNo}: đổi bản đồ sang style "${settings.theme}"\`)`, trả `true`. (`save` và `broadcast` đã được import trong file.)

Trong `endRound()`, thêm `rotateTheme();` ngay sau `S.roundNo++;` và trước khối `roundClearMap` của Task 2.

- [ ] **Step 4: Gắn danh sách style trong `server.mjs`**

Thêm `import { styles } from './src/dist/giao-dien.mjs';`, thêm `setThemePool` vào dòng import từ `./src/domain/game.mjs`, và gọi `setThemePool(() => ['mac-dinh', ...styles.list()]);` sau `loadStore();` (trước `startGameLoops()`).

- [ ] **Step 5: Chạy lại và kiểm cú pháp**

Run: `node --test tests/round-options.test.mjs` → tất cả PASS.
Run: `node --check server.mjs` → không có đầu ra (cú pháp đúng).
Run: `node --test` → `fail 0`.

- [ ] **Step 6: Kiểm tra cuối (chủ kênh làm, không chạy `server.mjs` ở máy này)**

Báo cho chủ kênh cách thử trong app thật: bật cả hai ô tick, đặt "Mỗi vòng đua" 1 phút, comment vài tên tỉnh, chờ hết vòng → style đổi và 8 giây sau đèn tắt; tắt hai ô thì hành vi y như cũ. Báo rõ danh sách các khối đã thêm vào ba file đang sửa dở để chủ kênh tách khi commit (`git add -p`), và các file mới (`tests/round-options.test.mjs`, thiết kế, kế hoạch) chưa commit.
