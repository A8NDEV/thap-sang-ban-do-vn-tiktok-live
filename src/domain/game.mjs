// TẦNG 3 — luật chơi "Thắp sáng bản đồ": thắp đèn tỉnh, vòng đua điểm, quà, cả nước rực sáng.
// Nhận sự kiện đã chuẩn hóa từ tầng 1 (onChat/onLike/onGift/onJoin), cập nhật store, phát sự kiện hình (broadcast) và lời MC (say).
import { broadcast, addLog } from '../core/bus.mjs';
import { cleanName, sanitizeText } from '../ingest/sanitize.mjs';
import { S, fans, save, saveFans, resetSession } from './store.mjs';
import { settings, tiers, ptsFor } from './settings.mjs';
import { NAMES, TOTAL, INFO, findProvinces, findIsland, factOf, ISLAND_LINE } from './provinces.mjs';
import { say, queueLen, queueCount } from '../audio/tts-queue.mjs';
import { prefetchName } from '../audio/tts-engine.mjs';
import { addOwnerCoins, ownersView } from './owners.mjs';
import { duelAdd, duelView, startDuel } from './duel.mjs';
import { actFor, giftMenu } from './gift-acts.mjs';
import { quizAnswer, quizActive, quizView } from './quiz.mjs';
import { chestAdd, chestView } from './chest.mjs';
import { crossedFull } from './full-rule.mjs';
import { addRegionScore, getRegionsSnapshot, resetRegionsScore, is3MienModalOpen } from './regions.mjs';
import { LEVEL_NAMES, parseTiers, levelOf, nextInfo } from './levels.mjs';
import { rankList, detectOvertake } from './ranking.mjs';
import { missionOnChat, missionView } from './mission.mjs';
import { pollOnChat, pollView } from './poll.mjs';
import { topMilestone, heartView } from './heartgoal.mjs';
import { shareAllowed } from './share-rule.mjs';
import { fxFlags } from './fx-flags.mjs';
import { pickIndex, HEART_LINES, SHARE_LINES } from './engage-lines.mjs';

/* ------------------------------------------------------------------ trạng thái gửi overlay */
export const litCount = () => Object.keys(S.lit).length;
export const peopleCount = () => Object.keys(S.who).length;
export const sortObj = (o, n) => Object.entries(o).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, n);
export function snapshot(){
  const lit = {};
  for (const [ten, L] of Object.entries(S.lit)) lit[ten] = { by: L.by, last: L.last, n: L.people.length, at: L.at, recent: (L.recent || [L.last || L.by]).map(r => ({ name: r.name, avatar: r.avatar })) };
  return {
    t: 'state', lit, litCount: litCount(), total: TOTAL, people: peopleCount(), last: S.last,
    round: { no: S.roundNo, endsAt: S.roundEnd, now: Date.now(), top: sortObj(S.pts, 5).map(([prov, pts]) => ({ prov, pts })) },
    gifts: sortObj(S.gifts, 5).map(([prov, coins]) => ({ prov, coins })),
    donors: Object.values(S.donors).sort((a, b) => b.coins - a.coins).slice(0, 3).map(d => ({ ...d, level: settings.levelOn ? levelOf(d.coins, parseTiers(settings.levelTiers)) : 0 })),
    quiz: quizView(),
    chest: chestView(),
    mission: missionView(),
    hearts: settings.heartGoalOn ? heartView(Number(S.hearts) || 0, settings.heartGoalStep) : null,
    poll: pollView(),
    regions: getRegionsSnapshot().regions,
    regionsModalOpen: is3MienModalOpen(),
    wins: S.wins, menu: settings.giftMenuOn ? giftMenu(settings.giftMap) : [], owners: settings.ownerOn ? ownersView() : {}, duel: duelView(), rules: { commentPts: settings.commentPts, likePts: settings.likePts, followPts: settings.followPts, duelFollowPts: settings.duelFollowPts, tiers: tiers(), fullCoins: settings.fullCoins, roundMin: settings.roundMin, quizPts: settings.quizPts, levelTiers: settings.levelTiers, levelOn: settings.levelOn },
    look: { theme: settings.theme, lite: settings.fxLite, camZoom: !!settings.camZoom, showFps: !!settings.showFps, lensOn: !!settings.lensOn, softZoom: !!settings.softZoom, board: settings.boardStyle, map3d: settings.map3d, fx: fxFlags(settings) },
  };
}
let pushT = null;
export function push(){ if (!pushT) pushT = setTimeout(() => { pushT = null; broadcast(snapshot()); }, 250); save(); }   // gộp cập nhật 250ms
export function pushNow(){ clearTimeout(pushT); pushT = null; broadcast(snapshot()); save(); }

