// THẮP SÁNG BẢN ĐỒ VIỆT NAM — TikTok LIVE overlay tương tác
//   Người xem bình luận tên tỉnh, thành quê mình → thắp đèn tỉnh đó trên bản đồ 34 tỉnh, thành (sau sáp nhập 2025).
//
// File này chỉ lắp ráp các tầng (xem docs/KIEN-TRUC.md):
//   T1 src/ingest   — TikTok, webhook, chạy thử, làm sạch dữ liệu
//   T2 src/protocol — HTTP, WebSocket, JSON-RPC 2.0, token
//   T3 src/domain   — trạng thái + luật chơi
//   T4 src/audio    — giọng đọc MC, hàng đợi, nhạc nền
//   T5 public/      — overlay 9:16, bảng điều khiển
//   T6 electron/    — vỏ app Windows (tùy chọn)
//
//   npm install && node server.mjs   (hoặc CHAY.bat)
import { FILES, writeJSON } from './src/core/paths.mjs';
import { addLog } from './src/core/bus.mjs';
import { loadAppConfig, findFreePort } from './src/config.mjs';
import { stopOldInstance } from './src/core/single.mjs';
import { settings } from './src/domain/settings.mjs';
import { loadStore, flushAll } from './src/domain/store.mjs';
import { startGameLoops, litCount, peopleCount, setThemePool } from './src/domain/game.mjs';
import { styles } from './src/dist/giao-dien.mjs';
import { startDuelLoop } from './src/domain/duel.mjs';
import { startQuizLoop } from './src/domain/quiz.mjs';
import { startPollLoop } from './src/domain/poll.mjs';
import { startMissionLoop } from './src/domain/mission.mjs';
import { TOTAL } from './src/domain/provinces.mjs';
import { startMC, pruneCache, prewarm } from './src/audio/mc.mjs';
import { startMusicWatch } from './src/audio/music.mjs';
import { startAutoPacing } from './src/ingest/auto-pacing.mjs';
import { connectTikTok, disconnectTikTok } from './src/ingest/tiktok.mjs';
import { configureAuth, controlUrl, lanIps } from './src/protocol/auth.mjs';
import { createHttpServer } from './src/protocol/http.mjs';
import { attachWs } from './src/protocol/ws-hub.mjs';
import { startDist, APP_VERSION } from './src/dist/index.mjs';
import { setShutdown } from './src/core/bus.mjs';
import { configureObs } from './src/protocol/obs.mjs';
import { configurePhone, isRebinding } from './src/protocol/phone-mode.mjs';

const EXIT_PORT_BUSY = 98;
const cfg = loadAppConfig();
if (await stopOldInstance(cfg.rpcToken)) addLog('♻️ Đã tắt bản app đang chạy trước đó.');
loadStore();
setThemePool(() => ['mac-dinh', ...styles.list()]);

const port = await findFreePort(cfg.port, cfg.host).catch(e => { console.error(e.message); process.exit(EXIT_PORT_BUSY); });
if (port !== cfg.port) addLog(`⚠️ Cổng ${cfg.port} đang bận → dùng cổng ${port}`);
configureAuth({ token: cfg.rpcToken, port, lan: cfg.lan });

const server = createHttpServer({ port });
attachWs(server);
startGameLoops();
startDuelLoop();
startQuizLoop();
startPollLoop();
startMissionLoop();
startMC();
startMusicWatch();
startDist();
startAutoPacing();

server.on('error', e => { if (isRebinding()) return; addLog('Lỗi server: ' + e.message); if (e.code === 'EADDRINUSE') process.exit(EXIT_PORT_BUSY); });
server.listen(port, cfg.host, () => {
  try { writeJSON(FILES.runtime, { port, pid: process.pid, startedAt: Date.now() }); } catch {}
  addLog(`Thắp Sáng Bản Đồ ${APP_VERSION} chạy · Overlay: http://localhost:${port}/overlay.html`);
  addLog(`🔑 Bảng điều khiển: ${controlUrl()}`);
  addLog(`🗺️ Bản đồ hiện có ${litCount()}/${TOTAL} tỉnh sáng · ${peopleCount()} người`);
  configureObs({ port });
  configurePhone({ server, port, localHost: cfg.localHost, lanHost: cfg.lanHost, lanFixed: cfg.lanFixed, lanOn: cfg.lan });
  if (cfg.lan) for (const ip of lanIps()) addLog(`📱 Điện thoại (cùng Wi-Fi): http://${ip}:${port}/overlay.html`);
  process.send?.({ type: 'ready', port, token: cfg.rpcToken });   // báo cho vỏ Electron
  if (settings.lastUniqueId) { addLog(`🔁 Tự kết nối lại TikTok @${settings.lastUniqueId}...`); setTimeout(() => connectTikTok(settings.lastUniqueId), 2500); }
  if (process.env.TSBD_NO_PREWARM !== '1') setTimeout(() => { pruneCache(); prewarm(); }, 1500);   // bộ test tắt để không gọi mạng
});

// tắt an toàn: ghi trạng thái xuống đĩa ngay (không chờ debounce)
let stopping = false;
async function shutdown(code = 0){
  if (stopping) return; stopping = true;
  try { flushAll(); } catch {}
  try { await Promise.race([disconnectTikTok(false), new Promise(r => setTimeout(r, 1500))]); } catch {}
  process.exit(code);
}
setShutdown(code => shutdown(code));   // tắt an toàn theo yêu cầu (CHAY.bat chạy lại nếu mã thoát khác 77)
for (const sig of ['SIGINT', 'SIGTERM', 'SIGBREAK', 'SIGHUP']) process.on(sig, () => shutdown(0));
process.on('message', m => { if (m?.type === 'shutdown') shutdown(0); });
process.on('beforeExit', () => { try { flushAll(); } catch {} });
process.on('uncaughtException', e => addLog('Lỗi: ' + (e?.stack || e)));
process.on('unhandledRejection', e => addLog('Lỗi: ' + (e?.message || e)));
