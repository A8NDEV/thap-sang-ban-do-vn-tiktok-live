// Bảng điều khiển — gửi lệnh JSON-RPC 2.0 qua WebSocket (role=control, xác thực bằng cookie đã cấp).
import { connectRpc } from './rpc-client.js';
import { PROVINCES } from '../data/mapdata.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const ALL = PROVINCES.map(p => p.ten).sort((a, b) => a.localeCompare(b, 'vi'));
let demoOn = false;

$('#ovUrl').textContent = `${location.origin}/overlay.html`;
if ($('#mienUrl')) $('#mienUrl').textContent = `${location.origin}/3mien.html`;

function addLine(l){ const el = $('#log'), atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 30; el.textContent += l + '\n'; if (el.textContent.length > 60000) el.textContent = el.textContent.slice(-40000); if (atBottom) el.scrollTop = el.scrollHeight; }
function tk(m){ ck('#ckLive', m.status === 'connected'); connMsg(m); const el = $('#st'); el.className = m.status; el.textContent = { idle: 'chưa kết nối', connecting: 'đang kết nối @' + m.uniqueId + '…', connected: '● đang live @' + m.uniqueId, disconnected: 'mất kết nối, đang thử lại…', error: 'lỗi: ' + (m.error || '') }[m.status] || m.status; }

const handlers = {
  log: m => addLine(m.line),
  logs: m => { $('#log').textContent = ''; m.lines.forEach(addLine); },
  settings: ({ settings }) => {
    if (settings.giftMap && cat.acts.length) { cat.map = { ...settings.giftMap }; drawActs(); }
    for (const el of document.querySelectorAll('[data-k]')) { const v = settings[el.dataset.k]; if (el.type === 'checkbox') el.checked = !!v; else if (document.activeElement !== el) el.value = v; }
    if (settings.lastUniqueId && !$('#uid').value) $('#uid').value = settings.lastUniqueId;
    markTheme(settings.theme); markBoard(settings.boardStyle);
  },
  tiktok: tk,
  state: m => {
    $('#sLit').textContent = m.litCount + '/' + m.total; $('#sPpl').textContent = m.people; $('#sRound').textContent = m.round.no;
    $('#litList').innerHTML = ALL.map(n => `<i class="${m.lit[n] ? 'on' : ''}">${esc(n)}${m.lit[n] ? ' · ' + m.lit[n].n : ''}</i>`).join('');
    if (m.regionsModalOpen !== undefined) update3MienBtn(m.regionsModalOpen);
  },
  regionsModal: m => update3MienBtn(m.open),
  music: m => drawMusic(m),
  demo: m => { demoOn = m.on; $('#btnDemo').textContent = demoOn ? '⏹️ Dừng chạy thử' : '▶️ Chạy thử tự động'; },
  license: m => {
    const on = m.activated || m.dev;
    $('#licCard').hidden = on; $('#licRe').hidden = !on; $('#licRe').textContent = m.activated ? '↻ nhập lại key' : '🔑 Nhập key';
    $('#licState').className = on ? 'on' : 'off';
    setPreview(on); ck('#ckLic', on);
    $('#licState').textContent = m.activated ? '🔑 Đã kích hoạt' + (m.email ? ' · ' + m.email : '') : m.dev ? '🔓 Bản phát triển (chưa nhập key)' : '🔒 Chưa kích hoạt';
  },
  dist: m => {
    $('#appVer').textContent = m.version || '?';
    const u = m.update, d = m.data, um = $('#updMsg'), dm = $('#dataMsg');
    if (['download', 'extract', 'copy', 'check', 'restart'].includes(u.stage)) { um.className = ''; um.textContent = u.msg; }
    else if (u.stage === 'error' && u.error) { um.className = 'err'; um.textContent = '✗ ' + u.error; }
    if (u.stage === 'restart') setTimeout(() => location.reload(), 8000);
    $('#btnData').hidden = !m.activated || ['list', 'download'].includes(d.stage);
    dm.className = d.stage === 'error' ? 'err' : d.stage === 'done' ? 'ok' : '';
    dm.textContent = d.stage === 'idle' ? (m.activated ? '' : '🎨 7 style màn hình + 🎙 giọng MC + nhạc mẫu tự tải sau khi kích hoạt key') : '⬇ ' + (d.error || d.msg);
    lockStyles(m);
  },
  prices: m => {
    $('#unk').innerHTML = (m.unknown || []).map(u => `<div class="row">⚠️ ${esc(u.name)} (mã ${esc(u.id)}, ${u.count} lần) <button data-id="${esc(u.id)}">Nhập giá</button></div>`).join('');
    $('#prices').textContent = Object.entries(m.prices || {}).map(([k, v]) => `${k.replace('id:', 'mã ')} = ${v} xu`).join(' · ');
  },
};
handlers.sound = m => {   // ≥ 2 nơi cùng phát tiếng overlay → cảnh báo đỏ, nói rõ nơi nào
  const w = $('#soundWarn'); if (!w) return;
  w.hidden = !(m.n >= 2);
  if (m.n >= 2) w.innerHTML = `🔊 Tiếng đang phát ở <b>${m.n} nơi</b> cùng lúc: ${m.where.map(esc).join(' · ')}. Người xem LIVE sẽ nghe tiếng bị <b>đè 2 lần</b> — chỉ giữ tiếng ở OBS / TikTok LIVE Studio, tắt tiếng nơi còn lại (khung xem trước: bấm 🔇; tab trình duyệt: đóng tab hoặc chuột phải → Tắt tiếng trang web).`;
};
const rpc = connectRpc({
  role: 'control',
  onEvent: m => handlers[m.t]?.(m),
  onStatus: ok => { if (!ok) tk({ status: 'error', error: 'mất kết nối server' }); },
});
const call = (method, params) => rpc.call(method, params).catch(e => addLine('⚠️ ' + method + ': ' + e.message));

