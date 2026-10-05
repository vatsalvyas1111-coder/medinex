// Offline / no-API-key responder. It answers ONLY from the same role-scoped snapshot the model would get,
// so the demo still works when wifi or the Groq key is unavailable. It refuses the same things Medi refuses.
const first = (n) => (n || '').split(' ')[0];
const EMERGENCY = /chest pain|can'?t breathe|cannot breathe|trouble breathing|difficulty breathing|unconscious|passed out|stroke|seizure|overdose|heavy bleeding|suicid|severe (pain|allergic)|swollen (face|tongue|lips)/i;
const CHANGE = /(increase|decrease|double|halve|stop|skip|change|reduce|raise|lower).{0,30}(dose|dosage|tablet|pill|medicine|medication)|should i (take|stop|double|skip)|can i (take|stop|skip|double)/i;
const EDU = /side effect|interact|together with|mix|forgot|missed (a )?dose|what if i miss|what should i do/i;
const DIAG = /diagnos|do i have|what disease|is it (cancer|serious)|why do i feel/i;

const pickPatient = (ctx, q) => {
  const list = ctx.linked_patients ?? [];
  return list.find((p) => q.includes(first(p.profile.name).toLowerCase())) ?? list[0] ?? null;
};
const t12 = (t) => t;

function doseLine(d) { return `${d.time}  ${d.medicine} ${d.dosage} (${d.status === 'taken' ? 'taken ✓' : d.status === 'overdue' ? 'overdue' : d.status})`; }

export function localReply(user, message, ctx) {
  const q = message.toLowerCase();
  const name = first(user.name);
  if (EMERGENCY.test(q)) {
    return { text: `That sounds serious, ${name}. Please contact your local emergency services right now (in India, dial **112**), or ask someone nearby to help you. I'm not able to help with emergencies, and it's best not to wait.`, card: null };
  }
  if (CHANGE.test(q)) {
    return { text: `I can't change doses or schedules, ${name}, and I can't tell you to stop, skip or double a medicine. Your doctor or pharmacist is the right person for that. If you'd like, I can help you write a note to raise with them, or show you what's currently scheduled.`, card: user.role === 'patient' ? { type: 'dose_summary', data: {} } : null };
  }
  if (DIAG.test(q)) {
    return { text: `I can't diagnose or explain what's causing symptoms. Please describe how you feel to your doctor. If it feels urgent or severe, contact emergency services. I'm happy to share what's in your medicine list in the meantime.`, card: null };
  }
  if (user.role === 'patient') return patientReply(user, q, ctx, name);
  if (user.role === 'tracker') return trackerReply(q, ctx, name);
  return reviewerReply(q, ctx);
}