// đoạn có số liệu thay đổi (điểm, thứ hạng): không lưu bộ nhớ đệm
export const dyn = t => ({ t, nc: true });

/* ------------------------------------------------------------------ người xem */
export function fan(uid, name, avatar){
  const f = fans[uid] ||= { name: cleanName(name), home: '', seen: 0 };
  f.name = cleanName(name) || f.name; if (avatar) f.avatar = avatar; f.seen = Date.now(); saveFans();
  return f;
}
const lastCmt = new Map();   // chống spam: mỗi người tối đa 1 điểm bình luận / 2 giây
// dn: điểm tính cho Đại chiến (mặc định = n; bình luận / tim có mức riêng khi đang Đại chiến)
function addPts(ten, n, dn = n){ if (!ten) return; if (dn > 0) duelAdd(ten, dn); if (!(n > 0)) return; S.pts[ten] = (S.pts[ten] || 0) + n; if (!S.roundEnd) S.roundEnd = Date.now() + settings.roundMin * 60_000; }
export function addBonusPts(ten, n){ addPts(ten, n); pushNow(); }
function cmtPt(uid, ten){ const now = Date.now(); if (now - (lastCmt.get(uid) || 0) < 2000) return; lastCmt.set(uid, now); addPts(ten, settings.commentPts, settings.duelCmtPts); }
setInterval(() => { const old = Date.now() - 60_000; for (const [k, t] of lastCmt) if (t < old) lastCmt.delete(k); }, 60_000).unref();

// sau khi cộng điểm: quê đang đứng đâu, cách quê dẫn đầu bao nhiêu
export function raceTail(ten){
  const top = sortObj(S.pts, 99), r = top.findIndex(([t]) => t === ten);
  if (r === 0) return top[1] ? `${ten} đang dẫn đầu vòng đua, hơn ${top[1][0]} ${top[0][1] - top[1][1]} điểm!` : `${ten} đang dẫn đầu vòng đua!`;
  if (r > 0) { const gap = top[0][1] - top[r][1] + 1, need = settings.mcGiftCta ? tiers().find(([, p]) => p >= gap) : null; return need ? `Chỉ cần thêm quà ${need[0]} xu là ${ten} vượt ${top[0][0]} lên dẫn đầu!` : `${ten} đang đứng thứ ${r + 1}, cố lên!`; }
  return '';
}

