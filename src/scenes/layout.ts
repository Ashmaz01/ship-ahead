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
  [279,200],[315,235],[387,252],[454,246],[514,223],[553,181],[566,139],
  [553,102],[509,73],[451,57],[381,54],[313,60],[253,77],[201,112],
  [171,158],[157,208],[171,249],[211,291],[275,326],[345,345],[425,354],
  [497,349],[565,326],[622,289],[650,250],[649,209],[632,174],
  [608,142],[600,116],[580,87],[558,67],[526,52],
  [461,38],[391,34],[320,43],[243,60],[178,92],[128,138],[99,203],
  [82,269],[81,328],[96,374],[130,410],[193,446],[273,473],[365,483],
  [457,477],[545,457],[620,426],[679,385],[709,334],[720,272],[726,232],
  [748,210],[791,200],[888,194],[996,195],[1100,201],[1172,221],[1225,254],
  [1300,289],[1375,319],[1412,351],[1410,376],[1388,398],[1345,419],
  [1317,452],[1327,479],[1371,515],[1403,546],[1407,575],[1383,600],
  [1320,630],[1281,665],[1254,712],[1220,740],[1177,755],[1119,760],
  [1043,752],[975,753],[909,771],[843,790],[765,792],[675,783],[582,768],
  [548,746],[563,725],[610,701],[656,677],
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
      y: WAYPOINTS[i][1] + (WAYPOINTS[i + 1][1] - WAYPOINTS[i][1]) * t,
    };
  });
}

/** Converts island drawing coordinates (as in the design file) to screen coordinates. */
export const iy = (y: number) => y + DY;
