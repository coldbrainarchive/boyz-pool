let leaderboardData = [];
let teamsData = [];
let matchesData = [];
let settingsData = {};
let pendingAssignTeamCode = null;
let pendingUnassign = null;
let activeFilter = 'all';
let matchFilter = 'upcoming';
let activeTab = 'leaderboard';
let scheduleRefreshTimer = null;
let pendingPhoto = null;
let activityExpanded = false;
let activityEntries = [];

const STAGE_LABELS = {
  GROUP:  'Groups',
  R32:    'R32',
  R16:    'R16',
  QF:     'QF',
  SF:     'SF',
  FINAL:  'Final',
  WINNER: '🏆'
};

// ─── Data Loading ─────────────────────────────────────────────────────────────

async function loadAll() {
  await Promise.all([loadLeaderboard(), loadTeams(), loadSettings(), loadMatches(), loadActivity()]);
}

async function loadLeaderboard() {
  try {
    const res = await fetch('/api/leaderboard');
    if (!res.ok) return;
    leaderboardData = await res.json();
    renderLeaderboard();
  } catch (_) {}
}

async function loadTeams() {
  try {
    const res = await fetch('/api/teams');
    if (!res.ok) return;
    teamsData = await res.json();
    renderTeams();
  } catch (_) {}
}

async function loadSettings() {
  const res = await fetch('/api/settings');
  if (!res.ok) return;
  settingsData = await res.json();
  renderScoringTable();
  updateSettingsMaxPts();
}

async function loadActivity() {
  try {
    const res = await fetch('/api/activity');
    activityEntries = await res.json();
    renderActivity();
    updateActivityBadge();
  } catch (_) {}
}

function toggleActivity() {
  activityExpanded = !activityExpanded;
  const log = document.getElementById('activityLog');
  const arrow = document.getElementById('activityArrow');
  log.classList.toggle('collapsed', !activityExpanded);
  if (arrow) arrow.style.transform = activityExpanded ? 'rotate(90deg)' : '';

  if (activityExpanded) {
    // Mark all as read
    localStorage.setItem('lastActivityViewedAt', new Date().toISOString());
    updateActivityBadge();
  }
}

