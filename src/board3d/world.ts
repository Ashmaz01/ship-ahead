/**
 * Volcano Isle as numbers: island outline, ground height and the pillar path.
 * Pure maths (no three.js) so it can be tested and reused by the minimap.
 * World units: x to the right, z towards the camera, y up. Sea level is y = 0.
 */

export const VOLCANO = { x: 0, z: -4, peak: 12, crater: 1.9, slope: 1.3 };

/** Island radius at angle `a` around the origin: a wobbly circle so the coast looks natural. */
export function islandRadius(a: number): number {
  return 17.5 + 2.2 * Math.sin(3 * a + 1.1) + 1.3 * Math.sin(5 * a + 2.3) + 0.7 * Math.sin(9 * a);
}

/** Cheap smooth noise from summed sines: deterministic, no tables. */
export function hills(x: number, z: number): number {
  return (
    Math.sin(x * 0.45 + 1.3) * Math.cos(z * 0.38 - 0.7) * 0.6 +
    Math.sin(x * 0.9 - z * 0.7 + 2.1) * 0.25 +
    Math.cos(x * 1.7 + z * 1.3) * 0.12
  );
}

/** Ground height. Negative means under the sea. */
export function groundHeight(x: number, z: number): number {
  const d = Math.hypot(x, z);
  const a = Math.atan2(z, x);
  const shore = islandRadius(a) - d; // > 0 on land
  if (shore < 0) return Math.max(-3, shore * 0.5);
  const land = Math.min(1, shore / 3); // 0 at the beach, 1 inland
  let h = shore < 1.2 ? shore * 0.15 : 0.18 + land * (0.9 + hills(x, z) * 0.9);
  const vd = Math.hypot(x - VOLCANO.x, z - VOLCANO.z);
  const cone = VOLCANO.peak - vd * VOLCANO.slope;
  if (cone > h) h = h + (cone - h) * Math.min(1, (cone - h) / 2);
  if (vd < VOLCANO.crater) h = VOLCANO.peak - VOLCANO.slope * VOLCANO.crater - (VOLCANO.crater - vd) * 0.9;
  return h;
}

export interface PathPoint {
  x: number;
  z: number;
  /** Ground height under the pillar. */
  ground: number;
  /** Height of the pillar's top face. */
  top: number;
}

/**
 * The path spirals out from the volcano's foot and ends on the south coast, facing the
 * camera, where the pier and ships are. Points are evenly spaced along the spiral.
 */
export function pathPoints(n: number): PathPoint[] {
  const turns = 1.55;
  const r0 = 6.8;
  const r1 = 15.2;
  const end = Math.PI / 2; // south, towards the camera
  const start = end - turns * Math.PI * 2;
  const dense: Array<[number, number]> = [];
  const steps = 2000;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = start + (end - start) * t;
    const r = r0 + (r1 - r0) * t;
    dense.push([VOLCANO.x + Math.cos(a) * r, VOLCANO.z + Math.sin(a) * r]);
  }
  const cum = [0];
  for (let i = 1; i < dense.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  }
  const total = cum[cum.length - 1];
  const out: PathPoint[] = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const want = (total * k) / (n - 1);
    while (j < cum.length - 2 && cum[j + 1] < want) j++;
    const t = (want - cum[j]) / (cum[j + 1] - cum[j] || 1);
    const x = dense[j][0] + (dense[j + 1][0] - dense[j][0]) * t;
    const z = dense[j][1] + (dense[j + 1][1] - dense[j][1]) * t;
    const ground = Math.max(0.1, groundHeight(x, z));
    // Pillars stand 1.2 to 2.6 above the ground, varying gently along the path.
    const top = ground + 1.9 + Math.sin(k * 0.9) * 0.5 + Math.cos(k * 0.37) * 0.2;
    out.push({ x, z, ground, top });
  }
  return out;
}