$('#unk').addEventListener('click', e => { const id = e.target.dataset?.id; if (id) { $('#pId').value = id; $('#pCoins').focus(); } });
for (const el of document.querySelectorAll('[data-k]')) el.addEventListener('change', () => call('settings.set', { settings: { [el.dataset.k]: el.type === 'checkbox' ? el.checked : el.type === 'number' ? +el.value : el.value } }));
$('#btnConn').onclick = () => call('tiktok.connect', { uniqueId: $('#uid').value });
$('#btnDis').onclick = () => call('tiktok.disconnect');
$('#btnChat').onclick = () => call('sim.chat', { name: $('#simName').value, text: $('#simText').value });
$('#simText').onkeydown = e => { if (e.key === 'Enter') $('#btnChat').click(); };
$('#btnLike').onclick = () => call('sim.like', { name: $('#simName').value, n: 10 });
$('#btnFollow').onclick = () => call('sim.follow', { name: $('#simName').value });
$('#btnGift').onclick = () => {
  const c = +$('#simCoins').value || 5;
  const gName = c >= 500 ? 'Rồng Vàng' : c >= 100 ? 'Thiên nga' : c >= 30 ? 'Bánh kem' : c >= 5 ? 'Nón lá' : 'Hoa hồng';
  call('sim.gift', { name: $('#simName').value, coins: c, gift: gName });
};
$('#btnJoin').onclick = () => call('sim.join', { name: $('#simName').value });
$('#btnDemo').onclick = () => call('demo.set', { on: !demoOn });
$('#btnVoice').onclick = () => call('mc.testVoice');
$('#btnSay').onclick = () => { call('mc.say', { text: $('#sayText').value }); $('#sayText').value = ''; };
$('#sayText').onkeydown = e => { if (e.key === 'Enter') $('#btnSay').click(); };
$('#btnEnd').onclick = () => call('round.end');
$('#btnRR').onclick = () => confirm('Xóa điểm vòng đua hiện tại?') && call('round.reset');
$('#btnRM').onclick = () => confirm('Tắt hết đèn trên bản đồ? (giữ số vòng thắng)') && call('map.reset');
$('#btnNS').onclick = () => confirm('Bắt đầu buổi live mới: xóa bản đồ, điểm, quà, số vòng thắng?') && call('session.new');
$('#btnPrice').onclick = () => { call('gift.setPrice', { id: $('#pId').value, coins: +$('#pCoins').value }); $('#pId').value = $('#pCoins').value = ''; };
$('#btnDuel').onclick = () => call('duel.start');
$('#btnDuelStop').onclick = () => call('duel.stop');
$('#btnQuiz').onclick = () => call('quiz.start');
$('#btnQuizStop').onclick = () => call('quiz.stop');
$('#btnChest').onclick = () => call('chest.drop');
$('#btnChestStop').onclick = () => call('chest.stop');
const open3Mien = () => window.open('/3mien.html', '_blank', 'width=540,height=960');
if ($('#btn3Mien')) $('#btn3Mien').onclick = open3Mien;
if ($('#btnPlay3Mien')) $('#btnPlay3Mien').onclick = open3Mien;

