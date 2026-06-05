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
let draftState = null;
let draftTimerInterval = null;
let tradeDeadlineInterval = null;
let draftDirection = 'reverse'; // 'forward' or 'reverse'
let tradesData = [];
const DRAFT_ROUNDS = 8;

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
  await Promise.all([loadLeaderboard(), loadTeams(), loadSettings(), loadMatches(), loadActivity(), loadDraft(), loadTrades()]);
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
  renderTradeDeadlineBanner();
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

    const isOnClock = draftState?.active && String(draftState.current_player_id) === String(player.id);
    const draftClass = isOnClock ? 'on-the-clock' : (draftState?.active ? 'draft-waiting' : '');
    const timerStr = isOnClock && draftState.timer_enabled && draftState.time_remaining != null
      ? formatTimer(draftState.time_remaining) : '';

    const avatar = player.photo
      ? `<img src="${player.photo}" class="player-avatar" onclick="updatePlayerPhoto(${player.id})" title="Tap to change photo" />`
      : `<div class="player-avatar player-avatar-placeholder" onclick="updatePlayerPhoto(${player.id})" title="Tap to add photo">${escHtml(player.name[0].toUpperCase())}</div>`;

    const locked = !!settingsData.teams_locked;
    const teamChips = player.teams.map(t => `
      <span class="team-chip stage-${t.stage || ''}"
            ${locked ? '' : `onclick="openUnassign(${player.id}, '${t.code}', '${escHtml(t.name)}')" title="Click to remove ${escHtml(t.name)}"`}
            style="${locked ? 'cursor:default' : ''}">
        ${t.flag} ${escHtml(t.name)}
        ${t.stage ? `<span class="chip-pts">${t.points}pts</span>` : ''}
      </span>`).join('');

    // During draft: only show + Team for current picker; hide when locked
    const showAddTeam = !locked && (!draftState?.active || isOnClock);

    return `
      <div class="player-card ${rankClass} ${draftClass}">
        <div class="player-rank">${rankLabel}</div>
        ${avatar}
        <div class="player-info">
          <div class="player-name">
            ${escHtml(player.name)}
            ${locked ? `<span class="teams-locked-badge">🔒</span>` : ''}
            ${isOnClock ? `<span class="draft-clock-badge">ON THE CLOCK</span>` : ''}
            ${timerStr ? `<span class="draft-live-timer">${timerStr}</span>` : ''}
          </div>
          <div class="player-teams">
            ${teamChips}
            ${showAddTeam ? `<span class="add-team-chip" onclick="openAssignForPlayer(${player.id})">+ Team</span>` : ''}
          </div>
        </div>
        <div>
          <div class="player-points">${player.totalPoints}</div>
          <div class="player-pts-label">pts</div>
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
  closeModal('managePlayersModal');
  showToast(`${name} removed`, 'success');
  await loadAll();
  renderManagePlayers();
}

function openManagePlayers() {
  renderManagePlayers();
  menuAction(() => openModal('managePlayersModal'));
}

function renderManagePlayers() {
  const el = document.getElementById('managePlayersList');
  if (!el) return;
  if (!leaderboardData.length) {
    el.innerHTML = `<p style="color:var(--muted);font-size:14px;padding:12px 0">No players yet.</p>`;
    return;
  }
  el.innerHTML = leaderboardData.map(p => `
    <div class="manage-player-row">
      ${p.photo
        ? `<img src="${p.photo}" class="manage-avatar" />`
        : `<div class="manage-avatar manage-avatar-placeholder">${escHtml(p.name[0].toUpperCase())}</div>`}
      <span class="manage-player-name">${escHtml(p.name)}</span>
      <button class="btn btn-danger manage-delete-btn" onclick="removePlayer(${p.id}, '${escHtml(p.name)}')">Remove</button>
    </div>`).join('');
}

// ─── Team Assignment ──────────────────────────────────────────────────────────

function handleTeamClick(teamCode) {
  const team = teamsData.find(t => t.code === teamCode);
  if (team?.claimed_by_id) {
    openUnassign(team.claimed_by_id, teamCode, team.name);
    return;
  }
  if (draftState?.active) {
    assignDraftPick(teamCode);
    return;
  }
  openAssign(teamCode);
}

function openAssign(teamCode) {
  if (settingsData.teams_locked) { showToast('Team changes are locked', 'error'); return; }
  // Always re-fetch draft state before deciding — avoids stale cached state
  fetch('/api/draft').then(r => r.json()).then(fresh => {
    draftState = fresh;
    if (fresh?.active) {
      assignDraftPick(teamCode);
      return;
    }
    const team = teamsData.find(t => t.code === teamCode);
    pendingAssignTeamCode = teamCode;
    document.getElementById('assignModalTitle').textContent = `Assign ${team?.flag || ''} ${team?.name || teamCode}`;
    document.getElementById('assignModalSub').textContent = 'Choose a player to assign this team to:';
    const select = document.getElementById('assignPlayerSelect');
    if (!leaderboardData.length) { showToast('Add a player first', 'error'); return; }
    select.innerHTML = leaderboardData.map(p => `<option value="${p.id}">${escHtml(p.name)}</option>`).join('');
    openModal('assignModal');
  }).catch(() => {
    // Fallback to normal modal if fetch fails
    const team = teamsData.find(t => t.code === teamCode);
    pendingAssignTeamCode = teamCode;
    document.getElementById('assignModalTitle').textContent = `Assign ${team?.flag || ''} ${team?.name || teamCode}`;
    document.getElementById('assignModalSub').textContent = 'Choose a player to assign this team to:';
    const select = document.getElementById('assignPlayerSelect');
    if (!leaderboardData.length) { showToast('Add a player first', 'error'); return; }
    select.innerHTML = leaderboardData.map(p => `<option value="${p.id}">${escHtml(p.name)}</option>`).join('');
    openModal('assignModal');
  });
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

  // Advance draft if active and this was the current drafter's pick
  if (draftState?.active && String(draftState.current_player_id) === String(playerId)) {
    try {
      const advRes = await fetch('/api/draft/advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'pick' }),
      });
      const advData = await advRes.json();
      if (!advRes.ok) showToast(advData.error || 'Draft advance failed', 'error');
      else if (advData.complete) showToast('🏆 Draft complete!', 'success');
    } catch (e) { showToast('Draft advance error', 'error'); }
  }

  await loadDraft();
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
  if (settingsData.teams_locked) { showToast('Team changes are locked', 'error'); closeModal('unassignModal'); return; }
  const { playerId, teamCode, teamName } = pendingUnassign;
  await fetch(`/api/players/${playerId}/teams/${teamCode}`, { method: 'DELETE' });
  closeModal('unassignModal');
  showToast(`${teamName} unassigned`, 'success');
  pendingUnassign = null;
  await loadAll();
}

// ─── Trade Deadline ───────────────────────────────────────────────────────────

function renderTradeDeadlineBanner() {
  clearInterval(tradeDeadlineInterval);
  const banner = document.getElementById('tradeDeadlineBanner');
  if (!banner) return;
  const market = document.getElementById('tradeMarket');
  const deadline = settingsData.trade_deadline;
  if (!settingsData.trade_deadline_active) {
    banner.style.display = 'none';
    if (market) market.style.display = 'none';
    return;
  }

  if (deadline) banner.style.display = '';
  if (market) market.style.display = '';
  renderTrades();
  const timerEl = document.getElementById('tradeDeadlineTimer');

  function tick() {
    const ms = deadline - Date.now();
    if (ms <= 0) {
      timerEl.textContent = 'CLOSED';
      clearInterval(tradeDeadlineInterval);
      return;
    }
    const totalSecs = Math.floor(ms / 1000);
    const d = Math.floor(totalSecs / 86400);
    const h = Math.floor((totalSecs % 86400) / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    const pad = n => String(n).padStart(2, '0');
    timerEl.textContent = d > 0
      ? `${d}d ${pad(h)}h ${pad(m)}m ${pad(s)}s`
      : `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  tick();
  tradeDeadlineInterval = setInterval(tick, 1000);
}

