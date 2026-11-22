import * as THREE from 'three';
import { CREW, crewIndex } from '../ui/crew';
import type { Tile } from '../rules/board';
import type { GameEvent, GameState } from '../rules/game';
import { PathPoint, VOLCANO, groundHeight, islandRadius, pathPoints } from './world';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const TYPE = { mcq: 0xa58bff, fill: 0x3fc79a, pattern: 0xffcf3a, word: 0xff7fb8 } as const;
const C = {
  sky: 0x608796,
  sea: 0x246775,
  seaDeep: 0x18475b,
  sand: 0x989683,
  grass: 0x6d9270,
  jungle: 0x3e6c5d,
  rock: 0x615566,
  rockDark: 0x3a3342,
  lava: 0xff5a1f,
  ember: 0xffc23d,
  power: 0x2a2530,
  fuel: 0xf3f4f6,
  dock: 0x2ba8e0,
  start: 0x615566,
  arrow: 0xffffff,
};

interface Token {
  group: THREE.Group;
  pos: number;
}

/**
 * Volcano Isle in 3D. Same contract as the 2D board: `setup(state)` paints a new game,
 * `play(events)` animates what the rules report and resolves when done. It never changes state.
 */
export class Board3D {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(46, 1, 0.5, 500);
  private path: PathPoint[];
  private pillars: THREE.Mesh[] = [];
  private caps: THREE.Group[] = [];
  private tokens = new Map<number, Token>();
  private ships: THREE.Group[] = [];
  private lavaFlow?: THREE.Mesh;
  private lavaLight = new THREE.PointLight(C.lava, 30, 14, 1.6);
  private sea!: THREE.Mesh;
  private smoke: THREE.Mesh[] = [];
  private board: Tile[] = [];
  private lavaFront = 0;
  private focus = new THREE.Vector3(0, 2, 6);
  private focusTarget = new THREE.Vector3(0, 2, 6);
  private overview = false;
  private lastFrame = 0;
  private snapCamera = true;
  private pending: Array<(t: number) => boolean> = [];
  onFrame?: () => void;

