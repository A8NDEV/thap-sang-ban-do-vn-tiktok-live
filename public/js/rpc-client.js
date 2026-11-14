// Kết nối WebSocket /ws theo JSON-RPC 2.0, tự kết nối lại. Dùng chung cho overlay và bảng điều khiển.
//   onEvent nhận thông báo máy chủ đã đổi về dạng { t: 'light', ... } (method "map.light").
//   call(method, params) gửi lệnh (chỉ role=control) và trả Promise kết quả.
export function connectRpc({ role = 'overlay', query = '', onEvent, onStatus }){
  let ws = null, seq = 0;
  const waiting = new Map();
  function open(){
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${proto}//${location.host}/ws${role === 'control' ? '?role=control' : query ? '?' + query : ''}`);
    ws.onopen = () => onStatus?.(true);
    ws.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.id !== undefined && waiting.has(m.id)) {
        const { resolve, reject } = waiting.get(m.id); waiting.delete(m.id);
        m.error ? reject(new Error(m.error.message)) : resolve(m.result);
        return;
      }
      if (typeof m.method === 'string' && m.method.startsWith('map.')) onEvent?.({ t: m.method.slice(4), ...(m.params || {}) });
    };
    ws.onclose = () => {
      onStatus?.(false);
      for (const { reject } of waiting.values()) reject(new Error('mất kết nối'));
      waiting.clear();
      setTimeout(open, 1500);
    };
  }
  open();
  return {
    call(method, params = {}, ms = 15000){
      return new Promise((resolve, reject) => {
        if (!ws || ws.readyState !== 1) return reject(new Error('chưa kết nối server'));
        const id = ++seq;
        waiting.set(id, { resolve, reject });
        ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
        setTimeout(() => { if (waiting.delete(id)) reject(new Error('quá thời gian chờ')); }, ms);
      });
    },
  };
}