// ─── Settings ─────────────────────────────────────────────────────────────────

function openMenuAuth() {
  if (localStorage.getItem('adminAuth') === '1') { openMenu(); return; }
  document.getElementById('settingsPasswordInput').value = '';
  document.getElementById('settingsAuthError').style.display = 'none';
  openModal('settingsAuthModal');
  setTimeout(() => document.getElementById('settingsPasswordInput').focus(), 50);
}

function submitSettingsPassword() {
  const input = document.getElementById('settingsPasswordInput');
  if (input.value === 'Netherlands121') {
    localStorage.setItem('adminAuth', '1');
    closeModal('settingsAuthModal');
    setTimeout(openMenu, 220);
  } else {
    document.getElementById('settingsAuthError').style.display = '';
    input.value = '';
    input.focus();
  }
}

function adminSignOut() {
  localStorage.removeItem('adminAuth');
  closeModal('menuModal');
  showToast('Signed out on this device', 'success');
}

function openSettings() {
  const s = settingsData;
  document.getElementById('s_r16_bonus').value   = s.pts_groups    ?? 5;
  document.getElementById('s_r16').value         = s.pts_r16       ?? 10;
  document.getElementById('s_qf').value          = s.pts_qf        ?? 10;
  document.getElementById('s_sf').value          = s.pts_sf        ?? 10;
  document.getElementById('s_runner_up').value   = s.pts_runner_up ?? 10;
  document.getElementById('s_champion').value    = s.pts_champion  ?? 10;
  document.getElementById('s_teams_locked').checked = !!s.teams_locked;
  document.getElementById('s_trade_deadline_active').checked = !!s.trade_deadline_active;

  const dlInput = document.getElementById('s_trade_deadline');
  if (s.trade_deadline > 0) {
    const d = new Date(s.trade_deadline);
    const pad = n => String(n).padStart(2, '0');
    dlInput.value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } else {
    dlInput.value = '';
  }

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
    teams_locked:          document.getElementById('s_teams_locked').checked ? 1 : 0,
    trade_deadline:        (() => { const v = document.getElementById('s_trade_deadline').value; return v ? new Date(v).getTime() : 0; })(),
    trade_deadline_active: document.getElementById('s_trade_deadline_active').checked ? 1 : 0,
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
  renderTradeDeadlineBanner();
  closeModal('settingsModal');
  showToast('Settings saved!', 'success');
  await loadLeaderboard();
}

