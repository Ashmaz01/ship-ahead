import { RULES } from '../rules/config';

/** Logical screen size. The whole app is laid out at this size and scaled to fit. */
export const VIEW = { w: 390, h: 844 };
/** The island scene sits between the top bar and the bottom panel. */
export const BOARD_TOP = 64;
export const BOARD_H = 560;
/** Island drawing coordinates are offset by this inside the board area. */
const DY = BOARD_TOP + 40;

export const COLORS = {
  basalt: 0x26212b,
  basaltDeep: 0x1e1a22,
  rock: 0x3a3242,
  rockShade: 0x2f2936,
  ash: 0x4a4252,
  sky: 0x2c2532,
  sea: 0x0f4f73,
  seaLight: 0x2ba8e0,
  shallows: 0x1a6e8f,
  cliff: 0x2e4430,
  sand: 0xb89a62,
  land: 0x3d5a40,
  landLight: 0x4a6b4b,
  lava: 0xff6a2b,
  lavaCrust: 0xc2410c,
  ember: 0xffc23d,
  white: 0xffffff,
  pier: 0x6b4a2e,
};

export const TYPE_COLORS = {
  mcq: { top: 0xa58bff, side: 0x6e52c9, css: '#A58BFF' },
  fill: { top: 0x4fd1a5, side: 0x2a8f6d, css: '#4FD1A5' },
  pattern: { top: 0xffd54a, side: 0xb88f12, css: '#FFD54A' },
  word: { top: 0xff8fc2, side: 0xc25288, css: '#FF8FC2' },
} as const;

/** Hand-placed waypoints of the winding path, around the volcano then round the coast. */
const WAYPOINTS: Array<[number, number]> = [
  [222, 250], [275, 262], [318, 290], [326, 330], [292, 360], [232, 374], [166, 370], [110, 348],
  [78, 308], [46, 338], [52, 386], [98, 420], [160, 440], [226, 447], [290, 440], [335, 425],
];

/** Pillar centres (top face) in screen coordinates, evenly spaced along the path. */
export function pillarPoints(n = RULES.pathLength): Array<{ x: number; y: number }> {
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < WAYPOINTS.length; i++) {
    const d = Math.hypot(WAYPOINTS[i][0] - WAYPOINTS[i - 1][0], WAYPOINTS[i][1] - WAYPOINTS[i - 1][1]);
    seg.push(d);
    total += d;
  }
  return Array.from({ length: n }, (_, k) => {
    let dist = (total * k) / (n - 1);
    let i = 0;
    while (i < seg.length - 1 && dist > seg[i]) {
      dist -= seg[i];
      i++;
    }
    const t = Math.min(1, dist / seg[i]);
    return {
      x: WAYPOINTS[i][0] + (WAYPOINTS[i + 1][0] - WAYPOINTS[i][0]) * t,
      y: WAYPOINTS[i][1] + (WAYPOINTS[i + 1][1] - WAYPOINTS[i][1]) * t + DY,
    };
  });
}

/** Converts island drawing coordinates (as in the design file) to screen coordinates. */
export const iy = (y: number) => y + DY;