function update3MienBtn(open){
  const btnT = $('#btnToggle3Mien');
  const btnC = $('#btnClose3Mien');
  if (btnT) {
    btnT.textContent = open ? '⚔️ ĐẠI CHIẾN 3 MIỀN (ĐANG BẬT)' : '⚔️ BẬT ĐẠI CHIẾN 3 MIỀN (Trên màn hình)';
    btnT.classList.toggle('active', !!open);
  }
  if (btnC) {
    btnC.style.display = open ? 'inline-block' : 'none';
  }
}
if ($('#btnToggle3Mien')) $('#btnToggle3Mien').onclick = () => call('regions.toggle');
if ($('#btnClose3Mien')) $('#btnClose3Mien').onclick = () => call('regions.close');
if ($('#btnReset3Mien')) $('#btnReset3Mien').onclick = () => confirm('Đặt lại toàn bộ điểm số của 3 Miền về 0?') && call('regions.reset');
$('#btnOwnReset').onclick = () => confirm('Xóa toàn bộ Chủ tỉnh của mọi tỉnh? (không hoàn tác được)') && call('owners.reset');
$('#licRe').onclick = e => { e.preventDefault(); $('#licCard').hidden = false; $('#licKey').focus(); };
$('#btnLic').onclick = async () => {
  const key = $('#licKey').value.trim(), msg = $('#licMsg'); if (!key) return $('#licKey').focus();
  msg.className = 'note'; msg.textContent = 'Đang kiểm tra key với máy chủ…'; $('#btnLic').disabled = true;
  try { const d = await rpc.call('license.activate', { key }, 90000); msg.className = 'note ok'; msg.textContent = `✓ Đã kích hoạt (máy ${d.devices}/${d.maxDevices}) — giờ bấm Kết nối TikTok được rồi.`; $('#licKey').value = ''; }
  catch (e) { msg.className = 'note err'; msg.textContent = '✗ ' + e.message; }
  finally { $('#btnLic').disabled = false; }
};
$('#licKey').onkeydown = e => { if (e.key === 'Enter') $('#btnLic').click(); };

