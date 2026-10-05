const hash = (s: string) => [...s].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 11);

/** Procedural gradient-orb avatar generated from avatar_seed. */
export function Avatar({ seed, name, size = 44, className = '', ring = false }: { seed: string; name?: string; size?: number; className?: string; ring?: boolean }) {
  const h = hash(seed); const h1 = h % 360, h2 = (h1 + 40 + (h % 70)) % 360, h3 = (h1 + 200) % 360;
  const id = `av${h}`;
  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center rounded-full ${className}`} style={{ width: size, height: size, boxShadow: ring ? '0 0 0 3px rgb(var(--bg)), 0 0 0 5px rgb(var(--teal) / .6)' : undefined }}>
      <svg width={size} height={size} viewBox="0 0 48 48" className="absolute inset-0" aria-hidden="true">
        <defs>
          <radialGradient id={`${id}a`} cx=".3" cy=".25" r="1"><stop offset="0" stopColor={`hsl(${h1} 90% 78%)`} /><stop offset=".6" stopColor={`hsl(${h2} 80% 58%)`} /><stop offset="1" stopColor={`hsl(${h3} 70% 38%)`} /></radialGradient>
          <radialGradient id={`${id}b`} cx=".72" cy=".78" r=".55"><stop offset="0" stopColor={`hsl(${h3} 95% 72%)`} stopOpacity=".85" /><stop offset="1" stopColor={`hsl(${h3} 95% 72%)`} stopOpacity="0" /></radialGradient>
        </defs>
        <circle cx="24" cy="24" r="24" fill={`url(#${id}a)`} /><circle cx="24" cy="24" r="24" fill={`url(#${id}b)`} />
        <ellipse cx="16" cy="12" rx="10" ry="5" fill="#fff" opacity=".28" transform="rotate(-25 16 12)" />
      </svg>
      {name && <span className="relative font-bold text-white drop-shadow" style={{ fontSize: size * 0.38 }}>{name.replace(/^Dr\.?\s*/, '').trim()[0]}</span>}
    </span>
  );
}
