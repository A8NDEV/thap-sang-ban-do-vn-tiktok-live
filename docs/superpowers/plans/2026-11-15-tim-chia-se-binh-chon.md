# Mục tiêu tim + Thưởng chia sẻ/follow + Bình chọn nhanh — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ba cách kéo tương tác thật, không dính tiền/quà: thanh mục tiêu tim cả phòng, thưởng chia sẻ (và follow) bằng hiệu ứng + lời cảm ơn, bình chọn nhanh A/B/C bằng comment.

**Architecture:** Logic thuần trong `src/domain/` (test `node --test`), nối vào `game.mjs` và `src/ingest/tiktok.mjs` bằng vài dòng, sự kiện `broadcast` xuống overlay, overlay vẽ bằng file mới (transform/opacity only). Mỗi tính năng có cài đặt riêng trong bảng điều khiển (không dùng tham số URL).

**Tech Stack:** Node 23 ESM, JS/CSS thuần, WAAPI. Thư viện TikTok `tiktok-live-connector@2.5.0` có sự kiện `WebcastEvent.SHARE = "share"` (kiểu `WebcastSocialMessage`, cùng cách lấy `uidOf/nameOf/avatarOf` như `FOLLOW`).

## Global Constraints

- File chủ kênh đang sửa dở (KHÔNG commit, KHÔNG stage, chỉ sửa hunk nhỏ bằng Edit hoặc script Node dò kiểu xuống dòng; **cấm `sed -i`**, nhiều file là CRLF): `public/control.html`, `src/domain/game.mjs`, `src/domain/settings.mjs`. Mọi file khác (kể cả `main.js`, `render.js`, `tiktok.mjs`, `store.mjs`, `server.mjs`, `mission.mjs`) đang sạch và được commit bằng đường dẫn rõ ràng (không `git add -A`). Kiểm tra `git status --short` trước khi commit.
- Chỉ tính người thật: bỏ qua uid bắt đầu bằng `auto_` hoặc `demo` (`isBotUid` trong `game.mjs`); các module thuần không tự lọc uid, nơi gọi phải lọc.
- Không chạy `node server.mjs`; không ghi vào `data/` (test dùng thư mục tạm); test: `node --test` (hiện 129 đạt). Không `Co-Authored-By`. Không đụng `auto-pacing`, bản quyền.
- Overlay: chỉ animate `transform`/`opacity`; tắt khi `isLite()`; bỏ phần nặng khi `qualityLevel() >= 2`; mọi tên người xem đặt bằng `textContent`; mỗi phần tử tự dọn đúng một lần.
- Lời MC (`say([...], { tag })`) không nhắc tới quà/xu/tặng quà; câu cảm ơn ngắn, đa dạng (ít nhất 4 mẫu câu cho mỗi sự kiện, chọn ngẫu nhiên không lặp liên tiếp).
- Không để ba tính năng chạy chồng lên nhau và lên Đại chiến/câu đố/rương/nhiệm vụ: bình chọn chỉ bắt đầu khi không có `duelView()`, `quizActive()`, `isChestActive()`, `missionView()`; nhiệm vụ cũng không bắt đầu khi bình chọn đang chạy (`pollView()` khác null).

## Cài đặt (tất cả trong `settings.mjs` + `RULES`)

| Khóa | Mặc định | Giới hạn |
|---|---|---|
| `heartGoalOn` | true | bool |
| `heartGoalStep` | 1000 | 50–1000000 (mỗi bội số của bước là một mốc) |
| `shareRewardOn` | true | bool |
| `sharePts` | 30 | 0–1000 (điểm cho quê người chia sẻ, nếu họ có quê) |
| `pollOn` | false | bool |
| `pollEveryMin` | 10 | 2–120 |
| `pollSec` | 40 | 15–180 |

## Review Focus

1. Tim: `onLike` hiện thoát sớm khi người xem chưa có quê (`if (!f.home) return;`) — tim của MỌI người thật phải được đếm TRƯỚC bước đó; một sự kiện tim lớn (n=30) vượt nhiều mốc phát đúng MỘT sự kiện mốc (mốc cao nhất đạt được), không phát lặp; `heartGoalStep` đổi giữa buổi không làm tính lại hay phát lại mốc cũ.
2. Chia sẻ: một người chia sẻ liên tục không được tạo bão hiệu ứng/lời MC (mỗi người tối đa 1 lần thưởng/5 phút, chung tối đa 1 lời MC/8 giây; vẫn phát sự kiện overlay khi bị giới hạn lời MC); người xem ảo không bao giờ được thưởng.
3. Bình chọn: chỉ comment đúng một token A/B/C (hoặc 1/2/3; không phân biệt hoa thường; cho phép dấu chấm câu cuối như "A." hoặc "b!") mới tính; mỗi người một phiếu, đổi ý thì lấy phiếu cuối; hết giờ phát đúng MỘT kết quả; hòa thì không chọn thắng (MC nói "hòa"); không ai bỏ phiếu thì kết thúc êm không công bố thắng; bình chọn không bắt đầu khi phòng không có người thật trong 2 phút (dùng mốc `lastReal` riêng được cập nhật khi có người thật comment, KHÔNG dùng `S.lastAct` vì bot cũng cập nhật nó).
4. Bật/tắt cài đặt giữa chừng không để lại phần tử mồ côi hay timer; tên chứa HTML hiện như chữ thường trên overlay.