/* ---------- quà → hành động (giống bảng gán quà của Sàn Quẩy) ---------- */
let cat = { gifts: [], acts: [], map: {} }, byId = new Map(), pickAct = '';
const chip = id => { const g = byId.get(id); return g ? `<span class="chip"><img src="${esc(g.img)}" alt="" referrerpolicy="no-referrer">${esc(g.name)} · ${g.coins} xu<i data-rm="${esc(id)}" title="Bỏ quà này">✕</i></span>` : ''; };
function drawActs(){
  $('#acts').innerHTML = cat.acts.map(a => {
    const ids = String(cat.map[a.id] || '').split(',').filter(Boolean);
    return `<div class="act" data-act="${a.id}"><b>${a.emoji} ${esc(a.label)}${a.only ? ' <small class="note" style="display:inline">(chỉ đúng quà)</small>' : ''}</b><div class="chips">${ids.map(chip).join('') || '<span class="none">chưa gán quà</span>'}</div><button data-pick="${a.id}">Chọn quà</button></div>`;
  }).join('');
}
async function loadCatalog(){
  try {
    cat = await rpc.call('gift.catalog'); byId = new Map(cat.gifts.map(g => [g.id, g]));
    $('#catInfo').textContent = `Danh sách ${cat.total} quà TikTok${cat.at ? ' · cập nhật ' + new Date(cat.at).toLocaleDateString('vi-VN') : ''}`;
    drawActs();
  } catch { setTimeout(loadCatalog, 1500); }
}
const saveMap = () => call('settings.set', { settings: { giftMap: cat.map } });
function drawPick(){
  const q = $('#pkQ').value.trim().toLowerCase(), mine = String(cat.map[pickAct] || '').split(',');
  const list = cat.gifts.filter(g => !q || g.name.toLowerCase().includes(q) || g.en.toLowerCase().includes(q) || g.id === q).slice(0, 240);
  $('#pkGrid').innerHTML = list.map(g => `<button data-g="${g.id}" class="${mine.includes(g.id) ? 'on' : ''}" title="${esc(g.en)} · mã ${g.id}"><img src="${esc(g.img)}" alt="" loading="lazy" referrerpolicy="no-referrer">${esc(g.name)}<small>${g.coins} xu</small></button>`).join('') || '<span class="note">Không thấy quà nào.</span>';
}
$('#acts').addEventListener('click', e => {
  const p = e.target.closest('[data-pick]'), rm = e.target.dataset?.rm, row = e.target.closest('.act');
  if (p) { pickAct = p.dataset.pick; const a = cat.acts.find(x => x.id === pickAct); $('#pkTitle').textContent = `Chọn quà cho: ${a.emoji} ${a.label}`; $('#pkQ').value = ''; drawPick(); $('#pick').showModal(); $('#pkQ').focus(); }
  if (rm && row) { cat.map[row.dataset.act] = String(cat.map[row.dataset.act] || '').split(',').filter(x => x && x !== rm).join(','); drawActs(); saveMap(); }
});
$('#pkGrid').addEventListener('click', e => {
  const b = e.target.closest('[data-g]'); if (!b) return;
  const id = b.dataset.g; let ids = String(cat.map[pickAct] || '').split(',').filter(Boolean);
  if (ids.includes(id)) ids = ids.filter(x => x !== id);
  else { for (const k in cat.map) cat.map[k] = String(cat.map[k] || '').split(',').filter(x => x && x !== id).join(',');   // 1 quà chỉ thuộc 1 hành động
         ids = [...ids.filter(x => x !== id), id].slice(-5); }
  cat.map[pickAct] = ids.join(','); drawPick(); drawActs(); saveMap();
});
$('#pkQ').oninput = drawPick;
$('#pkClose').onclick = () => $('#pick').close();
$('#btnGiftRefresh').onclick = async () => {
  $('#catInfo').textContent = 'Đang tải danh sách quà mới từ TikTok…';
  try { const r = await rpc.call('gift.refresh', {}, 60000); $('#catInfo').textContent = `✓ Đã cập nhật ${r.total} quà`; loadCatalog(); }
  catch (e) { $('#catInfo').textContent = '✗ ' + e.message; }
};
loadCatalog();

/* ---------- phiên bản / cập nhật / dữ liệu từ máy chủ ---------- */
const updMsg = (t, c = '') => { $('#updMsg').className = c; $('#updMsg').textContent = t; };
$('#btnUpdCheck').onclick = async () => {
  $('#btnUpdApply').hidden = true; $('#updNotes').hidden = true; updMsg('Đang kiểm tra key và phiên bản…'); $('#btnUpdCheck').disabled = true;
  try {
    const d = await rpc.call('update.check', {}, 90000);
    if (!d.hasUpdate) return updMsg('✓ Key hợp lệ · đang dùng bản mới nhất' + (d.latest ? ' (' + d.latest + ')' : ''), 'ok');
    updMsg('🆕 Có bản mới ' + d.latest + (d.size ? ' · ' + (d.size / 1048576).toFixed(0) + ' MB' : '') + (d.inPlace ? '' : ' — tải bản mới bằng link trong email mua hàng'), 'ok');
    if (d.notes) { $('#updNotes').textContent = d.notes; $('#updNotes').hidden = false; }
    if (d.inPlace) { $('#btnUpdApply').textContent = '⬇ Cập nhật lên ' + d.latest; $('#btnUpdApply').hidden = false; }
  } catch (e) { updMsg('✗ ' + e.message, 'err'); } finally { $('#btnUpdCheck').disabled = false; }
};
$('#btnUpdApply').onclick = () => confirm('Cập nhật bản mới? Tool sẽ tự khởi động lại (nên làm khi KHÔNG live). Dữ liệu, điểm, Chủ tỉnh, bản quyền giữ nguyên.') && call('update.apply');
$('#btnData').onclick = () => call('data.sync');

