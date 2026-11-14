// Bình chọn nhanh A/B/C bằng comment: logic thuần (không DOM, không Node API).

const TOKEN = { a: 0, b: 1, c: 2, 1: 0, 2: 1, 3: 2 };
const MAX_LEN = 64; // comment dài hơn chắc chắn không phải một phiếu

// Chỉ nhận khi toàn bộ comment (đã cắt khoảng trắng + dấu . ! , ? ở cuối) là một token a|b|c|1|2|3.
// Trả chỉ số 0-based (< nOptions) hoặc -1.
export function parseVote(text, nOptions) {
  if (typeof text !== 'string' || text.length > MAX_LEN) return -1;
  if (!Number.isInteger(nOptions) || nOptions < 1) return -1;
  const t = text.trim().replace(/[\s.!,?]+$/, '').toLowerCase();
  if (!Object.hasOwn(TOKEN, t)) return -1;
  const idx = TOKEN[t];
  return idx < nOptions ? idx : -1;
}

// Phần trăm nguyên cho từng lựa chọn, tổng đúng 100 khi có phiếu (largest remainder), 0 khi chưa có.
function percents(counts, total) {
  if (total <= 0) return counts.map(() => 0);
  const raw = counts.map((c) => (c * 100) / total);
  const out = raw.map(Math.floor);
  let left = 100 - out.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((x, y) => y.frac - x.frac || x.i - y.i);
  for (let k = 0; left > 0 && k < order.length; k++, left--) out[order[k].i]++;
  return out;
}

export function createPoll({ options, durationMs } = {}) {
  const opts = Array.isArray(options) ? options.map(String) : [];
  const dur = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 40000;
  const n = opts.length;

  let state = 'idle'; // 'idle' | 'running' | 'done'
  let question = '';
  let startAt = 0;
  let endsAt = 0;
  let votes = new Map(); // uid -> chỉ số lựa chọn
  let final = null;

  const countsNow = () => {
    const c = new Array(n).fill(0);
    for (const i of votes.values()) c[i]++;
    return c;
  };

  const compute = () => {
    const counts = countsNow();
    const total = counts.reduce((a, b) => a + b, 0);
    const top = Math.max(0, ...counts);
    const leaders = counts.reduce((acc, c, i) => (c === top && top > 0 ? acc.concat(i) : acc), []);
    const tie = leaders.length > 1;
    return { winner: leaders.length === 1 ? leaders[0] : -1, counts, total, tie };
  };

  return {
    begin(nowMs, q) {
      state = 'running';
      question = typeof q === 'string' ? q : '';
      startAt = nowMs;
      endsAt = nowMs + dur;
      votes = new Map();
      final = null;
    },

    vote(uid, text, nowMs) {
      if (state !== 'running' || !Number.isFinite(nowMs) || nowMs < startAt || nowMs >= endsAt) return false;
      if ((typeof uid !== 'string' && typeof uid !== 'number') || uid === '') return false;
      const idx = parseVote(text, n);
      if (idx < 0) return false;
      votes.set(String(uid), idx);
      return true;
    },

    tick(nowMs) {
      if (state !== 'running') return 'idle';
      if (!Number.isFinite(nowMs) || nowMs < endsAt) return 'running';
      final = compute();
      state = 'done';
      return 'done';
    },

    view(nowMs) {
      const r = state === 'done' && final ? final : compute();
      const leftMs = state === 'running' ? Math.max(0, Math.min(dur, endsAt - nowMs)) : 0;
      return {
        active: state === 'running',
        question,
        options: opts.slice(),
        counts: r.counts.slice(),
        total: r.total,
        pct: percents(r.counts, r.total),
        leftMs,
        state,
      };
    },

    result() {
      return final ? { ...final, counts: final.counts.slice() } : null;
    },
  };
}