// ─── Draft ────────────────────────────────────────────────────────────────────

async function loadDraft() {
  try {
    const res = await fetch('/api/draft');
    if (!res.ok) return;
    draftState = await res.json();
    renderDraftBanner();
    setupDraftTimer();
  } catch (_) {}
}

function draftPlayerAtPick(order, pickNum) {
  const n = order.length;
  if (!n) return null;
  const round = Math.floor(pickNum / n);
  const pos   = pickNum % n;
  return order[round % 2 === 1 ? (n - 1 - pos) : pos];
}

function formatTimer(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function setupDraftTimer() {
  clearInterval(draftTimerInterval);
  if (!draftState?.active || !draftState?.timer_enabled || !draftState?.pick_started_at) return;

  draftTimerInterval = setInterval(() => {
    const elapsed  = (Date.now() - new Date(draftState.pick_started_at + 'Z').getTime()) / 1000;
    const remaining = Math.max(0, draftState.timer_seconds - elapsed);
    const str = formatTimer(remaining);

    document.querySelectorAll('.draft-live-timer').forEach(el => el.textContent = str);
    const bt = document.getElementById('draftBannerTimer');
    if (bt) bt.textContent = str;

    if (remaining <= 0) {
      clearInterval(draftTimerInterval);
      autoAdvanceDraft();
    }
  }, 1000);
}

function renderDraftBanner() {
  const banner = document.getElementById('draftBanner');
  if (!banner) return;

  if (!draftState?.active) {
    banner.style.display = 'none';
    return;
  }
  banner.style.display = '';

  const order  = draftState.player_order;
  const n      = order.length;
  const pick   = draftState.pick_number;
  const round  = Math.floor(pick / n) + 1;
  const isRev  = Math.floor(pick / n) % 2 === 1;
  const total  = n * DRAFT_ROUNDS;

  document.getElementById('draftBannerRound').textContent = `Round ${round} · ${isRev ? '← Snake' : '→ Forward'} 🐍`;
  document.getElementById('draftBannerPick').textContent  = `Pick ${pick + 1} of ${total}`;
  document.getElementById('draftBannerName').textContent  = draftState.current_player_name || '—';

  const timerEl = document.getElementById('draftBannerTimer');
  timerEl.style.display = draftState.timer_enabled ? '' : 'none';
  if (draftState.timer_enabled && draftState.time_remaining != null) {
    timerEl.textContent = formatTimer(draftState.time_remaining);
  }
}

async function assignDraftPick(teamCode) {
  if (!draftState?.active || !draftState.current_player_id) return;
  const playerId = draftState.current_player_id;
  const team = teamsData.find(t => t.code === teamCode);
  const player = leaderboardData.find(p => p.id === playerId);

  const res = await fetch(`/api/players/${playerId}/teams`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teamCode }),
  });
  const data = await res.json();
  if (!res.ok) { showToast(data.error || 'Pick failed', 'error'); return; }

  // Advance draft
  let advData = {};
  try {
    const advRes = await fetch('/api/draft/advance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'pick' }),
    });
    advData = await advRes.json();
    if (!advRes.ok) showToast(advData.error || 'Draft advance failed', 'error');
  } catch (e) { showToast('Draft advance error', 'error'); }

  if (advData.complete) {
    showToast('🏆 Draft complete! All picks are in.', 'success');
  } else {
    const nextPlayer = leaderboardData.find(p => p.id === advData.current_player_id);
    const nextMsg = advData.same_player
      ? ` · ${player?.name} picks again!`
      : nextPlayer ? ` · Up next: ${nextPlayer.name}` : '';
    showToast(`${team?.flag} ${team?.name} → ${player?.name}!${nextMsg}`, 'success');
  }

  await loadDraft();
  await loadAll();
}

