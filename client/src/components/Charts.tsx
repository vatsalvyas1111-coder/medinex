import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { motion } from 'framer-motion';
import { SLOT_LABEL, parseStamp } from '../lib/time';
import type { HeatDay, Stats } from '../lib/types';

const axis = { fontSize: 12, fontWeight: 700, fill: 'rgb(var(--muted))' };
function Tip({ active, payload, label, unit = '' }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl px-3 py-2 text-sm shadow-lift" style={{ background: 'rgb(var(--surface) / .95)' }}>
      <p className="font-bold">{label}</p>
      {payload.map((p: any) => <p key={p.dataKey} className="font-semibold" style={{ color: p.color || p.fill }}>{p.name}: {p.value}{unit}</p>)}
    </div>
  );
}

/** Daily adherence trend (area). */
export function TrendChart({ days }: { days: HeatDay[] }) {
  const data = days.filter((d) => d.total - d.pending > 0).map((d) => ({ date: parseStamp(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), pct: Math.round((d.taken / (d.total - d.pending)) * 100) }));
  return (
    <div className="h-56 w-full"><ResponsiveContainer>
      <AreaChart data={data} margin={{ left: -18, right: 6, top: 8 }}>
        <defs><linearGradient id="trend" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="rgb(var(--teal))" stopOpacity=".5" /><stop offset="1" stopColor="rgb(var(--teal))" stopOpacity="0" /></linearGradient></defs>
        <CartesianGrid vertical={false} stroke="rgb(var(--ink) / .08)" />
        <XAxis dataKey="date" tick={axis} axisLine={false} tickLine={false} minTickGap={24} /><YAxis domain={[0, 100]} tick={axis} axisLine={false} tickLine={false} unit="%" ticks={[0, 50, 100]} />
        <Tooltip content={<Tip unit="%" />} cursor={{ stroke: 'rgb(var(--teal))', strokeOpacity: 0.4 }} />
        <Area type="monotone" dataKey="pct" name="Taken" stroke="rgb(var(--teal))" strokeWidth={3} fill="url(#trend)" animationDuration={1200} dot={false} activeDot={{ r: 6, strokeWidth: 3, stroke: 'rgb(var(--bg))', fill: 'rgb(var(--teal))' }} />
      </AreaChart></ResponsiveContainer></div>
  );
}

/** Which time slot is missed most (bar chart, worst slot highlighted in coral). */
export function SlotChart({ stats }: { stats: Stats }) {
  const data = stats.byTimeSlot.map((s) => ({ slot: SLOT_LABEL[s.slot], missed: s.missed, rate: s.missRate, worst: s.slot === stats.worstSlot }));
  return (
    <div className="h-52 w-full"><ResponsiveContainer>
      <BarChart data={data} margin={{ left: -22, right: 6, top: 8 }}>
        <defs>
          <linearGradient id="barok" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="rgb(var(--mint))" /><stop offset="1" stopColor="rgb(var(--teal))" /></linearGradient>
          <linearGradient id="barbad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="rgb(var(--coral))" /><stop offset="1" stopColor="rgb(var(--amber))" /></linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="rgb(var(--ink) / .08)" />
        <XAxis dataKey="slot" tick={axis} axisLine={false} tickLine={false} /><YAxis tick={axis} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip content={<Tip />} cursor={{ fill: 'rgb(var(--ink) / .05)' }} />
        <Bar dataKey="missed" name="Missed doses" radius={[10, 10, 4, 4]} animationDuration={1000}>{data.map((d) => <Cell key={d.slot} fill={d.worst ? 'url(#barbad)' : 'url(#barok)'} />)}</Bar>
      </BarChart></ResponsiveContainer></div>
  );
}

/** Per-medicine adherence bars (custom, animated). */
export function MedicineBars({ stats }: { stats: Stats }) {
  return (
    <ul className="space-y-3.5">
      {stats.byMedicine.map((m, i) => (
        <li key={m.medicineId}>
          <div className="mb-1 flex items-center justify-between text-[15px]"><span className="flex items-center gap-2 font-bold"><span className="h-3 w-3 rounded-full" style={{ background: m.color }} />{m.name}</span><span className="font-extrabold">{m.adherence ?? '—'}%</span></div>
          <div className="h-3 overflow-hidden rounded-full bg-ink/8"><motion.div className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${m.color}, rgb(var(--mint)))` }} initial={{ width: 0 }} animate={{ width: `${m.adherence ?? 0}%` }} transition={{ duration: 1, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }} /></div>
          <p className="mt-0.5 text-xs text-muted">{m.taken} of {m.due} doses</p>
        </li>
      ))}
    </ul>
  );
}

/** Tracker comparison across linked patients. */
export function CompareChart({ rows }: { rows: { name: string; d7: number | null; d30: number | null }[] }) {
  return (
    <div className="h-64 w-full"><ResponsiveContainer>
      <BarChart data={rows} margin={{ left: -18, right: 6, top: 8 }} barGap={6}>
        <defs>
          <linearGradient id="c7" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="rgb(var(--mint))" /><stop offset="1" stopColor="rgb(var(--teal))" /></linearGradient>
          <linearGradient id="c30" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="rgb(var(--amber))" /><stop offset="1" stopColor="rgb(var(--coral))" stopOpacity=".8" /></linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="rgb(var(--ink) / .08)" />
        <XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} tick={axis} axisLine={false} tickLine={false} unit="%" ticks={[0, 50, 100]} />
        <Tooltip content={<Tip unit="%" />} cursor={{ fill: 'rgb(var(--ink) / .05)' }} />
        <Bar dataKey="d7" name="7 days" fill="url(#c7)" radius={[10, 10, 4, 4]} animationDuration={1000} /><Bar dataKey="d30" name="30 days" fill="url(#c30)" radius={[10, 10, 4, 4]} animationDuration={1200} />
      </BarChart></ResponsiveContainer></div>
  );
}