  constructor(private host: HTMLElement, pathLength: number) {
    this.path = pathPoints(pathLength);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    host.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color(C.sky);
    this.scene.fog = new THREE.Fog(C.sky, 100, 220);
    this.buildLights();
    this.buildSea();
    this.buildIsland();
    this.buildVolcano();
    this.buildTrees();
    this.buildPier();
    this.buildPillars();
    this.buildLandmarks();
    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  /** World positions of every pillar top, for the minimap. */
  get pathPoints(): readonly PathPoint[] {
    return this.path;
  }

  get isOverview(): boolean {
    return this.overview;
  }

  setOverview(on: boolean): void {
    this.overview = on;
  }

  /** Points the camera at a player's token. */
  follow(playerId: number): void {
    const t = this.tokens.get(playerId);
    if (t) this.focusTarget.copy(t.group.position);
  }

  setup(s: GameState): void {
    this.board = s.board;
    this.lavaFront = s.lavaFront;
    this.tokens.forEach((t) => t.group.removeFromParent());
    this.tokens.clear();
    this.ships.forEach((ship, i) => ship.position.set(i ? 2.6 : -2.6, 0, i ? 22 : 21.2));
    for (const p of s.players) {
      const group = this.makeToken(p.color);
      this.scene.add(group);
      this.tokens.set(p.id, { group, pos: p.pos });
    }
    this.paintPillars();
    this.placeTokens(true);
    this.follow(s.players[s.current].id);
    this.snapCamera = true;
  }

  async play(events: GameEvent[]): Promise<void> {
    for (const e of events) {
      if (e.type === 'move') await this.hop(e.playerId, e.from, e.to);
      else if (e.type === 'lava') {
        this.lavaFront = e.front;
        this.focusTarget.set(this.path[Math.min(e.front, this.path.length - 1)].x, 2, this.path[Math.min(e.front, this.path.length - 1)].z);
        await this.wait(500);
        this.paintPillars();
        await this.wait(700);
      } else if (e.type === 'lavaHit') await this.hop(e.playerId, this.tokens.get(e.playerId)!.pos, e.to);
      else if (e.type === 'board') await this.sail(e.playerId);
      else if (e.type === 'turn') this.follow(e.playerId);
    }
  }

  // ---------- animation helpers ----------

  private wait(ms: number): Promise<void> {
    const dur = reducedMotion() ? 0 : ms / 1000;
    return this.animate(dur, () => undefined);
  }

  /** Runs `step(k)` with k going 0..1 over `seconds`, inside the render loop. */
  private animate(seconds: number, step: (k: number) => void): Promise<void> {
    return new Promise((resolve) => {
      const start = this.now();
      this.pending.push((now) => {
        const k = seconds <= 0 ? 1 : Math.min(1, (now - start) / seconds);
        step(k);
        if (k >= 1) resolve();
        return k >= 1;
      });
    });
  }

  private tokenSpot(pos: number, slot = 0, count = 1): THREE.Vector3 {
    const p = this.path[pos];
    const spread = count > 1 ? 0.42 : 0;
    const a = (slot / Math.max(1, count)) * Math.PI * 2;
    return new THREE.Vector3(p.x + Math.cos(a) * spread, p.top, p.z + Math.sin(a) * spread);
  }

  private async hop(id: number, from: number, to: number): Promise<void> {
    const token = this.tokens.get(id)!;
    const dir = to > from ? 1 : -1;
    const dur = reducedMotion() ? 0 : 0.26;
    for (let i = from; i !== to; i += dir) {
      const a = token.group.position.clone();
      const b = this.tokenSpot(i + dir);
      const lift = Math.max(a.y, b.y) + 1.1;
      token.pos = i + dir;
      this.focusTarget.copy(b);
      await this.animate(dur, (k) => {
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        token.group.position.lerpVectors(a, b, e);
        token.group.position.y = (1 - k) * (1 - k) * a.y + 2 * (1 - k) * k * lift + k * k * b.y;
        const squash = k > 0.85 ? 1 - (1 - k) * 2 : 1;
        token.group.scale.set(1, squash, 1);
      });
      token.group.scale.set(1, 1, 1);
    }
    token.pos = to;
    this.placeTokens(false);
    await this.wait(150);
  }

  private async sail(id: number): Promise<void> {
    const token = this.tokens.get(id)!;
    const ship = this.ships[0];
    const a = token.group.position.clone();
    const b = ship.position.clone().add(new THREE.Vector3(0, 1.4, 0));
    this.focusTarget.copy(b);
    await this.animate(reducedMotion() ? 0 : 0.8, (k) => {
      token.group.position.lerpVectors(a, b, k);
      token.group.position.y += Math.sin(k * Math.PI) * 2.5;
    });
    ship.add(token.group);
    token.group.position.set(0, 1.4, 0);
    const s0 = ship.position.clone();
    await this.animate(reducedMotion() ? 0 : 2.4, (k) => {
      ship.position.set(s0.x + k * k * 14, s0.y, s0.z + k * k * 10);
      this.focusTarget.copy(ship.position);
    });
  }

  /** Spreads tokens that share a pillar. */
  private placeTokens(snap: boolean): void {
    const groups = new Map<number, number[]>();
    this.tokens.forEach((t, id) => groups.set(t.pos, [...(groups.get(t.pos) ?? []), id]));
    groups.forEach((ids, pos) => {
      ids.forEach((id, slot) => {
        const target = this.tokenSpot(pos, slot, ids.length);
        const g = this.tokens.get(id)!.group;
        if (snap || reducedMotion()) g.position.copy(target);
        else {
          const from = g.position.clone();
          this.animate(0.15, (k) => g.position.lerpVectors(from, target, k));
        }
      });
    });
  }

  // ---------- frame ----------

  private resize(): void {
    const w = this.host.clientWidth || 1;
    const h = this.host.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private now(): number {
    return performance.now() / 1000;
  }

  private frame(): void {
    const now = this.now();
    const dt = Math.min(0.1, this.lastFrame ? now - this.lastFrame : 0.016);
    this.lastFrame = now;
    this.pending = this.pending.filter((f) => !f(now));

    // Camera: close behind the focus, or a high overview of the whole island.
    // Close-up looks inward from outside the token, so the volcano never blocks the view.
    const target = this.overview ? new THREE.Vector3(0, 0, 1) : this.focusTarget;
    const fit = Math.max(1, .64 / this.camera.aspect);
    let offset = new THREE.Vector3(0, 62 * fit, 46 * fit);
    if (!this.overview) {
      const out = new THREE.Vector2(this.focus.x - VOLCANO.x, this.focus.z - VOLCANO.z);
      if (out.length() < 0.5) out.set(0, 1);
      out.normalize();
      offset = new THREE.Vector3(out.x * 17, 22, out.y * 17);
    }
    // Frame-rate independent easing, so slow phones still settle quickly.
    const ease = reducedMotion() || this.snapCamera ? 1 : 1 - Math.exp(-dt * 3.2);
    if (this.snapCamera) this.focus.copy(target);
    this.snapCamera = false;
    this.focus.lerp(target, ease);
    const want = this.focus.clone().add(offset);
    this.camera.position.lerp(want, ease);
    this.camera.lookAt(this.focus);
    for (const { group } of this.tokens.values()) {
      group.rotation.y = Math.atan2(this.camera.position.x - group.position.x, this.camera.position.z - group.position.z);
    }

    if (!reducedMotion()) {
      const pos = this.sea.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i);
        pos.setZ(i, Math.sin(x * 0.35 + now * 1.2) * 0.12 + Math.cos(y * 0.3 + now * 0.9) * 0.12);
      }
      pos.needsUpdate = true;
      this.sea.geometry.computeVertexNormals();
      this.smoke.forEach((s, i) => {
        const t = (now * 0.25 + i / this.smoke.length) % 1;
        s.position.set(VOLCANO.x + Math.sin(t * 6 + i) * t * 1.5, VOLCANO.peak + 1.5 + t * 9, VOLCANO.z - t * 3);
        s.scale.setScalar(0.4 + t * 1.6);
        (s.material as THREE.MeshStandardMaterial).opacity = 0.55 * (1 - t);
      });
      this.lavaLight.intensity = 26 + Math.sin(now * 3) * 6;
    }
    this.ships.forEach((s, i) => {
      if (!s.children.some((c) => c.userData.token)) s.rotation.z = Math.sin(now * 1.3 + i) * 0.04;
    });
    this.renderer.render(this.scene, this.camera);
    this.onFrame?.();
  }

