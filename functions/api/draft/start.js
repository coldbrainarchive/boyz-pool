import { json } from '../_shared.js';
import { getPlayerAtPick } from '../draft.js';

export async function onRequestPost({ env, request }) {
  try {
    const { playerOrder, timerEnabled, timerSeconds, pickNumber } = await request.json();
    if (!playerOrder?.length) return json({ error: 'Player order required' }, 400);

    const pick = pickNumber ?? 0;
    const secs = timerSeconds ?? 18000;
    const now  = timerEnabled ? new Date().toISOString().replace('Z', '') : null;

    await env.DB.prepare(`
      INSERT INTO draft (id, active, pick_number, timer_enabled, timer_seconds, pick_started_at, player_order)
      VALUES (1, 1, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        active = 1, pick_number = excluded.pick_number,
        timer_enabled = excluded.timer_enabled, timer_seconds = excluded.timer_seconds,
        pick_started_at = excluded.pick_started_at, player_order = excluded.player_order
    `).bind(pick, timerEnabled ? 1 : 0, secs, now, JSON.stringify(playerOrder)).run();

    const currentPlayer = getPlayerAtPick(playerOrder, pick);
    return json({ success: true, current_player_id: currentPlayer });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
