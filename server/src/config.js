// Loads server/.env (tiny loader, no dotenv dependency) and exposes typed config.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(__dirname, '..');

const envFile = path.join(SERVER_ROOT, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (!m || line.trim().startsWith('#')) continue;
    if (process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

// All wall-clock logic runs in one zone so the demo behaves the same on any machine.
process.env.TZ = process.env.APP_TZ || 'Asia/Kolkata';

export const config = {
  port: Number(process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  demoMode: (process.env.DEMO_MODE ?? 'true') !== 'false',
  seedClockStart: process.env.SEED_CLOCK_START || '07:30',
  groqKey: process.env.GROQ_API_KEY || '',
  groqModel: process.env.GROQ_MODEL || 'qwen/qwen3.8-27b',
  groqFallbacks: (process.env.GROQ_FALLBACK_MODELS || 'qwen/qwen3.6-27b,qwen/qwen3-32b')
    .split(',').map((s) => s.trim()).filter(Boolean),
  dbPath: path.join(SERVER_ROOT, 'data', 'medinex.db'),
  clientDist: path.resolve(SERVER_ROOT, '..', 'client', 'dist'),
};
