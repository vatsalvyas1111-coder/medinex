const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'), surface: v('surface'), ink: v('ink'), muted: v('muted'),
        line: v('line'), teal: v('teal'), mint: v('mint'), coral: v('coral'), amber: v('amber'), leaf: v('leaf'),
      },
      fontFamily: {
        display: ['Fraunces', 'Iowan Old Style', 'Palatino Linotype', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: { md2: '12px', lg2: '20px', xl2: '28px' },
      boxShadow: {
        soft: '0 1px 1px rgb(var(--shadow) / .04), 0 4px 10px rgb(var(--shadow) / .06), 0 18px 40px rgb(var(--shadow) / .10)',
        lift: '0 2px 2px rgb(var(--shadow) / .05), 0 10px 24px rgb(var(--shadow) / .12), 0 30px 60px rgb(var(--shadow) / .16)',
        glow: '0 0 0 1px rgb(var(--teal) / .35), 0 8px 40px rgb(var(--teal) / .35)',
      },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        drift: { '0%,100%': { transform: 'translate3d(0,0,0) scale(1)' }, '50%': { transform: 'translate3d(4%,-3%,0) scale(1.08)' } },
        breathe: { '0%,100%': { transform: 'scale(1)', opacity: '.85' }, '50%': { transform: 'scale(1.08)', opacity: '1' } },
        amberPulse: { '0%,100%': { boxShadow: '0 0 0 0 rgb(var(--amber) / .0)' }, '50%': { boxShadow: '0 0 0 8px rgb(var(--amber) / .22)' } },
        spin360: { to: { transform: 'rotate(360deg)' } },
        shake: { '0%,100%': { transform: 'translateX(0)' }, '20%': { transform: 'translateX(-6px)' }, '40%': { transform: 'translateX(5px)' }, '60%': { transform: 'translateX(-3px)' }, '80%': { transform: 'translateX(2px)' } },
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite', drift: 'drift 22s ease-in-out infinite', breathe: 'breathe 3.4s ease-in-out infinite',
        amberPulse: 'amberPulse 2s ease-in-out infinite', spin360: 'spin360 1.4s linear infinite', shake: 'shake .42s ease-in-out',
      },
    },
  },
  plugins: [],
};