function patientReply(user, q, ctx, name) {
  const doses = ctx.today_doses ?? [];
  const taken = doses.filter((d) => d.status === 'taken');
  const open = doses.filter((d) => d.status !== 'taken' && d.status !== 'missed');
  if (EDU.test(q)) {
    return { text: `Good question, ${name}. In general, if you miss a dose, don't double up unless your doctor has told you to. The right step depends on the medicine and how late it is, so please check with your doctor or pharmacist. Side effects and interactions are the same: I can share general information, but they should confirm it for you.\n\nIf you tell me which medicine, I can show what's on your schedule.`, card: null };
  }
  if (/refill|stock|running (low|out)|left|pharmacy/.test(q)) {
    const low = ctx.low_stock ?? [];
    return { text: low.length
      ? `Some medicines are running low: ${low.map((l) => `**${l.medicine}** (${l.left} left${l.days_left != null ? `, about ${l.days_left} days` : ''})`).join(', ')}. It's a good time to arrange a refill.`
      : `Nothing is running low right now, ${name}. I'll flag it here when a medicine gets close to its refill level.`, card: { type: 'refill', data: {} } };
  }
  if (/request|new medicine|hurts?|pain|ache|itch|cough|cold|fever|trouble|sleep/.test(q)) {
    return { text: `I can help you write that down for a doctor to review, ${name}. I can't suggest a medicine myself. Try this on the **Requests** page, then choose the medicine name and dose yourself:\n\n> "${message.trim().replace(/^i (have|am having|feel)\s*/i, '').replace(/^my /i, 'My ')}"\n\nA reviewer will check it against your current medicines and allergies before anything is added.`, card: null };
  }
  if (/streak|week|adherence|doing|progress|how (am|have) i|percent|%/.test(q)) {
    const worst = (ctx.adherence_by_medicine_14d ?? []).filter((m) => m.percent != null).sort((a, b) => a.percent - b.percent)[0];
    return { text: `You've taken **${ctx.adherence_7d_percent ?? '—'}%** of doses this week and **${ctx.adherence_14d_percent ?? '—'}%** over two weeks, ${name}. Your current streak is **${ctx.streak_days} day${ctx.streak_days === 1 ? '' : 's'}**.${ctx.most_missed_time_of_day_14d ? ` Most missed doses fall in the ${ctx.most_missed_time_of_day_14d}.` : ''}${worst ? ` ${worst.medicine} is the one that slips most (${worst.percent}%).` : ''}\n\nA small habit, like pairing the evening dose with dinner, often helps.`, card: { type: 'adherence', data: {} } };
  }
  if (/what|due|next|today|schedule|take|left|remaining/.test(q) || true) {
    if (!doses.length) return { text: `You have nothing scheduled today, ${name}.`, card: null };
    const next = open[0];
    return { text: `${taken.length} of ${doses.length} doses done today, ${name}. ${next ? `Next up is **${next.medicine} ${next.dosage}** at **${t12(next.time)}**${next.status === 'overdue' ? ' — it is a little overdue, so now is a good time.' : '.'}` : 'Everything for today is logged. Well done! 🎉'}\n\n${doses.map(doseLine).map((l) => `- ${l}`).join('\n')}`, card: { type: 'dose_summary', data: {} } };
  }
}

function trackerReply(q, ctx, name) {
  const p = pickPatient(ctx, q);
  if (!p) return { text: `You don't have any linked patients yet, ${name}. Ask them to invite you from their Links page.`, card: null };
  const pn = first(p.profile.name);
  const worst = (p.adherence_by_medicine_14d ?? []).filter((m) => m.percent != null).sort((a, b) => a.percent - b.percent)[0];
  const missedToday = (p.today_doses ?? []).filter((d) => d.status === 'missed');
  const todayTaken = (p.today_doses ?? []).filter((d) => d.status === 'taken').length;
  if (/refill|stock|low/.test(q)) {
    const low = p.low_stock;
    return { text: low.length ? `${pn} is running low on ${low.map((l) => `**${l.medicine}** (${l.left} left)`).join(', ')}.` : `${pn} has no medicines close to their refill level.`, card: { type: 'refill', data: { patient_id: p.patient_id } } };
  }
  if (/today|\bnow\b|right now|latest/.test(q) && !/week/.test(q)) {
    return { text: `${pn} has taken **${todayTaken} of ${(p.today_doses ?? []).length}** doses today.${missedToday.length ? ` Missed: ${missedToday.map((d) => d.medicine).join(', ')}.` : ' No missed doses so far.'}`, card: { type: 'dose_summary', data: { patient_id: p.patient_id } } };
  }
  const noteLine = p.recent_dose_notes?.length ? `\n\nRecent note from ${pn}: "${p.recent_dose_notes.at(-1).note}" (${p.recent_dose_notes.at(-1).medicine}).` : '';
  return { text: `Here's how ${pn} has been, ${name}:\n\n- **${p.adherence_7d_percent ?? '—'}%** of doses taken this week (**${p.adherence_14d_percent ?? '—'}%** over 14 days)\n- **${p.missed_last_7d}** missed dose${p.missed_last_7d === 1 ? '' : 's'} in the last 7 days${p.most_missed_time_of_day_14d ? `, mostly in the ${p.most_missed_time_of_day_14d}` : ''}\n- Current streak: **${p.streak_days} day${p.streak_days === 1 ? '' : 's'}**${worst ? `\n- Lowest: ${worst.medicine} at ${worst.percent}%` : ''}${noteLine}\n\nA gentle idea: ask ${pn} whether the ${p.most_missed_time_of_day_14d ?? 'busiest'} routine could use a reminder. Please leave any medical decisions to their doctor.`, card: { type: 'adherence', data: { patient_id: p.patient_id } } };
}