/* ------------------------------------------------------------------ thắp đèn */
export const isBotUid = uid => typeof uid === 'string' && (uid.startsWith('auto_') || uid.startsWith('demo'));
let lastLightSay = 0;
// 3 người thắp gần nhất của mỗi tỉnh (hiện ảnh đại diện chồng lên nhau trên tỉnh)
function pushRecent(L, uid, name, avatar){ L.recent = [{ uid, name, avatar: avatar || '' }, ...(L.recent || []).filter(r => r.uid !== uid)].slice(0, 3); }
const lightQ = () => queueCount('light');
let batchLit = [];
function light(uid, name, avatar, ten, why = 'chat'){
  const isBot = isBotUid(uid);
  const f = fan(uid, name, avatar), now = Date.now(), nm = cleanName(name);
  S.lastAct = now;

  // Tỉnh coi là mới sáng (fresh) nếu:
  // 1. Chưa từng sáng (!S.lit[ten])
  // 2. HOẶC trước đó chỉ do BOT thắp (prevLit.byBot = true), nay có NGƯỜI THẬT đầu tiên thắp!
  const prevLit = S.lit[ten];
  const fresh = !prevLit || (!isBot && prevLit.byBot);

  const L = S.lit[ten] ||= { at: now, by: { name: nm, avatar: avatar || '' }, people: [], byBot: isBot };

  // Nếu người thật thắp: chính thức chiếm ngôi người thắp đầu tiên thay cho bot!
  if (!isBot && L.byBot) {
    L.by = { name: nm, avatar: avatar || '' };
    L.byBot = false;
    L.at = now;
  }

  const newPerson = !L.people.includes(uid);
  if (newPerson) L.people.push(uid);
  L.last = { name: nm, avatar: avatar || '' };
  pushRecent(L, uid, nm, avatar);
  const w = S.who[uid] ||= { name: nm, provs: [] }; if (!w.provs.includes(ten)) w.provs.push(ten);
  cmtPt(uid, ten);
  if (!(quizActive() && f.home)) { f.home = ten; saveFans(); }   // đang đố mà đoán tên tỉnh → vẫn thắp đèn, nhưng không đổi quê
  if (f.pending) { const { coins, pts } = f.pending; f.pending = null; if (coins) S.gifts[ten] = (S.gifts[ten] || 0) + coins; addPts(ten, pts); if (!isBot) say([nm, dyn(`ơi, ${coins ? 'quà' : 'điểm câu đố'} của bạn đã cộng ${pts} điểm cho ${ten}.`), dyn(raceTail(ten))], { tag: 'gift' }); claimOwner(uid, nm, avatar, ten, coins); }
  const fact = factOf(ten);

  // Người thật thắp luôn được ưu tiên giữ trên thẻ "Vừa thắp đèn". Bot không được đè tên người thật vừa thắp (<25s)
  const isReal = !isBot;
  const canUpdateCard = isReal || !S.last || (Date.now() - S.last.at > 25_000);
  if (canUpdateCard && (fresh || newPerson)) {
    S.last = { kind: 'light', name: nm, avatar: avatar || '', prov: ten, fact, fresh, at: now, isBot };
  }

  broadcast({ t: 'light', prov: ten, name: nm, avatar: avatar || '', fresh, newPerson, isBot });
  if (fresh || newPerson) addLog(`🏮 ${nm} thắp đèn ${ten}${fresh ? ' (tỉnh mới sáng!)' : ''}${why === 'return' ? ' · quay lại' : ''}${isBot ? ' [ẢO]' : ''}`);

  // MC CHỈ ĐỌC CHO NGƯỜI THẬT (không đọc bot để tránh nghẽn giọng và đè tiếng người thật)
  if (!isBot) {
    if (fresh) {
      const q = lightQ();       // nhiều tỉnh sáng dồn dập → đọc ngắn, quá nhiều thì gộp thành 1 câu điểm danh
      if (q >= 4) batchLit.push(ten);
      else say([nm, why === 'return' ? `quê ${ten} đã quay lại, thắp đèn cho ${ten}.` : `vừa thắp đèn cho ${ten}.`, ...(settings.readFact && q < 2 ? [fact] : [])], { tag: 'light' });
      const n = litCount();
      if (n === TOTAL) { broadcast({ t: 'full' }); say(['Tuyệt vời quá! Cả 34 tỉnh, thành đã sáng đèn. Cảm ơn bà con khắp mọi miền đất nước!'], { tag: 'win' }); }
      else if (n % 5 === 0) say([`Bản đồ đã sáng ${n} trên 34 tỉnh, thành rồi. Còn ${TOTAL - n} tỉnh nữa thôi!`], { tag: 'light' });
    } else if (now - lastLightSay > 4000 && queueLen() < 3) {
      lastLightSay = now;
      say([nm, why === 'return' ? `quê ${ten} đã quay lại.` : `thắp thêm đèn cho ${ten}.`, ...(settings.readFact && Math.random() < .35 ? [fact] : [])], { tag: 'light2' });
    }
  }
  push();
}
function lightAll(uid, nm, avatar, coins, pts, home, f){
  const now = Date.now();
  for (const ten of NAMES) {
    const L = S.lit[ten] ||= { at: now, by: { name: nm, avatar: avatar || '' }, people: [] };
    if (!L.people.includes(uid)) L.people.push(uid);
    L.last = { name: nm, avatar: avatar || '' };
    pushRecent(L, uid, nm, avatar);
  }
  const w = S.who[uid] ||= { name: nm, provs: [] }; w.provs = [...NAMES];
  if (home) { S.gifts[home] = (S.gifts[home] || 0) + coins; addPts(home, pts); }
  if (home) setTimeout(() => claimOwner(uid, nm, avatar, home, coins), 0);
  // chưa có quê → GIỮ điểm thưởng + xu (tính Chủ tỉnh) như quà thường, comment tên tỉnh là cộng một lần
  let held = null;
  if (!home && f) { held = f.pending || { coins: 0, pts: 0 }; held.coins += coins; held.pts += pts; f.pending = held; saveFans(); }
  S.last = { kind: 'full', name: nm, avatar: avatar || '', prov: home, coins, pts, at: now };
  broadcast({ t: 'fullGift', name: nm, avatar: avatar || '', coins });
  say(['Ôi trời ơi!', nm, 'đã thắp sáng cả nước!', 'Cả 34 tỉnh, thành rực sáng cùng lúc!', 'Cảm ơn', nm, 'rất rất nhiều!', ...(home ? [`Cộng ${pts} điểm cho ${home}.`] : held ? [dyn(`Comment tên tỉnh quê bạn để cộng ${held.pts} điểm cho quê nhé.`)] : [])], { tag: 'win' });
  pushNow();
}
// người quen từng thắp đèn ở buổi trước: bình luận / thả tim / vào phòng → tự thắp lại đèn quê họ
function maybeReturn(uid, name, avatar){
  const f = fans[uid];
  if (!settings.returnLight || !f?.home || S.who[uid] || !INFO[f.home]) return false;
  light(uid, name, avatar, f.home, 'return');
  return true;
}

