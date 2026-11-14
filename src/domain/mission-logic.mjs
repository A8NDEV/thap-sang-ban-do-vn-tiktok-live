// Nhiệm vụ cả phòng (đếm lượt trong thời hạn). Thuần: không DOM, không Node API, không timer;
// thời gian do bên gọi truyền vào (nowMs). Lọc người ảo (auto_/demo) là việc của bên gọi.
export function createMission({ target, durationMs, perUserCap = 5 } = {}) {
  const goal = Number.isFinite(target) && target > 0 ? Math.floor(target) : 1;
  const dur = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 60000;
  const cap = Number.isFinite(perUserCap) && perUserCap >= 1 ? Math.floor(perUserCap) : 5;

  let running = false;
  let endsAt = 0;
  let label = '';
  let count = 0;
  let per = new Map();

  return {
    begin(nowMs, text) {
      if (running || !Number.isFinite(nowMs)) return;
      running = true;
      endsAt = nowMs + dur;
      label = typeof text === 'string' ? text : '';
      count = 0;
      per = new Map();
    },
    hit(uid, nowMs) {
      if (!running || !uid || !Number.isFinite(nowMs)) return false;
      if (nowMs >= endsAt || count >= goal) return false;
      const used = per.get(uid) || 0;
      if (used >= cap) return false;
      per.set(uid, used + 1);
      count++;
      return true;
    },
    tick(nowMs) {
      if (!running) return 'idle';
      if (count >= goal) { running = false; return 'won'; }
      if (Number.isFinite(nowMs) && nowMs >= endsAt) { running = false; return 'lost'; }
      return 'running';
    },
    // Sau khi kết thúc: active=false, state='idle', label/count giữ lại kết quả nhiệm vụ vừa xong tới lần begin kế.
    view(nowMs) {
      const left = running && Number.isFinite(nowMs) ? Math.max(0, endsAt - nowMs) : 0;
      return {
        active: running,
        label,
        count,
        target: goal,
        leftMs: running ? Math.min(dur, left) : 0,
        state: running ? 'running' : 'idle',
      };
    },
  };
}
