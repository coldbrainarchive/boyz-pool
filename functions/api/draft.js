import { json } from './_shared.js';

export function getPlayerAtPick(order, pickNum) {
  const n = order.length;
  if (!n) return null;
  const round = Math.floor(pickNum / n);
  const pos   = pickNum % n;
  const idx   = round % 2 === 1 ? (n - 1 - pos) : pos;
  return order[idx] ?? null;
}

export async function onRequestGet({ env }) {
  try {
    const state = await env.DB.prepare('SELECT * FROM draft WHERE id = 1').first();
    if (!state) return json({ active: false, configured: false });

    const order = JSON.parse(state.player_order || '[]');
    const currentPlayerId = state.active ? getPlayerAtPick(order, state.pick_number) : null;

    // Fetch player name directly so the banner never depends on leaderboard loading
    const currentPlayerName = currentPlayerId
      ? (await env.DB.prepare('SELECT name FROM players WHERE id = ?').bind(currentPlayerId).first())?.name ?? null
      : null;

    let timeRemaining = null;
    if (state.active && state.timer_enabled && state.pick_started_at) {
      const elapsed = (Date.now() - new Date(state.pick_started_at + 'Z').getTime()) / 1000;
      timeRemaining = Math.max(0, state.timer_seconds - elapsed);
    }

    return json({
      active:               !!state.active,
      pick_number:          state.pick_number,
      current_player_id:    currentPlayerId,
      current_player_name:  currentPlayerName,
      timer_enabled:        !!state.timer_enabled,
      timer_seconds:        state.timer_seconds,
      time_remaining:       timeRemaining,
      pick_started_at:      state.pick_started_at,
      player_order:         order,
    });
  } catch (err) {
    return json({ error: err.message, active: false }, 500);
  }
}