// cộng điểm thưởng (câu đố) cho quê người xem; chưa có quê → giữ lại, comment tên tỉnh là cộng. Trả tên quê ('' nếu chưa có)
export function awardPts(uid, name, avatar, pts){
  const f = fan(uid, name, avatar);
  if (!f.home) { const p = f.pending || { coins: 0, pts: 0 }; p.pts += pts; f.pending = p; saveFans(); return ''; }
  if (!S.who[uid]) maybeReturn(uid, name, avatar);
  addPts(f.home, pts); push();
  return f.home;
}

/* ------------------------------------------------------------------ sự kiện từ tầng 1 */
const islandAt = { hs: 0, ts: 0 };
export function onChat(uid, name, rawText, avatar){
  const text = sanitizeText(rawText);
  seen(uid, name);
  if (quizAnswer(uid, cleanName(name), avatar, text)) { S.lastAct = Date.now(); return; }   // đáp án đúng câu đố: cộng điểm, không thắp đèn theo nó
  const provs = findProvinces(text);
  if (!isBotUid(uid)) missionOnChat(uid, provs);
  if (!isBotUid(uid)) pollOnChat(uid, text);
  for (const k of findIsland(text)) {
    broadcast({ t: 'island', k, name: cleanName(name) });
    if (Date.now() - islandAt[k] > 90_000) { islandAt[k] = Date.now(); say([ISLAND_LINE[k]], { tag: 'light2' }); }
  }
  if (provs.length) {
    for (const ten of provs) {
      light(uid, name, avatar, ten);
      chestAdd(ten, 1, cleanName(name));
      addRegionScore(ten, 'chat', settings.commentPts, cleanName(name), avatar);
    }
    return;
  }
  if (maybeReturn(uid, name, avatar)) return;
  const f = fan(uid, name, avatar);
  if (f.home) {
    cmtPt(uid, f.home);
    chestAdd(f.home, 1, cleanName(name));
    addRegionScore(f.home, 'chat', settings.commentPts, cleanName(name), avatar);
    push();
  } else {
    addRegionScore(text, 'chat', settings.commentPts, cleanName(name), avatar);
  }
}
export function onLike(uid, name, n, avatar){
  S.lastAct = Date.now();
  const f = fan(uid, name, avatar);
  seen(uid, name);
  if (!isBotUid(uid) && settings.heartGoalOn) heartAdd(n);   // tim của mọi người thật, kể cả chưa có quê
  if (!f.home) return;
  if (!S.who[uid]) maybeReturn(uid, name, avatar);
  const k = Math.min(n, 30);
  if (settings.likePts || duelView()) { addPts(f.home, k * settings.likePts, k * settings.duelLikePts); push(); }
  addRegionScore(f.home, 'like', k * (settings.likePts || 1), cleanName(name), avatar, { n: k });
}
// mục tiêu tim: cộng vào tổng cả phòng; vượt một hay nhiều mốc chỉ phát MỘT sự kiện (mốc cao nhất)
let lastHeartLine = -1;
function heartAdd(n){
  const add = Math.max(1, Math.min(100, Math.round(+n) || 1)), prev = Number(S.hearts) || 0, total = prev + add, step = settings.heartGoalStep;
  S.hearts = total;
  const ms = topMilestone(prev, total, step);
  if (ms !== null) {
    broadcast({ t: 'heart', total, step, milestone: ms });
    lastHeartLine = pickIndex(HEART_LINES.length, lastHeartLine);
    say([dyn(HEART_LINES[lastHeartLine](ms))], { tag: 'light2' });
    addLog(`❤️ Cả phòng đã đủ ${ms} lượt tim`);
  }
  push();
}
// thưởng chia sẻ live: mỗi người 1 lần / 5 phút, lời MC tối đa 1 câu / 8 giây toàn cục (sự kiện overlay vẫn phát)
const lastShare = new Map();
let lastShareSay = 0, lastShareLine = -1;
export function onShare(uid, name, avatar){
  if (isBotUid(uid) || !settings.shareRewardOn) return;
  const now = Date.now();
  if (!shareAllowed(lastShare.get(uid), now, 300_000)) return;
  if (lastShare.size > 500) for (const [k, t] of lastShare) if (now - t >= 300_000) lastShare.delete(k);
  lastShare.set(uid, now);
  S.lastAct = now;
  const f = fan(uid, name, avatar), nm = cleanName(name) || f.name, pts = settings.sharePts;
  seen(uid, name);
  if (f.home && pts > 0) addBonusPts(f.home, pts);   // cố ý: thưởng chia sẻ cũng tính điểm Đại chiến (addBonusPts → addPts → duelAdd), giống thưởng nhiệm vụ
  broadcast({ t: 'share', name: nm, avatar: avatar || f.avatar || '', prov: f.home || '' });
  addLog(`🔗 ${nm} đã CHIA SẺ live${f.home && pts > 0 ? ` (+${pts} điểm quê ${f.home})` : ''}`);
  if (now - lastShareSay >= 8000) {
    lastShareSay = now;
    lastShareLine = pickIndex(SHARE_LINES.length, lastShareLine);
    say([dyn(SHARE_LINES[lastShareLine](nm))], { tag: 'light2' });
  }
}
export function onFollow(uid, name, avatar){
  const isBot = isBotUid(uid);
  S.lastAct = Date.now();
  const nm = cleanName(name);
  const f = fan(uid, name, avatar);
  seen(uid, name);
  const pts = settings.followPts || 20;
  const duelPts = settings.duelFollowPts || 25;

  if (f.home) {
    if (!S.who[uid]) maybeReturn(uid, name, avatar);
    addPts(f.home, pts, duelPts);
    chestAdd(f.home, 2, nm);
    addRegionScore(f.home, 'follow', pts, nm, avatar);
    addLog(`➕ ${nm} đã FOLLOW kênh (+${pts} điểm quê ${f.home}${duelView() ? ' · +' + duelPts + ' kéo co' : ''})${isBot ? ' [ẢO]' : ''}`);
    broadcast({ t: 'follow', name: nm, avatar: avatar || '', prov: f.home, pts, duelPts: duelView() ? duelPts : 0, isBot });
    if (!isBot) say([`Cảm ơn ${nm} đã follow kênh!`, `Cộng ngay ${pts} điểm cho quê ${f.home}.`], { tag: 'gift' });
    push();
  } else {
    addRegionScore('', 'follow', pts, nm, avatar);
    addLog(`➕ ${nm} đã FOLLOW kênh (chưa chọn quê)${isBot ? ' [ẢO]' : ''}`);
    broadcast({ t: 'follow', name: nm, avatar: avatar || '', prov: '', pts, isBot });
    if (!isBot) say([`Cảm ơn ${nm} đã follow kênh!`, dyn(`Comment tên tỉnh quê bạn để nhận ngay ${pts} điểm cho quê nhé.`)], { tag: 'gift' });
  }
}
// cấp độ + vượt hạng của người tặng (chỉ người thật): tính đồng bộ ngay lúc có quà, phát trễ 700ms để banner quà hiện trước
const NO_LV = { lv: 0, lvName: '', lvNext: null, lvNeed: 0 };
// lời MC cấp/hạng: mỗi người tối đa 1 câu / 20 giây, toàn cục 1 câu / 8 giây (sự kiện hình vẫn phát đủ)
const lvSayAt = new Map();
let lvSayAll = 0;
export const _resetLevelSay = () => { lvSayAt.clear(); lvSayAll = 0; };   // chỉ cho test
function lvSayOk(uid){
  const now = Date.now();
  if (now - lvSayAll < 8000 || now - (lvSayAt.get(uid) || 0) < 20_000) return false;
  if (lvSayAt.size > 200) for (const [k, ts] of lvSayAt) if (now - ts >= 20_000) lvSayAt.delete(k);
  lvSayAll = now; lvSayAt.set(uid, now);
  return true;
}
function levelFx(D, before, rkBefore, prov, uid){
  if (!settings.levelOn && !settings.overtakeOn) return NO_LV;
  const tr = parseTiers(settings.levelTiers), ni = nextInfo(D.coins, tr), oldLv = levelOf(before, tr);
  const who = { name: D.name, avatar: D.avatar || '' };
  const up = settings.levelOn && ni.level > oldLv;
  const ov = settings.overtakeOn && rkBefore.length ? detectOvertake(rkBefore, rankList(S.donors, 1000), uid) : null;   // người tặng đầu tiên của buổi: không có ai để vượt
  const sayOv = !!ov && !!(ov.passed || ov.rank <= 3);   // hạng 4-5 mà không vượt ai: chỉ hiện hình, MC không đọc
  if (up || ov) setTimeout(() => {
    try {
      if (up) broadcast({ t: 'levelUp', ...who, level: ni.level, levelName: LEVEL_NAMES[ni.level], next: ni.next, need: ni.need, prov });
      if (ov) broadcast({ t: 'overtake', ...who, rank: ov.rank, passedName: ov.passed?.name || '', passedAvatar: ov.passed?.avatar || '' });
      if (!(up || sayOv) || !lvSayOk(uid)) return;   // đang trong thời gian chờ: bỏ câu nói, sự kiện hình đã phát
      const a = up ? (ni.next ? `${who.name} lên cấp ${ni.name}` : `${who.name} đã đạt cấp ${ni.name}`) : who.name;
      const b = sayOv ? (ov.passed ? `vượt ${ov.passed.name} lên hạng ${ov.rank}` : `vào top ${ov.rank}`) : '';
      const cta = up && ni.next && settings.mcGiftCta ? ` Còn ${ni.need} xu nữa lên ${ni.next}.` : '';
      say([dyn(up && sayOv ? `${a} và ${b}!${cta}` : up ? `${a}!${cta}` : `${a} ${b}!`)], { tag: 'gift' });   // một quà → tối đa MỘT câu cấp/hạng
    } catch (err) { addLog('⚠️ levelFx: ' + (err?.message || err)); }
  }, 700);
  return settings.levelOn ? { lv: ni.level, lvName: LEVEL_NAMES[ni.level], lvNext: ni.next, lvNeed: ni.need } : NO_LV;
}
// quà → điểm theo bậc; đủ fullCoins xu (một lần hoặc cộng dồn cả buổi) → cả nước rực sáng
export function onGift(uid, name, giftName, cnt, price, avatar, giftId = ''){
  const isBot = isBotUid(uid);
  S.lastAct = Date.now();
  const f = fan(uid, name, avatar), coins = cnt * price, nm = cleanName(name);
  let lvx = NO_LV;
  if (!isBot) {
    const D = S.donors[uid] ||= { name: nm, avatar: avatar || '', coins: 0 };
    const rkBefore = rankList(S.donors, 1000);
    const before = D.coins; D.coins += coins; D.name = nm; if (avatar) D.avatar = avatar;
    try { lvx = levelFx(D, before, rkBefore, f.home, uid); } catch (err) { addLog('⚠️ levelFx: ' + (err?.message || err)); }   // lỗi hiệu ứng không bao giờ chặn xử lý quà
  }
  const act = actFor(settings.giftMap, giftId, giftName);   // quà đã gán hành động (Sàn Quẩy-style)
  const full = act === 'casang' || crossedFull(S.donors[uid]?.coins, coins, settings.fullCoins);   // vượt một mốc fullCoins (không bật lại ở mọi quà sau)
  if (act === 'daichien') { const r = startDuel(); if (!r.ok) addLog('⚔️ Quà mở Đại chiến: ' + r.error); }
  const pts = full ? Math.max(ptsFor(coins), settings.fullPts) : ptsFor(coins);
  const what = `${cnt > 1 ? cnt + ' ' : ''}${giftName}`;
  addLog(`🎁 ${nm} tặng ${cnt} × ${giftName} (${coins} xu) = ${pts} điểm${f.home ? ' → ' + f.home : ''}${full ? ' · CẢ NƯỚC RỰC SÁNG' : ''}${isBot ? ' [ẢO]' : ''}`);
  if (full) return lightAll(uid, nm, avatar, coins, pts, f.home, f);

  const isReal = !isBot;
  if (isReal || !S.last || (Date.now() - S.last.at > 25_000)) {
    S.last = { kind: 'gift', name: nm, avatar: avatar || '', prov: f.home, gift: what, coins, pts, at: Date.now(), isBot };
  }

  if (!f.home) {
    const p = f.pending || { coins: 0, pts: 0 }; p.coins += coins; p.pts += pts; f.pending = p; saveFans();
    broadcast({ t: 'gift', prov: '', name: nm, avatar: avatar || '', coins, pts, gift: what, act, isBot, ...lvx });
    addRegionScore(what, 'gift', pts, nm, avatar, { coins, gift: what });
    if (!isBot) say([nm, `ơi, cảm ơn bạn đã tặng ${what}!`, dyn(`Comment tên tỉnh quê bạn để cộng ${p.pts} điểm cho quê nhé.`)], { tag: 'gift' });
    push(); return;
  }
  if (!S.who[uid]) maybeReturn(uid, name, avatar);
  S.gifts[f.home] = (S.gifts[f.home] || 0) + coins;
  addPts(f.home, pts);
  chestAdd(f.home, Math.max(1, Math.round(coins / 2)), nm);
  addRegionScore(f.home, 'gift', pts, nm, avatar, { coins, gift: what });
  broadcast({ t: 'gift', prov: f.home, name: nm, avatar: avatar || '', coins, pts, gift: what, act, isBot, ...lvx });
  if (!isBot) {
    const hype = coins >= 100 ? ['Đại gia', nm, 'chơi lớn quá!', `Cảm ơn bạn đã tặng ${what}!`] : coins >= 30 ? ['Trời ơi,', nm, `đã tặng ${what}, cảm ơn bạn nhiều lắm!`] : coins >= 5 ? ['Woa, cảm ơn', nm, `đã tặng ${what}!`] : ['Cảm ơn', nm, `đã tặng ${what}!`];
    say([...hype, `Cộng ${pts} điểm cho ${f.home}.`, dyn(raceTail(f.home))], { tag: 'gift' });
    claimOwner(uid, nm, avatar, f.home, coins);
  }
  push();
}

