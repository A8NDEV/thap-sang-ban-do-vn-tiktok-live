// TẦNG 2 — đường dẫn cho OBS / TikTok LIVE Studio / điện thoại (chuyển từ Sàn Quẩy).
//   - Một số phần mềm phát không nhận "localhost" → tên miền riêng thapsang.test (thêm vào file hosts qua hộp UAC)
//     hoặc mở overlay trong cửa sổ Edge riêng để quay bằng Window Capture.
//   - LIVE bằng điện thoại (CHAY-DIEN-THOAI.bat): link IP mạng nội bộ + kiểm tra / mở tường lửa Windows.
import fs from 'node:fs';
import dns from 'node:dns';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT, DATA_DIR } from '../core/paths.mjs';
import { OBS_DOMAIN, lanIps, isLan } from './auth.mjs';
import { phoneFixed } from './phone-mode.mjs';

let PORT = 0, firewallState = '';
const TOOLS = path.join(ROOT, 'tools');
const OVERLAY = '/overlay.html';
export function configureObs({ port }){ PORT = port; if (isLan()) ensureFirewall(); }

const resolvesLocal = host => new Promise(r => dns.lookup(host, { family: 4 }, (e, a) => r(!e && a === '127.0.0.1')));
const runPs = args => new Promise(r => { const p = spawn('powershell.exe', args, { windowsHide: true, stdio: 'ignore' }); p.on('error', () => r(-1)); p.on('exit', r); });
// chạy script PowerShell với quyền quản trị: Windows hiện hộp UAC, người dùng tự bấm Có
const runAdmin = inner => runPs(['-NoProfile', '-Command', `Start-Process powershell.exe -Verb RunAs -WindowStyle Hidden -Wait -ArgumentList '${inner.replace(/'/g, "''")}'`]);

export async function obsLinks(){
  return {
    domain: OBS_DOMAIN, domainOk: await resolvesLocal(OBS_DOMAIN),
    links: [`http://localhost:${PORT}${OVERLAY}`, `http://127.0.0.1:${PORT}${OVERLAY}`, `http://${OBS_DOMAIN}:${PORT}${OVERLAY}`],
    lan: isLan(), lanFixed: phoneFixed(), firewall: isLan() ? firewallState : '',
    phone: isLan() ? lanIps().map(ip => `http://${ip}:${PORT}${OVERLAY}`) : [],
  };
}
export async function addHost(){
  if (process.platform !== 'win32') throw new Error('Chỉ hỗ trợ Windows');
  const script = path.join(TOOLS, 'them-ten-mien.ps1');
  if (!fs.existsSync(script)) throw new Error(`Thiếu tools/them-ten-mien.ps1 — thêm dòng "127.0.0.1 ${OBS_DOMAIN}" vào file hosts thủ công.`);
  const code = await runAdmin(`-NoProfile -ExecutionPolicy Bypass -File "${script}" -Domain ${OBS_DOMAIN}`);
  await new Promise(r => setTimeout(r, 500));   // chờ ghi hosts + xóa bộ nhớ DNS
  const ok = await resolvesLocal(OBS_DOMAIN);
  if (!ok) throw new Error(code !== 0 ? 'Windows chưa cho quyền quản trị (bấm "Không" ở hộp hỏi quyền).' : 'Đã chạy nhưng tên miền chưa trỏ về máy này.');
  return { domainOk: true };
}
export function openWindow(){
  const pf = [process.env['ProgramFiles(x86)'], process.env.ProgramFiles, process.env.LOCALAPPDATA].filter(Boolean);
  const edge = pf.map(d => path.join(d, 'Microsoft', 'Edge', 'Application', 'msedge.exe')).find(f => fs.existsSync(f));
  if (!edge) throw new Error('Không tìm thấy Microsoft Edge');
  spawn(edge, [`--app=http://127.0.0.1:${PORT}${OVERLAY}`, '--window-size=560,1030', `--user-data-dir=${path.join(DATA_DIR, 'cua-so-obs')}`, '--autoplay-policy=no-user-gesture-required', '--no-first-run'], { detached: true, stdio: 'ignore' }).unref();
  return { ok: true };
}

// tường lửa cho điện thoại: kiểm tra không cần quyền; thiếu quy tắc / còn quy tắc chặn node.exe → hỏi UAC một lần
const fwArgs = () => ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(TOOLS, 'mo-tuong-lua.ps1'), '-Port', String(PORT), '-Program', process.execPath];
async function checkFirewall(){
  if (process.platform !== 'win32' || !fs.existsSync(path.join(TOOLS, 'mo-tuong-lua.ps1'))) return (firewallState = '');
  const code = await runPs([...fwArgs(), '-Check']);
  return (firewallState = code === 0 ? 'ok' : code === 2 ? 'chan' : '');
}
export async function fixFirewall(){
  if (process.platform !== 'win32') throw new Error('Chỉ hỗ trợ Windows');
  await runAdmin(fwArgs().map(a => /[\s"]/.test(a) ? `"${a}"` : a).join(' '));
  return { firewall: await checkFirewall() };
}
let asked = false;
export async function ensureFirewall(){
  if (process.env.TSBD_NO_FIREWALL === '1') return;   // bộ test: không gọi PowerShell / không hiện hộp UAC
  if ((await checkFirewall()) !== 'chan' || asked) return;
  asked = true;
  console.log(`   🛡️  Tường lửa Windows đang chặn cổng ${PORT} — Windows sẽ hỏi quyền quản trị → bấm "Có" để điện thoại mở được.`);
  await fixFirewall().catch(() => {});
}
