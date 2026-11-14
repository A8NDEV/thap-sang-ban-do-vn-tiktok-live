// Dùng bởi CHAY.bat: chờ server báo sẵn sàng (data/runtime.json mới hơn lúc chạy script) rồi mở bảng điều khiển kèm token.
// Không in token ra màn hình.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(process.env.APP_HOME || ROOT, 'data');
const since = Date.now() - 2000;
const read = f => { try { return JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')); } catch { return null; } };

for (let i = 0; i < 120; i++) {
  const rt = read('runtime.json'), cfg = read('app-config.json');
  if (rt && rt.startedAt >= since && cfg?.rpcToken) {
    const url = `http://localhost:${rt.port}/control.html?token=${cfg.rpcToken}`;
    spawn('cmd', ['/c', 'start', '""', url.replace(/&/g, '^&')], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    process.exit(0);
  }
  await new Promise(r => setTimeout(r, 500));
}
console.error('Không thấy server khởi động sau 60 giây — mở thủ công: http://localhost:3002/');