// Chủ tỉnh: người tặng nhiều xu nhất cho tỉnh (cộng dồn qua các buổi) → giành ngôi thì vinh danh
function claimOwner(uid, nm, avatar, ten, coins){
  if (!settings.ownerOn || isBotUid(uid)) return;
  const won = addOwnerCoins(ten, uid, nm, avatar || '', coins);
  if (!won) return;
  addLog(`👑 ${nm} thành Chủ tỉnh ${ten}${won.prev ? ' (vượt ' + won.prev + ')' : ''}`);
  broadcast({ t: 'owner', prov: ten, name: nm, avatar: avatar || '', prev: won.prev });
  say([nm, `vừa trở thành Chủ tỉnh ${ten}!`, ...(won.prev ? ['vượt qua', won.prev] : [])], { tag: 'gift' });
  push();
}

// chào người vào phòng: gom tên lại, MC rảnh câu là chào ngay (mc.mjs đọc joinBuf / joined)
export const joinBuf = [], joined = new Map();   // joined: uid → { name, at, called }
const greeted = new Map();
// người xem mới xuất hiện → tạo sẵn giọng đọc tên (chạy nền) để lúc cảm ơn/chào là đọc ngay
function seen(uid, name){
  if (isBotUid(uid)) return; // không tải sẵn giọng đọc cho bot ảo
  if (!joined.has(uid)) {
    const nm = cleanName(name);
    joined.set(uid, { name: nm, at: Date.now(), called: false });
    prefetchName(nm);
  }
}
export function onJoin(uid, name, avatar){
  if (isBotUid(uid)) return; // bỏ qua bot ảo
  const f = fans[uid];
  seen(uid, name);
  if (f?.home && settings.returnLight && !S.who[uid]) { fan(uid, name, avatar); maybeReturn(uid, name, avatar); return; }
  if (!settings.greetJoin || Date.now() - (greeted.get(uid) || 0) < 10 * 60_000) return;
  greeted.set(uid, Date.now());
  if (!joinBuf.some(j => j.uid === uid)) joinBuf.push({ uid, name: cleanName(name), at: Date.now() });
  if (joinBuf.length > 30) joinBuf.splice(0, joinBuf.length - 30);
}
setInterval(() => {   // dọn bộ nhớ: stream 24/7 không để Map phình mãi
  const old = Date.now() - 3 * 3600_000;
  for (const [k, j] of joined) if (j.at < old) joined.delete(k);
  for (const [k, t] of greeted) if (t < old) greeted.delete(k);
}, 10 * 60_000).unref();