/* ---------- link OBS / điện thoại ---------- */
const lnk = (tag, url, bad) => `<div class="lnk${bad ? ' bad' : ''}"><span class="tag">${tag}</span><code>${esc(url)}</code><button data-copy="${esc(url)}">Sao chép</button></div>`;
async function loadObs(){
  try {
    const d = await rpc.call('obs.links');
    $('#obsLinks').innerHTML = lnk(d.domainOk ? '✓ OBS' : 'OBS', d.links[2], !d.domainOk);   // chỉ hiện link tên miền, không hiện localhost / 127.0.0.1
    $('#btnHost').hidden = d.domainOk;
    $('#hostOk').innerHTML = d.domainOk ? '<b class="okc">✓ tên miền đã trỏ về máy này</b>' : '<span class="dim">chưa thêm</span>';
    ck('#ckHost', d.domainOk);
    // LIVE bằng điện thoại (kinh nghiệm Quán Nhậu): bật / tắt ngay trên trang, báo rõ tường lửa + thiếu Wi-Fi
    const tog = d.lanFixed ? '<small class="note">Đang mở bằng <b>CHAY-DIEN-THOAI.bat</b> — chế độ điện thoại luôn bật.</small>'
      : `<div class="row"><button id="btnPhone" class="${d.lan ? 'red' : 'gold'}" data-on="${d.lan ? 0 : 1}">${d.lan ? '⏹ Tắt LIVE bằng điện thoại' : '📱 Bật LIVE bằng điện thoại'}</button><span id="phoneMsg" class="dim"></span></div>`;
    $('#phoneBox').innerHTML = tog + (d.lan
      ? (d.phone.map(u => lnk('📱 Wi-Fi', u)).join('') || '<small class="note errc">✗ Máy chưa kết nối Wi-Fi / mạng LAN — điện thoại không mở được.</small>')
        + (d.firewall === 'chan' ? '<div class="row"><small class="note errc">🛡️ Tường lửa Windows đang chặn — điện thoại sẽ báo "mất kết nối / quá thời gian".</small><button id="btnFw">🛡️ Mở tường lửa</button></div>' : d.firewall === 'ok' ? '<small class="note okc">🛡️ Tường lửa đã mở cho điện thoại.</small>' : '')
        + '<ul><li>Điện thoại <b>cùng Wi-Fi</b> với máy này mở link trên bằng trình duyệt (Chrome / Safari).</li><li><b>Chạm 1 lần</b> vào màn hình: bật tiếng MC + vào toàn màn hình (iPhone: tắt nút gạt im lặng, tăng âm lượng).</li><li>Để điện thoại không tự khóa màn hình khi đang LIVE. Trang điều khiển vẫn chỉ mở được trên máy này.</li></ul>'
      : '<small class="note">Bật lên → điện thoại cùng Wi-Fi mở được màn hình bản đồ để phát LIVE bằng điện thoại. Windows có thể hỏi quyền tường lửa → bấm <b>Có</b>.</small>');
  } catch { setTimeout(loadObs, 1500); }
}
document.addEventListener('click', async e => {
  const c = e.target.dataset?.copy;
  if (c) { try { await navigator.clipboard.writeText(c); e.target.textContent = '✓ Đã chép'; setTimeout(() => e.target.textContent = 'Sao chép', 1500); } catch { prompt('Sao chép link:', c); } }
  if (e.target.id === 'btnPhone') {
    const b = e.target, on = b.dataset.on === '1';
    b.disabled = true; $('#phoneMsg').textContent = on ? 'Đang mở cổng cho mạng Wi-Fi… (Windows có thể hỏi quyền tường lửa → bấm Có)' : 'Đang tắt…';
    try { await rpc.call('phone.set', { on }, 30000); } catch (err) { $('#phoneMsg').className = 'errc'; $('#phoneMsg').textContent = '✗ ' + err.message; b.disabled = false; return; }
    setTimeout(loadObs, on ? 2500 : 300);   // đợi kiểm tra tường lửa xong
    loadObs();
  }
  if (e.target.id === 'btnFw') { e.target.disabled = true; e.target.textContent = 'Đang chờ Windows hỏi quyền…'; await call('obs.fixFirewall'); loadObs(); }
});
$('#btnHost').onclick = async () => { $('#btnHost').disabled = true; $('#btnHost').textContent = 'Windows sẽ hỏi quyền → bấm "Có"…'; await call('obs.addHost'); $('#btnHost').disabled = false; $('#btnHost').textContent = '🌐 Thêm tên miền vào hosts'; loadObs(); };
$('#btnWin').onclick = () => call('obs.openWindow');
loadObs();

