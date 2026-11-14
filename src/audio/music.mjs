// TẦNG 4 — kênh nhạc nền: quét thư mục nhac/, overlay tự phát lặp với âm lượng cố định (không hạ khi MC nói).
import fs from 'node:fs';
import path from 'node:path';
import { broadcast, addLog } from '../core/bus.mjs';
import { MUSIC_DIR } from '../core/paths.mjs';
import { settings } from '../domain/settings.mjs';

export const MUSIC_RE = /^[^.].*\.(mp3|m4a|ogg|wav|aac)$/i;
let musicFiles = [];
const sizeOf = f => { try { return fs.statSync(path.join(MUSIC_DIR, f)).size; } catch { return 0; } };
export const musicMsg = () => ({ t: 'music', files: musicFiles.map(f => '/nhac/' + encodeURIComponent(f)), list: musicFiles.map(f => ({ name: f, size: sizeOf(f) })), on: settings.music, vol: settings.musicVol });
export const pushMusic = () => broadcast(musicMsg());
export function scanMusic(){
  let list = []; try { list = fs.readdirSync(MUSIC_DIR).filter(f => MUSIC_RE.test(f)).sort(); } catch {}
  if (list.join('|') === musicFiles.join('|')) return;
  musicFiles = list;
  addLog(list.length ? `🎵 Nhạc nền: ${list.length} bài trong thư mục nhac` : '🎵 Chưa có nhạc nền — chép file mp3 vào thư mục nhac (tự nhận, không cần khởi động lại)');
  pushMusic();
}
export function startMusicWatch(){ scanMusic(); setInterval(scanMusic, 15_000); }

/* ---------- tải nhạc lên / xóa từ trang điều khiển (giống Sàn Quẩy /api/music/upload) ---------- */
export const MUSIC_MAX = 50 * 1024 * 1024;
// tên an toàn: bỏ đường dẫn, chỉ giữ chữ/số/khoảng trắng . _ ( ) -
export function cleanMusicName(raw){
  return path.basename(String(raw || '')).normalize('NFC').replace(/[^\p{L}\p{N} ._()\-]/gu, '').replace(/\s+/g, ' ').trim().slice(-120);
}
// kiểm tra đúng là file âm thanh qua chữ ký đầu file (không tin đuôi file)
export function isAudioBuf(b){
  return b.toString('latin1', 0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) || b.toString('latin1', 0, 4) === 'OggS'
    || (b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WAVE') || b.toString('latin1', 4, 8) === 'ftyp';
}
export function saveMusic(rawName, buf){
  const name = cleanMusicName(rawName);
  if (!MUSIC_RE.test(name)) throw new Error('Chỉ nhận file nhạc .mp3 .m4a .ogg .wav .aac');
  if (!Buffer.isBuffer(buf) || buf.length < 1024) throw new Error('File rỗng hoặc quá nhỏ');
  if (!isAudioBuf(buf)) throw new Error('File không phải nhạc hợp lệ');
  fs.mkdirSync(MUSIC_DIR, { recursive: true });
  const tmp = path.join(MUSIC_DIR, '.tai-len-' + process.pid + '-' + Date.now());
  fs.writeFileSync(tmp, buf); fs.renameSync(tmp, path.join(MUSIC_DIR, name));
  addLog(`🎵 Đã thêm nhạc: ${name}`); scanMusic();
  return { name, size: buf.length };
}
export function deleteMusic(rawName){
  const name = cleanMusicName(rawName);
  if (!MUSIC_RE.test(name) || name !== rawName) throw new Error('Tên bài không hợp lệ');
  fs.unlinkSync(path.join(MUSIC_DIR, name));
  addLog(`🗑️ Đã xóa nhạc: ${name}`); scanMusic();
  return { ok: true };
}
