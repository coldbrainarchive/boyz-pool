export const DEFAULT_SETTINGS = {
  pts_groups: 5, pts_r16: 10, pts_qf: 10,
  pts_sf: 10, pts_runner_up: 10, pts_champion: 10,
  teams_locked: 0,
  trade_deadline: 0,
  trade_deadline_active: 0,
};

export const VALID_STAGES = [null, 'GROUP', 'R32', 'R16', 'QF', 'SF', 'FINAL', 'WINNER'];
export const STAGE_ORDER  = ['GROUP', 'R32', 'R16', 'QF', 'SF', 'FINAL', 'WINNER'];

export function calcPoints(stage, settings) {
  if (!stage || stage === 'GROUP') return 0;
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const g = s.pts_groups;
  const r16 = g + s.pts_r16;
  const qf  = r16 + s.pts_qf;
  const sf  = qf  + s.pts_sf;
  const fin = sf  + s.pts_runner_up;
  const win = fin + s.pts_champion;
  return { R32: g, R16: r16, QF: qf, SF: sf, FINAL: fin, WINNER: win }[stage] ?? 0;
}

export async function getSettings(db) {
  const { results } = await db.prepare('SELECT key, value FROM settings').all();
  const s = { ...DEFAULT_SETTINGS };
  for (const row of results) if (row.key in s) s[row.key] = parseInt(row.value) || 0;
  return s;
}

// Snake draft: returns the player ID at a given pick number
export function getPlayerAtPick(order, pickNum) {
  const n = order.length;
  if (!n) return null;
  const round = Math.floor(pickNum / n);
  const pos   = pickNum % n;
  const idx   = round % 2 === 1 ? (n - 1 - pos) : pos;
  return order[idx] ?? null;
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