/* ---------- nhạc nền: tải lên (kéo thả / chọn nhiều file, 3 file song song) + xóa ---------- */
const MB = n => (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + ' MB';
// tên hiển thị có dấu cho nhạc mẫu (tệp phải tên không dấu để đi qua kênh tải dữ liệu của máy chủ)
const TEN_NHAC = {
  'nhac-viet-nam-oi.mp3': 'Việt Nam ơi', 'nhac-viet-nam-oi-nui-song-hung-vi.mp3': 'Việt Nam ơi – Núi sông hùng vĩ',
  'nhac-trong-tim-con-day.mp3': 'Trong tim con đây', 'nhac-viet-nam-tu-hao-trong.mp3': 'Việt Nam – Tự hào trong',
};
function drawMusic(m){
  const list = m.list || [];
  $('#musicList').innerHTML = list.length
    ? '<ol class="mlist">' + list.map(x => `<li><span>🎵 ${esc(TEN_NHAC[x.name] || x.name)}</span><small>${MB(x.size)}</small><button class="red sm" data-mdel="${esc(x.name)}">Xóa</button></li>`).join('') + '</ol>'
    : '';
  $('#musicInfo').textContent = list.length ? `${list.length} bài, phát lần lượt và lặp lại${m.on ? '' : ' — đang TẮT nhạc nền'}` : 'Chưa có bài nào — tải nhạc lên ở trên (hoặc chép file vào thư mục nhac).';
}
function upOne(file){
  const row = document.createElement('div'); row.className = 'mup';
  row.innerHTML = `<span>${esc(file.name)}</span><progress max="100" value="0"></progress><small>đang chờ…</small>`;
  $('#musicUp').append(row);
  const msg = row.querySelector('small'), bar = row.querySelector('progress');
  if (file.size > 50 * 1048576) { msg.textContent = '✗ quá 50 MB'; row.classList.add('err'); return Promise.resolve(); }
  return new Promise(done => {
    const x = new XMLHttpRequest();
    x.open('POST', '/upload/nhac');
    x.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
    x.upload.onprogress = e => { if (e.lengthComputable) { bar.value = e.loaded / e.total * 100; msg.textContent = Math.round(bar.value) + '%'; } };
    x.onload = () => {
      let r = {}; try { r = JSON.parse(x.responseText); } catch {}
      if (x.status === 200) { bar.value = 100; msg.textContent = '✓ xong'; row.classList.add('ok'); setTimeout(() => row.remove(), 4000); }
      else { msg.textContent = '✗ ' + (r.error || 'lỗi ' + x.status); row.classList.add('err'); }
      done();
    };
    x.onerror = () => { msg.textContent = '✗ mất kết nối'; row.classList.add('err'); done(); };
    x.send(file);
  });
}
async function uploadMusic(files){
  const q = [...files];
  const worker = async () => { while (q.length) await upOne(q.shift()); };
  await Promise.all([worker(), worker(), worker()]);   // 3 luồng song song
}
$('#btnMusicUp').onclick = e => { e.preventDefault(); $('#musicFile').click(); };
$('#musicFile').onchange = e => { uploadMusic(e.target.files); e.target.value = ''; };
const drop = $('#musicDrop');
for (const ev of ['dragenter', 'dragover']) drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); });
for (const ev of ['dragleave', 'drop']) drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); });
drop.addEventListener('drop', e => uploadMusic(e.dataTransfer.files));
document.addEventListener('click', e => {
  const n = e.target.dataset?.mdel;
  if (n && confirm('Xóa bài "' + n + '" khỏi thư mục nhac?')) call('music.delete', { name: n });
});

