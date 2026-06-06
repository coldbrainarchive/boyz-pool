const SYNC_URL = 'https://boyz-pool.pages.dev/api/sync';

// Tournament window: June 11 – July 20 2026
const TOURNAMENT_START = new Date('2026-06-11T00:00:00Z');
const TOURNAMENT_END   = new Date('2026-07-20T00:00:00Z');

export default {
  async scheduled(event, env, ctx) {
    const now = new Date();
    if (now < TOURNAMENT_START || now > TOURNAMENT_END) return; // no-op outside tournament
    try {
      const res = await fetch(SYNC_URL, { method: 'POST' });
      const data = await res.json();
      console.log('[sync-cron]', data.message ?? data.error ?? res.status);
    } catch (err) {
      console.error('[sync-cron] failed:', err.message);
    }
  },

  // Lets you trigger a manual sync by hitting the worker URL directly
  async fetch(request) {
    if (request.method !== 'POST') return new Response('boyz-pool sync worker', { status: 200 });
    try {
      const res = await fetch(SYNC_URL, { method: 'POST' });
      const data = await res.json();
      return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  },
};
