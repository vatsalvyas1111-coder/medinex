import { motion } from 'framer-motion';
import { parseStamp, ymd } from '../lib/time';
import type { HeatDay } from '../lib/types';

const CLS: Record<string, string> = { green: 'heat-green', amber: 'heat-amber', red: 'heat-red', none: 'heat-none', pending: 'heat-pending' };
const LABEL: Record<string, string> = { green: 'All taken on time', amber: 'Some late or missed', red: 'Mostly missed', none: 'No doses scheduled', pending: 'In progress' };

/** Custom SVG-free calendar heatmap: green taken / amber late / red missed. Weeks are rows, Monday first. */
export function CalendarHeatmap({ days, selected, onSelect, compact = false }: { days: HeatDay[]; selected?: string | null; onSelect?: (d: HeatDay) => void; compact?: boolean }) {
  if (!days.length) return null;
  const first = parseStamp(days[0].date); const lead = (first.getDay() + 6) % 7;
  const cells: (HeatDay | null)[] = [...Array(lead).fill(null), ...days];
  while (cells.length % 7) cells.push(null);
  const today = ymd(parseStamp(days[days.length - 1].date));
  return (
    <div role="grid" aria-label="Adherence calendar">
      <div className="mb-1.5 grid grid-cols-7 gap-1.5 text-center text-[11px] font-bold uppercase tracking-wider text-muted">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i}>{d}</span>)}</div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((c, i) => c ? (
          <motion.button key={c.date} type="button" role="gridcell" initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: Math.min(i * 0.008, 0.6), type: 'spring', stiffness: 400, damping: 22 }}
            whileHover={{ scale: 1.14, zIndex: 2 }} whileTap={{ scale: 0.92 }} onClick={() => onSelect?.(c)} disabled={!onSelect}
            title={`${c.date}: ${LABEL[c.level]}${c.total ? ` (${c.taken}/${c.total} taken${c.missed ? `, ${c.missed} missed` : ''}${c.late ? `, ${c.late} late` : ''})` : ''}`} aria-label={`${c.date}: ${LABEL[c.level]}`}
            className={`relative grid aspect-square place-items-center rounded-lg text-[12px] font-bold ${CLS[c.level]} ${selected === c.date ? 'ring-[3px] ring-ink/70 ring-offset-2 ring-offset-transparent' : ''} ${c.level === 'none' ? 'text-muted' : 'text-white/95'}`}>
            {!compact && parseStamp(c.date).getDate()}{c.date === today && <span className="absolute inset-0 rounded-lg ring-2 ring-teal" />}
          </motion.button>
        ) : <span key={i} />)}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-muted">
        {(['green', 'amber', 'red', 'none'] as const).map((k) => <span key={k} className="inline-flex items-center gap-1.5"><span className={`h-3 w-3 rounded ${CLS[k]}`} />{k === 'green' ? 'Taken' : k === 'amber' ? 'Late / some missed' : k === 'red' ? 'Missed' : 'None'}</span>)}
      </div>
    </div>
  );
}