---

### Task 1: Logic thuần + test

**Files:** Create `src/domain/heartgoal.mjs`, `src/domain/poll-logic.mjs`, `src/domain/poll-bank.mjs`, `src/domain/share-rule.mjs` và `tests/heartgoal.test.mjs`, `tests/poll-logic.test.mjs`, `tests/poll-bank.test.mjs`, `tests/share-rule.test.mjs`.

**Interfaces (Produces):**
- `heartgoal.mjs`: `milestonesCrossed(prevTotal, newTotal, step): number` — số mốc (bội số của `step`) bị vượt khi tổng đi từ `prevTotal` lên `newTotal` (0 nếu đầu vào không hợp lệ, `step <= 0`, hay `newTotal <= prevTotal`); `topMilestone(prevTotal, newTotal, step): number | null` — giá trị mốc cao nhất vừa đạt (vd 2900→3100 step 1000 → 3000; không vượt → `null`); `heartView(total, step): { total, step, next, prev, pct }` — `next` = bội số kế tiếp lớn hơn `total`, `prev` = bội số gần nhất không lớn hơn `total` (0 nếu chưa), `pct` = phần trăm tiến độ từ `prev` đến `next` làm tròn 0–100; `step` hỏng → mặc định 1000.
- `share-rule.mjs`: `shareAllowed(lastAtMs, nowMs, minGapMs = 300000): boolean` (chưa có lần trước hoặc đủ cách; `nowMs < lastAtMs` → false).
- `poll-bank.mjs`: `export const POLL_BANK: Array<{ q: string, options: string[] }>` ≥ 24 câu hỏi vui, trung tính, tiếng Việt (ẩm thực, quê hương, Tết, du lịch, âm nhạc…), mỗi câu 2 hoặc 3 lựa chọn, mỗi lựa chọn ≤ 22 ký tự, không trùng câu, không chứa từ liên quan tiền/quà (`quà`, `xu`, `tặng`, `tiền`, `donate`); `pickPoll(rand = Math.random, recent = []): { q, options }` chọn câu không nằm trong `recent` (mảng chỉ số/câu đã dùng gần đây; hết câu mới thì dùng lại câu cũ nhất).
- `poll-logic.mjs`: `parseVote(text, nOptions): number | -1` (chỉ khi toàn bộ comment, sau khi cắt khoảng trắng và dấu `.!,?` ở cuối, là một token `a|b|c` hoặc `1|2|3`, không phân biệt hoa thường, và chỉ số < `nOptions`; trả chỉ số 0-based, ngược lại `-1`); `createPoll({ options, durationMs }): { begin(nowMs, question), vote(uid, text, nowMs): boolean, tick(nowMs): 'idle'|'running'|'done', view(nowMs): { active, question, options, counts, total, pct, leftMs, state }, result(): { winner: number|-1, counts, total, tie: boolean } | null }` — `vote` chỉ tính khi đang chạy và chưa hết giờ, mỗi uid một phiếu (phiếu sau thay phiếu trước), trả `true` nếu phiếu hợp lệ được ghi; `tick` trả `'done'` đúng MỘT lần khi hết giờ (sau đó `'idle'`), `result()` có sau `'done'`; hòa ở vị trí dẫn đầu → `winner: -1, tie: true`; không ai bỏ phiếu → `total: 0, winner: -1, tie: false`.