/* ---------- khung xem trước: MẶC ĐỊNH TẮT TIẾNG (OBS / TikTok LIVE Studio đã phát tiếng; 2 nơi cùng phát → người xem nghe đè) ---------- */
let pvLic = false, pvMuted = null;
try { const v = localStorage.getItem('tsbd.pvMute2'); if (v !== null) pvMuted = v === '1'; } catch {}
function setPreview(lic){
  pvLic = lic;
  const mute = pvMuted ?? true;
  const src = '/overlay.html' + (mute ? '?mute=1' : '');
  const f = $('#pvFrame');
  if (f.getAttribute('src') !== src) f.setAttribute('src', src);
  $('#pvSound').textContent = mute ? '🔇 Đang tắt tiếng' : '🔊 Đang có tiếng';
  $('#pvSound').classList.toggle('gold', !mute);
  $('#pvNote').textContent = mute ? '' : 'Chỉ bật tiếng ở đây khi KHÔNG dùng OBS / TikTok LIVE Studio — nếu không người xem sẽ nghe tiếng bị đè 2 lần.';
}
$('#pvSound').onclick = () => {
  pvMuted = !(pvMuted ?? true);
  try { localStorage.setItem('tsbd.pvMute2', pvMuted ? '1' : '0'); } catch {}
  setPreview(pvLic);
};
setTimeout(() => { if ($('#pvFrame').getAttribute('src') === 'about:blank') setPreview(false); }, 3000);   // phòng khi chưa nhận được trạng thái key

/* ---------- trang hướng dẫn: ô trạng thái + API key EulerStream (giống Sàn Quẩy) ---------- */
function ck(sel, ok){ const el = $(sel); if (el) el.classList.toggle('ok', !!ok); }
function showSign(v){
  ck('#ckSign', v.hasKey);
  $('#signMsg').className = 'note' + (v.hasKey ? ' okc' : '');
  $('#signMsg').textContent = v.hasKey ? '✓ Đã có key (…' + v.tail + ')' : 'Chưa có key — vẫn kết nối được nhưng dễ bị giới hạn số lần mỗi giờ.';
  $('#btnSignDel').hidden = !v.hasKey;
}
async function loadSign(){ try { showSign(await rpc.call('sign.get')); } catch { setTimeout(loadSign, 1500); } }
$('#btnSign').onclick = async () => {
  const key = $('#signKey').value.trim();
  if (!key) { $('#signKey').focus(); return; }
  try { showSign(await rpc.call('sign.set', { key })); $('#signKey').value = ''; }
  catch (e) { $('#signMsg').className = 'note errc'; $('#signMsg').textContent = '✗ ' + e.message; }
};
$('#btnSignDel').onclick = async () => { if (confirm('Xóa API key EulerStream khỏi máy này?')) showSign(await rpc.call('sign.set', { key: '' })); };
loadSign();