function reviewerReply(q, ctx) {
  const list = ctx.pending_requests ?? [];
  if (!list.length) return { text: 'There are no pending requests right now. Nice and clear. ✅', card: null };
  const lines = list.map((r) => `- **${r.requested_medicine} ${r.dosage === 'not specified' ? '' : r.dosage}** for ${r.patient.name} (${r.patient.age}): ${r.interaction_flags.length ? `${r.interaction_flags.length} interaction flag${r.interaction_flags.length > 1 ? 's' : ''} (${r.overall_flag}${r.interaction_flags[0] ? `, with ${r.interaction_flags[0].with}` : ''})` : 'no interaction flags'}${r.allergy_flags.length ? `; allergy note: ${r.allergy_flags[0]}` : ''}. Reason: ${r.reason}.`);
  const missing = list.filter((r) => r.dosage === 'not specified').map((r) => r.requested_medicine);
  return { text: `${list.length} pending request${list.length > 1 ? 's' : ''}:\n\n${lines.join('\n')}${missing.length ? `\n\nMissing information: dosage not given for ${missing.join(', ')}.` : ''}\n\nThe decision is yours. I'm only summarising what's in the record.`, card: { type: 'request_summary', data: { request_id: list[0].request_id } } };
}

export function localInsight(ctxPatient) {
  const p = ctxPatient; const pn = first(p.profile.name);
  const slot = p.most_missed_time_of_day_14d;
  const worst = (p.adherence_by_medicine_14d ?? []).filter((m) => m.percent != null).sort((a, b) => a.percent - b.percent)[0];
  return {
    bullets: [
      `${pn} took ${p.adherence_7d_percent ?? '—'}% of doses this week (${p.adherence_14d_percent ?? '—'}% over 14 days).`,
      slot ? `Most missed doses happen in the ${slot}${worst ? `, especially ${worst.medicine} (${worst.percent}%)` : ''}.` : 'No clear pattern of missed doses yet.',
      `Current streak: ${p.streak_days} day${p.streak_days === 1 ? '' : 's'}${p.low_stock.length ? `; ${p.low_stock.map((l) => l.medicine).join(', ')} running low` : ''}.`,
    ],
    suggestion: slot ? `Try linking the ${slot} dose to a daily habit, like dinner or brushing teeth, and celebrate small wins.` : 'Keep up the routine and a quick daily check-in will do the rest.',
  };
}

export function localBrief(c) {
  const dot = (t) => String(t).replace(/[.\s]+$/, '');
  const flag = c.interaction_flags.length
    ? `${c.interaction_flags.length} interaction flag${c.interaction_flags.length > 1 ? 's' : ''} (highest: ${c.overall_flag}): ${c.interaction_flags.map((f) => `${f.with} (${f.severity}) — ${dot(f.note).toLowerCase().replace(/^./, (x) => x)}`).join('; ')}`
    : 'no interaction flags against current medicines';
  const allergy = c.allergy_flags.length ? ` Allergy alert: ${c.allergy_flags.join(' ')}` : c.patient.allergies && c.patient.allergies !== 'None known' ? ` Listed allergies (${c.patient.allergies}) do not match this request.` : '';
  const missing = [c.dosage === 'not specified' && 'dosage', !c.reason || c.reason === 'not given' ? 'reason' : null].filter(Boolean);
  return `${c.patient.name} (${c.patient.age}; ${c.patient.conditions || 'no conditions listed'}) requests ${c.requested_medicine}${c.dosage !== 'not specified' ? ' ' + c.dosage : ''} for: "${dot(c.reason)}". They currently take ${c.current_medicines.length} medicines, with ${flag}.${allergy}${missing.length ? ` Missing information: ${missing.join(', ')}.` : ' Duration and monitoring plan are not stated.'} The decision remains with the reviewer.`;
}