async function autoAdvanceDraft() {
  try {
    const res = await fetch('/api/draft/advance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'timeout' }),
    });
    const data = await res.json();
    if (data.success && !data.skipped) {
      showToast('⏰ Time\'s up — skipped to next picker', '');
      await loadDraft();
      await loadAll();
    } else if (data.skipped) {
      await loadDraft(); // another client already advanced — sync UI
    }
  } catch (_) {}
}

// ── Draft Settings UI ─────────────────────────────────────────────────────────

function setDraftDir(dir) {
  draftDirection = dir;
  document.getElementById('draftDirFwd').classList.toggle('active', dir === 'forward');
  document.getElementById('draftDirRev').classList.toggle('active', dir === 'reverse');
}

function openDraftSettings() {
  const ordered = [...leaderboardData].sort((a, b) => a.id - b.id);

  // Populate player dropdown
  const select = document.getElementById('draftStartPlayer');
  if (select) select.innerHTML = ordered.map(p => `<option value="${p.id}">${escHtml(p.name)}</option>`).join('');

  const n = ordered.length;

  if (draftState?.active && draftState.current_player_id) {
    // Draft running — show current state
    if (select) select.value = draftState.current_player_id;
    const isRev = Math.floor(draftState.pick_number / n) % 2 === 1;
    setDraftDir(isRev ? 'reverse' : 'forward');
  } else {
    // Auto-detect from total picks already made
    const totalPicks = leaderboardData.reduce((sum, p) => sum + (p.teams?.length || 0), 0);
    const autoRound  = Math.floor(totalPicks / n);
    const autoIsRev  = autoRound % 2 === 1;
    const posInRound = totalPicks % n;
    const autoIdx    = autoIsRev ? (n - 1 - posInRound) : posInRound;
    const autoPlayer = ordered[autoIdx];

    if (autoPlayer && select) select.value = autoPlayer.id;
    setDraftDir(autoIsRev ? 'reverse' : 'forward');
  }

  // Timer settings
  const toggle = document.getElementById('draftTimerToggle');
  if (toggle) { toggle.checked = !!draftState?.timer_enabled; updateDraftTimerVisibility(); }
  const secs = draftState?.timer_seconds ?? 18000;
  const h = document.getElementById('draftHours');
  const m = document.getElementById('draftMins');
  if (h) h.value = Math.floor(secs / 3600);
  if (m) m.value = Math.floor((secs % 3600) / 60);

  const stopBtn = document.getElementById('stopDraftBtn');
  if (stopBtn) stopBtn.style.display = draftState?.active ? '' : 'none';

  // Status label with auto-detect info
  if (draftState?.active) {
    document.getElementById('draftStatusLabel').textContent =
      `Draft is ACTIVE — Pick ${(draftState.pick_number || 0) + 1} of ${n * DRAFT_ROUNDS}`;
  } else {
    const totalPicks = leaderboardData.reduce((sum, p) => sum + (p.teams?.length || 0), 0);
    const round = Math.floor(totalPicks / n) + 1;
    document.getElementById('draftStatusLabel').textContent =
      `Auto-detected: Round ${round}, Pick ${totalPicks + 1} of ${n * DRAFT_ROUNDS}. Adjust if needed.`;
  }

  openModal('draftModal');
}

