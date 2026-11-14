// TẦNG 2 — WebSocket /ws: máy chủ đẩy sự kiện tới overlay/bảng điều khiển dưới dạng thông báo JSON-RPC 2.0
//   { "jsonrpc":"2.0", "method":"map.light", "params":{...} }
// Bảng điều khiển (role=control, cần token/cookie) gửi lệnh JSON-RPC, nhận kết quả theo id.
import { WebSocketServer } from 'ws';
import { setBroadcaster, log, addLog, requestQuit } from '../core/bus.mjs';

// đóng hết tab bảng điều khiển → chờ một lúc (tải lại trang không tính) rồi tắt hẳn app, không để server chạy ngầm nặng máy.
// Bản Electron tự quản lý vòng đời nên bỏ qua.
const AUTO_QUIT = !process.send && process.env.TSBD_NO_AUTOQUIT !== '1';
const QUIT_MS = (+process.env.TSBD_AUTOQUIT_SEC || 20) * 1000;
let controls = 0, quitT = null;
function controlOpened(){ controls++; clearTimeout(quitT); quitT = null; }
function controlClosed(){
  if (--controls > 0 || !AUTO_QUIT) return;
  clearTimeout(quitT);
  quitT = setTimeout(() => { if (controls > 0) return; addLog('👋 Đã đóng bảng điều khiển → tắt app.'); requestQuit(); }, QUIT_MS);
}
import { settings } from '../domain/settings.mjs';
import { snapshot } from '../domain/game.mjs';
import { musicMsg } from '../audio/music.mjs';
import { pricesMsg } from '../ingest/gift-prices.mjs';
import { tiktokMsg } from '../ingest/tiktok.mjs';
import { demoMsg } from '../ingest/demo.mjs';
import { okHost, okOrigin, isAuthorized, isLoopback } from './auth.mjs';
import { handleRpc, parseError } from './rpc.mjs';
import { licenseMsg } from '../dist/license.mjs';
import { distMsg } from '../dist/index.mjs';
import { soundLabel, createSoundTracker } from './nguon-tieng.mjs';

const toRpc = ({ t, ...params }) => JSON.stringify({ jsonrpc: '2.0', method: 'map.' + t, params });

export function attachWs(server){
  const wss = new WebSocketServer({
    server, path: '/ws', maxPayload: 64 * 1024,
    verifyClient: ({ origin, req }) => {
      if (!okHost(req.headers.host) || !okOrigin(origin)) return false;
      const url = new URL(req.url, 'http://x');
      if (url.searchParams.get('role') === 'control' && !isLoopback(req)) return false;   // điện thoại chỉ xem overlay
      return url.searchParams.get('role') !== 'control' || isAuthorized(req, url);   // overlay chỉ xem, không cần token
    },
  });
  setBroadcaster((msg, only) => {
    const s = toRpc(msg);
    for (const c of wss.clients) if (c.readyState === 1 && (!only || c.role === only)) c.send(s);
  });
  const sound = createSoundTracker();
  const toControls = () => { const s = toRpc(sound.msg()); for (const c of wss.clients) if (c.readyState === 1 && c.role === 'control') c.send(s); };
  wss.on('connection', (ws, req) => {
    const q = new URL(req.url, 'http://x').searchParams;
    ws.role = q.get('role') === 'control' ? 'control' : 'overlay';
    if (ws.role === 'overlay' && q.get('sound') === '1') {   // overlay đang phát tiếng → báo trang điều khiển nếu bị trùng
      sound.add(ws, soundLabel(req.headers['user-agent'], q.get('src') || ''));
      ws.once('close', () => { sound.remove(ws); toControls(); });
      toControls();
    }
    if (ws.role === 'control') { controlOpened(); ws.once('close', controlClosed); }
    const send = m => ws.send(toRpc(m));
    send(snapshot()); send(musicMsg()); send(tiktokMsg());
    if (ws.role === 'control') { send({ t: 'logs', lines: log }); send({ t: 'settings', settings }); send(pricesMsg()); send(demoMsg()); send(licenseMsg()); send(distMsg()); send(sound.msg()); }
    ws.on('message', async buf => {
      if (ws.role !== 'control') return;
      let msg; try { msg = JSON.parse(buf); } catch { ws.send(JSON.stringify(parseError())); return; }
      const res = await handleRpc(msg);
      if (res && ws.readyState === 1) ws.send(JSON.stringify(res));
    });
  });
  // giữ kết nối sống qua proxy/OBS: ping 30 giây
  setInterval(() => { for (const c of wss.clients) { if (c.alive === false) { c.terminate(); continue; } c.alive = false; c.ping(); } }, 30_000).unref();
  wss.on('connection', ws => { ws.alive = true; ws.on('pong', () => { ws.alive = true; }); });
  return wss;
}
