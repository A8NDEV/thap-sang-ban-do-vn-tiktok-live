// Cấu hình vận hành (khác với cài đặt game): cổng, địa chỉ, token RPC. Lưu ở data/app-config.json.
import crypto from 'node:crypto';
import net from 'node:net';
import { FILES, readJSON, writeJSON } from './core/paths.mjs';

const DEFAULTS = { port: 3002, host: '127.0.0.1', rpcToken: '' };

export function loadAppConfig(){
  const cfg = { ...DEFAULTS, ...readJSON(FILES.config, {}) };
  let dirty = false;
  if (!/^[a-f0-9]{32,}$/.test(cfg.rpcToken || '')) { cfg.rpcToken = crypto.randomBytes(24).toString('hex'); dirty = true; }
  if (dirty) writeJSON(FILES.config, cfg, true);
  if (process.env.PORT) cfg.port = +process.env.PORT;
  // LIVE bằng điện thoại: CHAY-DIEN-THOAI.bat (TSBD_LAN=1, luôn bật) hoặc bấm nút trên trang điều khiển (lưu "phoneLan")
  cfg.lanFixed = process.env.TSBD_LAN === '1';
  cfg.lan = cfg.lanFixed || cfg.phoneLan === true;
  cfg.localHost = cfg.host;
  cfg.lanHost = process.env.TSBD_LAN_HOST || '0.0.0.0';   // bộ test đặt 127.0.0.1
  if (cfg.lan) cfg.host = cfg.lanHost;
  if (process.env.HOST) cfg.host = process.env.HOST;
  if (process.env.RPC_TOKEN) cfg.rpcToken = process.env.RPC_TOKEN;
  return cfg;
}

const tryPort = (port, host) => new Promise(res => {
  const s = net.createServer().once('error', () => res(false)).once('listening', () => s.close(() => res(true)));
  s.listen(port, host);
});
// cổng bận (app khác hoặc bản đang chạy) → thử cổng kế tiếp, tối đa 20 cổng
export async function findFreePort(preferred, host){
  for (let p = preferred; p < preferred + 20; p++) if (await tryPort(p, host)) return p;
  throw new Error(`Không còn cổng trống từ ${preferred} đến ${preferred + 19}`);
}