/* ------------------------------------------------------------------ vòng đua thắp đèn */
let warned = false;
export const ROUND = { clearMs: 8000 };
let clearT = null;
// hết vòng: tắt đèn các tỉnh sáng trước lúc hết vòng (tỉnh vừa sáng trong thời gian chờ thì giữ), giữ tim + số vòng thắng
function clearMapAfterRound(cut){
  clearT = null;
  for (const k of Object.keys(S.lit)) if ((S.lit[k].at || 0) < cut) delete S.lit[k];
  S.who = {}; S.last = null; batchLit = [];
  if (settings.keepGifts === false) S.gifts = {};
  addLog(`🗺️ Hết vòng ${S.roundNo - 1}: tắt hết đèn, vòng ${S.roundNo} thắp lại từ đầu`);
  broadcast({ t: 'reset' });
  pushNow();
}
// đổi style bản đồ ngẫu nhiên mỗi vòng (chọn khác style đang dùng); pool do server.mjs gắn vào
let themePool = () => ['mac-dinh'];
export const setThemePool = fn => { themePool = fn; };
export function rotateTheme(){
  if (!settings.themeRotate) return false;
  const pool = [...new Set(themePool())].filter(t => t !== settings.theme);
  if (!pool.length) return false;
  settings.theme = pool[Math.floor(Math.random() * pool.length)];
  save();
  broadcast({ t: 'settings', settings }, 'control');
  addLog(`🎨 Vòng ${S.roundNo}: đổi bản đồ sang style "${settings.theme}"`);
  return true;
}
export function endRound(){
  const top = sortObj(S.pts, 3);
  if (top.length) {
    const [[w, p], second] = top;
    S.wins[w] = (S.wins[w] || 0) + 1;
    broadcast({ t: 'winner', prov: w, pts: p, no: S.roundNo });
    addLog(`🏆 Vòng ${S.roundNo}: ${w} thắng với ${p} điểm`);
    say([dyn(`Hết giờ! Vòng đua thứ ${S.roundNo}, quê ${w} thắp sáng nhất với ${p} điểm.`), `Chúc mừng bà con ${w}!`, ...(second ? [`Về nhì là ${second[0]}.`] : []), settings.mcGiftCta ? 'Vòng mới bắt đầu rồi, tặng quà để quê mình về nhất nhé!' : 'Vòng mới bắt đầu rồi, bà con comment tên quê để thắp đèn nhé!'], { tag: 'win' });
    S.roundNo++;
    rotateTheme();
    if (settings.roundClearMap) {
      clearTimeout(clearT);
      const cut = Date.now();
      clearT = setTimeout(() => clearMapAfterRound(cut), ROUND.clearMs);
      clearT.unref?.();
    }
  }
  S.pts = {}; S.roundEnd = top.length ? Date.now() + settings.roundMin * 60_000 : 0; warned = false;
  pushNow();
}
export function resetRound(){ S.pts = {}; S.roundEnd = 0; warned = false; addLog('🔄 Đã xóa điểm vòng đua hiện tại'); pushNow(); }
export function resetMap(){ clearTimeout(clearT); clearT = null; resetSession(true); addLog('🗺️ Đã tắt hết đèn — bản đồ mới'); broadcast({ t: 'reset' }); pushNow(); }
export function newSession(){ clearTimeout(clearT); clearT = null; resetSession(false); addLog('🆕 Buổi live mới: xóa bản đồ, điểm, quà, số vòng thắng'); broadcast({ t: 'reset' }); pushNow(); }

export function startGameLoops(){
  // nhiều tỉnh sáng dồn dập → gộp thành 1 câu điểm danh
  setInterval(() => {
    if (!batchLit.length || lightQ() >= 2) return;
    const L = batchLit.splice(0), head = L.slice(0, 6);
    say([{ t: `Đèn vừa sáng thêm ở ${head.join(', ')}${L.length > 6 ? ` và ${L.length - 6} tỉnh khác` : ''}. Cảm ơn bà con!`, nc: true }], { tag: 'light' });
  }, 1000);
  // đồng hồ vòng đua
  setInterval(() => {
    if (!S.roundEnd) return;
    const left = S.roundEnd - Date.now();
    if (!warned && left < 60_000 && left > 50_000) {
      warned = true;
      const top = sortObj(S.pts, 2);
      if (top.length) say([`Còn một phút nữa là hết vòng đua.`, dyn(`${top[0][0]} đang dẫn đầu với ${top[0][1]} điểm.`), top[1] ? dyn(raceTail(top[1][0])) : 'Quê bạn đang ở đâu, vào thắp đèn đi nào!'], { tag: 'win' });
    }
    if (left <= 0) endRound();
  }, 1000);
}