function updateDraftTimerVisibility() {
  const on = document.getElementById('draftTimerToggle')?.checked;
  const fields = document.getElementById('draftTimerFields');
  if (fields) fields.style.display = on ? '' : 'none';
}

async function startDraft() {
  const ordered = [...leaderboardData].sort((a, b) => a.id - b.id);
  const n = ordered.length;
  if (!n) { showToast('Add players first', 'error'); return; }

  const selectedId  = parseInt(document.getElementById('draftStartPlayer')?.value);
  const playerIndex = ordered.findIndex(p => p.id === selectedId);
  if (playerIndex === -1) { showToast('Selected player not found', 'error'); return; }

  // Use total existing picks as the base pick number — auto-detects the round
  const totalPicks  = leaderboardData.reduce((sum, p) => sum + (p.teams?.length || 0), 0);
  const baseRound   = Math.floor(totalPicks / n);
  const baseIsRev   = baseRound % 2 === 1;

  // Find position of selected player within that round's direction
  const posInRound  = baseIsRev ? (n - 1 - playerIndex) : playerIndex;
  const pickNumber  = baseRound * n + posInRound;

  const timerOn   = !!document.getElementById('draftTimerToggle')?.checked;
  const hours     = parseInt(document.getElementById('draftHours')?.value) || 0;
  const mins      = parseInt(document.getElementById('draftMins')?.value) || 0;
  const timerSecs = (hours * 3600) + (mins * 60) || 18000;

  const res = await fetch('/api/draft/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      playerOrder: ordered.map(p => p.id),
      timerEnabled: timerOn,
      timerSeconds: timerSecs,
      pickNumber,
    }),
  });
  const data = await res.json();
  if (!res.ok) { showToast(data.error || 'Failed to start', 'error'); return; }

  closeModal('draftModal');
  showToast('🐍 Draft started!', 'success');
  await loadDraft();
  await loadAll();
}

