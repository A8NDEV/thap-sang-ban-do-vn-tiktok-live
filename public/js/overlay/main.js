// Overlay 9:16 — nhận sự kiện từ máy chủ và điều phối: vẽ trạng thái, hiệu ứng, camera, âm thanh.
import { $ } from './util.js';
import { connectRpc } from '../rpc-client.js';
import { setupStage } from './stage.js';
import { buildMap } from './map.js';
import { render, clearMarks, startCountdown, startDuelClock, startHowRotate, startQuizClock, popQuiz, renderChest, startChestClock, setRegionsModal, renderRegions, pushRegionsCombatFeed } from './render.js';
import { shot, flash, ripple, banner, island, nationWide, startTour, giftFx, duelWin, usurpCrown, dropChestPin, removeChestPin, explodeChestFx } from './fx.js';
import { startAmbient } from './theme.js';
import { startThemeAmbient } from './theme-fx.js';
import { playVoice, stopVoice, setMusic, playSfx, MUTE } from './audio.js';
import { initParticles, screenShake } from './particles.js';
import { registerCombo } from './combo.js';
import { lanternRise, bigGiftCinema } from './fx-cinema.js';
import { setFpsMeter } from './fx-perf.js';
import { showLens, setLensOn } from './fx-lens.js';
import { setSoftZoom } from './fx-camera.js';

setupStage();
initParticles($('#fxCanvas'));
buildMap();
startCountdown();
startDuelClock();
startQuizClock();
startChestClock();
startHowRotate();
startTour();
startAmbient();
startThemeAmbient();

