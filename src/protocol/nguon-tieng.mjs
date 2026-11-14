// Đếm số nơi đang PHÁT TIẾNG overlay (OBS, TikTok LIVE Studio, tab Chrome, khung xem trước, điện thoại).
//   ≥ 2 nơi cùng phát + phần mềm LIVE thu "âm thanh máy tính" → người xem nghe tiếng bị đè / vọng 2 lần.
//   Overlay tự báo ?sound=1|0 (đang tắt tiếng thì 0) và ?src=xem-truoc khi nằm trong khung xem trước.
export function soundLabel(ua = '', src = ''){
  if (src === 'xem-truoc') return 'khung xem trước trong trang điều khiển';
  if (/OBS/i.test(ua)) return 'OBS (Browser Source)';
  if (/TikTok|LIVE ?Studio/i.test(ua)) return 'TikTok LIVE Studio';
  if (/Electron/i.test(ua)) return 'cửa sổ overlay của app';
  if (/Android|iPhone|iPad|Mobile/i.test(ua)) return 'điện thoại';
  return 'tab trình duyệt (Chrome / Edge…)';
}
export function createSoundTracker(){
  const on = new Map();   // ws → nhãn
  return {
    add(ws, label){ on.set(ws, label); },
    remove(ws){ return on.delete(ws); },
    msg(){ const where = [...on.values()]; return { t: 'sound', n: where.length, where }; },
  };
}