function updateActivityBadge() {
  const badge = document.getElementById('activityBadge');
  if (!badge) return;
  const lastViewed = localStorage.getItem('lastActivityViewedAt');
  const unread = lastViewed
    ? activityEntries.filter(e => new Date(e.created_at + 'Z') > new Date(lastViewed)).length
    : activityEntries.length;
  if (unread > 0) {
    badge.textContent = unread;
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}

const STAGE_ADVANCE_LABELS = {
  GROUP:  'eliminated in groups',
  R32:    'survived the Group Stage',
  R16:    'reached the Round of 16',
  QF:     'reached the Quarterfinals',
  SF:     'reached the Semifinals',
  FINAL:  'reached the Final!',
  WINNER: 'won the World Cup! 🏆',
};

function renderActivity() {
  const el = document.getElementById('activityLog');
  if (!el) return;

  if (!activityEntries.length) {
    el.innerHTML = `<div class="activity-empty">No activity yet — add players and pick teams to get started</div>`;
    return;
  }

  el.innerHTML = activityEntries.map(e => {
    if (e.action === 'stage_advance') {
      const label = STAGE_ADVANCE_LABELS[e.stage] || e.stage;
      const pts = calcTeamPoints(e.stage);
      const hasOwner = e.player_name && e.player_name !== '';
      return `
        <div class="activity-row activity-stage">
          <span class="activity-flag">${e.team_flag}</span>
          <div class="activity-text">
            <span class="activity-team">${escHtml(e.team_name)}</span>
            <span class="activity-action stage">${label}</span>
            ${hasOwner ? `<span class="activity-player">${escHtml(e.player_name)}</span>` : ''}
            ${pts > 0 && hasOwner ? `<span class="activity-pts">+${pts} pts</span>` : ''}
          </div>
          <span class="activity-time">${timeAgo(e.created_at)}</span>
        </div>`;
    }
    const isAssigned = e.action === 'assigned';
    return `
      <div class="activity-row">
        <span class="activity-flag">${e.team_flag}</span>
        <div class="activity-text">
          <span class="activity-team">${escHtml(e.team_name)}</span>
          <span class="activity-action ${isAssigned ? 'assigned' : 'removed'}">
            ${isAssigned ? '→ added to' : '✕ removed from'}
          </span>
          <span class="activity-player">${escHtml(e.player_name)}</span>
        </div>
        <span class="activity-time">${timeAgo(e.created_at)}</span>
      </div>`;
  }).join('');
}

function timeAgo(utcStr) {
  const diff = Date.now() - new Date(utcStr + 'Z').getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

async function loadMatches() {
  try {
    const res = await fetch('/api/matches');
    const data = await res.json();
    if (data.noApiKey) {
      document.getElementById('matchesList').innerHTML = `
        <div class="empty-state">
          <div class="big-icon">🔑</div>
          <p style="font-weight:700;margin-bottom:8px">API key needed for live schedule</p>
          <p style="font-size:13px;color:var(--muted)">In Cloudflare Pages → Settings → Environment Variables, add:<br><br>
          <strong style="color:var(--accent)">FOOTBALL_DATA_API_KEY</strong><br><br>
          Get a free key at <strong>football-data.org</strong></p>
        </div>`;
      return;
    }
    matchesData = data.matches || [];
    renderMatches();
  } catch (_) {}
}

// ─── Scoring Helpers ──────────────────────────────────────────────────────────

function calcMaxPts(s) {
  return (s.pts_groups || 0) + (s.pts_r16 || 0) + (s.pts_qf || 0) +
         (s.pts_sf || 0) + (s.pts_runner_up || 0) + (s.pts_champion || 0);
}

function calcTeamPoints(stage) {
  if (!stage || stage === 'GROUP') return 0;
  const s = settingsData;
  const g = s.pts_groups || 0;
  const vals = {
    R32:    g,
    R16:    g + (s.pts_r16 || 0),
    QF:     g + (s.pts_r16 || 0) + (s.pts_qf || 0),
    SF:     g + (s.pts_r16 || 0) + (s.pts_qf || 0) + (s.pts_sf || 0),
    FINAL:  g + (s.pts_r16 || 0) + (s.pts_qf || 0) + (s.pts_sf || 0) + (s.pts_runner_up || 0),
    WINNER: calcMaxPts(s),
  };
  return vals[stage] ?? 0;
}

function renderScoringTable() {
  const el = document.getElementById('rulesScoring');
  if (!el) return;
  const s = settingsData;
  const g   = s.pts_groups    || 0;
  const r16 = s.pts_r16       || 0;
  const qf  = s.pts_qf        || 0;
  const sf  = s.pts_sf        || 0;
  const ru  = s.pts_runner_up || 0;
  const ch  = s.pts_champion  || 0;

  const rows = [
    { label: 'Eliminated in Group Stage',  bonus: 0,  total: 0,                   cls: 'muted' },
    { label: 'Survived Groups (reach R32)', bonus: g,  total: g,                   cls: g > 0 ? '' : 'muted' },
    { label: 'Reached Round of 16',        bonus: r16, total: g + r16,             cls: '' },
    { label: 'Reached Quarterfinals',      bonus: qf,  total: g + r16 + qf,        cls: '' },
    { label: 'Reached Semifinals',         bonus: sf,  total: g + r16 + qf + sf,   cls: '' },
    { label: 'Runner-up',                  bonus: ru,  total: g + r16 + qf + sf + ru, cls: '' },
    { label: '🏆 Champion',               bonus: ch,  total: calcMaxPts(s),        cls: 'gold', highlight: true },
  ];

  el.innerHTML = rows.map(r => `
    <div class="score-row ${r.highlight ? 'highlight' : ''}">
      <span>${r.label}</span>
      <div class="score-row-pts">
        ${r.bonus > 0 ? `<span class="pts-bonus">+${r.bonus}</span>` : '<span class="pts-bonus muted">+0</span>'}
        <span class="pts-total ${r.cls}">${r.total} pts total</span>
      </div>
    </div>`).join('');
}

function updateSettingsMaxPts() {
  const el = document.getElementById('settingsMaxPts');
  if (el) el.textContent = calcMaxPts(settingsData) + ' pts';
}

// ─── Rendering ────────────────────────────────────────────────────────────────

function renderLeaderboard() {
  const el = document.getElementById('leaderboard');

  if (!leaderboardData.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="big-icon">👥</div>
        <p>No players yet. Add one to get started!</p>
      </div>`;
    return;
  }

  // Only show medals once at least one player has points
  const hasPoints = leaderboardData.some(p => p.totalPoints > 0);

  // If no one has points yet, show in order they were added (server sorts by id asc when all 0)
  const displayData = hasPoints
    ? leaderboardData
    : [...leaderboardData].sort((a, b) => a.id - b.id);

  el.innerHTML = displayData.map((player, i) => {
    const rank = i + 1;
    const showMedal = hasPoints && rank <= 3;
    const rankClass = showMedal ? `rank-${rank}` : '';
    const rankLabel = showMedal ? ['🥇','🥈','🥉'][rank-1] : rank;

    const avatar = player.photo
      ? `<img src="${player.photo}" class="player-avatar" onclick="updatePlayerPhoto(${player.id})" title="Tap to change photo" />`
      : `<div class="player-avatar player-avatar-placeholder" onclick="updatePlayerPhoto(${player.id})" title="Tap to add photo">${escHtml(player.name[0].toUpperCase())}</div>`;

    const teamChips = player.teams.map(t => `
      <span class="team-chip stage-${t.stage || ''}"
            onclick="openUnassign(${player.id}, '${t.code}', '${escHtml(t.name)}')"
            title="Click to remove ${escHtml(t.name)}">
        ${t.flag} ${escHtml(t.name)}
        ${t.stage ? `<span class="chip-pts">${t.points}pts</span>` : ''}
      </span>`).join('');

    return `
      <div class="player-card ${rankClass}">
        <div class="player-rank">${rankLabel}</div>
        ${avatar}
        <div class="player-info">
          <div class="player-name">${escHtml(player.name)}</div>
          <div class="player-teams">
            ${teamChips}
            <span class="add-team-chip" onclick="openAssignForPlayer(${player.id})">+ Team</span>
          </div>
        </div>
        <div>
          <div class="player-points">${player.totalPoints}</div>
          <div class="player-pts-label">pts</div>
        </div>
        <div class="player-actions">
          <button class="icon-btn" onclick="removePlayer(${player.id}, '${escHtml(player.name)}')" title="Remove player">🗑</button>
        </div>
      </div>`;
  }).join('');
}

function renderTeams() {
  const el = document.getElementById('teamsGrid');
  if (!teamsData.length) { el.innerHTML = ''; return; }

  const onlyAvailable = activeFilter === 'available';
  const groups = ['A','B','C','D','E','F','G','H','I','J','K','L'];

  // Bucket teams by group
  const byGroup = {};
  for (const g of groups) byGroup[g] = [];
  for (const t of teamsData) {
    const g = t.group_name || '?';
    if (!byGroup[g]) byGroup[g] = [];
    byGroup[g].push(t);
  }

  let html = '';
  for (const g of groups) {
    const teams = byGroup[g] || [];
    const visible = onlyAvailable ? teams.filter(t => !t.claimed_by) : teams;
    if (!visible.length) continue;

    html += `<div class="group-section">
      <div class="group-header">Group ${g}</div>
      <div class="group-teams">${visible.map(renderTeamCard).join('')}</div>
    </div>`;
  }

  el.innerHTML = html || `<div class="empty-state"><div class="big-icon">✅</div><p>All teams have been claimed!</p></div>`;
}

function renderTeamCard(t) {
  const isClaimed = !!t.claimed_by;
  const stageLabel = t.stage ? STAGE_LABELS[t.stage] : '';
  const pts = calcTeamPoints(t.stage);
  return `
    <div class="team-card ${isClaimed ? 'claimed' : ''}"
         onclick="handleTeamClick('${t.code}')"
         title="${isClaimed ? `${escHtml(t.claimed_by)}'s team — tap to unassign` : 'Tap to assign to a player'}">
      ${t.stage ? `<span class="team-card-stage stage-${t.stage}">${stageLabel}</span>` : ''}
      <div class="team-card-flag">${t.flag}</div>
      <div class="team-card-name">${escHtml(t.name)}</div>
      <div class="team-card-code">${t.code}</div>
      ${pts > 0 ? `<div class="team-card-pts">${pts} pts</div>` : ''}
      ${isClaimed ? `<div class="team-card-claimed">→ ${escHtml(t.claimed_by)}</div>` : ''}
    </div>`;
}

function applyFilter(filter) {
  activeFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.filter === filter);
  });
  renderTeams();
}

// ─── Player Actions ───────────────────────────────────────────────────────────

function openAddPlayer() {
  pendingPhoto = null;
  const preview = document.getElementById('addPhotoPreview');
  preview.style.backgroundImage = '';
  preview.innerHTML = '<span class="avatar-pick-icon">📷</span><span class="avatar-pick-label">Photo</span>';
  openModal('addPlayerModal');
  document.getElementById('playerNameInput').value = '';
  setTimeout(() => document.getElementById('playerNameInput').focus(), 50);
}

async function submitAddPlayer() {
  const name = document.getElementById('playerNameInput').value.trim();
  if (!name) return;
  const res = await fetch('/api/players', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, photo: pendingPhoto })
  });
  const data = await res.json();
  if (!res.ok) { showToast(data.error, 'error'); return; }
  pendingPhoto = null;
  closeModal('addPlayerModal');
  showToast(`${name} added!`, 'success');
  await loadAll();
}

function handlePhotoSelect(previewId, input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 120; canvas.height = 120;
      const ctx = canvas.getContext('2d');
      const size = Math.min(img.width, img.height);
      const ox = (img.width - size) / 2;
      const oy = (img.height - size) / 2;
      ctx.drawImage(img, ox, oy, size, size, 0, 0, 120, 120);
      pendingPhoto = canvas.toDataURL('image/jpeg', 0.82);
      const el = document.getElementById(previewId);
      el.innerHTML = '';
      el.style.backgroundImage = `url(${pendingPhoto})`;
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

async function updatePlayerPhoto(playerId) {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 120; canvas.height = 120;
        const ctx = canvas.getContext('2d');
        const size = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width-size)/2, (img.height-size)/2, size, size, 0, 0, 120, 120);
        const photo = canvas.toDataURL('image/jpeg', 0.82);
        await fetch(`/api/players/${playerId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photo })
        });
        showToast('Photo updated!', 'success');
        await loadLeaderboard();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

async function removePlayer(id, name) {
  if (!confirm(`Remove ${name} and all their teams?`)) return;
  await fetch(`/api/players/${id}`, { method: 'DELETE' });
  showToast(`${name} removed`, 'success');
  await loadAll();
}

// ─── Team Assignment ──────────────────────────────────────────────────────────

function handleTeamClick(teamCode) {
  const team = teamsData.find(t => t.code === teamCode);
  if (team?.claimed_by_id) {
    openUnassign(team.claimed_by_id, teamCode, team.name);
  } else {
    openAssign(teamCode);
  }
}

function openAssign(teamCode) {
  const team = teamsData.find(t => t.code === teamCode);
  pendingAssignTeamCode = teamCode;
  document.getElementById('assignModalTitle').textContent = `Assign ${team?.flag || ''} ${team?.name || teamCode}`;
  document.getElementById('assignModalSub').textContent = 'Choose a player to assign this team to:';
  const select = document.getElementById('assignPlayerSelect');
  if (!leaderboardData.length) { showToast('Add a player first', 'error'); return; }
  select.innerHTML = leaderboardData.map(p => `<option value="${p.id}">${escHtml(p.name)}</option>`).join('');
  openModal('assignModal');
}

function openAssignForPlayer(playerId) {
  const availableTeams = teamsData.filter(t => !t.claimed_by);
  if (!availableTeams.length) { showToast('No teams available', 'error'); return; }
  const player = leaderboardData.find(p => p.id === playerId);
  document.getElementById('assignModalTitle').textContent = `Add Team for ${player?.name || ''}`;
  document.getElementById('assignModalSub').textContent = 'Choose an available team:';
  const select = document.getElementById('assignPlayerSelect');
  select.innerHTML = availableTeams.map(t => `<option value="${t.code}">${t.flag} ${escHtml(t.name)}</option>`).join('');
  pendingAssignTeamCode = '__by_player__';
  select.dataset.playerId = playerId;
  openModal('assignModal');
}

async function submitAssign() {
  const select = document.getElementById('assignPlayerSelect');
  let playerId, teamCode;
  if (pendingAssignTeamCode === '__by_player__') {
    playerId = select.dataset.playerId;
    teamCode = select.value;
  } else {
    teamCode = pendingAssignTeamCode;
    playerId = select.value;
  }
  const res = await fetch(`/api/players/${playerId}/teams`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teamCode })
  });
  const data = await res.json();
  if (!res.ok) { showToast(data.error, 'error'); return; }
  const team = teamsData.find(t => t.code === teamCode);
  const player = leaderboardData.find(p => p.id === parseInt(playerId));
  closeModal('assignModal');
  showToast(`${team?.flag} ${team?.name} → ${player?.name}`, 'success');
  await loadAll();
}

