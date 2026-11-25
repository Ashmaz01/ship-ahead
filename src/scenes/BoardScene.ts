import { IslandLife } from './IslandLife';
import { cue } from '../sound';
import Phaser from 'phaser';
import type { Tile } from '../rules/board';
import type { GameEvent, GameState } from '../rules/game';
import { BOARD_H, BOARD_TOP, VIEW, COLORS, TYPE_COLORS, pillarPoints } from './layout';
import { crewSprites, crewIndex } from '../ui/crew';
import islandUrl from '../assets/volcano.webp';
import ferryUrl from '../assets/rescue-ferry.webp';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const vec = (pts: Array<{ x: number; y: number }>) => pts.map((p) => new Phaser.Math.Vector2(p.x, p.y));

interface Token {
  box: Phaser.GameObjects.Container;
  pos: number;
  avatar: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
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
  private life!: IslandLife;
  private panic!: Phaser.GameObjects.Text;
  private departed = 0;
  private framing = new Phaser.Math.Vector2();
  private lookAhead = new Phaser.Math.Vector2();
  danger = false;
  update(_time:number, delta:number):void {
    if(!this.life)return;
    if (this.tokens.size) this.frameBoard(delta);
    this.life.danger=this.danger;
    this.life.draw(delta,reducedMotion());
    const token=this.tokens.get(this.activeId);
    this.panic.setVisible(!!token && this.danger && !!token.box.visible);
    if(token && this.danger)this.panic.setPosition(token.box.x+14,token.box.y-53);
  }
  overview = false;
  private activeId = 0;
  private lavaFront = 0;
  private board: Tile[] = [];

  constructor() {
    super('board');
  }

  preload(): void {
    this.load.image("volcano", islandUrl);
    this.load.image("ferry", ferryUrl);
    crewSprites.forEach((url, index) => this.load.image(`crew-${index}`, url));
  }

  create(): void {
    // The canvas is drawn at 2x for sharp edges; the world stays in 390 x 844 units.
    this.cameras.main.setViewport(0, BOARD_TOP * 2, VIEW.w * 2, BOARD_H * 2).setBackgroundColor('#08415e');
    this.add.image(0, 0, 'volcano').setOrigin(0);

    this.lavaStream = this.add.graphics().setDepth(1);
    this.lavaRing = this.add.graphics().setDepth(5000);
    this.pillars = this.pts.map((p) => this.add.graphics({ x: p.x, y: p.y }).setDepth(p.y));
    this.ships = [this.drawShip(687,650), this.drawShip(737,610)];
    this.life = new IslandLife(this);
    this.panic = this.add.text(0,0,'😰',{fontSize:'21px'}).setDepth(5001).setVisible(false);
    this.game.events.emit('board-ready');
  }

  /** Paints a new game: pillars, lava and player tokens. */
  setup(s: GameState): void {
    this.departed=s.escapeOrder.length; this.danger=false;
    this.board = s.board;
    this.lavaFront = s.lavaFront;
    this.tokens.forEach((t) => t.box.destroy());
    this.tokens.clear();
    this.ships.forEach((ship, i) => ship.setPosition(i === 0 ? 687 : 737, i === 0 ? 650 : 610).setAlpha(1).setVisible(i >= this.departed));
    for (const p of s.players) {
      const box = this.add.container(0, 0).setDepth(4000);
      const avatar = this.add.image(0, 0, `crew-${crewIndex(p.color)}`).setOrigin(.5, .94);
      avatar.setScale(54 / avatar.height);
      const shadow = this.add.ellipse(0, 0, 23, 7, 0x16232a, .38);
      box.add([shadow, avatar]);
      box.setVisible(!p.boarded);
      this.tokens.set(p.id, { box, avatar, shadow, pos: p.pos });
    }
    this.paint();
    this.placeTokens(false);
    this.overview = false;
    this.focusPlayer(s.current);
    this.frameBoard(0, true);
  }

  async revealIsland(): Promise<void> {
    this.overview = true;
    this.frameBoard(0, true);
    await this.wait(1100);
    this.overview = false;
    await this.wait(900);
  }

  focusPlayer(id: number): void {
    this.activeId = id;
    this.lookAhead.set(0, 0);
  }

  private frameBoard(delta: number, snap = false): void {
    const camera = this.cameras.main;
    const actor = this.tokens.get(this.activeId)?.box;
    const wide = this.overview || !actor;
    const zoom = wide ? VIEW.w * 2 / 1600 : 2.4;
    const immediate = snap || reducedMotion();
    const blend = immediate ? 1 : 1 - Math.exp(-delta / 165);
    const nextZoom = Phaser.Math.Linear(camera.zoom, zoom, blend);
    camera.setZoom(nextZoom);
    const halfW = camera.width / (2 * nextZoom);
    const halfH = camera.height / (2 * nextZoom);
    const x = wide ? 768 : Phaser.Math.Clamp(actor.x + this.lookAhead.x, halfW, 1536 - halfW);
    const y = wide ? 512 : Phaser.Math.Clamp(actor.y - 20 + this.lookAhead.y, halfH, 1024 - halfH);
    this.framing.x += (x - this.framing.x) * blend;
    this.framing.y += (y - this.framing.y) * blend;
    camera.centerOn(this.framing.x, this.framing.y);
  }

