import { json, getPlayerAtPick } from '../_shared.js';

const TOTAL_ROUNDS = 8; // 8 teams per player

export async function onRequestPost({ env, request }) {
  try {
    const { reason, fromPickNumber } = await request.json();
    const state = await env.DB.prepare('SELECT * FROM draft WHERE id = 1').first();
    if (!state?.active) return json({ error: 'Draft not active' }, 400);

    // Stale call guard — another client already advanced
    if (fromPickNumber !== undefined && state.pick_number !== fromPickNumber)
      return json({ success: true, skipped: true, pick_number: state.pick_number });

    // Timer expiry validation (5s grace window)
    if (reason === 'timeout' && state.timer_enabled && state.pick_started_at) {
      const elapsed = (Date.now() - new Date(state.pick_started_at + 'Z').getTime()) / 1000;
      if (elapsed < state.timer_seconds - 5)
        return json({ error: 'Timer has not expired' }, 400);
    }

    const order = JSON.parse(state.player_order || '[]');
    const totalPicks = order.length * TOTAL_ROUNDS;
    const newPick = state.pick_number + 1;

    if (newPick >= totalPicks) {
      // Draft complete
      await env.DB.prepare('UPDATE draft SET active = 0, pick_number = ? WHERE id = 1').bind(newPick).run();
      return json({ success: true, complete: true });
    }

    // Key rule: timer resets only when the PLAYER CHANGES
    const curPlayer  = getPlayerAtPick(order, state.pick_number);
    const nextPlayer = getPlayerAtPick(order, newPick);
    const samePlayer = curPlayer === nextPlayer;

    const newPickStartedAt = (!state.timer_enabled)
      ? null
      : samePlayer
        ? state.pick_started_at  // keep timer running for back-to-back picks
        : new Date().toISOString().replace('Z', '');

    // Atomic update — only succeeds if nobody else already advanced
    const { meta } = await env.DB.prepare(`
      UPDATE draft SET pick_number = ?, pick_started_at = ?
      WHERE id = 1 AND pick_number = ?
    `).bind(newPick, newPickStartedAt, state.pick_number).run();

    if (!meta.changes) return json({ success: true, skipped: true, pick_number: state.pick_number });

    return json({ success: true, pick_number: newPick, current_player_id: nextPlayer, same_player: samePlayer });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
