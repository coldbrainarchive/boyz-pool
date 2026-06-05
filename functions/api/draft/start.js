import { json, getPlayerAtPick } from '../_shared.js';

export async function onRequestPost({ env, request }) {
  try {
    const { playerOrder, timerEnabled, timerSeconds, pickNumber } = await request.json();
    if (!playerOrder?.length) return json({ error: 'Player order required' }, 400);

    const pick = pickNumber ?? 0;
    const secs = timerSeconds ?? 18000;
    const now  = timerEnabled ? new Date().toISOString().replace('Z', '') : null;

    // INSERT OR REPLACE is more compatible than ON CONFLICT DO UPDATE
    await env.DB.prepare(`
      INSERT OR REPLACE INTO draft (id, active, pick_number, timer_enabled, timer_seconds, pick_started_at, player_order)
      VALUES (1, 1, ?, ?, ?, ?, ?)
    `).bind(pick, timerEnabled ? 1 : 0, secs, now, JSON.stringify(playerOrder)).run();

    const currentPlayer = getPlayerAtPick(playerOrder, pick);
    return json({ success: true, current_player_id: currentPlayer });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
