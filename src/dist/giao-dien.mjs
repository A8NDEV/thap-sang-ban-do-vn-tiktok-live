// ============================================================================
// PHÂN PHỐI — GÓI GIAO DIỆN (7 style màn hình LIVE trả phí): không đóng gói theo app, tải sau khi kích hoạt key.
//   Máy chủ: storage/app/releases/thap-sang-ban-do/assets/giao-dien.pak (cùng đường tải giọng MC, xem tai-du-lieu.mjs)
//   Máy khách: data/giao-dien.pak = JSON { v, files: { "tet.css": "...", "tet.js": "..." } } — đọc thẳng, không giải nén.
//   Máy dev: không có gói thì đọc thư mục goi-style/ (bản build-portable không chép thư mục này).
//   Tạo gói: npm run goi-giong (→ release/du-lieu/giao-dien.pak + manifest.json)
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, DATA_DIR } from '../core/paths.mjs';

export const PAK_NAME = 'giao-dien.pak';
export const STYLE_IDS = ['son-mai', 'aurora', 'neon', 'hoi-an', 'radar', 'tet', 'giay-co'];
const NAME_RE = /^[a-z0-9-]{1,40}\.(css|js)$/;

export function createStyleStore({ pakFile = path.join(DATA_DIR, PAK_NAME), devDir = path.join(ROOT, 'goi-style') } = {}){
  let files = null, key = '';
  function pak(){
    let st; try { st = fs.statSync(pakFile); } catch { files = null; key = ''; return null; }
    const k = st.mtimeMs + ':' + st.size;
    if (k !== key) {
      key = k;
      try { const j = JSON.parse(fs.readFileSync(pakFile, 'utf8')); files = j && typeof j.files === 'object' ? j.files : null; } catch { files = null; }
    }
    return files;
  }
  // nội dung 1 tệp style (chuỗi) hoặc null
  function file(name){
    if (!NAME_RE.test(name)) return null;
    const p = pak();
    if (p && typeof p[name] === 'string') return p[name];
    try { return fs.readFileSync(path.join(devDir, name), 'utf8'); } catch { return null; }
  }
  // style nào đã dùng được (đủ cả .css và .js)
  const list = () => STYLE_IDS.filter(id => file(id + '.css') !== null && file(id + '.js') !== null);
  return { file, list };
}

// gói từ thư mục goi-style/ → chuỗi JSON của tệp .pak
export function buildPak(dir){
  const files = {};
  for (const id of STYLE_IDS) for (const ext of ['css', 'js']) {
    const f = path.join(dir, `${id}.${ext}`);
    if (!fs.existsSync(f)) throw new Error('Thiếu ' + f);
    files[`${id}.${ext}`] = fs.readFileSync(f, 'utf8');
  }
  return JSON.stringify({ v: 1, files });
}

export const styles = createStyleStore();