async function stopDraft() {
  if (!confirm('Stop the draft? Timer and lock will be removed.')) return;
  await fetch('/api/draft/stop', { method: 'POST' });
  closeModal('draftModal');
  showToast('Draft stopped', '');
  await loadDraft();
  await loadAll();
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

  const liveStatuses = ['IN_PLAY', 'PAUSED', 'EXTRA_TIME', 'PENALTY_SHOOTOUT'];

  let filtered = [...matchesData];
  if (matchFilter === 'live') {
    filtered = filtered.filter(m => liveStatuses.includes(m.status));
    if (!filtered.length) {
      el.innerHTML = `<div class="empty-state"><div class="big-icon">⏸</div><p>No live matches right now</p></div>`;
      return;
    }
  } else if (matchFilter === 'upcoming') {
    filtered = filtered.filter(m => ['SCHEDULED', 'TIMED'].includes(m.status));
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

function exportBackup() {
  closeModal('menuModal');
  const a = document.createElement('a');
  a.href = '/api/backup';
  a.download = '';
  a.click();
  showToast('Downloading backup…', 'success');
}
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

// ─── Force refresh all clients ────────────────────────────────────────────────

let localVersion = null;

async function checkVersion() {
  try {
    const res = await fetch('/api/version');
    if (!res.ok) return;
    const { version } = await res.json();
    if (localVersion === null) {
      localVersion = version; // first load — store as baseline
    } else if (version !== localVersion) {
      location.reload(); // server version changed — reload silently
    }
  } catch (_) {}
}

async function forceRefreshAll() {
  closeModal('menuModal');
  try {
    const res = await fetch('/api/version', { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      localVersion = data.version; // don't reload yourself
      showToast('All devices will refresh within 30 seconds', 'success');
    }
  } catch (_) { showToast('Failed to send refresh', 'error'); }
}

// Poll for forced refresh every 30 seconds
setInterval(checkVersion, 30_000);

// Boot
checkVersion(); // establish baseline version on load
loadAll();

// ─── Trade Market ─────────────────────────────────────────────────────────────

async function loadTrades() {
  try {
    const res = await fetch('/api/trades');
    tradesData = res.ok ? await res.json() : [];
  } catch (_) {
    tradesData = [];
  }
  renderTrades();
}

function getTeamDisplay(code) {
  const team = teamsData.find(t => t.code === code);
  return team ? `${team.flag} ${escHtml(team.name)}` : escHtml(code);
}

function renderTrades() {
  const el = document.getElementById('tradeList');
  if (!el) return;
  const isAdmin = localStorage.getItem('adminAuth') === '1';

  if (!tradesData.length) {
    el.innerHTML = '<p class="trade-empty">No active trades. Be the first to propose one!</p>';
    return;
  }

  el.innerHTML = tradesData.map(t => {
    const offerDisplay = t.offer_teams.map(getTeamDisplay).join(', ');
    const requestDisplay = t.request_teams.map(getTeamDisplay).join(', ');
    const r = t.receiver_response;
    const responseBadge = r === 'accepted'
      ? `<span class="trade-response-badge accepted">✓ ${escHtml(t.receiver_name)} accepted</span>`
      : r === 'declined'
      ? `<span class="trade-response-badge declined">✗ ${escHtml(t.receiver_name)} declined</span>`
      : `<span class="trade-response-badge waiting">⏳ Waiting for ${escHtml(t.receiver_name)}</span>`;
    const respondBtns = !r
      ? `<button class="btn btn-ghost" onclick="respondTrade(${t.id},'declined')" style="font-size:12px;padding:4px 10px">✗ Decline</button>
         <button class="btn btn-primary" onclick="respondTrade(${t.id},'accepted')" style="font-size:12px;padding:4px 10px">✓ Accept</button>`
      : `<button class="btn btn-ghost" onclick="respondTrade(${t.id}, '${r === 'accepted' ? 'declined' : 'accepted'}')" style="font-size:12px;padding:4px 10px;opacity:0.6">Change mind</button>`;
    return `
      <div class="trade-card">
        <div class="trade-card-header">
          <div class="trade-players">${escHtml(t.proposer_name)} → ${escHtml(t.receiver_name)}</div>
          <span class="trade-status-badge pending">Pending</span>
        </div>
        <div class="trade-sides">
          <div class="trade-side">
            <div class="trade-side-label">Offering</div>
            <div class="trade-teams">${offerDisplay}</div>
          </div>
          <div class="trade-arrow">⇄</div>
          <div class="trade-side">
            <div class="trade-side-label">For</div>
            <div class="trade-teams">${requestDisplay}</div>
          </div>
        </div>
        <div class="trade-response-row">
          ${responseBadge}
          <div class="trade-respond-btns">${respondBtns}</div>
        </div>
        <div class="trade-card-actions">
          <button class="btn btn-ghost" onclick="cancelTrade(${t.id})" style="font-size:12px;padding:4px 12px">Withdraw</button>
          ${isAdmin ? `
          <button class="btn btn-danger" onclick="rejectTrade(${t.id})" style="font-size:12px;padding:4px 12px">Reject</button>
          <button class="btn btn-primary" onclick="approveTrade(${t.id})" style="font-size:12px;padding:4px 12px">Approve ✓</button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function openProposeTradeModal() {
  if (!leaderboardData.length) { showToast('No players found', 'error'); return; }
  const proposerSel = document.getElementById('tradeProposer');
  const receiverSel = document.getElementById('tradeReceiver');
  const allOpts = leaderboardData.map(p => `<option value="${p.id}">${escHtml(p.name)}</option>`).join('');
  proposerSel.innerHTML = '<option value="">— Who are you? —</option>' + allOpts;
  receiverSel.innerHTML = '<option value="">— Other player —</option>' + allOpts;
  document.getElementById('tradeOfferChips').innerHTML = '<span class="trade-chip-hint">Select your name above</span>';
  document.getElementById('tradeRequestChips').innerHTML = '<span class="trade-chip-hint">Select a player above</span>';
  openModal('proposeTradeModal');
}

function onProposerChange() {
  const proposerId = parseInt(document.getElementById('tradeProposer').value);
  const container = document.getElementById('tradeOfferChips');
  if (!proposerId) { container.innerHTML = '<span class="trade-chip-hint">Select your name above</span>'; return; }

  // Update receiver options to exclude self
  const receiverSel = document.getElementById('tradeReceiver');
  const prevReceiverId = receiverSel.value;
  receiverSel.innerHTML = '<option value="">— Other player —</option>' +
    leaderboardData.filter(p => p.id !== proposerId)
      .map(p => `<option value="${p.id}">${escHtml(p.name)}</option>`).join('');
  if (prevReceiverId && parseInt(prevReceiverId) !== proposerId) receiverSel.value = prevReceiverId;

  const player = leaderboardData.find(p => p.id === proposerId);
  if (!player?.teams.length) { container.innerHTML = '<span class="trade-chip-hint">This player has no teams</span>'; return; }
  container.innerHTML = player.teams.map(t =>
    `<span class="trade-select-chip" data-code="${t.code}" onclick="toggleTradeChip(this)">${t.flag} ${escHtml(t.name)}</span>`
  ).join('');
}

function onReceiverChange() {
  const receiverId = parseInt(document.getElementById('tradeReceiver').value);
  const container = document.getElementById('tradeRequestChips');
  if (!receiverId) { container.innerHTML = '<span class="trade-chip-hint">Select a player above</span>'; return; }
  const player = leaderboardData.find(p => p.id === receiverId);
  if (!player?.teams.length) { container.innerHTML = '<span class="trade-chip-hint">This player has no teams</span>'; return; }
  container.innerHTML = player.teams.map(t =>
    `<span class="trade-select-chip" data-code="${t.code}" onclick="toggleTradeChip(this)">${t.flag} ${escHtml(t.name)}</span>`
  ).join('');
}

function toggleTradeChip(el) { el.classList.toggle('selected'); }

async function submitTrade() {
  const proposerId = parseInt(document.getElementById('tradeProposer').value);
  const receiverId = parseInt(document.getElementById('tradeReceiver').value);
  const offerTeams = [...document.querySelectorAll('#tradeOfferChips .trade-select-chip.selected')].map(el => el.dataset.code);
  const requestTeams = [...document.querySelectorAll('#tradeRequestChips .trade-select-chip.selected')].map(el => el.dataset.code);

  if (!proposerId || !receiverId) { showToast('Select both players', 'error'); return; }
  if (!offerTeams.length) { showToast('Select at least one team to offer', 'error'); return; }
  if (!requestTeams.length) { showToast('Select at least one team to request', 'error'); return; }

  const res = await fetch('/api/trades', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ proposer_id: proposerId, receiver_id: receiverId, offer_teams: offerTeams, request_teams: requestTeams }),
  });
  const data = await res.json();
  if (!res.ok) { showToast(data.error || 'Failed to propose trade', 'error'); return; }
  closeModal('proposeTradeModal');
  showToast('Trade proposed!', 'success');
  await loadTrades();
}

async function respondTrade(id, response) {
  const res = await fetch(`/api/trades/${id}/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ response }),
  });
  const d = await res.json();
  if (!res.ok) { showToast(d.error || 'Failed', 'error'); return; }
  showToast(response === 'accepted' ? 'Trade accepted!' : 'Trade declined', response === 'accepted' ? 'success' : '');
  await loadTrades();
}

async function cancelTrade(id) {
  const res = await fetch(`/api/trades/${id}`, { method: 'DELETE' });
  const d = await res.json();
  if (!res.ok) { showToast(d.error || 'Failed to withdraw trade', 'error'); return; }
  showToast('Trade withdrawn', 'success');
  await loadTrades();
}

async function approveTrade(id) {
  const res = await fetch(`/api/trades/${id}/approve`, { method: 'POST' });
  const d = await res.json();
  if (!res.ok) { showToast(d.error || 'Failed to approve trade', 'error'); return; }
  showToast('Trade approved! Teams swapped.', 'success');
  await loadAll();
}

async function rejectTrade(id) {
  const res = await fetch(`/api/trades/${id}/reject`, { method: 'POST' });
  const d = await res.json();
  if (!res.ok) { showToast(d.error || 'Failed to reject trade', 'error'); return; }
  showToast('Trade rejected', 'success');
  await loadTrades();
}
