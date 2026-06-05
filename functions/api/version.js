import { json } from './_shared.js';

export async function onRequestGet({ env }) {
  const row = await env.DB.prepare(
    "SELECT value FROM settings WHERE key = 'force_refresh_at'"
  ).first();
  return json({ version: row?.value ?? '0' });
}

export async function onRequestPost({ env }) {
  const v = String(Date.now());
  await env.DB.prepare(
    "INSERT OR REPLACE INTO settings (key, value) VALUES ('force_refresh_at', ?)"
  ).bind(v).run();
  return json({ success: true, version: v });
}
