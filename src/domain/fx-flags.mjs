// Cờ 8 hiệu ứng nâng cao gửi xuống overlay trong look.fx (luôn đủ 8 khóa bool).
export function fxFlags(settings) {
  const s = settings || {};
  return {
    ambient: !!s.fxAmbient,
    wave: !!s.fxWave,
    name: !!s.fxName,
    combo: !!s.fxCombo,
    sky: !!s.fxSky,
    intro: !!s.fxIntro,
    beat: !!s.fxBeat,
    region: !!s.fxRegion,
  };
}