function openUnassign(playerId, teamCode, teamName) {
  const player = leaderboardData.find(p => p.id === playerId);
  const team = teamsData.find(t => t.code === teamCode);
  pendingUnassign = { playerId, teamCode, teamName };
  document.getElementById('unassignTitle').textContent = `Remove ${team?.flag || ''} ${teamName}?`;
  document.getElementById('unassignSub').textContent = `Remove ${teamName} from ${player?.name || 'this player'}?`;
  openModal('unassignModal');
}

async function submitUnassign() {
  if (!pendingUnassign) return;
  const { playerId, teamCode, teamName } = pendingUnassign;
  await fetch(`/api/players/${playerId}/teams/${teamCode}`, { method: 'DELETE' });
  closeModal('unassignModal');
  showToast(`${teamName} unassigned`, 'success');
  pendingUnassign = null;
  await loadAll();
}

// ─── Settings ─────────────────────────────────────────────────────────────────

function openSettings() {
  const s = settingsData;
  document.getElementById('s_r16_bonus').value = s.pts_groups    ?? 5;
  document.getElementById('s_r16').value       = s.pts_r16       ?? 10;
  document.getElementById('s_qf').value        = s.pts_qf        ?? 10;
  document.getElementById('s_sf').value        = s.pts_sf        ?? 10;
  document.getElementById('s_runner_up').value = s.pts_runner_up ?? 10;
  document.getElementById('s_champion').value  = s.pts_champion  ?? 10;
  updateSettingsPreview();

  ['s_r16_bonus','s_r16','s_qf','s_sf','s_runner_up','s_champion'].forEach(id => {
    document.getElementById(id).oninput = updateSettingsPreview;
  });

  openModal('settingsModal');
}

