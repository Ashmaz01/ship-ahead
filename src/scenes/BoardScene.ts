import Phaser from 'phaser';
import type { Tile } from '../rules/board';
import type { GameEvent, GameState } from '../rules/game';
import { BOARD_H, BOARD_TOP, COLORS, TYPE_COLORS, VIEW, iy, pillarPoints } from './layout';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const vec = (pts: Array<{ x: number; y: number }>) => pts.map((p) => new Phaser.Math.Vector2(p.x, p.y));
const hex = (css: string) => Phaser.Display.Color.HexStringToColor(css).color;

interface Token {
  box: Phaser.GameObjects.Container;
  pos: number;
}

/**
 * Draws Volcano Isle and animates what the rules report. It never changes game state:
 * the controller passes in state and events, and waits for `play` to finish.
 */
export default class BoardScene extends Phaser.Scene {
  private pts = pillarPoints();
  private pillars: Phaser.GameObjects.Graphics[] = [];
  private lavaStream!: Phaser.GameObjects.Graphics;
  private lavaRing!: Phaser.GameObjects.Graphics;
  private tokens = new Map<number, Token>();
  private ships: Phaser.GameObjects.Container[] = [];
  private lavaFront = 0;
  private board: Tile[] = [];

  constructor() {
    super('board');
  }

  create(): void {
    // The canvas is drawn at 2x for sharp edges; the world stays in 390 x 844 units.
    this.cameras.main.setOrigin(0, 0).setZoom(2);
    this.drawIsland();
    this.lavaStream = this.add.graphics().setDepth(1);
    this.lavaRing = this.add.graphics().setDepth(5000);
    this.pillars = this.pts.map((p) => this.add.graphics({ x: p.x, y: p.y }).setDepth(p.y));
    this.ships = [this.drawShip(286 + 20, iy(456) + 30), this.drawShip(340 + 20, iy(448) + 30)];
    this.game.events.emit('board-ready');
  }

