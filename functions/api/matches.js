import { json } from './_shared.js';

export async function onRequestGet({ env }) {
  if (!env.FOOTBALL_DATA_API_KEY) return json({ matches: [], noApiKey: true });

  try {
    const res = await fetch('https://api.football-data.org/v4/competitions/WC/matches?season=2026', {
      headers: { 'X-Auth-Token': env.FOOTBALL_DATA_API_KEY },
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    return json({ matches: data.matches || [] });
  } catch (err) {
    return json({ error: err.message, matches: [] }, 500);
  }
}