/* ---------- bước 6: báo kết nối thành công / thất bại ngay dưới ô tên kênh ---------- */
const hhmm = () => new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
function connMsg(m){
  const el = $('#connMsg'); if (!el) return;
  const id = esc(m.uniqueId || ''), err = esc(m.error || '');
  const tips = /rate|limit|429/i.test(m.error) ? ' → nhập <b>API key EulerStream</b> ở bước 2 để hết giới hạn.'
    : /API key/i.test(m.error) ? ' → sao chép lại key ở bước 2.'
    : /offline|not.*live|isn't online|LIVE has ended|room.?id|user_not_found|not found/i.test(m.error) ? ' → kiểm tra kênh <b>đang LIVE</b> và gõ đúng tên kênh (phần sau tiktok.com/@).'
    : /bản quyền|key/i.test(m.error) ? ' → kích hoạt key ở bước 1.' : '';
  const v = {
    idle: ['idle', '○ Chưa kết nối — bấm <b>Kết nối</b> khi đang LIVE.'],
    connecting: ['wait', `⏳ Đang kết nối @${id}…`],
    connected: ['ok', `✅ Kết nối thành công @${id} lúc ${hhmm()} — tool đang nhận bình luận, tim, quà.`],
    disconnected: ['wait', `⚠️ Mất kết nối @${id} lúc ${hhmm()} — đang tự kết nối lại…`],
    error: ['bad', `❌ Kết nối thất bại @${id} lúc ${hhmm()}: ${err}${tips}`],
  }[m.status] || ['idle', esc(m.status)];
  el.className = 'conn ' + v[0]; el.innerHTML = v[1];
}

// style màn hình LIVE: bấm thẻ → lưu cài đặt theme (overlay đổi ngay, có chuyển cảnh mờ)
// 7 style thuộc gói giao diện: chưa tải về (chưa kích hoạt key / đang tải / mạng lỗi) thì khóa thẻ + thanh tiến độ
let styleOk = null, lockWhy = '';
function bar(el, d, show){
  el.hidden = !show; if (!show) return;
  el.querySelector('i').style.width = (d.pct || 0) + '%';
  el.querySelector('span').textContent = d.stage === 'list' ? 'Đang kết nối máy chủ…' : d.stage === 'wait' ? (d.msg || 'Mạng chập chờn — sẽ tự tải tiếp') : `${d.pct || 0}%`;
  el.classList.toggle('wait', d.stage === 'wait');
}
function lockStyles(m){
  const d = m.data || {}, running = ['list', 'download', 'wait'].includes(d.stage);
  styleOk = new Set(m.styles || []);
  lockWhy = !m.activated ? '🔒 Kích hoạt key để tải' : running ? '⏳ Đang tải…' : d.stage === 'error' ? '⚠️ Tải lỗi — bấm Tải dữ liệu' : '⬇ Chưa tải';
  for (const b of document.querySelectorAll('#themes [data-theme]')) {
    const lock = b.dataset.theme !== 'mac-dinh' && !styleOk.has(b.dataset.theme);
    b.classList.toggle('locked', lock); if (lock) b.dataset.lock = lockWhy; else delete b.dataset.lock;
  }
  const need = [...document.querySelectorAll('#themes .locked')].length > 0;
  bar($('#styleDl'), d, need && running);
  bar($('#dataBar'), d, running);
}
function markTheme(t){ for (const b of document.querySelectorAll('#themes [data-theme]')) b.classList.toggle('on', b.dataset.theme === t); }
for (const b of document.querySelectorAll('#themes [data-theme]')) b.addEventListener('click', () => {
  if (b.classList.contains('locked')) {
    const el = $('#styleDl'); el.hidden = false; el.querySelector('i').style.width = '0%';
    el.querySelector('span').textContent = lockWhy.startsWith('🔒') ? 'Style này nằm trong gói giao diện — nhập key ở mục bản quyền, gói tự tải về (vài giây).' : lockWhy.startsWith('⏳') ? 'Đang tải gói giao diện, xong là chọn được ngay.' : 'Chưa có gói giao diện — bấm "⬇ Tải dữ liệu" ở mục Phiên bản & cập nhật.';
    return;
  }
  const inp = $('#themeVal'); inp.value = b.dataset.theme; markTheme(inp.value); inp.dispatchEvent(new Event('change'));
});

// style bảng thống kê: bấm thẻ → lưu boardStyle
function markBoard(t){ for (const b of document.querySelectorAll('#boards [data-board]')) b.classList.toggle('on', b.dataset.board === (t || 'theo-style')); }
for (const b of document.querySelectorAll('#boards [data-board]')) b.addEventListener('click', () => {
  const inp = $('#boardVal'); inp.value = b.dataset.board; markBoard(inp.value); inp.dispatchEvent(new Event('change'));
});