  /** Paints a new game: pillars, lava and player tokens. */
  setup(s: GameState): void {
    this.board = s.board;
    this.lavaFront = s.lavaFront;
    this.tokens.forEach((t) => t.box.destroy());
    this.tokens.clear();
    this.ships.forEach((ship, i) => ship.setPosition(i === 0 ? 306 : 360, i === 0 ? iy(486) : iy(478)).setAlpha(1));
    for (const p of s.players) {
      const box = this.add.container(0, 0).setDepth(4000);
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.35).fillEllipse(0, 12, 16, 6);
      g.fillStyle(hex(p.color)).fillCircle(0, 0, 10);
      g.lineStyle(2.5, COLORS.white).strokeCircle(0, 0, 10);
      const label = this.add
        .text(0, 0.5, p.name.slice(0, 1).toUpperCase(), { fontFamily: 'Lilita One', fontSize: '12px', color: '#26212B' })
        .setOrigin(0.5)
        .setResolution(2);
      box.add([g, label]);
      this.tokens.set(p.id, { box, pos: p.pos });
    }
    this.paint();
    this.placeTokens(false);
  }

  /** Plays rule events in order. Resolves when the board has caught up. */
  async play(events: GameEvent[]): Promise<void> {
    for (const e of events) {
      if (e.type === 'move') await this.hop(e.playerId, e.from, e.to);
      else if (e.type === 'lava') {
        this.lavaFront = e.front;
        this.paint();
        this.shake(0.004);
        await this.wait(350);
      } else if (e.type === 'lavaHit') {
        await this.hop(e.playerId, this.tokens.get(e.playerId)!.pos, e.to);
      } else if (e.type === 'board') await this.sail(e.playerId);
    }
  }

  private wait(ms: number): Promise<void> {
    return new Promise((r) => this.time.delayedCall(reducedMotion() ? 0 : ms, r));
  }

  private shake(intensity: number): void {
    if (!reducedMotion()) this.cameras.main.shake(220, intensity);
  }

  private tween(cfg: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => {
      if (reducedMotion()) cfg.duration = 0;
      this.tweens.add({ ...cfg, onComplete: () => resolve() });
    });
  }

  /** Moves a token one pillar at a time so players can count the steps. */
  private async hop(id: number, from: number, to: number): Promise<void> {
    const token = this.tokens.get(id)!;
    const dir = to > from ? 1 : -1;
    for (let i = from; i !== to; i += dir) {
      const next = this.pts[i + dir];
      token.pos = i + dir;
      await this.tween({ targets: token.box, x: next.x, y: next.y - 16, duration: 150, ease: 'Quad.easeOut' });
    }
    token.pos = to;
    this.placeTokens(true);
    await this.wait(120);
  }

  private async sail(id: number): Promise<void> {
    const token = this.tokens.get(id)!;
    const ship = this.ships[0];
    await this.tween({ targets: token.box, x: ship.x, y: ship.y - 28, duration: 400, ease: 'Back.easeOut' });
    await this.tween({ targets: [ship, token.box], x: '+=140', duration: 1400, ease: 'Sine.easeIn' });
  }

  /** Spreads tokens that share a pillar so every player stays visible. */
  private placeTokens(animate: boolean): void {
    const groups = new Map<number, number[]>();
    this.tokens.forEach((t, id) => groups.set(t.pos, [...(groups.get(t.pos) ?? []), id]));
    groups.forEach((ids, pos) => {
      const p = this.pts[pos];
      ids.forEach((id, k) => {
        const x = p.x + (k - (ids.length - 1) / 2) * 12;
        const y = p.y - 16 - (k % 2) * 4;
        const box = this.tokens.get(id)!.box;
        if (animate && !reducedMotion()) this.tweens.add({ targets: box, x, y, duration: 120 });
        else box.setPosition(x, y);
      });
    });
  }

  /** Redraws pillars and the lava flow for the current lava front. */
  private paint(): void {
    this.board.forEach((tile, i) => this.drawPillar(this.pillars[i], tile, i < this.lavaFront));
    const flow = [{ x: 195, y: iy(124) }, { x: 205, y: iy(190) }, ...this.pts.slice(0, Math.max(1, this.lavaFront))];
    this.lavaStream.clear();
    this.lavaStream.lineStyle(13, COLORS.lava).strokePoints(vec(flow), false);
    this.lavaStream.lineStyle(3, COLORS.ember, 0.6).strokePoints(vec(flow), false);
    this.lavaRing.clear();
    const next = this.pts[this.lavaFront];
    if (next && this.lavaFront < this.pts.length - 1) {
      this.lavaRing.lineStyle(2, COLORS.lava);
      for (let a = 0; a < 360; a += 30) {
        const r1 = Phaser.Math.DegToRad(a), r2 = Phaser.Math.DegToRad(a + 16);
        this.lavaRing.beginPath();
        this.lavaRing.moveTo(next.x + Math.cos(r1) * 14, next.y + Math.sin(r1) * 8);
        this.lavaRing.lineTo(next.x + Math.cos(r2) * 14, next.y + Math.sin(r2) * 8);
        this.lavaRing.strokePath();
      }
    }
  }

  private drawPillar(g: Phaser.GameObjects.Graphics, tile: Tile, lava: boolean): void {
    let top: number = TYPE_COLORS[tile.qtype].top;
    let side: number = TYPE_COLORS[tile.qtype].side;
    if (tile.kind === 'power') [top, side] = [COLORS.rock, COLORS.basalt];
    if (tile.kind === 'fuel') [top, side] = [0xf1f5f9, 0x94a3b8];
    if (tile.kind === 'start') [top, side] = [COLORS.rock, COLORS.basalt];
    if (tile.kind === 'dock') [top, side] = [COLORS.seaLight, 0x1a7aa8];
    if (lava) [top, side] = [COLORS.lava, COLORS.lavaCrust];
    g.clear();
    g.fillStyle(side).fillEllipse(0, 13, 20, 11).fillRect(-10, 0, 20, 13);
    g.fillStyle(top).fillEllipse(0, 0, 20, 11);
    g.lineStyle(1, COLORS.white, 0.35).strokeEllipse(0, 0, 20, 11);
    if (lava) return;
    const ink = COLORS.basalt;
    if (tile.kind === 'power') {
      g.fillStyle(COLORS.ember);
      const star: Array<{ x: number; y: number }> = [];
      for (let k = 0; k < 10; k++) {
        const r = k % 2 ? 2.4 : 5.5, a = -Math.PI / 2 + (k * Math.PI) / 5;
        star.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * 0.8 });
      }
      g.fillPoints(vec(star), true);
    } else if (tile.kind === 'fuel') {
      g.fillStyle(0xe11d48).fillRect(-3.5, -3, 7, 6).fillRect(-1.5, -4.5, 3, 1.5);
    } else if (tile.kind === 'dock') {
      g.lineStyle(1.5, COLORS.white).strokeCircle(0, -1.5, 2.5);
    } else if (tile.kind === 'question') {
      g.fillStyle(ink);
      if (tile.qtype === 'mcq') [[-2, -1.6], [2, -1.6], [-2, 1.6], [2, 1.6]].forEach(([x, y]) => g.fillCircle(x, y, 1.2));
      if (tile.qtype === 'fill') g.fillRect(-4, 1.2, 8, 1.6).fillRect(-4, -2.4, 3.5, 1.6);
      if (tile.qtype === 'pattern') g.fillRect(-4, 0.5, 2, 2.5).fillRect(-1, -1, 2, 4).fillRect(2, -2.8, 2, 5.8);
      if (tile.qtype === 'word') g.fillRect(-4, -2.4, 8, 1.2).fillRect(-4, -0.4, 8, 1.2).fillRect(-4, 1.6, 5, 1.2);
    }
  }

  private drawShip(x: number, y: number): Phaser.GameObjects.Container {
    const g = this.add.graphics();
    g.lineStyle(2, COLORS.white).lineBetween(-2, -26, -2, 0);
    g.fillStyle(COLORS.white).fillTriangle(0, -24, 14, -4, 0, -4);
    g.fillStyle(0xcde9f7).fillTriangle(-2, -21, -13, -4, -2, -4);
    g.fillStyle(COLORS.seaLight).fillPoints(vec([{ x: -20, y: 0 }, { x: 20, y: 0 }, { x: 14, y: 10 }, { x: -14, y: 10 }]), true);
    return this.add.container(x, y, [g]).setDepth(iy(456));
  }

  private drawIsland(): void {
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(COLORS.basalt).fillRect(0, 0, VIEW.w, VIEW.h);
    g.fillStyle(COLORS.sky).fillRect(0, BOARD_TOP, VIEW.w, BOARD_H);
    g.fillStyle(COLORS.sea).fillRect(0, BOARD_TOP + 200, VIEW.w, BOARD_H - 200);
    g.lineStyle(1.5, COLORS.seaLight, 0.35);
    for (const wy of [BOARD_TOP + 230, BOARD_TOP + 520]) {
      g.beginPath();
      for (let x = 0; x <= VIEW.w; x += 4) g.lineTo(x, wy + Math.sin(x / 6.4) * 3);
      g.strokePath();
    }
    g.fillStyle(COLORS.ash, 0.7).fillCircle(210, iy(60), 34);
    g.fillStyle(COLORS.ash, 0.55).fillCircle(250, iy(36), 26);
    g.fillStyle(COLORS.ash, 0.5).fillCircle(172, iy(40), 22);
    g.fillStyle(COLORS.shallows).fillEllipse(190, iy(352), 380, 260);
    g.fillStyle(COLORS.cliff).fillEllipse(190, iy(360), 344, 228);
    g.fillStyle(COLORS.sand).fillEllipse(190, iy(350), 360, 240);
    g.fillStyle(COLORS.land).fillEllipse(190, iy(346), 332, 216);
    g.fillStyle(COLORS.landLight).fillEllipse(195, iy(320), 240, 140);

    const glow = this.add.circle(192, iy(118), 48, COLORS.lava, 0.35).setDepth(0);
    if (!reducedMotion()) this.tweens.add({ targets: glow, alpha: 0.6, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const v = this.add.graphics().setDepth(0.5);
    v.fillStyle(COLORS.rock).fillEllipse(195, iy(296), 192, 40);
    v.fillPoints(vec([{ x: 99, y: iy(296) }, { x: 172, y: iy(118) }, { x: 212, y: iy(118) }, { x: 291, y: iy(296) }]), true);
    v.fillStyle(COLORS.rockShade).fillPoints(vec([{ x: 198, y: iy(118) }, { x: 212, y: iy(118) }, { x: 291, y: iy(296) }, { x: 222, y: iy(296) }]), true);
    v.fillStyle(COLORS.lava).fillEllipse(192, iy(118), 42, 12);
    v.fillStyle(COLORS.ember);
    [[168, 92, 3], [222, 86, 2.5], [196, 74, 2]].forEach(([x, y, r]) => v.fillCircle(x, iy(y), r));

    const path = this.add.graphics().setDepth(0.8);
    path.fillStyle(COLORS.white, 0.4);
    for (let i = 0; i < this.pts.length - 1; i++) {
      const a = this.pts[i], b = this.pts[i + 1];
      for (let t = 0.3; t < 0.8; t += 0.25) path.fillCircle(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t + 6, 1);
    }

    const pier = this.add.graphics().setDepth(iy(430));
    pier.lineStyle(10, COLORS.pier).lineBetween(335, iy(428), 342, iy(470));
    pier.lineStyle(2, 0x8a6440);
    [440, 452, 464].forEach((y) => pier.lineBetween(331 + (y - 440) / 6, iy(y), 349 + (y - 440) / 6, iy(y)));
  }
}
