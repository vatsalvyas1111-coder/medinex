import { useId } from 'react';
import type { Form } from '../lib/types';

function hex(c: string) { const n = parseInt(c.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
export function shade(c: string, amt: number) {
  const [r, g, b] = hex(c).map((v) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt)))));
  return `rgb(${r},${g},${b})`;
}
const hash = (s: string) => [...s].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
export type Tablet = 'round' | 'oval' | 'split';
export const tabletVariant = (name: string): Tablet => (['round', 'oval', 'split'] as const)[hash(name) % 3];

/** Parametric pill library: tablet (round/oval/split), two-tone capsule, syrup bottle, injection, drops. */
export function PillIcon({ form, color, size = 56, name = '', className }: { form: Form; color: string; size?: number; name?: string; className?: string }) {
  const id = useId().replace(/:/g, '');
  const light = shade(color, .45), dark = shade(color, -.22);
  const grad = (
    <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={light} /><stop offset=".55" stopColor={color} /><stop offset="1" stopColor={dark} /></linearGradient>
  );
  const shadow = <ellipse cx="32" cy="57" rx="17" ry="3.2" fill="#000" opacity=".16" />;
  let body: React.ReactNode;
  if (form === 'tablet') {
    const v = tabletVariant(name);
    body = v === 'oval' ? (
      <g><ellipse cx="32" cy="32" rx="24" ry="15" fill={`url(#${id}g)`} transform="rotate(-25 32 32)" />
        <ellipse cx="24" cy="25" rx="10" ry="3.6" fill="#fff" opacity=".5" transform="rotate(-25 32 32)" />
        <path d="M19 40 L45 24" stroke={dark} strokeOpacity=".35" strokeWidth="1.6" strokeLinecap="round" /></g>
    ) : (
      <g><circle cx="32" cy="32" r="21" fill={`url(#${id}g)`} />
        <path d="M17 26c3-8 12-11 20-8" stroke="#fff" strokeOpacity=".65" strokeWidth="3.4" strokeLinecap="round" fill="none" />
        {v === 'split' && <path d="M14 32H50" stroke={dark} strokeOpacity=".4" strokeWidth="2" strokeLinecap="round" />}
        {v === 'round' && <circle cx="32" cy="32" r="14.5" fill="none" stroke={dark} strokeOpacity=".16" strokeWidth="1.5" />}</g>
    );
  } else if (form === 'capsule') {
    body = (
      <g transform="rotate(-35 32 32)">
        <clipPath id={`${id}c`}><rect x="6" y="20" width="52" height="24" rx="12" /></clipPath>
        <g clipPath={`url(#${id}c)`}>
          <rect x="6" y="20" width="27" height="24" fill={`url(#${id}g)`} />
          <rect x="32" y="20" width="26" height="24" fill="#f8fafc" />
          <rect x="32" y="34" width="26" height="10" fill="#cbd5e1" opacity=".55" />
          <rect x="10" y="23" width="44" height="5" rx="2.5" fill="#fff" opacity=".5" />
        </g>
        <rect x="31" y="20" width="2" height="24" fill="#000" opacity=".1" />
      </g>
    );
  } else if (form === 'syrup') {
    body = (
      <g><rect x="25" y="8" width="14" height="9" rx="3" fill={dark} />
        <rect x="27" y="16" width="10" height="6" fill="#e2e8f0" opacity=".9" />
        <path d="M21 26c0-4 3-6 6-6h10c3 0 6 2 6 6v24c0 4-3 6-6 6H27c-3 0-6-2-6-6z" fill="#e2e8f0" opacity=".55" />
        <path d="M22 34h20v16c0 3-2 5-5 5H27c-3 0-5-2-5-5z" fill={`url(#${id}g)`} />
        <rect x="24" y="38" width="16" height="10" rx="2.5" fill="#fff" opacity=".85" />
        <path d="M24 26v26" stroke="#fff" strokeOpacity=".7" strokeWidth="2.6" strokeLinecap="round" /></g>
    );
  } else if (form === 'injection') {
    body = (
      <g transform="rotate(40 32 32)"><rect x="24" y="14" width="16" height="30" rx="4" fill="#e2e8f0" opacity=".85" />
        <rect x="26" y="26" width="12" height="16" rx="2" fill={`url(#${id}g)`} />
        <rect x="20" y="12" width="24" height="4" rx="2" fill={dark} />
        <rect x="29" y="4" width="6" height="9" rx="2" fill={dark} />
        <rect x="31" y="44" width="2" height="12" fill="#94a3b8" />
        <path d="M27 18v20" stroke="#fff" strokeOpacity=".8" strokeWidth="2" strokeLinecap="round" /></g>
    );
  } else {
    body = (
      <g><rect x="25" y="6" width="14" height="10" rx="3" fill={dark} />
        <path d="M28 16h8l3 6v24c0 4-3 8-7 8s-7-4-7-8V22z" fill="#e2e8f0" opacity=".6" />
        <path d="M25 34h14v12c0 4-3 8-7 8s-7-4-7-8z" fill={`url(#${id}g)`} />
        <path d="M27 24v26" stroke="#fff" strokeOpacity=".75" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M32 58c-2-2.6-3.4-4-3.4-5.4a3.4 3.4 0 016.8 0c0 1.4-1.4 2.8-3.4 5.4z" fill={color} opacity=".9" transform="translate(0 1) scale(.85) translate(5.6 4)" /></g>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true" style={{ overflow: 'visible' }}>
      <defs>{grad}</defs>{shadow}{body}
    </svg>
  );
}
