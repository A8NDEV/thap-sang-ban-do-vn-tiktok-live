// TẦNG 1 — DANH SÁCH QUÀ TIKTOK (chép cách làm của Sàn Quẩy, qua-tiktok.js): tên Việt + tên Anh, giá xu, hình thật.
//   - App kèm sẵn qua-tiktok.json; bấm "Cập nhật danh sách quà" thì tải bản mới từ danh sách công khai của TikTok
//     (không cần LIVE, không tốn lượt kết nối), lưu data/qua-tiktok.json, bản nào mới hơn thì dùng.
//   - Nhờ có giá sẵn → gần như không còn cảnh "quà mã 8825 không rõ giá, nhập tay".
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, DATA_DIR } from '../core/paths.mjs';

const BUNDLED = path.join(ROOT, 'qua-tiktok.json');
const SAVED = path.join(DATA_DIR, 'qua-tiktok.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const MIN_GIFTS = 100;   // ít hơn số này coi như TikTok trả lỗi, giữ danh sách cũ
const IMG_RE = /^https:\/\/[^\s"'<>]+$/;

export const normGift = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '');
let at = 0;
export const byId = new Map();     // id → { id, name, en, coins, img }
const byName = new Map();          // tên Việt / Anh đã chuẩn hóa → quà (trùng tên thì giữ giá thấp nhất)

function apply(d){
  at = d.at || 0; byId.clear(); byName.clear();
  for (const g of d.gifts || []) {
    if (!g || !/^\d{1,20}$/.test(String(g.id)) || !(g.coins > 0)) continue;
    const x = { id: String(g.id), name: String(g.name || '').slice(0, 60), en: String(g.en || '').slice(0, 60), coins: Math.round(g.coins), img: IMG_RE.test(g.img || '') && g.img.length < 600 ? g.img : '' };
    byId.set(x.id, x);
    for (const k of [normGift(x.name), normGift(x.en)]) if (k && (!byName.has(k) || x.coins < byName.get(k).coins)) byName.set(k, x);
  }
}
export function loadCatalog(...files){
  let best = { at: 0, gifts: [] };
  for (const f of files.length ? files : [BUNDLED, SAVED]) {
    try { const d = JSON.parse(fs.readFileSync(f, 'utf8')); if (Array.isArray(d.gifts) && d.at > best.at) best = d; } catch {}
  }
  apply(best);
  return byId.size;
}
loadCatalog();

// tìm quà theo mã (ưu tiên) hoặc tên Việt / Anh
export function findGift(id, name){
  return byId.get(String(id ?? '')) || byName.get(normGift(name)) || null;
}
export const catalogView = () => ({ at, total: byId.size, gifts: [...byId.values()].sort((a, b) => a.coins - b.coins || a.name.localeCompare(b.name, 'vi')) });

async function fetchLang(lang){
  const q = new URLSearchParams({ aid: '1988', app_name: 'tiktok_web', device_platform: 'web_pc', browser_name: 'Mozilla', app_language: lang, language: lang, webcast_language: lang, browser_language: lang, priority_region: 'VN', region: 'VN', webcast_region: 'VN', tz_name: 'Asia/Ho_Chi_Minh' });
  const r = await fetch(`https://webcast.tiktok.com/webcast/gift/list/?${q}`, { headers: { 'User-Agent': UA, 'Accept-Language': `${lang},vi;q=0.9` }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`TikTok trả lỗi ${r.status}`);
  return (await r.json())?.data?.gifts || [];
}
// Tải mới từ TikTok. Bỏ quà bị khóa theo cấp độ (đa số người xem không tặng được).
export async function refreshCatalog(){
  const [vi, en] = await Promise.all([fetchLang('vi-VN'), fetchLang('en-US')]);
  const enName = new Map(en.map(g => [g.id, g.name]));
  const gifts = vi.filter(g => g.name && g.diamond_count > 0 && g.image?.url_list?.[0] && !g.lock_info?.lock)
    .map(g => ({ id: String(g.id), name: g.name.trim(), en: (enName.get(g.id) || '').trim(), coins: g.diamond_count, img: g.image.url_list[0] }));
  if (gifts.length < MIN_GIFTS) throw new Error(`TikTok chỉ trả về ${gifts.length} quà, giữ danh sách cũ`);
  const d = { at: Date.now(), gifts };
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SAVED, JSON.stringify(d));
  apply(d);
  return { at: d.at, total: byId.size };
}