const handlers = {
  state: s => { render(s); setFpsMeter(!!s.look?.showFps); setLensOn(s.look?.lensOn !== false); setSoftZoom(!!s.look?.softZoom); },
  light: m => {
    registerCombo(m.prov);
    if (m.fresh) {
      playSfx('boom');
      screenShake('sm');
      shot({ prov: m.prov, tag: '🏮 ' + m.name, big: true, comet: true });
      lanternRise(m.prov);
    } else if (m.newPerson) {
      playSfx('light');
      shot({ prov: m.prov, tag: '🏮 ' + m.name, big: false, comet: true });
    } else {
      playSfx('light');
      flash(m.prov);
      ripple(m.prov);
    }
  },
  follow: m => {
    playSfx('chime');
    if (m.prov) {
      shot({
        prov: m.prov,
        tag: '➕ ' + m.name + ' FOLLOW',
        plus: `+${m.pts}`,
        big: false,
        comet: true,
      });
    } else {
      banner('➕ CẢM ƠN FOLLOW KÊNH!', m.name, 'comment tên quê để nhận điểm nhé!', 4000, m);
    }
  },
  gift: m => {
    // 1. Phân tầng âm thanh SFX tức thì
    if (m.coins >= 100) playSfx('fanfare');
    else if (m.coins >= 30) { playSfx('boom'); setTimeout(() => playSfx('firework'), 320); }
    else if (m.coins >= 10) playSfx('boom');
    else playSfx('chime');

    // 2. Rung chấn màn hình
    if (m.coins >= 100) screenShake('lg');
    else if (m.coins >= 10) screenShake('sm');

    // 3. Camera shot + Cột sáng & Shockwave + Pháo hoa
    if (m.prov) {
      registerCombo(m.prov);
      const holdTime = m.act === 'camera' ? 6000 : (m.coins >= 100 ? 4200 : (m.coins >= 30 ? 3200 : 0));
      shot({
        prov: m.prov,
        tag: (m.act === 'camera' ? '🎥 ' : '🎁 ') + m.name,
        plus: `+${Number(m.pts).toLocaleString('vi-VN')}`,
        big: true,
        comet: true,
        hold: holdTime,
        fx: () => giftFx(m.prov, m.gift, m.coins, m.act)
      });
    } else if (m.coins >= 100 || m.act === 'rong' || m.act === 'phaohoa') {
      giftFx('', m.gift, m.coins, m.act);
    }

    // 4. Banner hoàng gia vinh danh người tặng quà
    if (m.coins >= 30) {
      const bannerDur = m.coins >= 100 ? 6500 : 4500;
      banner(
        `🎁 ${m.name} TẶNG ${String(m.gift).toUpperCase()}`,
        `+${Number(m.pts).toLocaleString('vi-VN')} ĐIỂM`,
        m.prov ? `cho quê ${m.prov}` : 'comment tên quê để nhận điểm!',
        bannerDur,
        m
      );
    }

    // 5. Cảnh điện ảnh cho quà lớn
    if (m.coins >= 100) bigGiftCinema({ prov: m.prov, name: m.name, gift: m.gift, coins: m.coins });
    if (m.coins >= 100 && m.prov) showLens({ prov: m.prov, name: m.name, avatar: m.avatar, gift: m.gift, coins: m.coins });
  },
  winner: m => {
    playSfx('fanfare');
    screenShake('lg');
    banner(`🏆 KẾT THÚC VÒNG ${m.no}`, `QUÊ ${String(m.prov).toUpperCase()} THẮNG!`, `${m.pts} điểm · chúc mừng bà con ${m.prov}`, 7000);
    shot({ prov: m.prov, tag: '🏆 Vô địch vòng ' + m.no, big: true });
    setTimeout(() => flash(m.prov, 'win'), 800);
  },
  full: () => {
    playSfx('fanfare');
    screenShake('lg');
    nationWide();
    banner('🎉 TUYỆT VỜI', 'CẢ NƯỚC ĐÃ SÁNG ĐÈN!', '34/34 tỉnh, thành · cảm ơn bà con mọi miền', 9000);
  },
  fullGift: m => {
    playSfx('fanfare');
    screenShake('lg');
    nationWide();
    banner('🎆 CẢ NƯỚC RỰC SÁNG', `${String(m.name).toUpperCase()}`, `đã tặng ${m.coins.toLocaleString('vi-VN')} xu · thắp sáng 34/34 tỉnh, thành`, 12000, m);
  },
  owner: m => {
    playSfx('thunder');
    usurpCrown(m.prov, m.name, m.prev);
    const title = m.prev ? '⚡ CƯỚP NGÔI CHỦ TỈNH! ⚡' : '👑 TÂN CHỦ TỈNH ĐẦU TIÊN!';
    const desc = m.prev
      ? `đã lật đổ ${m.prev} để thống trị ${String(m.prov).toUpperCase()}!`
      : `người đầu tiên ghi danh thống trị ${String(m.prov).toUpperCase()}!`;

    const b = $('#banner');
    if (m.prev) b?.classList.add('usurp');
    banner(title, `👑 ${String(m.name).toUpperCase()}`, desc, 7500, m);
    setTimeout(() => b?.classList.remove('usurp'), 7800);

    shot({ prov: m.prov, tag: '👑 CHỦ TỈNH: ' + m.name, big: true, hold: 4500 });
  },
  duelStart: m => {
    playSfx('fanfare');
    screenShake('sm');
    banner('🔥 ĐẠI CHIẾN · QUÊ NÀO ĐÔNG HƠN', `${m.a} 🆚 ${m.b}`, `${m.sec} giây · bình luận + thả tim để cộng điểm cho quê`, 4500);
  },
  duelEnd: m => {
    $('#stage')?.classList.remove('red-alert');
    $('#duel')?.classList.remove('red-alert');
    if (m.winner) {
      playSfx('fanfare');
      screenShake('sm');
      banner('🏆 THẮNG ĐẠI CHIẾN', String(m.winner).toUpperCase(), `${m.sa} – ${m.sb} · thưởng +${m.bonus} điểm`, 6000);
      shot({ prov: m.winner, tag: '🏆 Thắng đại chiến', plus: `+${m.bonus}`, big: true, fx: () => duelWin(m.winner) });
    } else {
      banner('⚔️ HẾT ĐẠI CHIẾN', 'HAI QUÊ HÒA NHAU', `${m.a} ${m.sa} – ${m.sb} ${m.b}`, 5000);
    }
  },
  quizRight: m => {
    popQuiz();
    if (m.first && m.prov) {
      playSfx('boom');
      shot({ prov: m.prov, tag: '✅ ' + m.name, plus: `+${m.pts}`, big: true });
    } else {
      playSfx('light');
    }
  },
  quizEnd: () => popQuiz(),
  chestDrop: m => {
    playSfx('fanfare');
    screenShake('sm');
    dropChestPin(m.prov);
    renderChest(m);
    banner(
      '🎁 RƯƠNG VÀNG THẦN KỲ!',
      'XUẤT HIỆN TẠI ' + String(m.prov).toUpperCase(),
      `Cần ${m.maxEnergy} năng lượng trong ${m.sec}s · thưởng +${Number(m.bonusPts).toLocaleString('vi-VN')} điểm!`,
      6000
    );
    shot({ prov: m.prov, tag: '🎁 RƯƠNG VÀNG: ' + m.prov, big: true, hold: 4000 });
  },
  chestUpdate: m => {
    playSfx('light');
    renderChest(m);
  },
  chestOpen: m => {
    playSfx('boom');
    setTimeout(() => playSfx('fanfare'), 350);
    explodeChestFx(m.prov, m.bonusPts, m.topName);
    renderChest(null);
    banner(
      '✨ RƯƠNG VÀNG ĐÃ NỔ TUNG! ✨',
      'QUÊ ' + String(m.prov).toUpperCase() + ' THẮNG LỚN!',
      `+${Number(m.bonusPts).toLocaleString('vi-VN')} ĐIỂM · Công đầu: ${m.topName}`,
      8500
    );
    shot({ prov: m.prov, tag: '✨ MỞ RƯƠNG VÀNG', plus: `+${Number(m.bonusPts).toLocaleString('vi-VN')}`, big: true, hold: 6000 });
  },
  chestEnd: m => {
    removeChestPin();
    renderChest(null);
    if (!m.success) {
      banner('⏱️ HẾT GIỜ MỞ RƯƠNG', 'RƯƠNG VÀNG ĐÃ BIẾN MẤT', 'Chưa đủ năng lượng để mở rương tại ' + m.prov, 4000);
    }
  },
  island: m => island(m.k),
  reset: clearMarks,
  tts: playVoice,
  ttsStop: stopVoice,
  music: setMusic,
  regionsModal: m => {
    setRegionsModal(m.open);
    if (m.snapshot) renderRegions(m.snapshot.regions);
  },
  regionsState: m => {
    if (m.open !== undefined) setRegionsModal(m.open);
    if (m.regions) renderRegions(m.regions);
    if (m.act) pushRegionsCombatFeed(m.act);
  },
};
let inFrame = false; try { inFrame = window.top !== window; } catch { inFrame = true; }
const rpc = connectRpc({ role: 'overlay', query: `sound=${MUTE ? 0 : 1}${inFrame ? '&src=xem-truoc' : ''}`, onEvent: m => handlers[m.t]?.(m) });

$('#btnRmClose')?.addEventListener('click', () => {
  rpc.call('regions.close').catch(() => {});
});