function updateSettingsPreview() {
  const preview = {
    pts_groups:    parseInt(document.getElementById('s_r16_bonus').value) || 0,
    pts_r16:       parseInt(document.getElementById('s_r16').value)       || 0,
    pts_qf:        parseInt(document.getElementById('s_qf').value)        || 0,
    pts_sf:        parseInt(document.getElementById('s_sf').value)        || 0,
    pts_runner_up: parseInt(document.getElementById('s_runner_up').value) || 0,
    pts_champion:  parseInt(document.getElementById('s_champion').value)  || 0,
  };
  const el = document.getElementById('settingsMaxPts');
  if (el) el.textContent = calcMaxPts(preview) + ' pts';
}

async function saveSettings() {
  const payload = {
    pts_groups:    parseInt(document.getElementById('s_r16_bonus').value) || 0,
    pts_r16:       parseInt(document.getElementById('s_r16').value)       || 0,
    pts_qf:        parseInt(document.getElementById('s_qf').value)        || 0,
    pts_sf:        parseInt(document.getElementById('s_sf').value)        || 0,
    pts_runner_up: parseInt(document.getElementById('s_runner_up').value) || 0,
    pts_champion:  parseInt(document.getElementById('s_champion').value)  || 0,
  };
  const res = await fetch('/api/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) { showToast(data.error || 'Failed to save', 'error'); return; }
  settingsData = data.settings;
  renderScoringTable();
  updateSettingsMaxPts();
  closeModal('settingsModal');
  showToast('Scoring updated!', 'success');
  await loadLeaderboard();
}

// ─── Tab switching ────────────────────────────────────────────────────────────

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${tab}`));

  // Auto-refresh schedule every 60s while viewing it
  clearInterval(scheduleRefreshTimer);
  if (tab === 'schedule') {
    loadMatches();
    scheduleRefreshTimer = setInterval(loadMatches, 60_000);
  }
}

// ─── Schedule ─────────────────────────────────────────────────────────────────

function renderMatches() {
  const el = document.getElementById('matchesList');
  if (!el || !matchesData.length) return;

  const liveStatuses = ['IN_PLAY', 'PAUSED', 'HALFTIME'];

  let filtered = [...matchesData];
  if (matchFilter === 'live') {
    filtered = filtered.filter(m => liveStatuses.includes(m.status));
    if (!filtered.length) {
      el.innerHTML = `<div class="empty-state"><div class="big-icon">⏸</div><p>No live matches right now</p></div>`;
      return;
    }
  } else if (matchFilter === 'upcoming') {
    filtered = filtered.filter(m => ['SCHEDULED','TIMED'].includes(m.status));
  } else if (matchFilter === 'finished') {
    filtered = filtered.filter(m => m.status === 'FINISHED').reverse();
  }

  if (!filtered.length) {
    el.innerHTML = `<div class="empty-state"><p>No ${matchFilter} matches</p></div>`;
    return;
  }

  // Group by local date
  const byDate = new Map();
  for (const m of filtered) {
    const key = new Date(m.utcDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(m);
  }

  el.innerHTML = [...byDate.entries()].map(([date, matches]) => `
    <div class="match-day">
      <div class="match-day-header">${date}</div>
      ${matches.map(renderMatchRow).join('')}
    </div>`).join('');
}

function renderMatchRow(m) {
  const home = m.homeTeam;
  const away = m.awayTeam;
  const homeTeam = teamsData.find(t => t.code === home?.tla) || {};
  const awayTeam = teamsData.find(t => t.code === away?.tla) || {};

  const isFinished = m.status === 'FINISHED';
  const isLive = ['IN_PLAY','PAUSED','HALFTIME'].includes(m.status);
  const localTime = new Date(m.utcDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  const stageLabel = (m.group || m.stage || '')
    .replace(/_/g, ' ')
    .replace(/GROUP /i, 'Group ')
    .replace(/ROUND OF /i, 'Round of ')
    .replace(/QUARTER FINALS/i, 'Quarterfinals')
    .replace(/SEMI FINALS/i, 'Semifinals');

  const timeDisplay = isFinished
    ? `<span class="match-score-val">${m.score?.fullTime?.home ?? '?'} – ${m.score?.fullTime?.away ?? '?'}</span>`
    : isLive
    ? `<span class="match-time live">🔴 LIVE</span>`
    : `<span class="match-time">${localTime}</span>`;

  const homeOwner = home?.tla ? leaderboardData.find(p => p.teams.some(t => t.code === home.tla)) : null;
  const awayOwner = away?.tla ? leaderboardData.find(p => p.teams.some(t => t.code === away.tla)) : null;

  return `
    <div class="match-card ${isLive ? 'match-live' : ''}">
      <div class="match-meta">
        ${timeDisplay}
        <span class="match-meta-dot">•</span>
        <span class="match-stage">${stageLabel}</span>
      </div>
      <div class="match-teams">
        <div class="match-team-left">
          <span class="match-flag">${homeTeam.flag || '🏳'}</span>
          <div>
            <div class="match-name">${home?.name || '?'}</div>
            ${homeOwner ? `<span class="match-owner">${escHtml(homeOwner.name)}</span>` : ''}
          </div>
        </div>
        <div class="match-vs">vs</div>
        <div class="match-team-right">
          <div style="text-align:right">
            <div class="match-name">${away?.name || '?'}</div>
            ${awayOwner ? `<span class="match-owner">${escHtml(awayOwner.name)}</span>` : ''}
          </div>
          <span class="match-flag">${awayTeam.flag || '🏳'}</span>
        </div>
      </div>
    </div>`;
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

async function triggerSync() {
  closeModal('menuModal');
  await new Promise(r => setTimeout(r, 220));
  showToast('Syncing scores…', '');
  try {
    const res = await fetch('/api/sync', { method: 'POST' });
    const data = await res.json();
    if (res.ok) { showToast('Scores synced!', 'success'); await loadAll(); }
    else showToast(data.error || 'Sync failed', 'error');
  } catch { showToast('Sync failed', 'error'); }
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function openRules() { openModal('rulesModal'); }
function openMenu() { openModal('menuModal'); }
// Close menu then open next modal after animation finishes
function menuAction(fn) { closeModal('menuModal'); setTimeout(fn, 220); }

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  if (e.key === 'Enter' && document.getElementById('addPlayerModal').classList.contains('open')) submitAddPlayer();
});

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });
});

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => applyFilter(btn.dataset.filter));
});

document.querySelectorAll('.match-filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    matchFilter = btn.dataset.mfilter;
    document.querySelectorAll('.match-filter-btn').forEach(b => b.classList.toggle('active', b === btn));
    renderMatches();
  });
});

document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ─── Toast ────────────────────────────────────────────────────────────────────

let toastTimer;
function showToast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Auto-refresh every 60 seconds
setInterval(loadAll, 60_000);

// Boot
loadAll();
