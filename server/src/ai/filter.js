// Streaming filter: removes <think>…</think> reasoning and extracts <card>…</card> blocks from token deltas.
const TAGS = ['<think>', '<card>'];

function partialSuffixLen(s) {
  let best = 0;
  for (const t of TAGS) for (let k = Math.min(t.length - 1, s.length); k > best; k--) if (s.endsWith(t.slice(0, k))) { best = k; break; }
  return best;
}

export class StreamFilter {
  constructor() { this.buf = ''; this.mode = 'text'; this.started = false; }
  push(chunk) {
    this.buf += chunk;
    const out = [];
    for (;;) {
      if (this.mode === 'text') {
        const idxs = TAGS.map((t) => [this.buf.indexOf(t), t]).filter(([i]) => i >= 0).sort((a, b) => a[0] - b[0]);
        if (idxs.length) {
          const [i, tag] = idxs[0];
          this.emitText(out, this.buf.slice(0, i));
          this.buf = this.buf.slice(i + tag.length);
          this.mode = tag === '<think>' ? 'think' : 'card';
          continue;
        }
        const hold = partialSuffixLen(this.buf);
        this.emitText(out, this.buf.slice(0, this.buf.length - hold));
        this.buf = this.buf.slice(this.buf.length - hold);
        break;
      }
      if (this.mode === 'think') {
        const i = this.buf.indexOf('</think>');
        if (i < 0) { this.buf = this.buf.slice(-8); break; }
        this.buf = this.buf.slice(i + 8); this.mode = 'text'; continue;
      }
      if (this.mode === 'card') {
        const i = this.buf.indexOf('</card>');
        if (i < 0) break;
        out.push({ type: 'card', raw: this.buf.slice(0, i).trim() });
        this.buf = this.buf.slice(i + 7); this.mode = 'text'; continue;
      }
    }
    return out;
  }
  end() {
    const out = [];
    if (this.mode === 'text') this.emitText(out, this.buf);
    this.buf = '';
    return out;
  }
  emitText(out, text) {
    if (!text) return;
    if (!this.started) { text = text.replace(/^\s+/, ''); if (!text) return; this.started = true; }
    out.push({ type: 'text', text });
  }
}

/** Remove reasoning + card markup from a full string (non-streamed calls). */
export function stripAll(s) {
  return s.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/<card>[\s\S]*?<\/card>/g, '').trim();
}
