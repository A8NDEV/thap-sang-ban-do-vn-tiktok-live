// TẦNG 3 — từ điển 34 tỉnh, thành: nhận tên tỉnh (mới, cũ, thành phố quen) trong bình luận.
import { INFO } from '../../public/data/tinh.js';
import { PROVINCES } from '../../public/data/mapdata.js';
import { norm } from '../ingest/sanitize.mjs';

export { INFO };
export const NAMES = PROVINCES.map(p => p.ten);
export const TOTAL = NAMES.length;

export const ALIAS = [];
for (const ten of NAMES) for (const a of new Set([norm(ten).trim(), ...INFO[ten].alias])) ALIAS.push({ a: ' ' + a + ' ', ten });
ALIAS.sort((x, y) => y.a.length - x.a.length);

export function findProvinces(text){
  let s = norm(text); const out = [];
  for (const { a, ten } of ALIAS) {
    const i = s.indexOf(a);
    if (i < 0) continue;
    if (!out.some(o => o.ten === ten)) out.push({ ten, i });
    s = s.slice(0, i) + ' ' + '#'.repeat(a.length - 2) + ' ' + s.slice(i + a.length);   // không để tên ngắn khớp lại trong tên dài
  }
  return out.sort((a, b) => a.i - b.i).map(o => o.ten).slice(0, 3);
}

const ISLAND = [{ a: ' hoang sa ', k: 'hs' }, { a: ' truong sa ', k: 'ts' }];
export const findIsland = text => { const s = norm(text); return ISLAND.filter(x => s.includes(x.a)).map(x => x.k); };
export const ISLAND_LINE = {
  hs: 'Quần đảo Hoàng Sa thuộc thành phố Đà Nẵng, là một phần lãnh thổ thiêng liêng của Việt Nam.',
  ts: 'Quần đảo Trường Sa thuộc tỉnh Khánh Hòa, là một phần lãnh thổ thiêng liêng của Việt Nam.',
};
export const ISLAND_IDLE = 'Quần đảo Hoàng Sa thuộc thành phố Đà Nẵng, quần đảo Trường Sa thuộc tỉnh Khánh Hòa, là một phần lãnh thổ thiêng liêng của Việt Nam.';

export function factOf(ten){ const f = INFO[ten].facts; return f[Math.floor(Math.random() * f.length)]; }
