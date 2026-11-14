// Mở app lần nữa → tắt bản đang chạy trước đó (cùng thư mục dữ liệu), tránh 2 server song song nặng máy và lẫn token.
import { FILES, readJSON } from './paths.mjs';

const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };

export async function stopOldInstance(token){
  const rt = readJSON(FILES.runtime, null);
  if (!rt?.pid || rt.pid === process.pid || !alive(rt.pid) || !token) return false;
  let r;
  try {
    const res = await fetch(`http://127.0.0.1:${rt.port}/rpc`, {
      method: 'POST', signal: AbortSignal.timeout(2000),
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'app.quit' }),
    });
    if (res.status !== 200) return false;   // sai token → không phải app này, để yên
    r = await res.json();
  } catch { return false; }                  // không trả lời → để yên
  if (r.error) { try { process.kill(rt.pid); } catch {} }   // bản cũ chưa có app.quit
  for (let i = 0; i < 60 && alive(rt.pid); i++) await new Promise(res => setTimeout(res, 100));
  return true;
}
