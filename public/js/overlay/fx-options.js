// Cờ bật/tắt các hiệu ứng nâng cao, nhận từ máy chủ qua look.fx trong mỗi lần đẩy trạng thái.
// Thuần logic, không chạm DOM: import được trong Node. Mặc định tất cả tắt cho tới khi nhận look.fx.
const KEYS = ['ambient', 'wave', 'name', 'combo', 'sky', 'intro', 'beat', 'region'];
const off = () => Object.freeze(Object.fromEntries(KEYS.map(k => [k, false])));
let flags = off();

export function setFxOptions(fx) {
  if (!fx || typeof fx !== 'object') { flags = off(); return; }
  flags = Object.freeze(Object.fromEntries(KEYS.map(k => [k, fx[k] === true])));
}

export function fxOn(name) {
  return Object.hasOwn(flags, name) ? flags[name] : false;
}