  toggleView(): void {
    this.overview = !this.overview;
    this.focusPlayer(this.activeId);
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
    this.focusPlayer(id);
    const dir = to > from ? 1 : -1;
    for (let i = from; i !== to; i += dir) {
      const next = this.pts[i + dir];
      const startX = token.box.x;
      const startY = token.box.y;
      cue('step');
      token.pos = i + dir;
      const step = { progress: 0 };
      const dx = next.x - startX;
      if (Math.abs(dx) > 5) token.avatar.setFlipX(dx < 0);
      if (reducedMotion()) {
        token.box.setPosition(next.x, next.y);
        continue;
      }
      this.lookAhead.set(dx * .24, (next.y - startY) * .24).limit(18);
      const base = 54 / token.avatar.height;
      const peak = Phaser.Math.Clamp(Math.hypot(dx, next.y - startY) * .26, 13, 30);
      await this.tween({
        targets: step, progress: 1, duration: 480, ease: 'Linear',
        onUpdate: () => {
          const phase = step.progress;
          const flight = Phaser.Math.Clamp((phase - .15) / .67, 0, 1);
          const arc = 4 * flight * (1 - flight);
          const load = phase < .15 ? Math.sin(Math.PI * phase / .15)
            : phase > .82 ? Math.sin(Math.PI * (phase - .82) / .18) : 0;
          token.box.setPosition(startX + dx * flight, Phaser.Math.Linear(startY, next.y, flight));
          token.avatar.setY(-peak * arc).setAngle(Math.sign(dx) * 7 * arc)
            .setScale(base * (1 + .09 * load - .035 * arc), base * (1 - .13 * load + .055 * arc));
          token.shadow.setScale(1 - .38 * arc).setAlpha(1 - .45 * arc);
        },
      });
      token.box.setPosition(next.x, next.y);
      token.avatar.setY(0).setAngle(0).setScale(base);
      token.shadow.setScale(1).setAlpha(1);
    }
    this.lookAhead.set(0, 0);
    token.pos = to;
    this.placeTokens(true);
    await this.wait(120);
  }

  private async sail(id: number): Promise<void> {
    const token = this.tokens.get(id)!;
    const ship = this.ships[this.departed++];
    cue('escape');
    await this.tween({ targets: token.box, x: ship.x, y: ship.y + 12, duration: 400, ease: 'Back.easeOut' });
    await this.tween({ targets: [ship, token.box], x: '+=100', y: '-=120', duration: 1400, ease: 'Sine.easeIn' });
    ship.setVisible(false); token.box.setVisible(false);
  }

  /** Spreads tokens that share a pillar so every player stays visible. */
  private placeTokens(animate: boolean): void {
    const groups = new Map<number, number[]>();
    this.tokens.forEach((t, id) => groups.set(t.pos, [...(groups.get(t.pos) ?? []), id]));
    groups.forEach((ids, pos) => {
      const p = this.pts[pos];
      ids.forEach((id, k) => {
        const rowSize = Math.min(ids.length - Math.floor(k / 3) * 3, 3);
        const x = p.x + (k % 3 - (rowSize - 1) / 2) * 12;
        const y = p.y + 1 - Math.floor(k / 3) * 13;
        const box = this.tokens.get(id)!.box;
        if (animate && !reducedMotion()) this.tweens.add({ targets: box, x, y, duration: 120 });
        else box.setPosition(x, y);
      });
    });
  }

  /** Redraws pillars and the lava flow for the current lava front. */
  private paint(): void {
    this.board.forEach((tile, i) => this.drawPillar(this.pillars[i], tile, i < this.lavaFront));
    const flow = this.pts.slice(0, Math.max(1, this.lavaFront));
    this.lavaStream.clear();
    this.lavaStream.lineStyle(16, COLORS.lava, .21).strokePoints(vec(flow), false);
    this.lavaStream.lineStyle(8, COLORS.lava).strokePoints(vec(flow), false);
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
    if (tile.kind === 'start') [top, side] = [COLORS.rock, COLORS.basalt];
    if (tile.kind === 'dock') [top, side] = [COLORS.seaLight, 0x1a7aa8];
    if (lava) [top, side] = [COLORS.lava, COLORS.lavaCrust];
    g.clear();
    g.fillStyle(0x101b23, .55).fillEllipse(2, 15, 26, 11);
    g.fillStyle(0x202936).fillEllipse(0, 11, 22, 12).fillRect(-11, 0, 22, 11);
    g.fillStyle(side).fillEllipse(0, 8, 20, 10).fillRect(-10, 0, 20, 8);
    g.fillStyle(0xffffff, .17).fillRect(-8, 3, 2, 7);
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
    } else if (tile.kind === 'dock') {
      g.lineStyle(1.5, COLORS.white).strokeCircle(0, -1.5, 2.5);
    } else if (tile.kind === 'start') {
      g.fillStyle(COLORS.ember).fillTriangle(-4, -3, 4, 0, -4, 3);
    } else if (tile.kind === 'question') {
      g.fillStyle(ink);
      if (tile.qtype === 'mcq') [[-2, -1.6], [2, -1.6], [-2, 1.6], [2, 1.6]].forEach(([x, y]) => g.fillCircle(x, y, 1.2));
      if (tile.qtype === 'fill') g.fillRect(-4, 1.2, 8, 1.6).fillRect(-4, -2.4, 3.5, 1.6);
      if (tile.qtype === 'pattern') g.fillRect(-4, 0.5, 2, 2.5).fillRect(-1, -1, 2, 4).fillRect(2, -2.8, 2, 5.8);
      if (tile.qtype === 'word') g.fillRect(-4, -2.4, 8, 1.2).fillRect(-4, -0.4, 8, 1.2).fillRect(-4, 1.6, 5, 1.2);
    }
  }

  private drawShip(x: number, y: number): Phaser.GameObjects.Container {
    const ferry = this.add.image(0, 0, 'ferry').setDisplaySize(86,78);
    return this.add.container(x, y, [ferry]).setDepth(3000);
  }
}