- [ ] Step 1: viết test thất bại cho cả 4 module (biên mốc 999→1000 / 1000→1000 / 2900→3100 / bước nhảy lớn vượt nhiều mốc / `step` không hợp lệ; `heartView` ở 0, ngay tại mốc, giữa hai mốc; `shareAllowed` các biên; ngân hàng: cấu trúc, độ dài, không trùng, không từ cấm, `pickPoll` tránh `recent`; `parseVote` các dạng "A", " b ", "C.", "2!", "ab", "a b", "4", "", emoji, chữ dài; `createPoll`: đổi phiếu, ngoài giờ, hòa, không phiếu, `done` đúng một lần, `view` đếm ngược không âm và phần trăm tổng ≤ 100).
- [ ] Step 2: `node --test` → FAIL. Step 3: cài đặt 4 module (thuần, không import DOM/Node). Step 4: `node --test` → PASS.
- [ ] Step 5: commit `git add src/domain/heartgoal.mjs src/domain/poll-logic.mjs src/domain/poll-bank.mjs src/domain/share-rule.mjs tests/heartgoal.test.mjs tests/poll-logic.test.mjs tests/poll-bank.test.mjs tests/share-rule.test.mjs` — "Logic thuần cho mục tiêu tim, chia sẻ, bình chọn (có test)".

---

### Task 2: Nối máy chủ

**Files:** Create `src/domain/poll.mjs` (chạy bình chọn). Modify: `src/domain/store.mjs` (thêm `hearts: 0` vào `freshSession()`, commit được), `src/ingest/tiktok.mjs` (đăng ký `WebcastEvent.SHARE`, commit được), `server.mjs` (khởi động vòng bình chọn, commit được), `src/domain/mission.mjs` (không bắt đầu khi `pollView()` khác null, commit được), `src/domain/settings.mjs` + `src/domain/game.mjs` (hunk nhỏ, KHÔNG commit).

**Interfaces:** Consumes Task 1. Produces các sự kiện `broadcast`:
- `{ t: 'heart', total, step, milestone }` — khi `topMilestone(...)` không null (milestone = giá trị mốc, vd 3000); MC nói một câu cảm ơn đa dạng ("Đã đủ ${milestone} lượt tim! Cảm ơn bà con…", không nhắc quà).
- `{ t: 'share', name, avatar, prov }` — `onShare(uid, name, avatar)` trong `game.mjs` (người thật, `settings.shareRewardOn`, `shareAllowed` theo từng uid 5 phút): cộng `sharePts` cho quê nếu có (`addBonusPts`), MC cảm ơn (tối đa 1 câu/8 giây toàn cục), luôn phát sự kiện overlay khi được thưởng.
- `snapshot()`: `hearts: heartView(S.hearts, settings.heartGoalStep)` khi `heartGoalOn` (ngược lại `null`); `poll: pollView()` (null khi không chạy; có `question, options, counts, pct, total, leftMs, endsAt, now`).
- `{ t: 'pollEnd', question, options, winner, tie, counts, total }` khi kết thúc (không phát khi tắt `pollOn` giữa chừng: phát `{ t: 'pollEnd', cancel: true }`); MC đọc kết quả bằng tiếng Việt tự nhiên ("Bình chọn xong! Phở dẫn đầu với 61% phiếu." / "Hòa nhau!" / bỏ qua nếu không ai bỏ phiếu).
- `poll.mjs` export: `startPollLoop(): void`, `pollOnChat(uid, text): void` (đếm phiếu; cập nhật `lastReal`), `pollView(): null | {...}`.

- [ ] Step 1 (`game.mjs`, `onLike`): trước `if (!f.home) return;` thêm `if (!isBotUid(uid) && settings.heartGoalOn) heartAdd(n)` (n cắt trong [1, 100]); `heartAdd` cập nhật `S.hearts`, tính `topMilestone`, phát `heart` + MC, gọi `push()`. Hàm `onShare` như trên. `onChat`: sau hook nhiệm vụ thêm `if (!isBotUid(uid)) pollOnChat(uid, text);`.
- [ ] Step 2 (`tiktok.mjs`): `c.on(WebcastEvent.SHARE, d => { markRealActivity(); onShare(uidOf(d), nameOf(d), avatarOf(d)); });` cạnh `FOLLOW`; import `onShare` từ `game.mjs`. Không đụng handler `SOCIAL`.
- [ ] Step 3 (`poll.mjs`): vòng 1 giây (`unref`), lịch `nextAt` như `mission.mjs`/`duel.mjs`; điều kiện bắt đầu: `settings.pollOn`, đến giờ, không `duelView()`/`quizActive()`/`isChestActive()`/`missionView()`, và `Date.now() - lastReal <= 120000`; lấy câu bằng `pickPoll(Math.random, recent)` (giữ 8 câu gần nhất); `begin`; khi `tick` ra `'done'` phát `pollEnd` + MC + `push()`; tắt `pollOn` giữa chừng thì hủy êm. Gọi `pushNow()` lúc bắt đầu/kết thúc và `push()` tối đa mỗi 500 ms khi có phiếu mới.
- [ ] Step 4: `settings.mjs` 7 khóa + RULES đúng bảng; `store.mjs` `hearts: 0`; `server.mjs` gọi `startPollLoop()` sau `startQuizLoop();`; `mission.mjs`: điều kiện bắt đầu thêm `&& !pollView()` (import vòng tròn an toàn như `game.mjs` ↔ `mission.mjs`).
- [ ] Step 5: `node --check` từng file, `node --test` PASS. Commit đúng các file sạch (`poll.mjs`, `store.mjs`, `tiktok.mjs`, `server.mjs`, `mission.mjs`); KHÔNG commit `game.mjs`/`settings.mjs`.

