// TẦNG 1 — làm sạch dữ liệu thô từ người xem trước khi vào logic game / giọng đọc.

// tên hiển thị: chỉ giữ chữ, số, khoảng trắng (bỏ emoji, ký tự trang trí), tối đa 20 ký tự
export function cleanName(raw){
  const s = String(raw || '').normalize('NFC').replace(/[^\p{L}\p{N}\s._-]/gu, ' ').replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return (s || 'bạn').slice(0, 20);
}

// bình luận: chuẩn hóa NFKC (chữ kiểu toán học → chữ thường), chặn Zalgo / chữ nêm / Braille gây lag, giới hạn độ dài
export function sanitizeText(raw, max = 200){
  return String(raw || '')
    .normalize('NFKC')
    .replace(/([̀-ͯ]{3,})/g, '')            // chồng ≥3 dấu (Zalgo)
    .replace(/[\u{12000}-\u{123FF}\u{12400}-\u{1247F}]/gu, '')  // chữ nêm Cuneiform
    .replace(/[⠀-⣿]/g, '')                   // chữ Braille
    .replace(/[​-‏‪-‮⁠-⁯﻿]/g, '')   // ký tự vô hình / đảo chiều
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

// so khớp không dấu: "Đà Lạt" → " da lat "
export const norm = s => ' ' + String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + ' ';

// mã người xem ổn định từ dữ liệu TikTok / webhook
export function uidOf(d){
  const id = String(d?.user?.userId ?? d?.userId ?? '').trim();
  if (id && id !== '0') return 'uid' + id;
  const s = String(d?.uniqueId || d?.user?.uniqueId || d?.nickname || d?.user?.nickname || '').trim();
  return s || 'u_' + Math.random().toString(36).slice(2);
}
export const nameOf = d => String(d?.nickname || d?.user?.nickname || d?.uniqueId || d?.user?.uniqueId || 'bạn').trim() || 'bạn';
export function avatarOf(d){
  const u = d?.user || d;
  const url = u?.profilePictureUrl || u?.profilePicture?.url?.[0] || u?.profilePicture?.urls?.[0] || u?.avatarThumb?.urlList?.[0] || u?.avatarThumb?.url?.[0] || d?.userDetails?.profilePictureUrls?.[0] || '';
  return /^https:\/\//.test(url) ? url : '';
}
