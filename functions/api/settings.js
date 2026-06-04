import { DEFAULT_SETTINGS, getSettings, json } from './_shared.js';

export async function onRequestGet({ env }) {
  return json(await getSettings(env.DB));
}

export async function onRequestPatch({ env, request }) {
  const body = await request.json();
  const allowed = Object.keys(DEFAULT_SETTINGS);

  const stmts = [];
  for (const key of allowed) {
    if (body[key] !== undefined) {
      const val = parseInt(body[key]);
      if (!isNaN(val) && val >= 0)
        stmts.push(env.DB.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').bind(key, String(val)));
    }
  }
  if (stmts.length) await env.DB.batch(stmts);
  return json({ success: true, settings: await getSettings(env.DB) });
}
