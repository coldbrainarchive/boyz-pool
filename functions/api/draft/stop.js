import { json } from '../_shared.js';

export async function onRequestPost({ env }) {
  try {
    await env.DB.prepare('UPDATE draft SET active = 0, pick_started_at = NULL WHERE id = 1').run();
    return json({ success: true });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