---

### Task 3: Overlay

**Files:** Create `public/js/overlay/fx-engage.js` + `public/css/fx-engage.css`. Modify `public/js/overlay/main.js` (sạch, commit được).

**Interfaces (Produces, trong `fx-engage.js`):** `renderHearts(view)`, `heartMilestone(ev)`, `showShare(ev)`, `renderPoll(view)`, `pollEnd(ev)`. Theo mẫu `fx-cinema.js`/`fx-donors.js`/`fx-mission.js` (CSS tự nạp, WAAPI, dọn đúng một lần, `createBudget` từ `./fx-cinema-logic.js`, `textContent`).

- [ ] Step 1 — thanh tim `renderHearts(view)` (`view` có thể `null` → ẩn): thẻ nhỏ góc trái (x 24–424, y ~360–410, z 27, `pointer-events: none`) "❤️ <total>/<next>" + thanh `transform: scaleX(pct/100)`; tạo một lần, dùng lại; không có timer riêng. `heartMilestone({ total, step, milestone })`: banner `banner('❤️ ĐỦ ${milestone} LƯỢT TIM', 'CẢM ƠN BÀ CON', 'cùng thả tim cho quê hương nào!', 5000)` từ `./fx.js`, `launchMassiveFireworks()` từ `./particles.js` (bỏ ở `qualityLevel() >= 2`), một cơn mưa tim nhẹ ❤️ 14 phần tử bay lên (trần 14, WAAPI) khi không `isLite()`.
- [ ] Step 2 — `showShare({ name, avatar, prov })`: toast nhỏ trượt vào dưới thẻ "vừa thắp đèn" hoặc góc phải trên (chọn chỗ không đè thẻ có sẵn, ví dụ x 744–1062, y ~120–180, z 27): "🔗 <tên> vừa chia sẻ live!" 2.6 giây, tối đa 1 toast cùng lúc (cái sau bị bỏ, không xếp hàng) và nếu `prov` hợp lệ gọi `lanternRise(prov)` từ `./fx-cinema.js`. Hiệu ứng tương tự khi có người follow: trong handler `follow` hiện có của `main.js` thêm `if (m.prov) lanternRise(m.prov);` (không đổi gì khác ở đó).
- [ ] Step 3 — bình chọn: `renderPoll(view)` (null → ẩn): thẻ ở vị trí của thẻ nhiệm vụ (x 24–424, y 250–~370; bình chọn và nhiệm vụ không bao giờ cùng chạy), câu hỏi, 2–3 hàng "A. <lựa chọn>" kèm thanh `scaleX` và % phiếu, dòng "Comment A, B hay C để bình chọn · còn Ns"; đếm ngược cục bộ như thẻ nhiệm vụ (một `setInterval` 250 ms chỉ tồn tại khi thẻ đang hiện). `pollEnd(ev)`: nếu `cancel` thì ẩn ngay; nếu có thắng thì thẻ nổi bật lựa chọn thắng 2.5 giây ("🏆 <lựa chọn> thắng!"), hòa thì "Hòa nhau!", không phiếu thì ẩn.
- [ ] Step 4 — `main.js`: import; trong handler `state` thêm `renderHearts(s.hearts); renderPoll(s.poll);`; handlers mới `heart: heartMilestone`, `share: showShare`, `pollEnd`. Không đổi gì khác (trừ dòng `follow` ở Step 2).
- [ ] Step 5: `node --check` bản sao tạm, `node --test` PASS. Commit đúng `fx-engage.js`, `fx-engage.css`, `main.js`.
- [ ] Step 6 (controller, trình duyệt): trạng thái giả, gọi trực tiếp hàm, chụp ảnh từng hiệu ứng, thử tên chứa `<img onerror>`, kiểm tra không còn phần tử mồ côi.

---

### Task 4: Bảng điều khiển (controller làm, không commit)

`public/control.html`: một mục mới "🤝 Tương tác cả phòng" gồm: `heartGoalOn`, `heartGoalStep`, `shareRewardOn`, `sharePts`, `pollOn`, `pollEveryMin`, `pollSec` (theo mẫu `data-k`). Nhắc chủ kênh khởi động lại `CHAY.bat`.
