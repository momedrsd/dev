/**
 * COMPÉTITION NATIONALE DE RÉCITATION DU CORAN — Édition 9
 * Client Application — Version 3.0
 * Corrections: sync temps réel, timer stop, classements séparés F/G, finale
 */

const App = {
  token: localStorage.getItem('auth_token'),
  user: null,
  socket: null,
  competition: null,
  participants: [],
  serverTimeOffset: 0, // décalage en ms entre l'horloge du client et du serveur
  scores: [],
  finalScores: [],
  criteria: [],
  scoreUnlocked: false,
  timerInterval: null,
  _currentPage: 1,
  _rankings: { selection: { male:[], female:[], all:[] }, final: { male:[], female:[], all:[] } },
  _judgesLockStatus: {},

  // ── Boot ──────────────────────────────────────────────────────────────────
  async init() {
    // Charger les infos publiques de la compétition avant login
    try {
      const pub = await fetch('/api/competition-public').then(r => r.ok ? r.json() : null);
      if (pub) this._publicComp = pub;
    } catch {}
    if (!this.token) return this.showLogin();
    try {
      this.user = await this.api('GET', '/api/me');
      await this.loadData();
      this.connectSocket();
      this.renderApp();
    } catch { this.showLogin(); }
  },

  // ── API ───────────────────────────────────────────────────────────────────
  async api(method, url, body) {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-auth-token': this.token || '' },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur serveur');
    return data;
  },

  async loadData() {
    [this.competition, this.participants, this.scores, this.criteria, this.finalScores] = await Promise.all([
      this.api('GET', '/api/competition'),
      this.api('GET', '/api/participants'),
      this.api('GET', '/api/scores'),
      this.api('GET', '/api/criteria'),
      this.api('GET', '/api/final-scores').catch(() => [])
    ]);
    try {
      const r = await this.api('GET', '/api/rankings');
      this._rankings = r;
    } catch {}
  },

  // ── Socket ────────────────────────────────────────────────────────────────
  // Synchronise l'horloge client avec le serveur (mesure latence + offset)
  syncServerTime() {
    const t0 = Date.now();
    this.socket.emit('time_sync', t0);
    this.socket.once('time_sync_response', ({ clientTime, serverTime }) => {
      const t1 = Date.now();
      const latency = (t1 - clientTime) / 2;
      this.serverTimeOffset = serverTime - t1 + latency;
      console.log(`[TimeSync] offset=${this.serverTimeOffset}ms latency=${latency}ms`);
    });
  },

  // Retourne Date.now() corrigé avec l'offset serveur
  now() { return Date.now() + this.serverTimeOffset; },

  connectSocket() {
    if (this.socket) this.socket.disconnect();
    this.socket = io({ transports: ['websocket'], upgrade: false });

    this.socket.on('connect', () => {
      this.socket.emit('authenticate', this.token);
      this.syncServerTime();
      if (this._timeSyncInterval) clearInterval(this._timeSyncInterval);
      this._timeSyncInterval = setInterval(() => this.syncServerTime(), 30000);
    });
    this.socket.on('connect_error', () => setTimeout(() => this.socket.connect(), 2000));
    this.socket.on('authenticated', (u) => { this.user = { ...this.user, ...u }; });

    this.socket.on('competition_updated', (comp) => {
      this.competition = comp;
      this.onCompetitionUpdate(comp);
    });

    this.socket.on('participants_updated', (list) => {
      this.participants = list;
      this.onParticipantsUpdate();
    });

    this.socket.on('scores_updated', (list) => {
      this.scores = list;
      this.onScoresUpdate();
    });

    this.socket.on('final_scores_updated', (list) => {
      this.finalScores = list;
      this.onScoresUpdate();
    });

    this.socket.on('rankings_updated', (r) => {
      this._rankings = r;
      this.onRankingsUpdate();
    });

    this.socket.on('criteria_updated', (c) => {
      this.criteria = c;
      this.onCriteriaUpdate();
    });

    this.socket.on('page_changed', (data) => {
      this._currentPage = data.page;
      this.renderFlipbookPage(data.page);
    });

    this.socket.on('timer_update', (data) => this.onTimerUpdate(data));

    this.socket.on('participant_changed', () => {
      // Juges: rafraîchir panel notation automatiquement
      const el = document.getElementById('scoring-card');
      if (el) el.innerHTML = '<div class="card-title" style="margin-bottom:4px;">✏️ Notation</div>' + this.renderScoringPanel();
    });

    this.socket.on('score_lock_status', (data) => {
      this.scoreUnlocked = !!data.unlocked;
      this.updateScoreLockUI();
      if (data.unlocked) this.showToast('✅ Le Président vous autorise à modifier votre note', 'success');
      else this.showToast('🔒 Note verrouillée', 'info');
    });

    this.socket.on('unlock_request', (data) => this.showUnlockRequest(data));
    this.socket.on('unlock_request_sent', () => this.showToast('📤 Demande envoyée au Président', 'info'));

    this.socket.on('score_unlock_confirmed', (data) => {
      this.showToast((data.unlocked ? '🔓 ' : '🔒 ') + data.judgeName + ': ' + (data.unlocked ? 'peut modifier' : 'verrouillé'), 'info');
      this._judgesLockStatus[data.judgeId] = { name: data.judgeName, unlocked: data.unlocked };
      this.refreshUnlockPanel();
    });

    this.socket.on('results_revealed', () => this.showToast('🏆 Résultats dévoilés au public!', 'success'));
    this.socket.on('emergency', (data) => this.showToast('🚨 ' + data.message, 'error'));
    this.socket.on('broadcast_message', (data) => this.showToast('📢 ' + data.from + ': ' + data.message, 'info'));
    this.socket.on('auth_error', () => this.logout());
  },

  // ── Auth ──────────────────────────────────────────────────────────────────
  showLogin() {
    const comp = this._publicComp || this.competition || {};
    const titre = comp.title || 'المسابقة الوطنية لتلاوة القرآن الكريم';
    const edition = comp.edition || 9;
    const lieu = comp.lieu || '';
    const fmtDate = (d) => {
      if (!d) return '';
      const dt = new Date(d);
      const mois = ['يناير','فبراير','مارس','أبريل','ماي','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
      return dt.getDate() + ' ' + mois[dt.getMonth()] + ' ' + dt.getFullYear();
    };
    const dateStr = comp.date_debut || comp.date_fin
      ? (fmtDate(comp.date_debut) + (comp.date_fin ? ' — ' + fmtDate(comp.date_fin) : ''))
      : '';
    document.getElementById('app').innerHTML = `
    <div class="login-page">
      <div class="login-card">
        <div class="login-logo">
          <span class="emblem">☪</span>
          <h1 style="font-size:clamp(1rem,3vw,1.4rem);">${titre}</h1>
          ${lieu ? '<p style="font-size:0.85rem;">📍 '+lieu+'</p>' : ''}
          ${dateStr ? '<p style="font-size:0.8rem;color:var(--text-muted);">'+dateStr+'</p>' : ''}
          <span class="edition-badge">ÉDITION ${edition}</span>
        </div>
        <div class="ornament">﷽</div>
        <div id="login-form">
          <div class="form-group">
            <label>Nom d'utilisateur</label>
            <input type="text" class="form-control" id="username" placeholder="Identifiant" autocomplete="username">
          </div>
          <div class="form-group">
            <label>Mot de passe</label>
            <input type="password" class="form-control" id="password" placeholder="••••••••">
          </div>
          <div id="login-error" style="color:#E74C3C;font-size:0.85rem;margin-bottom:12px;display:none;text-align:center;"></div>
          <button class="btn btn-primary" id="login-btn" onclick="App.doLogin()">🔐 Se connecter</button>
        </div>
        <p style="text-align:center;color:var(--text-muted);font-size:0.75rem;margin-top:20px;">Warsh • Hafs — رواية ورش وحفص</p>
      </div>
    </div>`;
    document.getElementById('password').addEventListener('keydown', e => { if(e.key==='Enter') App.doLogin(); });
  },

  async doLogin() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const btn = document.getElementById('login-btn');
    const err = document.getElementById('login-error');
    btn.disabled = true; btn.textContent = '⏳ Connexion...'; err.style.display = 'none';
    try {
      const data = await this.api('POST', '/api/login', { username, password });
      this.token = data.token; this.user = data;
      localStorage.setItem('auth_token', data.token);
      await this.loadData();
      this.connectSocket();
      this.renderApp();
    } catch(e) {
      err.textContent = e.message; err.style.display = 'block';
      btn.disabled = false; btn.textContent = '🔐 Se connecter';
    }
  },

  async logout() {
    try { await this.api('POST', '/api/logout'); } catch {}
    localStorage.removeItem('auth_token');
    this.token = null; this.user = null;
    if (this.socket) this.socket.disconnect();
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.showLogin();
  },

  // ── App Shell ─────────────────────────────────────────────────────────────
  renderApp() {
    const role = this.user.role;
    if (role === 'public' || role === 'participant') { this.renderParticipantPublicScreen(); return; }

    const isJudge = role === 'judge';
    const nav = this.getNav(role);
    document.getElementById('app').innerHTML = `
    <div class="app-container">
      <header class="app-header">
        <div class="logo">
          <span class="logo-icon">☪</span>
          <div class="logo-text">
            <h2>${this.competition?.title||'المسابقة الوطنية لتلاوة القرآن'}</h2>
            <p>Édition ${this.competition?.edition||9}${this.competition?.lieu?' — '+this.competition.lieu:' — Warsh & Hafs'}</p>
          </div>
        </div>
        <div class="header-right">
          <div class="live-badge"><span class="dot"></span>EN DIRECT</div>
          ${role === 'judge' ? '<div id="lock-badge" class="badge badge-hafs">🔒 Note verrouillée</div>' : ''}
          <div class="user-badge">
            <span class="role-tag role-${role}">${this.getRoleLabel(role)}</span>
            <span>${this.user.name}</span>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="App.logout()">🚪</button>
        </div>
      </header>
      <div class="app-body">
        ${isJudge ? '' : `
        <nav class="sidebar">
          <div class="sidebar-nav" id="sidebar-nav">
            ${nav.map(n => `<div class="nav-item ${n.default?'active':''}" data-page="${n.id}" onclick="App.navigate('${n.id}')">
              <span class="icon">${n.icon}</span><span>${n.label}</span>
            </div>`).join('')}
          </div>
        </nav>`}
        <main class="main-content" id="main-content"></main>
      </div>
    </div>
    <div class="toast-container" id="toast-container"></div>
    <div id="modal-root"></div>`;

    this.navigate('dashboard');
  },

  getNav(role) {
    const all = [
      { id: 'dashboard',      icon: '📊', label: 'Tableau de bord',    roles: ['admin','president','judge'], default: true },
      { id: 'participants',   icon: '👥', label: 'Participants',        roles: ['admin','president'] },
      { id: 'rankings',       icon: '🏆', label: 'Classement',         roles: ['admin','president'] },
      { id: 'finale',         icon: '🌟', label: 'Finale',             roles: ['admin','president'] },
      { id: 'comp-settings',   icon: '🏆', label: 'Compétition',        roles: ['admin'] },
      { id: 'users',          icon: '⚙️', label: 'Comptes',            roles: ['admin'] },
      { id: 'criteria',       icon: '📋', label: 'Grille de notation', roles: ['admin'] },
      { id: 'timer-settings', icon: '⏱️', label: 'Paramètres Timer',   roles: ['admin'] },
      { id: 'emergency',      icon: '🚨', label: 'Urgences',           roles: ['admin'] },
    ];
    return all.filter(n => n.roles.includes(role));
  },

  navigate(pageId) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.page === pageId));
    const mc = document.getElementById('main-content');
    if (!mc) return;
    switch(pageId) {
      case 'dashboard':      mc.innerHTML = this.pageDashboard();     this.initDashboard();     break;
      case 'participants':   mc.innerHTML = this.pageParticipants();  this.initParticipants();  break;
      case 'rankings':       mc.innerHTML = this.pageRankings();                                break;
      case 'finale':         mc.innerHTML = this.pageFinale();                                  break;
      case 'comp-settings':   mc.innerHTML = this.pageCompSettings();  this.initCompSettings();  break;
      case 'users':          mc.innerHTML = this.pageUsers();         this.initUsers();         break;
      case 'criteria':       mc.innerHTML = this.pageCriteria();      this.initCriteria();      break;
      case 'timer-settings': mc.innerHTML = this.pageTimerSettings(); this.initTimerSettings(); break;
      case 'emergency':      mc.innerHTML = this.pageEmergency();                               break;
      default: mc.innerHTML = '';
    }
  },

  // ── DASHBOARD ─────────────────────────────────────────────────────────────
  pageDashboard() {
    const role = this.user.role;
    const comp = this.competition || {};
    const currentP = this.participants.find(p => p.id === comp.currentParticipantId);
    const isJudge = role === 'judge';
    const isPresident = ['president','admin'].includes(role);


    // ── Layout JUGE ──────────────────────────────────────────────────────────
    if (isJudge) return `
    <div style="display:grid;grid-template-columns:340px 1fr;gap:16px;overflow-y:auto;">

      <!-- GAUCHE : Nom + Chrono + Notes + Dernières notes -->
      <div>
        <div class="card" style="padding:12px;">
          <div style="font-family:'Amiri',serif;font-size:1.4rem;color:var(--gold);text-align:center;" id="db-participant-name">
            ${currentP ? currentP.name : '— En attente —'}
          </div>
          <div style="color:var(--text-muted);font-size:0.78rem;text-align:center;margin-top:2px;" id="db-participant-info">
            ${currentP ? 'N°'+currentP.number+' • '+currentP.reading+' • '+(currentP.gender==='male'?'👨 Masculin':'👩 Féminin') : ''}
          </div>
          <div style="text-align:center;margin-top:8px;padding-top:8px;border-top:1px solid rgba(201,168,76,0.2);">
            <div class="timer-display" id="db-timer" style="font-size:2.4rem;line-height:1;">${this.formatTime(comp.timerDuration||300)}</div>
            ${comp.participantHasHand?'<div class="live-badge" style="margin:4px auto;width:fit-content;"><span class="dot"></span>RÉCITATION</div>':''}
          </div>
        </div>
        <div class="card" style="padding:12px;" id="scoring-card">
          <div class="card-title" style="margin-bottom:4px;">✏️ Notation</div>
          ${this.renderScoringPanel()}
        </div>
        <div class="card" style="padding:12px;" id="recent-scores-card">
          <div class="card-title" style="margin-bottom:8px;">📋 Dernières notes</div>
          ${this.renderRecentScores()}
        </div>
      </div>

      <!-- DROITE : Mushaf -->
      <div>
        <div class="card" style="padding:12px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <div style="color:var(--gold);font-size:0.9rem;font-weight:600;">📖 Coran — <span id="db-page-label">${comp.currentPage||1}/604</span></div>
            <span style="color:var(--text-muted);font-size:0.8rem;">Page ${comp.currentPage||1} / 604</span>
          </div>
          <div id="db-flipbook" style="display:flex;gap:0;width:100%;background:#e8dcc8;border-radius:6px;overflow:hidden;min-height:500px;box-shadow:0 4px 20px rgba(0,0,0,0.5);">
            <div id="db-page-left" style="flex:1;display:flex;align-items:center;justify-content:center;border-right:3px solid #8B6914;"></div>
            <div id="db-page-right" style="flex:1;display:flex;align-items:center;justify-content:center;"></div>
          </div>
        </div>
      </div>

    </div>`;

    // ── Layout PRÉSIDENT / ADMIN ──────────────────────────────────────────────
    return `
    <div style="display:grid;grid-template-columns:1fr 420px;gap:20px;" id="president-grid">
      <div>
        <div class="card" style="margin-bottom:16px;padding:16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <div>
              <div style="font-family:'Amiri',serif;font-size:1.6rem;color:var(--gold);" id="db-participant-name">
                ${currentP ? currentP.name : '— En attente —'}
              </div>
              <div style="color:var(--text-muted);font-size:0.8rem;" id="db-participant-info">
                ${currentP ? 'N°' + currentP.number + ' • ' + currentP.reading + ' • ' + (currentP.gender==='male'?'👨 Masculin':'👩 Féminin') : ''}
              </div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
              ${currentP ? `
                <button class="btn ${comp.participantHasHand?'btn-danger':'btn-primary'}" onclick="App.giveHand(${!comp.participantHasHand})" id="btn-give-hand">
                  ${comp.participantHasHand ? '✋ Reprendre la main' : '🤝 Donner la main + Démarrer'}
                </button>
              ` : '<button class="btn btn-ghost btn-sm" onclick="App.navigate(\'participants\')">👥 Sélectionner participant</button>'}
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:16px;padding:12px;background:rgba(201,168,76,0.06);border-radius:8px;border:1px solid rgba(201,168,76,0.15);">
            <div class="timer-display" id="db-timer" style="font-size:2.2rem;flex-shrink:0;">${this.formatTime(comp.timerDuration||300)}</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button class="btn btn-green btn-sm" onclick="App.timerStart()">▶️ Démarrer</button>
              <button class="btn btn-danger btn-sm" onclick="App.timerStop()">⏹️ Stop</button>
              <button class="btn btn-ghost btn-sm" onclick="App.timerReset()">🔄 Reset</button>
            </div>
            ${comp.participantHasHand ? '<div class="live-badge"><span class="dot"></span>RÉCITATION</div>' : ''}
          </div>
        </div>

        <div class="card" style="padding:12px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <div style="color:var(--gold);font-size:0.9rem;font-weight:600;">📖 Coran — <span id="db-page-label">${comp.currentPage||1}/604</span></div>
            <div style="display:flex;align-items:center;gap:8px;">
              <button class="flipbook-nav-btn" style="width:36px;height:36px;" onclick="App.dbFlipPrev()">◀️</button>
              <input type="number" id="db-page-input" min="1" max="604" value="${comp.currentPage||1}"
                style="width:60px;padding:4px;background:rgba(255,255,255,0.05);border:var(--border-gold);border-radius:6px;color:var(--text-light);text-align:center;direction:ltr;"
                onchange="App.dbFlipGoTo(this.value)">
              <button class="flipbook-nav-btn" style="width:36px;height:36px;" onclick="App.dbFlipNext()">▶️</button>
            </div>
          </div>
          <div id="db-flipbook" style="display:flex;gap:0;width:100%;background:#e8dcc8;border-radius:6px;overflow:hidden;min-height:350px;box-shadow:0 4px 20px rgba(0,0,0,0.5);">
            <div id="db-page-left" style="flex:1;display:flex;align-items:center;justify-content:center;border-right:3px solid #8B6914;"></div>
            <div id="db-page-right" style="flex:1;display:flex;align-items:center;justify-content:center;"></div>
          </div>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:16px;overflow-y:auto;padding-right:4px;" id="president-right-col">
        <div class="card" style="padding:16px;">
          <div class="card-title" style="margin-bottom:8px;">👥 Participants
            <input type="text" placeholder="🔍 Rechercher..." class="form-control"
              style="display:inline-block;width:140px;margin-right:8px;padding:4px 8px;font-size:0.8rem;"
              oninput="App.filterDashboardParticipants(this.value)">
          </div>
          <div id="db-participants-list" style="max-height:220px;overflow-y:auto;">
            ${this.renderParticipantsList()}
          </div>
        </div>

        <div class="card" style="padding:16px;" id="unlock-panel">
          <div class="card-title" style="margin-bottom:12px;">🔓 Demandes de modification</div>
          <div id="unlock-requests-list">
            <p style="color:var(--text-muted);font-size:0.85rem;text-align:center;">Aucune demande</p>
          </div>
          <div style="margin-top:12px;">
            <div class="card-title" style="font-size:0.9rem;margin-bottom:8px;">Statut des verrous</div>
            <div id="judges-lock-status">${this.renderJudgesLockStatus()}</div>
          </div>
        </div>

        <div class="card" style="padding:12px;" id="scoring-card">
          <div class="card-title" style="margin-bottom:4px;">✏️ Notation (Président)</div>
          ${this.renderScoringPanel()}
        </div>

        <div class="card" style="padding:16px;" id="recent-scores-card">
          <div class="card-title" style="margin-bottom:12px;">📋 Dernières notes</div>
          ${this.renderRecentScores()}
        </div>
      </div>
    </div>`;

  },
  initDashboard() {
    this._currentPage = this.competition?.currentPage || 1;
    this.renderDoublePage(this._currentPage);
    this.syncTimer();
    // Synchroniser hauteur colonne droite = hauteur colonne gauche (président/admin)
    const grid = document.getElementById('president-grid');
    if (grid) {
      const leftCol = grid.children[0];
      const rightCol = document.getElementById('president-right-col');
      if (leftCol && rightCol) {
        const syncH = () => {
          const h = leftCol.offsetHeight;
          if (h > 0) rightCol.style.maxHeight = (h - 19) + 'px';
        };
        syncH();
        setTimeout(syncH, 300);
        new ResizeObserver(syncH).observe(leftCol);
      }
    }
  },

  filterDashboardParticipants(val) {
    const el = document.getElementById('db-participants-list');
    if (el) el.innerHTML = this.renderParticipantsList(val);
  },

  getReadingFolder() {
    const comp = this.competition || {};
    const currentP = this.participants.find(p => p.id === comp.currentParticipantId);
    const reading = currentP?.reading || 'Warsh';
    return reading === 'Hafs' ? '/quran/hafs' : '/quran/warsh';
  },

  renderDoublePage(page) {
    this._currentPage = page;
    const left = document.getElementById('db-page-left');
    const right = document.getElementById('db-page-right');
    const inp = document.getElementById('db-page-input');
    const lbl = document.getElementById('db-page-label');
    if (inp) inp.value = page;
    if (lbl) lbl.textContent = page + '/604';

    const folder = this.getReadingFolder();
    const makePageDiv = (p) => {
      if (!p) return '<div style="flex:1;display:flex;align-items:center;justify-content:center;color:#c9a84c;opacity:0.3;font-family:\'Amiri\',serif;font-size:1.5rem;">نهاية</div>';
      return '<img src="' + folder + '/page_' + String(p).padStart(3,'0') + '.png" alt="Page ' + p + '" style="width:100%;height:100%;object-fit:contain;display:block;">';
    };
    if (left) left.innerHTML = makePageDiv(page);
    if (right) right.innerHTML = makePageDiv(page + 1 <= 604 ? page + 1 : null);
  },

  dbFlipNext() { const n=Math.min((this._currentPage||1)+2,604); this.renderDoublePage(n); this.socket.emit('page_change',{page:n}); },
  dbFlipPrev() { const p=Math.max((this._currentPage||1)-2,1); this.renderDoublePage(p); this.socket.emit('page_change',{page:p}); },
  dbFlipGoTo(val) { const p=Math.min(Math.max(parseInt(val)||1,1),604); this.renderDoublePage(p); this.socket.emit('page_change',{page:p}); },

  giveHand(hasHand) {
    // Mise à jour immédiate locale
    if (this.competition) this.competition.participantHasHand = hasHand;

    // Bouton
    const btn = document.getElementById('btn-give-hand');
    if (btn) {
      btn.textContent = hasHand ? '✋ Reprendre la main' : '🤝 Donner la main + Démarrer';
      btn.className = 'btn ' + (hasHand ? 'btn-danger' : 'btn-primary');
      btn.onclick = () => this.giveHand(!hasHand);
    }

    // Badge RÉCITATION dans la zone timer
    const timerZone = document.getElementById('db-timer')?.closest('[style*="align-items"]');
    if (timerZone) {
      let badge = timerZone.querySelector('.live-badge');
      if (hasHand && !badge) {
        const b = document.createElement('div');
        b.className = 'live-badge';
        b.innerHTML = '<span class="dot"></span>RÉCITATION';
        timerZone.appendChild(b);
      } else if (!hasHand && badge) {
        badge.remove();
      }
    }

    this.socket.emit('give_hand', { hasHand });
  },

  renderParticipantsList(filter) {
    const comp = this.competition || {};
    let list = this.participants;
    if (filter) list = list.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()));
    if (!list.length) return '<p style="color:var(--text-muted);font-size:0.82rem;text-align:center;">Aucun participant</p>';
    return list.map(p => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
      <div>
        <span style="font-size:0.88rem;${p.id===comp.currentParticipantId?'color:var(--gold);font-weight:700;':''}">${p.name}</span>
        <span class="badge badge-${p.reading==='Warsh'?'warsh':'hafs'}" style="margin-right:4px;font-size:0.7rem;">${p.reading}</span>
        ${p.gender==='female'?'<span style="font-size:0.7rem;color:#e74c9a;">👩</span>':'<span style="font-size:0.7rem;color:#3498db;">👨</span>'}
      </div>
      ${p.id!==comp.currentParticipantId
        ? '<button class="btn btn-green btn-sm" style="font-size:0.75rem;padding:4px 10px;" onclick="App.selectParticipant(\'' + p.id + '\')">▶ Sélectionner</button>'
        : '<span style="color:var(--gold);font-size:0.75rem;">✅ En cours</span>'}
    </div>`).join('');
  },

  selectParticipant(id) {
    this.socket.emit('set_current_participant', { participantId: id });
    this.showToast('Participant sélectionné', 'info');
  },

  renderJudgesLockStatus() {
    if (!Object.keys(this._judgesLockStatus).length) {
      return '<p style="color:var(--text-muted);font-size:0.82rem;">En attente des juges...</p>';
    }
    return Object.entries(this._judgesLockStatus).map(([id, info]) => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;">
      <span style="font-size:0.85rem;">${info.name}</span>
      <div style="display:flex;gap:6px;align-items:center;">
        <span style="font-size:0.75rem;color:${info.unlocked?'#2ECC71':'#E74C3C'};">${info.unlocked?'🔓 Autorisé':'🔒 Verrouillé'}</span>
        <button class="btn btn-sm ${info.unlocked?'btn-danger':'btn-green'}" style="font-size:0.72rem;padding:3px 8px;"
          onclick="App.toggleJudgeLock('${id}','${info.name}',${info.unlocked})">
          ${info.unlocked?'Verrouiller':'Autoriser'}
        </button>
      </div>
    </div>`).join('');
  },

  toggleJudgeLock(judgeId, judgeName, currentlyUnlocked) {
    this.socket.emit('unlock_score', { judgeId, judgeName, unlock: !currentlyUnlocked });
    this._judgesLockStatus[judgeId] = { name: judgeName, unlocked: !currentlyUnlocked };
    this.refreshUnlockPanel();
  },

  refreshUnlockPanel() {
    const el = document.getElementById('judges-lock-status');
    if (el) el.innerHTML = this.renderJudgesLockStatus();
  },

  showUnlockRequest(data) {
    this._judgesLockStatus[data.judgeId] = this._judgesLockStatus[data.judgeId] || { name: data.judgeName, unlocked: false };
    const el = document.getElementById('unlock-requests-list');
    const reqId = 'req-' + data.judgeId;
    if (el) {
      const html = '<div id="' + reqId + '" style="background:rgba(201,168,76,0.1);border:var(--border-gold);border-radius:6px;padding:10px;margin-bottom:8px;">' +
        '<div style="font-size:0.85rem;margin-bottom:8px;">⚠️ <strong>' + data.judgeName + '</strong> demande à modifier sa note</div>' +
        '<div style="display:flex;gap:8px;">' +
        '<button class="btn btn-green btn-sm" onclick="App.toggleJudgeLock(\'' + data.judgeId + '\',\'' + data.judgeName + '\',false);document.getElementById(\'' + reqId + '\')?.remove()">✅ Autoriser</button>' +
        '<button class="btn btn-ghost btn-sm" onclick="document.getElementById(\'' + reqId + '\')?.remove()">✖ Refuser</button>' +
        '</div></div>';
      const existing = document.getElementById(reqId);
      if (existing) existing.outerHTML = html;
      else el.innerHTML = html + el.innerHTML;
    }
    this.showToast('🔔 ' + data.judgeName + ' demande à modifier sa note', 'info');
  },

  // ── Scoring Panel ─────────────────────────────────────────────────────────
  renderScoringPanel(isFinal) {
    const comp = this.competition || {};
    const currentP = this.participants.find(p => p.id === comp.currentParticipantId);
    if (!currentP) return '<p style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:12px;">En attente d\'un participant...</p>';

    const scoreArr = isFinal ? this.finalScores : this.scores;
    const myScore = scoreArr.find(s => s.participantId === currentP.id && s.judgeId === this.user.userId);
    const isPresident = ['president','admin'].includes(this.user.role);
    // Le président peut toujours modifier directement — verrou uniquement pour les juges
    const locked = !!myScore && !this.scoreUnlocked && !isPresident;

    return `
    <div id="scoring-panel-inner">
      <div style="font-size:0.82rem;color:var(--text-muted);margin-bottom:10px;">
        Participant: <strong style="color:var(--gold)">${currentP.name}</strong>
        ${myScore ? '<span class="badge badge-warsh" style="margin-right:4px;font-size:0.7rem;">Noté: ' + myScore.total + '/20</span>' : ''}
        ${isFinal ? '<span class="badge badge-hafs" style="font-size:0.7rem;">🌟 FINALE</span>' : ''}
      </div>
      ${locked ? `
      <div style="text-align:center;padding:12px;background:rgba(192,57,43,0.1);border-radius:8px;border:1px solid rgba(192,57,43,0.3);">
        <div style="font-size:1.2rem;margin-bottom:8px;">🔒</div>
        <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:10px;">Note verrouillée</div>
        <button class="btn btn-ghost btn-sm" onclick="App.requestUnlock()">📤 Demander modification au Président</button>
      </div>` : `
      <div id="score-fields" style="display:flex;flex-direction:column;gap:4px;">
        ${this.criteria.map(c => `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;padding:3px 0;">
          <label style="font-size:0.75rem;color:var(--gold-light);flex:1;line-height:1.2;">${c.label}</label>
          <div class="score-stepper" style="height:28px;">
            <button class="stepper-btn" style="width:24px;" onclick="App.stepScore('sc-${c.key}',-1,${c.max})">−</button>
            <input type="number" class="score-input" id="sc-${c.key}" min="0" max="${c.max}"
              value="${myScore?.criteria?.[c.key]||0}" oninput="App.updateTotal()"
              style="width:32px;background:transparent;border:none;color:white;text-align:center;direction:ltr;font-weight:700;font-size:0.9rem;">
            <button class="stepper-btn" style="width:24px;" onclick="App.stepScore('sc-${c.key}',+1,${c.max})">+</button>
          </div>
          <span style="font-size:0.7rem;color:var(--text-muted);width:26px;text-align:right;">/${c.max}</span>
        </div>`).join('')}
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin:8px 0 6px;padding:6px 10px;background:rgba(201,168,76,0.1);border-radius:6px;">
        <span style="color:var(--text-muted);font-size:0.78rem;">Total</span>
        <span>
          <span id="score-total-val" style="color:var(--gold);font-weight:900;font-size:1.4rem;">${myScore?.total||0}</span>
          <span style="color:var(--text-muted);font-size:0.8rem;">/20</span>
        </span>
      </div>
      <button class="btn btn-primary btn-sm" style="width:100%;padding:8px;" onclick="App.confirmScore(${!!isFinal})">
        ${myScore ? '🔄 Modifier' : '✅ Valider'} la note
      </button>`}
    </div>`;
  },

  stepScore(id, delta, max) {
    const el = document.getElementById(id);
    if (!el) return;
    const val = Math.min(Math.max((parseInt(el.value)||0) + delta, 0), max);
    el.value = val;
    this.updateTotal();
  },

  updateTotal() {
    let total = 0;
    this.criteria.forEach(c => {
      const el = document.getElementById('sc-' + c.key);
      if (el) total += Math.min(parseInt(el.value)||0, c.max);
    });
    const el = document.getElementById('score-total-val');
    if (el) el.textContent = total;
  },

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  },

  requestUnlock() { this.socket.emit('request_unlock'); },

  updateScoreLockUI() {
    const el = document.getElementById('scoring-card');
    if (el) el.innerHTML = '<div class="card-title" style="margin-bottom:4px;">✏️ Notation</div>' + this.renderScoringPanel();
    const badge = document.getElementById('lock-badge');
    if (badge) {
      badge.textContent = this.scoreUnlocked ? '🔓 Modification autorisée' : '🔒 Note verrouillée';
      badge.className = 'badge ' + (this.scoreUnlocked ? 'badge-warsh' : 'badge-hafs');
    }
  },

  confirmScore(isFinal) {
    const comp = this.competition || {};
    const currentP = this.participants.find(p => p.id === comp.currentParticipantId);
    if (!currentP) return this.showToast('Aucun participant en cours', 'error');
    const criteria = {};
    let total = 0;
    this.criteria.forEach(c => {
      const val = Math.min(parseInt(document.getElementById('sc-' + c.key)?.value)||0, c.max);
      criteria[c.key] = val; total += val;
    });
    const rows = this.criteria.map(c => '<tr><td>' + c.label + '</td><td><strong style="color:var(--gold)">' + criteria[c.key] + '</strong>/' + c.max + '</td></tr>').join('');
    this.showModal(`
    <div class="modal-title">⚠️ Confirmer la note${isFinal?' — FINALE':''}</div>
    <p style="text-align:center;color:var(--text-muted);margin:8px 0 12px;">Participant: <strong style="color:var(--gold)">${currentP.name}</strong></p>
    <table style="width:100%">${rows}</table>
    <div class="score-total-display" style="margin-top:12px;">
      <div class="total-label">TOTAL</div><div class="total-value">${total}/20</div>
    </div>`,
    [
      { label: '✅ Confirmer', class: 'btn-primary', action: () => this.submitScore(currentP.id, criteria, isFinal) },
      { label: '✏️ Modifier', class: 'btn-ghost', action: () => this.closeModal() }
    ]);
  },

  async submitScore(participantId, criteria, isFinal) {
    this.closeModal();
    try {
      await this.api('POST', '/api/scores', { participantId, criteria, isFinal: !!isFinal });
      this.scoreUnlocked = false;
      this.showToast('✅ Note enregistrée et verrouillée', 'success');
      this.updateScoreLockUI();
    } catch(e) { this.showToast('❌ ' + e.message, 'error'); }
  },

  // ── PARTICIPANTS PAGE ─────────────────────────────────────────────────────
  pageParticipants() {
    return `
    <h2 style="color:var(--gold);margin-bottom:20px;font-family:'Amiri',serif;">👥 Gestion des Participants</h2>
    <div class="card">
      <div class="card-header"><div class="card-title">➕ Ajouter un participant</div></div>
      <div class="grid-2" style="gap:12px;">
        <div class="form-group" style="margin:0"><label>Nom complet</label>
          <input class="form-control" id="p-name" placeholder="Nom du participant"></div>
        <div class="form-group" style="margin:0"><label>Genre</label>
          <select class="form-control" id="p-gender">
            <option value="male">👨 Masculin</option><option value="female">👩 Féminin</option>
          </select></div>
        <div class="form-group" style="margin:0"><label>Lecture</label>
          <select class="form-control" id="p-reading">
            <option value="Warsh">Warsh — ورش</option><option value="Hafs">Hafs — حفص</option>
          </select></div>
        <div class="form-group" style="margin:0"><label>Catégorie</label>
          <select class="form-control" id="p-category">
            <option value="selection">Sélection</option><option value="final">Finale</option>
          </select></div>
      </div>
      <button class="btn btn-primary" style="width:auto;margin-top:16px;" onclick="App.addParticipant()">➕ Ajouter</button>
    </div>
    <div class="card">
      <div class="card-header">
        <div class="card-title">📋 Liste (${this.participants.length})</div>
        <input type="text" class="form-control" placeholder="🔍 Rechercher..." style="width:200px;" oninput="App.filterParticipants(this.value)">
      </div>
      <div id="participants-table">${this.renderParticipantsTable()}</div>
    </div>`;
  },

  renderParticipantsTable(filter) {
    let list = filter ? this.participants.filter(p => p.name.toLowerCase().includes(filter.toLowerCase())) : this.participants;
    if (!list.length) return '<p style="color:var(--text-muted);text-align:center;padding:20px;">Aucun participant</p>';
    const comp = this.competition||{};
    return '<div class="table-wrap"><table><thead><tr><th>N°</th><th>Nom</th><th>Genre</th><th>Lecture</th><th>Phase</th><th>Actions</th></tr></thead><tbody>' +
      list.map(p => '<tr>' +
        '<td>' + p.number + '</td>' +
        '<td>' + (p.id===comp.currentParticipantId?'<span class="status-dot status-current"></span> ':'') + p.name + '</td>' +
        '<td><span class="badge badge-' + p.gender + '">' + (p.gender==='male'?'👨 M':'👩 F') + '</span></td>' +
        '<td><span class="badge badge-' + (p.reading==='Warsh'?'warsh':'hafs') + '">' + p.reading + '</span></td>' +
        '<td>' + (p.phase==='final'?'<span class="badge badge-warsh">🌟 Finale</span>':'<span class="badge">🔵 Sélection</span>') + '</td>' +
        '<td><div style="display:flex;gap:6px;">' +
        (p.id!==comp.currentParticipantId
          ? '<button class="btn btn-green btn-sm" onclick="App.selectParticipant(\'' + p.id + '\')">▶️ Sélectionner</button>'
          : '<button class="btn btn-danger btn-sm" onclick="App.selectParticipant(null)">⏸️ Arrêter</button>') +
        '<button class="btn btn-ghost btn-sm" style="color:#85C1E9;" onclick="App.editParticipant(\'' + p.id + '\')">✏️ Modifier</button>' +
        '<button class="btn btn-ghost btn-sm" onclick="App.deleteParticipant(\'' + p.id + '\',\'' + p.name.replace(/'/g,"\\'") + '\')">🗑️</button>' +
        '</div></td></tr>'
      ).join('') +
      '</tbody></table></div>';
  },

  filterParticipants(val) {
    const el = document.getElementById('participants-table');
    if (el) el.innerHTML = this.renderParticipantsTable(val);
  },

  async addParticipant() {
    const name = document.getElementById('p-name').value.trim();
    if (!name) return this.showToast('Nom requis', 'error');
    try {
      await this.api('POST', '/api/participants', {
        name,
        gender: document.getElementById('p-gender').value,
        reading: document.getElementById('p-reading').value,
        category: document.getElementById('p-category').value
      });
      document.getElementById('p-name').value = '';
      this.showToast('✅ Participant ajouté', 'success');
    } catch(e) { this.showToast(e.message, 'error'); }
  },

  deleteParticipant(id, name) {
    this.showModal('<div class="modal-title">⚠️ Supprimer participant</div><p style="text-align:center;margin-top:12px;">Supprimer <strong style="color:var(--gold)">' + name + '</strong> ?</p>',
    [
      { label: '🗑️ Supprimer', class: 'btn-danger', action: async () => {
        this.closeModal();
        try { await this.api('DELETE', '/api/participants/' + id); this.showToast('Supprimé','info'); }
        catch(e) { this.showToast(e.message,'error'); }
      }},
      { label: 'Annuler', class: 'btn-ghost', action: () => this.closeModal() }
    ]);
  },

  initParticipants() {},

  // ── RANKINGS ─────────────────────────────────────────────────────────────
  pageRankings() {
    const comp = this.competition||{};
    const r = this._rankings?.selection || { male:[], female:[], all:[] };
    return `
    <h2 style="color:var(--gold);margin-bottom:20px;font-family:'Amiri',serif;">🏆 Classement — Sélection</h2>
    ${['admin','president'].includes(this.user.role)?`
    <div class="card" style="margin-bottom:20px;">
      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
        <span>Affichage au public:</span>
        <button class="btn ${comp.resultsVisible?'btn-danger':'btn-primary'}" onclick="App.toggleResults()">
          ${comp.resultsVisible?'🔒 Masquer':'📢 Afficher au public'}
        </button>
      </div>
    </div>`:''}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
      <div class="card">
        <div class="card-header"><div class="card-title">👨 Classement Garçons</div></div>
        ${this.renderRankingTable(r.male)}
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">👩 Classement Filles</div></div>
        ${this.renderRankingTable(r.female)}
      </div>
    </div>`;
  },

  // ── FINALE ────────────────────────────────────────────────────────────────
  pageFinale() {
    const r = this._rankings?.final || { male:[], female:[], all:[] };
    const finalists = this.participants.filter(p => p.phase === 'final');
    return `
    <h2 style="color:var(--gold);margin-bottom:20px;font-family:'Amiri',serif;">🌟 Finale</h2>

    <div class="card" style="margin-bottom:20px;">
      <div class="card-header"><div class="card-title">🚀 Gestion de la Finale</div></div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
        <button class="btn btn-primary" onclick="App.promoteFinalists()">
          🏆 Qualifier Top 5 Garçons + Top 5 Filles → Finale
        </button>
        <span style="color:var(--text-muted);font-size:0.85rem;">${finalists.length} finaliste(s) qualifié(s)</span>
      </div>
      ${finalists.length ? `
      <div style="margin-top:12px;">
        <div style="font-size:0.85rem;color:var(--gold);margin-bottom:8px;">Finalistes :</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${finalists.map(p => '<span class="badge badge-' + (p.gender==='male'?'warsh':'hafs') + '">' + (p.gender==='male'?'👨':'👩') + ' ' + p.name + '</span>').join('')}
        </div>
      </div>` : ''}
    </div>

    ${this.user.role === 'judge' ? `
    <div class="card" style="margin-bottom:20px;">
      <div class="card-title" style="margin-bottom:8px;">✏️ Notation Finale</div>
      ${this.renderScoringPanel(true)}
    </div>` : ''}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
      <div class="card">
        <div class="card-header"><div class="card-title">👨 Classement Final Garçons</div></div>
        ${this.renderRankingTable(r.male)}
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">👩 Classement Final Filles</div></div>
        ${this.renderRankingTable(r.female)}
      </div>
    </div>`;
  },

  renderRankingTable(list) {
    if (!list || !list.length) return '<p style="color:var(--text-muted);text-align:center;padding:20px;">Aucune note encore</p>';
    return '<div class="table-wrap"><table><thead><tr><th>Rang</th><th>Participant</th><th>Lecture</th><th>Juges</th><th>Score</th></tr></thead><tbody>' +
      list.map(r => '<tr>' +
        '<td>' + (r.rank===1?'🥇':r.rank===2?'🥈':r.rank===3?'🥉':r.rank) + '</td>' +
        '<td>' + r.participant.name + '</td>' +
        '<td><span class="badge badge-' + (r.participant.reading==='Warsh'?'warsh':'hafs') + '">' + r.participant.reading + '</span></td>' +
        '<td>' + r.judgeCount + '/4</td>' +
        '<td><strong style="color:var(--gold)">' + r.total + '</strong>/20</td>' +
        '</tr>'
      ).join('') +
      '</tbody></table></div>';
  },

  async promoteFinalists() {
    this.showModal('<div class="modal-title">🏆 Qualifier les finalistes</div><p style="text-align:center;margin-top:12px;color:var(--text-muted);">Cela va qualifier le Top 5 Garçons et Top 5 Filles pour la finale.</p>',
    [
      { label: '✅ Confirmer', class: 'btn-primary', action: async () => {
        this.closeModal();
        try {
          const r = await this.api('POST', '/api/promote-finalists');
          this.showToast('✅ ' + r.promoted + ' finalistes qualifiés', 'success');
          this.navigate('finale');
        } catch(e) { this.showToast(e.message,'error'); }
      }},
      { label: 'Annuler', class: 'btn-ghost', action: () => this.closeModal() }
    ]);
  },

  toggleResults() {
    const comp = this.competition||{};
    this.socket.emit('toggle_results', { visible: !comp.resultsVisible });
  },

  // ── CRITERIA ─────────────────────────────────────────────────────────────
  pageCriteria() {
    return `
    <h2 style="color:var(--gold);margin-bottom:20px;font-family:'Amiri',serif;">📋 Grille de Notation</h2>
    <div class="card">
      <div class="card-header">
        <div class="card-title">⚙️ Critères et Barèmes</div>
        <div id="criteria-total-badge" class="badge badge-warsh">Total: ${this.criteria.reduce((s,c)=>s+c.max,0)}/20</div>
      </div>
      <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:16px;">⚠️ Le total des barèmes doit être exactement 20 points.</p>
      <div id="criteria-list">${this.renderCriteriaList()}</div>
      <div style="display:flex;gap:12px;margin-top:16px;flex-wrap:wrap;">
        <button class="btn btn-green" onclick="App.addCriterion()">➕ Ajouter un critère</button>
        <button class="btn btn-primary" onclick="App.saveCriteria()">💾 Enregistrer</button>
      </div>
    </div>`;
  },

  renderCriteriaList() {
    return this.criteria.map((c, i) => `
    <div class="score-criterion" style="margin-bottom:10px;">
      <div class="grid-2" style="gap:10px;align-items:center;">
        <div>
          <label style="font-size:0.78rem;margin-bottom:4px;display:block;">Libellé</label>
          <input class="form-control" value="${c.label}" id="crit-label-${i}">
        </div>
        <div style="display:flex;gap:8px;align-items:flex-end;">
          <div style="flex:1">
            <label style="font-size:0.78rem;margin-bottom:4px;display:block;">Barème (max)</label>
            <input type="number" class="form-control" value="${c.max}" id="crit-max-${i}" min="1" max="20" oninput="App.updateCriteriaTotal()">
          </div>
          <button class="btn btn-danger btn-sm" onclick="App.removeCriterion(${i})">🗑️</button>
        </div>
      </div>
    </div>`).join('');
  },

  updateCriteriaTotal() {
    let total = 0;
    this.criteria.forEach((_, i) => { total += parseInt(document.getElementById('crit-max-'+i)?.value)||0; });
    const badge = document.getElementById('criteria-total-badge');
    if (badge) { badge.textContent = 'Total: ' + total + '/20'; badge.className = 'badge ' + (total===20?'badge-warsh':'badge-hafs'); }
  },

  addCriterion() {
    this.criteria.push({ key: 'crit_' + Date.now(), label: 'Nouveau critère', max: 0 });
    document.getElementById('criteria-list').innerHTML = this.renderCriteriaList();
    this.updateCriteriaTotal();
  },

  removeCriterion(i) {
    this.criteria.splice(i, 1);
    document.getElementById('criteria-list').innerHTML = this.renderCriteriaList();
    this.updateCriteriaTotal();
  },

  async saveCriteria() {
    const updated = this.criteria.map((c, i) => ({
      key: c.key,
      label: document.getElementById('crit-label-'+i)?.value || c.label,
      max: parseInt(document.getElementById('crit-max-'+i)?.value)||0
    }));
    const total = updated.reduce((s,c)=>s+c.max,0);
    if (total !== 20) return this.showToast('❌ Le total doit être 20 (actuellement ' + total + ')', 'error');
    try { await this.api('PUT', '/api/criteria', { criteria: updated }); this.showToast('✅ Grille enregistrée', 'success'); }
    catch(e) { this.showToast(e.message,'error'); }
  },

  initCriteria() { this.updateCriteriaTotal(); },

  // ── TIMER SETTINGS ────────────────────────────────────────────────────────
  pageTimerSettings() {
    const comp = this.competition||{};
    const presets = comp.timerPresets || [60,120,180,300,600,900];
    const currentDefault = comp.timerDuration||300;
    return `
    <h2 style="color:var(--gold);margin-bottom:20px;font-family:'Amiri',serif;">⏱️ Paramètres du Chronomètre</h2>
    <div class="card">
      <div class="card-header">
        <div class="card-title">⚡ Durées pré-configurées</div>
        <div style="font-size:0.8rem;color:var(--text-muted);">Durée par défaut actuelle : <strong style="color:var(--gold);">${this.formatTime(currentDefault)}</strong></div>
      </div>
      <div id="presets-list">
        ${presets.map((p,i) => `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
          <input type="number" class="form-control" value="${p}" id="preset-${i}" min="10" max="7200" style="width:100px;direction:ltr;text-align:center;">
          <span style="color:var(--text-muted);font-size:0.85rem;min-width:45px;">${this.formatTime(p)}</span>
          <button class="btn btn-ghost btn-sm" style="color:#2ECC71;border-color:rgba(46,204,113,0.4);${p===currentDefault?'background:rgba(46,204,113,0.15);':''}" onclick="App.setDefaultTimer(${p})">${p===currentDefault?'✅ Par défaut':'⭐ Par défaut'}</button>
          <button class="btn btn-danger btn-sm" onclick="App.removePreset(${i})">🗑️</button>
        </div>`).join('')}
      </div>
      <div style="display:flex;gap:12px;margin-top:12px;">
        <button class="btn btn-green btn-sm" onclick="App.addPreset()">➕ Ajouter</button>
        <button class="btn btn-primary btn-sm" onclick="App.savePresets()">💾 Enregistrer les durées</button>
      </div>
    </div>`;
  },

  async setDefaultTimer(seconds) {
    try {
      await this.api('PUT', '/api/competition', { timerDuration: seconds });
      if (this.competition) this.competition.timerDuration = seconds;
      this.showToast('✅ Durée par défaut : ' + this.formatTime(seconds), 'success');
      this.navigate('timer-settings');
    } catch(e) { this.showToast(e.message,'error'); }
  },

  addPreset() {
    const presets = this.competition?.timerPresets || [];
    presets.push(60);
    this.competition.timerPresets = presets;
    this.navigate('timer-settings');
  },

  removePreset(i) {
    const presets = this.competition?.timerPresets || [];
    presets.splice(i,1);
    this.competition.timerPresets = presets;
    this.navigate('timer-settings');
  },

  async savePresets() {
    const presets = (this.competition?.timerPresets||[]).map((_,i)=>parseInt(document.getElementById('preset-'+i)?.value)||60);
    try { await this.api('PUT', '/api/timer-presets', { presets }); this.showToast('✅ Préréglages enregistrés','success'); }
    catch(e) { this.showToast(e.message,'error'); }
  },

  initTimerSettings() {},

  // ── COMPETITION SETTINGS ───────────────────────────────────────────────
  pageCompSettings() {
    const comp = this.competition||{};
    return `
    <h2 style="color:var(--gold);margin-bottom:20px;font-family:'Amiri',serif;">🏆 Paramètres de la Compétition</h2>
    <div class="card">
      <div class="card-header"><div class="card-title">📝 Informations générales</div></div>
      <div style="display:flex;flex-direction:column;gap:16px;">
        <div class="form-group" style="margin:0;">
          <label>Nom de la compétition</label>
          <input class="form-control" id="cs-title" value="${comp.title||''}" placeholder="Ex: Compétition Nationale de Récitation du Coran" style="direction:rtl;">
        </div>
        <div class="form-group" style="margin:0;">
          <label>Numéro d'édition</label>
          <input class="form-control" id="cs-edition" type="number" min="1" value="${comp.edition||''}" placeholder="Ex: 9" style="width:120px;direction:ltr;text-align:center;">
        </div>
        <div class="form-group" style="margin:0;">
          <label>Date de début — من</label>
          <input class="form-control" id="cs-date-debut" type="date" value="${comp.date_debut||''}" style="direction:ltr;text-align:left;">
        </div>
        <div class="form-group" style="margin:0;">
          <label>Date de fin — إلى</label>
          <input class="form-control" id="cs-date-fin" type="date" value="${comp.date_fin||''}" style="direction:ltr;text-align:left;">
        </div>
        <div class="form-group" style="margin:0;">
          <label>Lieu</label>
          <input class="form-control" id="cs-lieu" value="${comp.lieu||''}" placeholder="Ex: Alger — Palais de la Culture" style="direction:rtl;">
        </div>
      </div>
      <button class="btn btn-primary" style="width:auto;margin-top:20px;" onclick="App.saveCompSettings()">💾 Enregistrer</button>
    </div>
    <div class="card" style="margin-top:20px;">
      <div class="card-header"><div class="card-title">👁️ Aperçu</div></div>
      <div style="text-align:center;padding:20px;background:rgba(201,168,76,0.05);border-radius:8px;">
        <div style="font-family:'Amiri',serif;font-size:1.6rem;color:var(--gold);">${comp.title||'—'}</div>
        <div style="color:var(--text-muted);margin-top:8px;">
          Édition ${comp.edition||'—'}
          ${comp.date_debut ? ' • ' + (() => { const d=new Date(comp.date_debut); const m=['يناير','فبراير','مارس','أبريل','ماي','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']; return d.getDate()+' '+m[d.getMonth()]+' '+d.getFullYear(); })() : ''}
          ${comp.date_fin ? ' — ' + (() => { const d=new Date(comp.date_fin); const m=['يناير','فبراير','مارس','أبريل','ماي','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']; return d.getDate()+' '+m[d.getMonth()]+' '+d.getFullYear(); })() : ''}
        </div>
        ${comp.lieu?'<div style="color:var(--text-muted);font-size:0.85rem;margin-top:4px;">📍 '+comp.lieu+'</div>':''}
      </div>
    </div>`;
  },

  initCompSettings() {},

  async saveCompSettings() {
    const title  = document.getElementById('cs-title')?.value.trim();
    const edition = parseInt(document.getElementById('cs-edition')?.value)||1;
    const date_debut = document.getElementById('cs-date-debut')?.value;
    const date_fin   = document.getElementById('cs-date-fin')?.value;
    const lieu   = document.getElementById('cs-lieu')?.value.trim();
    if (!title) return this.showToast('Nom requis','error');
    try {
      await this.api('PUT','/api/competition',{title,edition,date_debut,date_fin,lieu});
      if (this.competition) Object.assign(this.competition,{title,edition,date_debut,date_fin,lieu});
      this.showToast('✅ Compétition mise à jour','success');
      this.navigate('comp-settings');
    } catch(e) { this.showToast(e.message,'error'); }
  },

  // ── USERS ─────────────────────────────────────────────────────────────────────
  pageUsers() {
    return `
    <h2 style="color:var(--gold);margin-bottom:20px;font-family:'Amiri',serif;">⚙️ Gestion des Comptes</h2>
    <div class="card">
      <div class="card-header"><div class="card-title">➕ Nouveau compte</div></div>
      <div class="grid-2" style="gap:12px;">
        <div class="form-group" style="margin:0"><label>Nom complet</label><input class="form-control" id="u-name" placeholder="Nom affiché"></div>
        <div class="form-group" style="margin:0"><label>Identifiant</label><input class="form-control" id="u-username" placeholder="username" style="direction:ltr;text-align:left;"></div>
        <div class="form-group" style="margin:0"><label>Mot de passe</label><input class="form-control" id="u-password" type="password" placeholder="••••••••"></div>
        <div class="form-group" style="margin:0"><label>Rôle</label>
          <select class="form-control" id="u-role">
            <option value="judge">Juge</option><option value="president">Président</option>
            <option value="participant">Participant</option><option value="public">Public</option><option value="admin">Admin</option>
          </select></div>
      </div>
      <button class="btn btn-primary" style="width:auto;margin-top:16px;" onclick="App.createUser()">➕ Créer</button>
    </div>
    <div class="card"><div class="card-header"><div class="card-title">👥 Comptes</div></div>
    <div id="users-table">Chargement...</div></div>`;
  },

  async initUsers() {
    try {
      const users = await this.api('GET','/api/users');
      const el = document.getElementById('users-table');
      if (!el) return;
      el.innerHTML = '<div class="table-wrap"><table><thead><tr><th>Nom</th><th>Identifiant</th><th>Rôle</th><th>Statut</th><th>Actions</th></tr></thead><tbody>' +
        users.map(u => '<tr><td>' + u.name + '</td>' +
          '<td style="direction:ltr;text-align:left">' + u.username + '</td>' +
          '<td><span class="role-tag role-' + u.role + '">' + this.getRoleLabel(u.role) + '</span></td>' +
          '<td><span class="status-dot ' + (u.active?'status-active':'status-inactive') + '"></span> ' + (u.active?'Actif':'Inactif') + '</td>' +
          '<td><div style="display:flex;gap:6px;">' +
          '<button class="btn btn-ghost btn-sm" style="color:#85C1E9;" onclick="App.editUser(\'' + u.id + '\')">✏️ Modifier</button>' +
          '<button class="btn btn-ghost btn-sm" onclick="App.toggleUserActive(\'' + u.id + '\',' + u.active + ')">' + (u.active?'🔒 Désactiver':'✅ Activer') + '</button>' +
          (u.username!=='admin'?'<button class="btn btn-danger btn-sm" onclick="App.deleteUser(\'' + u.id + '\',\'' + u.name + '\')">🗑️</button>':'') +
          '</div></td></tr>'
        ).join('') + '</tbody></table></div>';
    } catch(e) { this.showToast(e.message,'error'); }
  },

  async createUser() {
    const name=document.getElementById('u-name').value.trim(), username=document.getElementById('u-username').value.trim(),
          password=document.getElementById('u-password').value, role=document.getElementById('u-role').value;
    if (!name||!username||!password) return this.showToast('Tous les champs sont requis','error');
    try {
      await this.api('POST','/api/users',{name,username,password,role});
      this.showToast('✅ Compte créé','success');
      document.getElementById('u-name').value=''; document.getElementById('u-username').value=''; document.getElementById('u-password').value='';
      await this.initUsers();
    } catch(e) { this.showToast(e.message,'error'); }
  },

  async toggleUserActive(id,active) {
    try { await this.api('PUT','/api/users/'+id,{active:!active}); await this.initUsers(); }
    catch(e) { this.showToast(e.message,'error'); }
  },

  editParticipant(id) {
    const p = this.participants.find(x => x.id === id);
    if (!p) return;
    const body = `
      <div class="modal-title" style="margin-bottom:16px;">✏️ Modifier participant</div>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div class="form-group" style="margin:0"><label>Nom</label>
          <input class="form-control" id="ep-name" value="${p.name}"></div>
        <div class="form-group" style="margin:0"><label>N° Passage</label>
          <input class="form-control" id="ep-number" type="number" min="1" value="${p.number}" style="direction:ltr;text-align:left;"></div>
        <div class="form-group" style="margin:0"><label>Genre</label>
          <select class="form-control" id="ep-gender">
            <option value="male" ${p.gender==='male'?'selected':''}>👨 Masculin</option>
            <option value="female" ${p.gender==='female'?'selected':''}>👩 Féminin</option>
          </select></div>
        <div class="form-group" style="margin:0"><label>Lecture</label>
          <select class="form-control" id="ep-reading">
            <option value="Warsh" ${p.reading==='Warsh'?'selected':''}>ورش — Warsh</option>
            <option value="Hafs" ${p.reading==='Hafs'?'selected':''}>حفص — Hafs</option>
          </select></div>
      </div>`;
    this.showModal(body, [
      { label:'💾 Enregistrer', class:'btn-primary', action: async () => {
        const name = document.getElementById('ep-name').value.trim();
        const number = parseInt(document.getElementById('ep-number').value);
        const gender = document.getElementById('ep-gender').value;
        const reading = document.getElementById('ep-reading').value;
        if (!name) return this.showToast('Nom requis','error');
        this.closeModal();
        try {
          await this.api('PUT', '/api/participants/'+id, {name, number, gender, reading});
          this.participants = await this.api('GET','/api/participants');
          const el = document.getElementById('participants-table');
          if (el) el.innerHTML = this.renderParticipantsTable();
          const pl = document.getElementById('participant-list');
          if (pl) pl.innerHTML = this.renderParticipantsList();
          this.showToast('✅ Participant modifié','success');
        } catch(e) { this.showToast(e.message,'error'); }
      }},
      { label:'Annuler', class:'btn-ghost', action: () => this.closeModal() }
    ]);
  },

  async editUser(id) {
    let users;
    try { users = await this.api('GET','/api/users'); } catch(e) { return; }
    const u = users.find(x => x.id === id);
    if (!u) return;
    const roleOptions = ['admin','president','judge','participant','public']
      .map(r => `<option value="${r}" ${u.role===r?'selected':''}>${this.getRoleLabel(r)}</option>`).join('');
    const body = `
      <div class="modal-title" style="margin-bottom:16px;">✏️ Modifier compte</div>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div class="form-group" style="margin:0"><label>Nom complet</label>
          <input class="form-control" id="eu-name" value="${u.name}"></div>
        <div class="form-group" style="margin:0"><label>Identifiant</label>
          <input class="form-control" id="eu-username" value="${u.username}" style="direction:ltr;text-align:left;" ${u.username==='admin'?'disabled':''}></div>
        <div class="form-group" style="margin:0"><label>Nouveau mot de passe <span style="color:var(--text-muted);font-size:0.75rem;">(laisser vide = inchangé)</span></label>
          <input class="form-control" id="eu-password" type="password" placeholder="••••••••"></div>
        <div class="form-group" style="margin:0"><label>Rôle</label>
          <select class="form-control" id="eu-role" ${u.username==='admin'?'disabled':''}>${roleOptions}</select></div>
      </div>`;
    this.showModal(body, [
      { label:'💾 Enregistrer', class:'btn-primary', action: async () => {
        const name = document.getElementById('eu-name').value.trim();
        const password = document.getElementById('eu-password').value;
        const role = document.getElementById('eu-role').value;
        if (!name) return this.showToast('Nom requis','error');
        this.closeModal();
        try {
          const body = {name, role};
          if (password) body.password = password;
          await this.api('PUT','/api/users/'+id, body);
          await this.initUsers();
          this.showToast('✅ Compte modifié','success');
        } catch(e) { this.showToast(e.message,'error'); }
      }},
      { label:'Annuler', class:'btn-ghost', action: () => this.closeModal() }
    ]);
  },

  deleteUser(id,name) {
    this.showModal('<div class="modal-title">⚠️ Supprimer compte</div><p style="text-align:center;margin-top:12px;">Supprimer <strong style="color:var(--gold)">' + name + '</strong> ?</p>',
    [
      { label:'🗑️ Supprimer', class:'btn-danger', action: async () => {
        this.closeModal();
        try { await this.api('DELETE','/api/users/'+id); await this.initUsers(); }
        catch(e) { this.showToast(e.message,'error'); }
      }},
      { label:'Annuler', class:'btn-ghost', action: () => this.closeModal() }
    ]);
  },

  // ── EMERGENCY ─────────────────────────────────────────────────────────────
  pageEmergency() {
    return `
    <h2 style="color:var(--red);margin-bottom:20px;font-family:'Amiri',serif;">🚨 Panneau d'Urgence</h2>
    <div class="emergency-panel">
      <div class="emergency-title">⚠️ Utilisez avec précaution</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;">
        <button class="btn btn-danger" onclick="App.emergencyReset()">🔄 Réinitialiser</button>
        <button class="btn btn-danger" onclick="App.emergencyStop()">⏹️ Arrêter</button>
        <button class="btn btn-danger" onclick="location.reload()">🔁 Recharger</button>
      </div>
    </div>
    <div class="card" style="margin-top:20px;">
      <div class="card-header"><div class="card-title">📢 Diffusion</div></div>
      <textarea id="broadcast-msg" class="form-control" rows="3" placeholder="Message à diffuser..." style="margin-bottom:12px;"></textarea>
      <button class="btn btn-ghost" onclick="App.broadcastMsg()">📢 Diffuser à tous</button>
    </div>`;
  },

  emergencyReset() {
    this.showModal('<div class="modal-title">🔄 Réinitialiser</div><p style="text-align:center;margin-top:12px;color:var(--text-muted);">Réinitialiser l\'état de la compétition ?</p>',
    [
      { label:'✅ Confirmer', class:'btn-danger', action: async () => { this.closeModal(); await this.api('POST','/api/emergency/reset'); }},
      { label:'Annuler', class:'btn-ghost', action: () => this.closeModal() }
    ]);
  },

  emergencyStop() {
    this.showModal('<div class="modal-title">⏹️ Arrêter</div><p style="text-align:center;margin-top:12px;color:var(--text-muted);">Arrêter la compétition ?</p>',
    [
      { label:'⏹️ Arrêter', class:'btn-danger', action: async () => { this.closeModal(); await this.api('POST','/api/emergency/stop'); }},
      { label:'Annuler', class:'btn-ghost', action: () => this.closeModal() }
    ]);
  },

  broadcastMsg() {
    const msg = document.getElementById('broadcast-msg')?.value.trim();
    if (!msg) return;
    this.socket.emit('broadcast', { message: msg });
    this.showToast('✅ Message diffusé','success');
  },

  // ── PUBLIC / PARTICIPANT SCREEN ───────────────────────────────────────────
  renderParticipantPublicScreen() {
    const isParticipant = this.user.role === 'participant';
    const isPublic = this.user.role === 'public';
    const comp = this.competition||{};
    const currentP = this.participants.find(p => p.id === comp.currentParticipantId);
    this._currentPage = comp.currentPage || 1;
    const canNav = isParticipant && comp.participantHasHand;
    const roleLabel = isParticipant ? 'Participant' : 'Public';
    const roleColor = isParticipant ? '#3498db' : '#27ae60';

    document.getElementById('app').innerHTML = `
    <div style="height:100vh;display:flex;flex-direction:column;background:#0a1208;overflow:hidden;">

      <!-- Header compact -->
      <div style="padding:6px 14px;border-bottom:1px solid rgba(201,168,76,0.2);display:flex;align-items:center;justify-content:space-between;background:rgba(0,0,0,0.5);flex-shrink:0;">
        <h1 style="font-family:'Amiri',serif;font-size:1rem;color:var(--gold);">المسابقة الوطنية لتلاوة القرآن الكريم</h1>
        <div style="display:flex;align-items:center;gap:8px;">
          <!-- Badge rôle + nom utilisateur -->
          <div style="display:flex;align-items:center;gap:6px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:20px;padding:4px 10px;">
            <span style="font-size:0.78rem;color:#ccc;">${this.user.name}</span>
            <span style="background:${roleColor};color:white;font-size:0.7rem;font-weight:700;padding:2px 8px;border-radius:12px;">${roleLabel}</span>
          </div>
          ${isParticipant ? '<span id="hand-badge" style="padding:3px 10px;border-radius:20px;font-size:0.72rem;font-weight:700;background:rgba(192,57,43,0.2);border:1px solid rgba(192,57,43,0.5);color:#E74C3C;">⏳ En attente</span>' : ''}
          <button onclick="App.toggleFullscreen()" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:#aaa;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:0.9rem;" title="Plein écran">⛶</button>
          <button onclick="App.logout()" style="background:rgba(192,57,43,0.2);border:1px solid rgba(192,57,43,0.4);color:#e74c3c;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:0.85rem;">🚪</button>
        </div>
      </div>

      <!-- Mushaf 4:3 centré -->
      <div style="flex:1;display:flex;min-height:0;position:relative;overflow:hidden;padding:6px;align-items:center;justify-content:center;">
        <div id="pub-book" style="aspect-ratio:4/3;height:100%;max-width:100%;display:flex;background:#e8dcc8;border-radius:3px;box-shadow:0 4px 30px rgba(0,0,0,0.9);overflow:hidden;position:relative;">
          <!-- Reliure centrale -->
          <div style="position:absolute;left:50%;top:0;bottom:0;width:8px;transform:translateX(-50%);background:linear-gradient(to right,rgba(0,0,0,0.25),rgba(100,70,10,0.7),rgba(201,168,76,0.4),rgba(100,70,10,0.7),rgba(0,0,0,0.25));z-index:3;pointer-events:none;"></div>
          <!-- Page gauche -->
          <div id="pub-page-left" style="flex:1;overflow:hidden;display:flex;align-items:stretch;"></div>
          <!-- Page droite -->
          <div id="pub-page-right" style="flex:1;overflow:hidden;display:flex;align-items:stretch;"></div>
        </div>

        <!-- Résultats overlay -->
        <div id="pub-results" style="display:${comp.resultsVisible?'flex':'none'};position:absolute;inset:0;background:rgba(0,0,0,0.88);z-index:10;align-items:center;justify-content:center;overflow-y:auto;">
          <div style="width:100%;max-width:700px;padding:20px;">
            <h3 style="color:var(--gold);text-align:center;margin-bottom:16px;font-family:'Amiri',serif;font-size:1.8rem;">🏆 Classement Final</h3>
            <div id="pub-rankings">${this.renderPublicRankings()}</div>
          </div>
        </div>
      </div>

      <!-- Barre fixe en bas -->
      <div style="flex-shrink:0;background:rgba(0,0,0,0.7);border-top:1px solid rgba(201,168,76,0.25);padding:6px 16px;display:flex;align-items:center;justify-content:space-between;gap:16px;">

        <!-- Gauche : Nom participant en grand -->
        <div style="min-width:160px;">
          <div style="font-family:'Amiri',serif;font-size:2rem;color:var(--gold);font-weight:700;line-height:1.1;" id="pub-name">${currentP?.name||'—'}</div>
          <div style="color:var(--text-muted);font-size:0.75rem;margin-top:1px;" id="pub-info">${currentP?'N°'+currentP.number+' • '+currentP.reading:''}</div>
        </div>

        <!-- Centre : Navigation (participant) ou vide (public) -->
        ${isParticipant ? `
        <div style="display:flex;align-items:center;gap:8px;justify-content:center;">
          <button id="pub-btn-prev" class="flipbook-nav-btn${canNav?'':' nav-disabled'}" onclick="App.pubFlipPrev()" ${canNav?'':'disabled'}>◀</button>
          <span style="color:var(--gold);font-size:0.78rem;font-weight:600;white-space:nowrap;" id="pub-page-label">Page ${this._currentPage} / 604</span>
          <button id="pub-btn-next" class="flipbook-nav-btn${canNav?'':' nav-disabled'}" onclick="App.pubFlipNext()" ${canNav?'':'disabled'}>▶</button>
        </div>` : '<div></div>'}

        <!-- Droite : Chronomètre -->
        <div id="pub-timer" class="timer-display" style="font-size:2rem;font-weight:900;min-width:110px;text-align:center;">${this.formatTime(comp.timerDuration||300)}</div>

      </div>
    </div>
    <div class="toast-container" id="toast-container"></div>`;

    this.pubRenderDoublePage(this._currentPage);
    if (comp.timerRunning && comp.timerEndTime) this.startPubTimer(comp.timerEndTime);
    if (!this.socket) this.connectSocket();
  },

  pubRenderDoublePage(page, direction) {
    this._currentPage = page;
    const label = document.getElementById('pub-page-label');
    if (label) label.textContent = 'Page ' + page + ' / 604';
    const folder = this.getReadingFolder();

    const imgUrl = (p) => folder + '/page_' + String(p).padStart(3,'0') + '.png';

    const left = document.getElementById('pub-page-left');
    const right = document.getElementById('pub-page-right');
    if (!left || !right) return;

    const setPages = () => {
      left.style.backgroundImage = page <= 604 ? 'url(' + imgUrl(page) + ')' : 'none';
      const rp = page + 1;
      right.style.backgroundImage = rp <= 604 ? 'url(' + imgUrl(rp) + ')' : 'none';
    };

    // Style de base pour les pages
    [left, right].forEach(el => {
      el.style.backgroundSize = '100% 100%';
      el.style.backgroundRepeat = 'no-repeat';
      el.style.backgroundPosition = 'center';
      el.style.width = '100%';
      el.style.height = '100%';
    });

    if (!direction) {
      setPages();
      return;
    }

    // Vrai effet de tournage de page
    const isNext = direction === 'next';

    // Créer la page qui tourne
    const flipPage = document.createElement('div');
    flipPage.style.cssText = [
      'position:absolute',
      'top:0', 'bottom:0',
      isNext ? 'right:0' : 'left:0',
      'width:50%',
      'z-index:5',
      'transform-origin:' + (isNext ? 'left' : 'right') + ' center',
      'transform-style:preserve-3d',
      'transition:transform 0.6s cubic-bezier(0.645,0.045,0.355,1.000)',
      'backface-visibility:hidden',
      'background-image:url(' + imgUrl(isNext ? page-1 : page+2) + ')',
      'background-size:100% 100%',
      'background-repeat:no-repeat',
      'box-shadow:' + (isNext ? '-4px' : '4px') + ' 0 12px rgba(0,0,0,0.4)',
    ].join(';');

    const book = document.getElementById('pub-book');
    book.style.position = 'relative';
    book.appendChild(flipPage);

    // Mettre les nouvelles pages derrière
    setPages();

    // Démarrer l'animation
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        flipPage.style.transform = isNext ? 'rotateY(-180deg)' : 'rotateY(180deg)';
        flipPage.style.boxShadow = 'none';
      });
    });

    setTimeout(() => {
      flipPage.remove();
    }, 650);
  },

  pubFlipNext() {
    if (this._flipping) return;
    const n = Math.min((this._currentPage||1)+2, 603);
    this._flipping = true;
    this.pubRenderDoublePage(n, 'next');
    this.socket.emit('page_change', {page: n});
    setTimeout(() => { this._flipping = false; }, 700);
  },

  pubFlipPrev() {
    if (this._flipping) return;
    const p = Math.max((this._currentPage||1)-2, 1);
    this._flipping = true;
    this.pubRenderDoublePage(p, 'prev');
    this.socket.emit('page_change', {page: p});
    setTimeout(() => { this._flipping = false; }, 700);
  },

  renderPublicRankings() {
    const r = this._rankings?.selection || { male:[], female:[] };
    const renderList = (list, title) => {
      if (!list.length) return '';
      return '<div style="margin-bottom:16px;"><div style="color:var(--gold);font-weight:700;margin-bottom:8px;">' + title + '</div>' +
        list.slice(0,5).map(r =>
          '<div style="display:flex;align-items:center;gap:12px;padding:8px;background:rgba(255,255,255,0.03);border-radius:8px;margin-bottom:4px;">' +
          '<div style="font-size:1.4rem;width:36px;text-align:center;">' + (r.rank===1?'🥇':r.rank===2?'🥈':r.rank===3?'🥉':r.rank) + '</div>' +
          '<div style="flex:1"><div style="font-weight:600">' + r.participant.name + '</div>' +
          '<div style="font-size:0.75rem;color:var(--text-muted)">' + r.participant.reading + '</div></div>' +
          '<div style="font-size:1.4rem;font-weight:900;color:var(--gold)">' + r.total + '</div>' +
          '</div>'
        ).join('') + '</div>';
    };
    return renderList(r.male,'👨 Garçons') + renderList(r.female,'👩 Filles');
  },

  startPubTimer(endTime) {
    if (this._pubTimer) clearInterval(this._pubTimer);
    this._pubTimer = setInterval(() => {
      const rem = Math.max(0, Math.ceil((endTime - App.now())/1000));
      const el = document.getElementById('pub-timer');
      if (el) {
        el.textContent = this.formatTime(rem);
        el.className = 'timer-display' + (rem<=30?' danger':rem<=60?' warning':'');
        el.style.fontSize = '3rem';
      }
      if (rem <= 0) clearInterval(this._pubTimer);
    }, 200);
  },

  // ── Timer helpers ─────────────────────────────────────────────────────────
  syncTimer() {
    const comp = this.competition||{};
    if (comp.timerRunning && comp.timerEndTime) {
      this.startDashboardTimer(comp.timerEndTime);
    } else {
      const el = document.getElementById('db-timer');
      if (el) el.textContent = this.formatTime(comp.timerDuration||300);
    }
  },

  startDashboardTimer(endTime) {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      const rem = Math.max(0, Math.ceil((endTime - App.now())/1000));
      const el = document.getElementById('db-timer');
      if (el) {
        el.textContent = this.formatTime(rem);
        el.className = 'timer-display' + (rem<=30?' danger':rem<=60?' warning':'');
        el.style.fontSize = '2.2rem';
      }
      if (rem <= 0) { clearInterval(this.timerInterval); this.timerInterval = null; }
    }, 200);
  },

  timerStart() { this.socket.emit('timer_start', { duration: this.competition?.timerDuration||300 }); },
  timerStop()  { this.socket.emit('timer_stop'); },
  timerReset() { this.socket.emit('timer_reset', { duration: this.competition?.timerDuration||300 }); },

  onTimerUpdate(data) {
    if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }
    if (this._pubTimer) { clearInterval(this._pubTimer); this._pubTimer = null; }

    if (this.user?.role === 'public' || this.user?.role === 'participant') {
      if (data.running && data.endTime) this.startPubTimer(data.endTime);
      else {
        const el = document.getElementById('pub-timer');
        if (el) { el.textContent = this.formatTime(data.duration||300); el.className='timer-display'; el.style.fontSize='3rem'; }
      }
    } else {
      if (data.running && data.endTime) this.startDashboardTimer(data.endTime);
      else {
        const el = document.getElementById('db-timer');
        if (el) { el.textContent = this.formatTime(data.duration||300); el.className='timer-display'; el.style.fontSize='2.2rem'; }
      }
    }
  },

  // ── Real-time update handlers ─────────────────────────────────────────────
  onCompetitionUpdate(comp) {
    if (this.user?.role === 'public' || this.user?.role === 'participant') {
      const currentP = this.participants.find(p => p.id === comp.currentParticipantId);
      const n = document.getElementById('pub-name'); if(n) n.textContent = currentP?.name||'—';
      const inf = document.getElementById('pub-info'); if(inf) inf.textContent = currentP?'N°'+currentP.number+' • '+currentP.reading:'';
      if (this.user.role === 'participant') {
        const badge = document.getElementById('hand-badge');
        if (badge) {
          badge.textContent = comp.participantHasHand ? '🎤 Vous récitez' : '⏳ En attente';
          badge.style.background = comp.participantHasHand ? 'rgba(46,204,113,0.2)' : 'rgba(192,57,43,0.2)';
          badge.style.borderColor = comp.participantHasHand ? 'rgba(46,204,113,0.5)' : 'rgba(192,57,43,0.5)';
          badge.style.color = comp.participantHasHand ? '#2ECC71' : '#E74C3C';
        }
        // Activer/griser boutons navigation
        const btnPrev = document.getElementById('pub-btn-prev');
        const btnNext = document.getElementById('pub-btn-next');
        if (btnPrev) { btnPrev.disabled = !comp.participantHasHand; btnPrev.classList.toggle('nav-disabled', !comp.participantHasHand); }
        if (btnNext) { btnNext.disabled = !comp.participantHasHand; btnNext.classList.toggle('nav-disabled', !comp.participantHasHand); }
      }
      const res = document.getElementById('pub-results'); if(res) res.style.display = comp.resultsVisible?'block':'none';
      const rank = document.getElementById('pub-rankings'); if(rank) rank.innerHTML = this.renderPublicRankings();
      if (comp.currentPage && comp.currentPage !== this._currentPage) this.pubRenderDoublePage(comp.currentPage);
      return;
    }

    const currentP = this.participants.find(p => p.id === comp.currentParticipantId);
    const nm = document.getElementById('db-participant-name');
    if (nm) nm.textContent = currentP?.name || '— En attente —';
    const inf = document.getElementById('db-participant-info');
    if (inf) inf.textContent = currentP ? 'N°'+currentP.number+' • '+currentP.reading+' • '+(currentP.gender==='male'?'👨 Masculin':'👩 Féminin') : '';
    if (comp.currentPage && comp.currentPage !== this._currentPage) this.renderDoublePage(comp.currentPage);
    this.syncTimer();

    const btnHand = document.getElementById('btn-give-hand');
    if (btnHand) {
      btnHand.textContent = comp.participantHasHand ? '✋ Reprendre la main' : '🤝 Donner la main + Démarrer';
      btnHand.className = 'btn ' + (comp.participantHasHand ? 'btn-danger' : 'btn-primary');
    }

    const pl = document.getElementById('db-participants-list');
    if (pl) pl.innerHTML = this.renderParticipantsList();
  },

  onParticipantsUpdate() {
    const role = this.user?.role;
    if (role === 'public' || role === 'participant') {
      const currentP = this.participants.find(p => p.id === this.competition?.currentParticipantId);
      const n = document.getElementById('pub-name'); if(n) n.textContent = currentP?.name||'—';
      return;
    }
    const el = document.getElementById('participants-table');
    if (el) el.innerHTML = this.renderParticipantsTable();
    const pl = document.getElementById('db-participants-list');
    if (pl) pl.innerHTML = this.renderParticipantsList();
    // Refresh scoring panel for judges (new participant selected)
    const sc = document.getElementById('scoring-card');
    if (sc) sc.innerHTML = '<div class="card-title" style="margin-bottom:4px;">✏️ Notation</div>' + this.renderScoringPanel();
  },

  onScoresUpdate() {
    // Refresh scoring card for judges
    const sc = document.getElementById('scoring-card');
    if (sc) sc.innerHTML = '<div class="card-title" style="margin-bottom:4px;">✏️ Notation</div>' + this.renderScoringPanel();
    // Refresh recent scores
    const rs = document.getElementById('recent-scores-card');
    if (rs) rs.innerHTML = '<div class="card-title" style="margin-bottom:12px;">📋 Dernières notes</div>' + this.renderRecentScores();
    // Public rankings
    const rank = document.getElementById('pub-rankings');
    if (rank) rank.innerHTML = this.renderPublicRankings();
  },

  onRankingsUpdate() {
    // Refresh rankings page if open
    const mc = document.getElementById('main-content');
    if (!mc) return;
    const active = document.querySelector('.nav-item.active')?.dataset?.page;
    if (active === 'rankings') mc.innerHTML = this.pageRankings();
    if (active === 'finale') mc.innerHTML = this.pageFinale();
    // Public
    const rank = document.getElementById('pub-rankings');
    if (rank) rank.innerHTML = this.renderPublicRankings();
  },

  onCriteriaUpdate() {
    const el = document.getElementById('criteria-list');
    if (el) el.innerHTML = this.renderCriteriaList();
  },

  renderFlipbookPage(page) {
    if (this.user?.role === 'public' || this.user?.role === 'participant') this.pubRenderDoublePage(page);
    else this.renderDoublePage(page);
  },

  // ── Recent scores ─────────────────────────────────────────────────────────
  renderRecentScores() {
    const isJudge = this.user?.role === 'judge';
    let list = isJudge ? this.scores.filter(s=>s.judgeId===this.user.userId) : [...this.scores];
    list = list.sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp)).slice(0,5);
    if (!list.length) return '<p style="color:var(--text-muted);font-size:0.82rem;text-align:center;">Aucune note</p>';
    return list.map(s => {
      const p = this.participants.find(x=>x.id===s.participantId);
      return '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:0.82rem;">' +
        '<span>' + (p?.name||'?') + '</span>' +
        (!isJudge?'<span style="color:var(--text-muted)">' + s.judgeName + '</span>':'') +
        '<strong style="color:var(--gold)">' + s.total + '/20</strong></div>';
    }).join('');
  },

  // ── Utilities ─────────────────────────────────────────────────────────────
  formatTime(s) {
    return String(Math.floor(s/60)).padStart(2,'0') + ':' + String(s%60).padStart(2,'0');
  },

  toArabicNumerals(n) {
    return String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
  },

  getRoleLabel(role) {
    return { admin:'Admin', president:'Président', judge:'Juge', participant:'Participant', public:'Public' }[role] || role;
  },

  showModal(content, actions) {
    const root = document.getElementById('modal-root'); if (!root) return;
    root.innerHTML = '<div class="modal-overlay" onclick="event.target===this&&App.closeModal()">' +
      '<div class="modal-box">' + content +
      '<div class="modal-actions">' + actions.map((a,i)=>'<button class="btn ' + a.class + '" id="mb'+i+'">' + a.label + '</button>').join('') +
      '</div></div></div>';
    actions.forEach((a,i) => document.getElementById('mb'+i).addEventListener('click', a.action));
  },

  closeModal() { const r=document.getElementById('modal-root'); if(r) r.innerHTML=''; },

  showToast(msg, type='info') {
    const c = document.getElementById('toast-container'); if (!c) return;
    const t = document.createElement('div');
    t.className = 'toast toast-' + type;
    t.innerHTML = '<span>' + ({success:'✅',error:'❌',info:'ℹ️'}[type]||'ℹ️') + '</span><span>' + msg + '</span>';
    c.appendChild(t);
    setTimeout(() => { t.classList.add('toast-out'); setTimeout(()=>t.remove(),300); }, 3500);
  }
};

window.addEventListener('DOMContentLoaded', () => App.init());