  // ---------- building the world ----------

  private buildLights(): void {
    this.scene.add(new THREE.HemisphereLight(0xdff3ff, 0x3b5a2a, 1.4));
    const sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
    sun.position.set(-18, 30, 14);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const sc = sun.shadow.camera;
    sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 80;
    sun.shadow.bias = -0.0008;
    this.scene.add(sun);
    this.lavaLight.position.set(VOLCANO.x, VOLCANO.peak + 1, VOLCANO.z);
    this.scene.add(this.lavaLight);
  }

  private buildSea(): void {
    const g = new THREE.PlaneGeometry(260, 260, 64, 64);
    const m = new THREE.MeshStandardMaterial({ color: C.sea, roughness: 0.35, metalness: 0.05, flatShading: true });
    this.sea = new THREE.Mesh(g, m);
    this.sea.rotation.x = -Math.PI / 2;
    this.sea.receiveShadow = true;
    this.scene.add(this.sea);
    // White surf following the coastline.
    const pts: THREE.Vector2[] = [];
    const inner: THREE.Vector2[] = [];
    for (let i = 0; i <= 180; i++) {
      const a = (i / 180) * Math.PI * 2;
      const r = islandRadius(a);
      pts.push(new THREE.Vector2(Math.cos(a) * (r + 1.1), Math.sin(a) * (r + 1.1)));
      inner.push(new THREE.Vector2(Math.cos(a) * (r + 0.2), Math.sin(a) * (r + 0.2)));
    }
    const shape = new THREE.Shape(pts);
    shape.holes.push(new THREE.Path(inner.reverse()));
    const surf = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 }));
    surf.rotation.x = Math.PI / 2;
    surf.position.y = 0.16;
    this.scene.add(surf);
  }

  private buildIsland(): void {
    const size = 48, seg = 120;
    const g = new THREE.PlaneGeometry(size, size, seg, seg).toNonIndexed();
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setY(i, groundHeight(pos.getX(i), pos.getZ(i)));
    const colors: number[] = [];
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i += 3) {
      // One colour per triangle for a low-poly look, from its average height.
      const x = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
      const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
      const z = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
      const vd = Math.hypot(x - VOLCANO.x, z - VOLCANO.z);
      if (y < 0.35) c.setHex(y < -0.2 ? C.seaDeep : C.sand);
      else if (vd < 5.5 || y > 4.2) c.setHex(vd < 3 ? C.rockDark : C.rock);
      else if (y > 1.25 + Math.sin(x * 2.1 + z) * 0.25) c.setHex(C.jungle);
      else c.setHex(C.grass);
      c.offsetHSL(0, 0, (Math.sin(x * 3.1 + z * 2.3) * 0.5 + 0.5) * 0.04 - 0.02);
      for (let k = 0; k < 3; k++) colors.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    const island = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }));
    island.receiveShadow = true;
    island.castShadow = true;
    this.scene.add(island);
  }

  private buildVolcano(): void {
    const crater = new THREE.Mesh(
      new THREE.CircleGeometry(VOLCANO.crater * 0.85, 20),
      new THREE.MeshBasicMaterial({ color: C.lava, toneMapped: false }),
    );
    crater.rotation.x = -Math.PI / 2;
    crater.position.set(VOLCANO.x, VOLCANO.peak - VOLCANO.slope * VOLCANO.crater - 0.75, VOLCANO.z);
    this.scene.add(crater);
    const smokeMat = () => new THREE.MeshStandardMaterial({ color: 0x8a8590, transparent: true, opacity: 0.5, flatShading: true, depthWrite: false });
    for (let i = 0; i < 7; i++) {
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 0), smokeMat());
      this.smoke.push(s);
      this.scene.add(s);
    }
  }

  /** Palms near the coast and round jungle trees inland, kept clear of the path. */
  private buildTrees(): void {
    const spots: Array<{ x: number; z: number; palm: boolean }> = [];
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 900 && spots.length < 110; i++) {
      const a = rnd() * Math.PI * 2;
      const d = Math.sqrt(rnd()) * islandRadius(a);
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      const h = groundHeight(x, z);
      if (h < 0.35 || Math.hypot(x - VOLCANO.x, z - VOLCANO.z) < 6) continue;
      if (this.path.some((p) => Math.hypot(p.x - x, p.z - z) < 2.1)) continue;
      if (Math.abs(x) < 2.2 && z > 9) continue; // keep the pier clear
      const shore = islandRadius(a) - d;
      spots.push({ x, z, palm: shore < 4.5 || rnd() < 0.35 });
    }
    const leaf = new THREE.MeshStandardMaterial({ color: 0x2f8f3a, flatShading: true, roughness: 0.9 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x24692f, flatShading: true, roughness: 0.9 });
    const trunk = new THREE.MeshStandardMaterial({ color: 0x8a6440, flatShading: true });
    const bush = new THREE.IcosahedronGeometry(1, 0);
    const stem = new THREE.CylinderGeometry(0.1, 0.16, 1, 5);
    const frond = new THREE.ConeGeometry(0.5, 1.6, 4);
    for (const s of spots) {
      const y = groundHeight(s.x, s.z);
      const tree = new THREE.Group();
      tree.position.set(s.x, y, s.z);
      if (s.palm) {
        const h = 1.6 + rnd() * 0.8;
        const t = new THREE.Mesh(stem, trunk);
        t.scale.y = h;
        t.position.y = h / 2;
        t.rotation.z = (rnd() - 0.5) * 0.3;
        tree.add(t);
        for (let k = 0; k < 5; k++) {
          const f = new THREE.Mesh(frond, leaf);
          f.position.set(0, h, 0);
          f.rotation.set(Math.PI / 2.4, (k / 5) * Math.PI * 2, 0, 'YXZ');
          f.translateY(0.7);
          tree.add(f);
        }
      } else {
        const r = 0.5 + rnd() * 0.45;
        const b = new THREE.Mesh(bush, rnd() < 0.5 ? leaf : dark);
        b.scale.set(r, r * 1.15, r);
        b.position.y = r * 0.9;
        tree.add(b);
      }
      tree.traverse((o) => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
      this.scene.add(tree);
    }
  }

  private buildPier(): void {
    const end = this.path[this.path.length - 1];
    const wood = new THREE.MeshStandardMaterial({ color: 0x8a6440, flatShading: true });
    const len = 21 - end.z;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.2, len), wood);
    deck.position.set(end.x, 0.7, end.z + len / 2 + 0.6);
    deck.castShadow = deck.receiveShadow = true;
    this.scene.add(deck);
    for (let z = end.z + 2; z < 21; z += 2) {
      for (const dx of [-0.8, 0.8]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2, 5), wood);
        post.position.set(end.x + dx, 0, z);
        this.scene.add(post);
      }
    }
    for (let i = 0; i < 2; i++) {
      const ship = this.makeShip();
      this.ships.push(ship);
      this.scene.add(ship);
    }
  }

  private makeShip(): THREE.Group {
    const g = new THREE.Group();
    const hullShape = new THREE.Shape();
    hullShape.moveTo(-1.6, 0.6); hullShape.lineTo(1.6, 0.6); hullShape.lineTo(1.1, -0.3); hullShape.lineTo(-1.1, -0.3);
    const hull = new THREE.Mesh(new THREE.ExtrudeGeometry(hullShape, { depth: 1.4, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: C.dock, flatShading: true }));
    hull.rotation.y = Math.PI / 2;
    hull.position.set(-0.7, 0.2, 1.6);
    hull.scale.set(1, 1, 1);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 6), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    mast.position.y = 2.3;
    const sail = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.4, 3), new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true }));
    sail.position.set(0, 2.2, 0.15);
    sail.scale.z = 0.12;
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.3, 0.5), new THREE.MeshStandardMaterial({ color: C.ember }));
    flag.position.set(0, 3.8, 0.25);
    g.add(hull, mast, sail, flag);
    g.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
    return g;
  }

  private buildPillars(): void {
    const geo = new THREE.CylinderGeometry(0.78, 0.78, 1, 24);
    geo.translate(0, -0.5, 0); // origin at the top face
    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(0, 0.5); arrowShape.lineTo(0.42, 0.02); arrowShape.lineTo(0.16, 0.02);
    arrowShape.lineTo(0.16, -0.45); arrowShape.lineTo(-0.16, -0.45); arrowShape.lineTo(-0.16, 0.02); arrowShape.lineTo(-0.42, 0.02);
    const arrowGeo = new THREE.ShapeGeometry(arrowShape);
    arrowGeo.rotateX(-Math.PI / 2);
    this.path.forEach((p, i) => {
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 }));
      mesh.position.set(p.x, p.top, p.z);
      mesh.scale.y = p.top - p.ground + 1.5;
      mesh.castShadow = mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.pillars.push(mesh);
      const cap = new THREE.Group();
      cap.position.set(p.x, p.top + 0.02, p.z);
      const next = this.path[Math.min(i + 1, this.path.length - 1)];
      const prev = this.path[Math.max(i - 1, 0)];
      const dx = (i < this.path.length - 1 ? next.x - p.x : p.x - prev.x);
      const dz = (i < this.path.length - 1 ? next.z - p.z : p.z - prev.z);
      const arrow = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color: C.arrow }));
      arrow.rotation.y = Math.atan2(dx, -dz) * -1;
      arrow.name = 'arrow';
      cap.add(arrow);
      this.caps.push(cap);
      this.scene.add(cap);
    });
  }

  /** Colours pillars by tile and lava, and swaps the top icon for special tiles. */
  private paintPillars(): void {
    this.board.forEach((tile, i) => {
      const lava = i < this.lavaFront;
      let color: number = TYPE[tile.qtype];
      if (tile.kind === 'power') color = C.power;
      if (tile.kind === 'dock') color = C.dock;
      if (tile.kind === 'start') color = C.start;
      const m = this.pillars[i].material as THREE.MeshStandardMaterial;
      m.color.setHex(lava ? 0xff3d00 : color);
      m.emissive.setHex(lava ? 0xff3300 : 0x000000);
      m.emissiveIntensity = lava ? 2.2 : 0;
      const cap = this.caps[i];
      cap.children.filter((c) => c.name === 'icon').forEach((c) => cap.remove(c));
      const arrow = cap.getObjectByName('arrow') as THREE.Mesh;
      arrow.visible = !lava;
      (arrow.material as THREE.MeshBasicMaterial).color.setHex(C.arrow);
      if (lava) return;
      if (tile.kind === 'power') cap.add(this.icon('star'));
      if (tile.kind === 'power') arrow.visible = false;
    });
    this.buildLavaFlow();
    const front = this.path[Math.min(this.lavaFront, this.path.length - 1)];
    if (this.lavaFront > 0) this.lavaLight.position.set(front.x, front.top + 1.5, front.z);
  }

  private icon(kind: 'star' | 'fuel'): THREE.Object3D {
    let obj: THREE.Mesh;
    if (kind === 'star') {
      const s = new THREE.Shape();
      for (let k = 0; k < 10; k++) {
        const r = k % 2 ? 0.24 : 0.58, a = Math.PI / 2 + (k * Math.PI) / 5;
        if (k === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      obj = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.14, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: C.ember, emissive: C.ember, emissiveIntensity: 0.4 }));
      obj.rotation.x = -Math.PI / 2;
      obj.position.y = 0.05;
    } else {
      obj = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.7, 0.36), new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.4 }));
      obj.position.y = 0.36;
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.12), obj.material);
      handle.position.y = 0.42;
      obj.add(handle);
      obj.castShadow = true;
    }
    obj.name = 'icon';
    return obj;
  }

  /** A glowing ribbon from the crater down the slope and along the covered pillars. */
  private buildLavaFlow(): void {
    if (this.lavaFlow) {
      this.scene.remove(this.lavaFlow);
      this.lavaFlow.geometry.dispose();
    }
    const first = this.path[0];
    const pts = [new THREE.Vector3(VOLCANO.x, VOLCANO.peak - 2.2, VOLCANO.z + 1.6)];
    for (let t = 0.2; t < 1; t += 0.2) {
      const x = VOLCANO.x + (first.x - VOLCANO.x) * t;
      const z = VOLCANO.z + 0.8 + (first.z - VOLCANO.z - 0.8) * t;
      pts.push(new THREE.Vector3(x, groundHeight(x, z) + 0.3, z));
    }
    for (let i = 0; i < Math.max(1, this.lavaFront); i++) {
      const p = this.path[i];
      pts.push(new THREE.Vector3(p.x, Math.max(0.2, p.ground) + 0.3, p.z));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    this.lavaFlow = new THREE.Mesh(
      new THREE.TubeGeometry(curve, pts.length * 8, 0.5, 8, false),
      new THREE.MeshBasicMaterial({ color: C.lava, toneMapped: false }),
    );
    this.scene.add(this.lavaFlow);
  }

  private buildLandmarks(): void {
    const rock = new THREE.DodecahedronGeometry(1, 0);
    const plaster = new THREE.MeshStandardMaterial({ color: 0xb5c8c6, flatShading: true });
    const trim = new THREE.MeshStandardMaterial({ color: 0x274755, flatShading: true });
    const lantern = new THREE.MeshBasicMaterial({ color: 0xffd385 });
    const tower = new THREE.Group();
    const x = 10.3, z = 6.2;
    tower.position.set(x, groundHeight(x, z), z);
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, y: number) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = y;
      mesh.castShadow = true;
      tower.add(mesh);
    };
    add(new THREE.CylinderGeometry(.46, .79, 2.7, 8), plaster, 1.35);
    add(new THREE.CylinderGeometry(.69, .69, .21, 8), trim, 2.63);
    add(new THREE.CylinderGeometry(.43, .43, .53, 8), lantern, 2.97);
    add(new THREE.ConeGeometry(.67, .64, 8), trim, 3.52);
    this.scene.add(tower);
    // Small outcrops on the shoreline, separate from the playable route.
    for (let k = 0; k < 30; k++) {
      const a = k * 2.39996;
      const r = islandRadius(a) + .14 + (k % 5) * .29;
      const xx = Math.cos(a) * r, zz = Math.sin(a) * r;
      if (zz > 10 && Math.abs(xx) < 4) continue;
      const boulder = new THREE.Mesh(rock, k % 3 === 0 ? plaster : trim);
      boulder.position.set(xx, .06, zz);
      const size = .18 + (k % 7) * .09;
      boulder.scale.set(size * 1.5, size * .42, size);
      boulder.rotation.y = a;
      this.scene.add(boulder);
    }
  }

  private makeToken(color: string): THREE.Group {
    const index = crewIndex(color);
    const crew = CREW[index];
    const group = new THREE.Group();
    const sphere = new THREE.SphereGeometry(.5, 12, 9);
    const part = (
      tint: THREE.ColorRepresentation, x: number, y: number, z: number,
      sx: number, sy: number, sz: number, geometry: THREE.BufferGeometry = sphere,
    ) => {
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: tint, roughness: .82 }));
      mesh.position.set(x, y, z);
      mesh.scale.set(sx, sy, sz);
      mesh.castShadow = true;
      group.add(mesh);
    };
    part(color, 0,.064,0,1,1,1,new THREE.CylinderGeometry(.43,.47,.128,16));
    part(color, 0,.42,0,.66,.81,.55);
    part(crew.skin, 0,.94,.035,.89,.91,.82);
    part(crew.hair, 0,1.17,-.06,.89,.51,.82);
    for (const side of [-1,1]) {
      part(0x252631,side*.16,.19,.12,.35,.29,.46);
      part(crew.skin,side*.29,.46,.05,.23,.38,.29);
      part(crew.skin,side*.41,.92,.04,.16,.24,.19);
      part(0x252333,side*.14,.99,.408,.11,.15,.05);
      part(0xfae7d8,side*.14+.012,1.015,.431,.033,.037,.022);
      if(index===2) part(crew.hair,side*.39,1.16,-.023,.39,.41,.39);
    }
    part(0x8b4d4e,0,.87,.423,.096,.048,.04);
    if(index!==2) {
      part(crew.gear,0,1.28,-.014,.92,.53,.89);
      part(crew.gear,0,1.19,.22,1.04,.115,.75);
    }
    if(index===3 || index===4) part(index===3?0xffe99e:0xe44742,0,1.29,.39,.22,.24,.05);
    group.userData.token = true;
    return group;
  }
}
