// Custom particle engine (no library). Driven by <ParticleField/>.
export type Behavior = 'drift' | 'burst' | 'rise' | 'seek';
interface P {
  x: number; y: number; vx: number; vy: number; s: number; c: string; a: number; life: number; max: number;
  b: Behavior; tx: number; ty: number; k: number; rot: number; vr: number; shape: 0 | 1; delay: number; fade: boolean;
}
export type Mode = 'ambient' | 'burst' | 'converge' | 'celebrate';
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export class Engine {
  ps: P[] = [];
  w = 0; h = 0;
  mouse = { x: -9999, y: -9999 };
  constructor(public mode: Mode, public colors: string[], public speed = 1, public repel = false, public maxCount = 400) {}

  resize(w: number, h: number) { this.w = w; this.h = h; }
  private add(p: Partial<P> & { x: number; y: number }) {
    if (this.ps.length >= this.maxCount) this.ps.shift();
    this.ps.push({ vx: 0, vy: 0, s: 2, c: this.colors[0], a: 1, life: 0, max: Infinity, b: 'drift', tx: 0, ty: 0, k: 0.05, rot: 0, vr: 0, shape: 0, delay: 0, fade: false, ...p });
  }
  color() { return this.colors[(Math.random() * this.colors.length) | 0]; }

  spawnAmbient(n: number) {
    for (let i = 0; i < n; i++) this.add({ x: rnd(0, this.w), y: rnd(0, this.h), vx: rnd(-.12, .12), vy: rnd(-.18, -.02), s: rnd(1, 3.2), a: rnd(.15, .6), c: this.color(), phase: rnd(0, 6.28) } as never);
  }
  spawnCelebrate(n: number) {
    for (let i = 0; i < n; i++) this.add({ x: rnd(0, this.w), y: this.h + rnd(0, 40), vx: rnd(-.25, .25), vy: rnd(-1.1, -.35), s: rnd(2, 5), a: rnd(.3, .9), c: this.color(), b: 'rise', max: rnd(240, 520), shape: Math.random() < .3 ? 1 : 0, rot: rnd(0, 6), vr: rnd(-.03, .03) });
  }
  burst(x: number, y: number, n = 16, colors?: string[]) {
    for (let i = 0; i < n; i++) {
      const ang = rnd(0, Math.PI * 2), sp = rnd(2.2, 7.2) * this.speed;
      this.add({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 2.2, s: rnd(2.4, 5.4), a: 1, c: colors ? colors[(Math.random() * colors.length) | 0] : this.color(), b: 'burst', max: rnd(38, 74), shape: Math.random() < .55 ? 1 : 0, rot: rnd(0, 6), vr: rnd(-.3, .3) });
    }
  }
  /** particles fly in from the edges and settle around the centre */
  spawnConverge(n: number, cx: number, cy: number, radius = 60) {
    for (let i = 0; i < n; i++) {
      const ang = rnd(0, Math.PI * 2), edge = Math.max(this.w, this.h) * rnd(.55, .9);
      const r = Math.sqrt(Math.random()) * radius;
      this.add({ x: cx + Math.cos(ang) * edge, y: cy + Math.sin(ang) * edge, s: rnd(1, 2.8), a: rnd(.35, .9), c: this.color(), b: 'seek', tx: cx + Math.cos(ang + 2) * r, ty: cy + Math.sin(ang + 2) * r, k: rnd(.012, .03), delay: rnd(0, .35) });
    }
  }
  /** release everything at (x,y) outward, e.g. a capsule splitting open */
  pour(x: number, y: number, n = 160) {
    for (let i = 0; i < n; i++) {
      const ang = rnd(-Math.PI, Math.PI), sp = rnd(1.5, 9);
      this.add({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, s: rnd(1.2, 3.4), a: 1, c: this.color(), b: 'burst', max: rnd(50, 90), rot: 0 });
    }
  }
  /** send existing particles to target points (wordmark). Extra particles fade away. */
  assemble(points: { x: number; y: number }[], spanX: [number, number]) {
    const list = this.ps.filter((p) => p.b !== 'burst' || true);
    const order = [...points].sort(() => Math.random() - .5);
    list.forEach((p, i) => {
      if (i < order.length) {
        const t = order[i];
        p.b = 'seek'; p.tx = t.x; p.ty = t.y; p.k = rnd(.05, .11); p.s = rnd(1.2, 2.1); p.a = 1; p.fade = false; p.max = Infinity;
        p.delay = ((t.x - spanX[0]) / Math.max(1, spanX[1] - spanX[0])) * .8; // left → right, letter by letter
        p.life = 0;
      } else { p.b = 'drift'; p.vx = rnd(-1.2, 1.2); p.vy = rnd(-1.2, 1.2); p.fade = true; }
    });
    // top up if we have fewer particles than points
    for (let i = list.length; i < order.length; i++) {
      const t = order[i];
      this.add({ x: t.x + rnd(-200, 200), y: t.y + rnd(-200, 200), s: rnd(1.2, 2.1), a: 1, c: this.color(), b: 'seek', tx: t.x, ty: t.y, k: rnd(.05, .11), delay: ((t.x - spanX[0]) / Math.max(1, spanX[1] - spanX[0])) * .8 });
    }
  }

  step(dt: number) { // dt in 60fps frames
    const { w, h } = this;
    for (let i = this.ps.length - 1; i >= 0; i--) {
      const p = this.ps[i];
      p.life += dt;
      if (p.b === 'seek') {
        if (p.delay > 0) { p.delay -= dt / 60; continue; }
        p.x += (p.tx - p.x) * p.k * dt + Math.sin(p.life * .05 + p.tx) * .04;
        p.y += (p.ty - p.y) * p.k * dt + Math.cos(p.life * .05 + p.ty) * .04;
      } else if (p.b === 'drift') {
        p.x += p.vx * dt * this.speed; p.y += p.vy * dt * this.speed;
        if (this.repel) {
          const dx = p.x - this.mouse.x, dy = p.y - this.mouse.y, d2 = dx * dx + dy * dy;
          if (d2 < 130 * 130) { const f = (1 - Math.sqrt(d2) / 130) * 1.6; const d = Math.sqrt(d2) || 1; p.x += (dx / d) * f * dt * 2; p.y += (dy / d) * f * dt * 2; }
        }
        if (p.fade) { p.a -= .012 * dt; if (p.a <= 0) { this.ps.splice(i, 1); continue; } }
        else {
          if (p.x < -10) p.x = w + 10; else if (p.x > w + 10) p.x = -10;
          if (p.y < -10) p.y = h + 10; else if (p.y > h + 10) p.y = -10;
        }
      } else if (p.b === 'burst') {
        p.vy += .16 * dt; p.vx *= Math.pow(.972, dt); p.vy *= Math.pow(.985, dt);
        p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        if (p.life > p.max) { this.ps.splice(i, 1); continue; }
      } else if (p.b === 'rise') {
        p.x += (p.vx + Math.sin(p.life * .03 + p.tx) * .25) * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        if (p.life > p.max || p.y < -20) { this.ps.splice(i, 1); continue; }
      }
    }
    if (this.mode === 'ambient' && this.ps.length < this.maxCount * .96) this.spawnAmbient(1);
    if (this.mode === 'celebrate' && Math.random() < .5 * dt) this.spawnCelebrate(1);
  }

  draw(ctx: CanvasRenderingContext2D, additive = false) {
    ctx.globalCompositeOperation = additive ? 'lighter' : 'source-over';
    for (const p of this.ps) {
      if (p.b === 'seek' && p.delay > 0 && p.life < 1) { /* still visible while waiting */ }
      let a = p.a;
      if (p.b === 'burst') a *= Math.max(0, 1 - Math.pow(p.life / p.max, 2));
      else if (p.b === 'rise') a *= Math.min(1, p.life / 30) * Math.max(0, 1 - p.life / p.max);
      if (a <= 0.01) continue;
      ctx.globalAlpha = a; ctx.fillStyle = p.c;
      if (p.shape === 1) {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.s, -p.s * .5, p.s * 2, p.s); ctx.restore();
      } else { ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 6.2832); ctx.fill(); }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
}
