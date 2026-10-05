import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate, wrap } from '../middleware/validate.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { clock } from '../services/clock.js';
import { audit } from '../services/audit.js';
import { buildContext, requestContext } from '../services/summary.js';
import { canViewPatient, linkedPatientIds } from '../services/access.js';
import { HttpError } from '../services/doses.js';
import { fillPrompt, CARD_NOTE } from '../ai/prompt.js';
import { StreamFilter, stripAll } from '../ai/filter.js';
import { streamChat, completeChat, groqEnabled } from '../ai/groq.js';
import { buildCard } from '../ai/cards.js';
import { localReply, localInsight, localBrief } from '../ai/local.js';

export const aiRouter = Router();
const chatLimit = rateLimit({ windowMs: 60_000, max: 20, keyPrefix: 'ai', message: 'Medi needs a breather. Please wait a few seconds.' });
const HISTORY_N = 12;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sse = (res, obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

function conversationFor(userId) {
  const c = db.prepare('SELECT id FROM ai_conversations WHERE user_id=? ORDER BY id DESC LIMIT 1').get(userId);
  if (c) return c.id;
  return db.prepare('INSERT INTO ai_conversations(user_id,created_at) VALUES(?,?)').run(userId, clock.stamp()).lastInsertRowid;
}
const parseStored = (m) => {
  const card = m.content.match(/<card>([\s\S]*?)<\/card>/);
  let parsed = null; try { parsed = card ? JSON.parse(card[1]) : null; } catch { /* */ }
  return { id: m.id, role: m.role, content: stripAll(m.content), card: parsed, created_at: m.created_at };
};

aiRouter.get('/history', requireAuth, (req, res) => {
  const cid = conversationFor(req.user.id);
  const rows = db.prepare('SELECT * FROM ai_messages WHERE conversation_id=? ORDER BY id DESC LIMIT 40').all(cid).reverse();
  const messages = rows.map(parseStored).map((m) => ({ ...m, card: m.card ? buildCard(req.user, m.card) : null })); // cards are rebuilt from live data
  res.json({ conversationId: cid, messages, provider: groqEnabled() ? 'groq' : 'local' });
});

aiRouter.delete('/history', requireAuth, (req, res) => {
  db.prepare('INSERT INTO ai_conversations(user_id,created_at) VALUES(?,?)').run(req.user.id, clock.stamp());
  res.json({ ok: true });
});

aiRouter.post('/chat', requireAuth, chatLimit, validate(z.object({ message: z.string().trim().min(1).max(1200) })), wrap(async (req, res) => {
  const user = req.user;
  const cid = conversationFor(user.id);
  const history = db.prepare('SELECT role,content FROM ai_messages WHERE conversation_id=? ORDER BY id DESC LIMIT ?').all(cid, HISTORY_N).reverse()
    .map((m) => ({ role: m.role, content: stripAll(m.content) || m.content }));
  db.prepare('INSERT INTO ai_messages(conversation_id,role,content,created_at) VALUES(?,?,?,?)').run(cid, 'user', req.body.message, clock.stamp());

  // 1) role-scoped snapshot (server side, from the authenticated user's permissions only)
  const context = buildContext(user);
  const now = clock.now();
  const system = fillPrompt({ user, date: clock.today(), time: clock.stamp(now).slice(11, 16), context }) + CARD_NOTE;

  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  const ac = new AbortController();
  res.on('close', () => ac.abort());

  let full = ''; let cardOut = null; let provider = 'local';
  const handle = (ev) => {
    if (ev.type === 'text') { full += ev.text; sse(res, { type: 'token', text: ev.text }); }
    else if (ev.type === 'card' && !cardOut) {
      cardOut = buildCard(user, ev.raw);
      if (cardOut) sse(res, { type: 'card', card: cardOut });
    }
  };

  try {
    if (groqEnabled()) {
      try {
        const f = new StreamFilter();
        const msgs = [{ role: 'system', content: system }, ...history, { role: 'user', content: req.body.message }];
        for await (const part of streamChat(msgs, { effort: 'none' }, ac.signal)) {
          if (part.model) { provider = 'groq'; sse(res, { type: 'meta', provider, model: part.model }); continue; }
          for (const ev of f.push(part.text)) handle(ev);
        }
        for (const ev of f.end()) handle(ev);
      } catch (e) {
        if (ac.signal.aborted) return;
        console.warn('[ai] Groq failed, using local responder:', e.message);
        if (full) throw e; // already streamed something: don't double-answer
        provider = 'local';
      }
    }
    if (provider === 'local') {
      sse(res, { type: 'meta', provider: 'local' });
      const r = localReply(user, req.body.message, context);
      const words = r.text.split(/(\s+)/);
      for (const w of words) { if (ac.signal.aborted) return; handle({ type: 'text', text: w }); await sleep(w.trim() ? 22 : 0); }
      if (r.card) handle({ type: 'card', raw: r.card });
    }
    const stored = full + (cardOut ? `\n<card>${JSON.stringify(cardOut)}</card>` : '');
    db.prepare('INSERT INTO ai_messages(conversation_id,role,content,created_at) VALUES(?,?,?,?)').run(cid, 'assistant', stored, clock.stamp());
    audit(user.id, 'ai.chat', 'ai_messages', cid, { provider, chars: full.length });
    sse(res, { type: 'done' });
  } catch (e) {
    console.error('[ai] error', e);
    sse(res, { type: 'error', message: 'Medi could not answer just now. Please try again.' });
  } finally { res.end(); }
}));

// ---------- Weekly insight (higher reasoning effort) ----------
const insightCache = new Map();
aiRouter.get('/insight', requireAuth, wrap(async (req, res) => {
  if (req.user.role === 'reviewer') throw new HttpError(403, 'FORBIDDEN', 'Insights are for patients and trackers.');
  const ctx = buildContext(req.user);
  const patients = req.user.role === 'patient' ? [ctx] : ctx.linked_patients;
  const wanted = Number(req.query.patientId) || patients[0]?.patient_id;
  const p = patients.find((x) => x.patient_id === wanted);
  if (!p) return res.json({ insight: null });
  if (!canViewPatient(req.user, wanted)) throw new HttpError(403, 'FORBIDDEN', 'No access');
  const key = `${req.user.id}:${wanted}:${clock.stamp().slice(0, 13)}:${p.adherence_7d_percent}:${p.missed_last_7d}`;
  if (!req.query.refresh && insightCache.has(key)) return res.json({ insight: insightCache.get(key) });
  let insight = null;
  if (groqEnabled()) {
    try {
      const sys = fillPrompt({ user: req.user, date: clock.today(), time: clock.stamp().slice(11, 16), context: { patient: p } });
      const { text, model } = await completeChat([
        { role: 'system', content: sys },
        { role: 'user', content: 'Write the weekly insight for this patient as JSON only: {"bullets":[3 short strings],"suggestion":"one gentle suggestion"}. Use only the snapshot numbers. No diagnosis, no dose changes.' },
      ], { effort: 'default', temperature: 0.4, max_tokens: 1500, json: true });
      const j = JSON.parse(stripAll(text).replace(/^```json|```$/g, ''));
      if (Array.isArray(j.bullets) && j.suggestion) insight = { bullets: j.bullets.slice(0, 3).map(String), suggestion: String(j.suggestion), provider: 'groq', model };
    } catch (e) { console.warn('[ai] insight fallback:', e.message); }
  }
  insight ??= { ...localInsight(p), provider: 'local' };
  insight.patient = p.profile.name; insight.patientId = wanted;
  insightCache.set(key, insight);
  res.json({ insight });
}));

// ---------- Request drafting (patient) ----------
aiRouter.post('/draft-request', requireRole('patient'), chatLimit, validate(z.object({ text: z.string().trim().min(3).max(500) })), wrap(async (req, res) => {
  const text = req.body.text;
  let draft = null;
  if (groqEnabled()) {
    try {
      const { text: out } = await completeChat([
        { role: 'system', content: 'You help an elderly patient turn a plain-language complaint into a short, structured note for a doctor to review. You never suggest a medicine name or dose. Respond with JSON only: {"reason":"1-2 plain sentences in first person","questions":["up to 2 short questions the doctor may ask"]}' },
        { role: 'user', content: text },
      ], { effort: 'none', temperature: 0.3, max_tokens: 300, json: true });
      const j = JSON.parse(stripAll(out));
      if (j.reason) draft = { reason: String(j.reason), questions: (j.questions || []).slice(0, 2).map(String), provider: 'groq' };
    } catch (e) { console.warn('[ai] draft fallback:', e.message); }
  }
  draft ??= {
    reason: `I have been experiencing this: ${text.replace(/^my /i, 'my ').replace(/[.!\s]+$/, '')}. I would like a doctor to review whether a medicine is suitable.`,
    questions: ['How long has this been going on?', 'Is it getting better or worse?'], provider: 'local',
  };
  // name/dosage intentionally left blank — the patient confirms them
  res.json({ draft: { name: '', dosage: '', ...draft } });
}));

// ---------- Reviewer brief ----------
const briefCache = new Map();
aiRouter.get('/brief/:id', requireRole('reviewer'), wrap(async (req, res) => {
  const r = db.prepare('SELECT * FROM medicine_requests WHERE id=?').get(Number(req.params.id));
  if (!r) throw new HttpError(404, 'NOT_FOUND', 'Request not found');
  const c = requestContext(r);
  const key = `${r.id}:${r.status}:${c.current_medicines.length}`;
  if (briefCache.has(key)) return res.json({ brief: briefCache.get(key) });
  let brief = null;
  if (groqEnabled()) {
    try {
      const sys = fillPrompt({ user: req.user, date: clock.today(), time: clock.stamp().slice(11, 16), context: { request: c } });
      const { text, model } = await completeChat([
        { role: 'system', content: sys },
        { role: 'user', content: 'Write ONE neutral paragraph (max 90 words) summarising this request for the reviewer: patient context, interaction and allergy flags, and any missing information. Do not recommend approve or reject.' },
      ], { effort: 'none', temperature: 0.3, max_tokens: 400 });
      brief = { text: stripAll(text), provider: 'groq', model };
    } catch (e) { console.warn('[ai] brief fallback:', e.message); }
  }
  brief ??= { text: localBrief(c), provider: 'local' };
  briefCache.set(key, brief);
  res.json({ brief });
}));
