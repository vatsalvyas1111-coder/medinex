import { config } from '../config.js';

const URL = 'https://api.groq.com/openai/v1/chat/completions';
let workingModel = null;

export const groqEnabled = () => !!config.groqKey && config.groqKey.length > 10;
const models = () => [...new Set([workingModel, config.groqModel, ...config.groqFallbacks].filter(Boolean))];

async function call(model, body, signal) {
  return fetch(URL, {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.groqKey}` },
    body: JSON.stringify({ model, ...body }),
  });
}

/**
 * Open a Groq chat completion, walking the model fallback chain.
 * effort 'none' = fast non-thinking mode for chat; 'default' = thinking (used for weekly insight only).
 */
async function open(messages, { stream, effort, temperature = 0.5, max_tokens = 700, json = false }, signal) {
  let lastErr = null;
  for (const model of models()) {
    // 1st try with reasoning params, 2nd without (some model ids reject reasoning_effort)
    for (const withReasoning of [true, false]) {
      const body = { messages, stream, temperature, max_tokens };
      if (withReasoning) { body.reasoning_effort = effort; if (effort !== 'none') body.reasoning_format = 'hidden'; }
      if (json) body.response_format = { type: 'json_object' };
      let res;
      try { res = await call(model, body, signal); } catch (e) { if (e.name === 'AbortError') throw e; lastErr = e; break; }
      if (res.ok) { workingModel = model; return { res, model }; }
      const txt = await res.text().catch(() => '');
      lastErr = new Error(`Groq ${res.status} for ${model}: ${txt.slice(0, 200)}`);
      if (res.status === 401 || res.status === 429) throw lastErr; // key/rate problems: fallbacks will not help
      if (res.status === 400 && withReasoning) continue; // retry same model without reasoning params
      break; // unknown model etc → next model
    }
  }
  throw lastErr ?? new Error('No Groq model available');
}

/** Async generator of text deltas. */
export async function* streamChat(messages, opts = {}, signal) {
  const { res, model } = await open(messages, { stream: true, effort: 'none', ...opts }, signal);
  yield { model };
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') return;
      try {
        const delta = JSON.parse(data).choices?.[0]?.delta?.content;
        if (delta) yield { text: delta };
      } catch { /* ignore keep-alives */ }
    }
  }
}

export async function completeChat(messages, opts = {}) {
  const { res, model } = await open(messages, { stream: false, effort: 'none', ...opts });
  const j = await res.json();
  return { text: j.choices?.[0]?.message?.content ?? '', model };
}
