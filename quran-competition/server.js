const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingInterval: 5000,
  pingTimeout: 10000
});

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const RESULTS_FILE = path.join(DATA_DIR, 'results.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function readUsers() { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); }
function writeUsers(d) { fs.writeFileSync(USERS_FILE, JSON.stringify(d, null, 2)); }
function readResults() { return JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8')); }
function writeResults(d) { fs.writeFileSync(RESULTS_FILE, JSON.stringify(d, null, 2)); }

const sessions = {};
const scoreUnlocks = {};

function requireAuth(req, res, next) {
  const token = req.headers['x-auth-token'];
  if (!token || !sessions[token]) return res.status(401).json({ error: 'Non autorise' });
  req.user = sessions[token];
  next();
}
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Acces refuse' });
    next();
  };
}

function defaultCriteria() {
  return [
    { key: 'makhaarij',   label: 'المخارج',                              max: 3 },
    { key: 'sifaat',      label: 'الصفات',                               max: 3 },
    { key: 'mudood',      label: 'المدود',                               max: 3 },
    { key: 'tafkhim',     label: 'التفخيم والترقيق والإمالات',           max: 3 },
    { key: 'noon_saakin', label: 'أحكام النون الساكنة والمشددة',         max: 2 },
    { key: 'meem_saakin', label: 'أحكام الميم الساكنة والمشددة',         max: 2 },
    { key: 'waqf',        label: 'الوقف والابتداء',                      max: 2 },
    { key: 'adaa',        label: 'الأداء',                               max: 2 }
  ];
}

function computeRankings(db, phase) {
  const participants = phase
    ? db.participants.filter(p => p.phase === phase)
    : db.participants;

  return participants.map(p => {
    const scoreField = phase === 'final' ? 'final_scores' : 'scores';
    const pScores = db[scoreField] ? db[scoreField].filter(s => s.participantId === p.id) : db.scores.filter(s => s.participantId === p.id);
    const judgeCount = pScores.length;
    if (!judgeCount) return null;
    let totals = pScores.map(s => s.total).sort((a, b) => a - b);
    if (judgeCount >= 3) totals = totals.slice(1, -1);
    const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
    return { participant: p, scores: pScores, total: Math.round(avg * 100) / 100, judgeCount };
  })
  .filter(Boolean)
  .sort((a, b) => b.total - a.total)
  .map((r, i) => ({ ...r, rank: i + 1 }));
}

function broadcastAll(db) {
  // Broadcast competition state to all
  io.emit('competition_updated', db.competition);
  io.emit('participants_updated', db.participants);
  broadcastScores(db);
}

function broadcastScores(db) {
  io.to('role_president').to('role_admin').emit('scores_updated', db.scores);
  io.to('role_president').to('role_admin').emit('final_scores_updated', db.final_scores || []);
  io.sockets.sockets.forEach(s => {
    if (s.user && s.user.role === 'judge') {
      s.emit('scores_updated', db.scores.filter(sc => sc.judgeId === s.user.userId));
      s.emit('final_scores_updated', (db.final_scores || []).filter(sc => sc.judgeId === s.user.userId));
    }
  });
}

// ─── Auth ──────────────────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const db = readUsers();
  const user = db.users.find(u => u.username === username && u.active);
  if (!user) return res.status(401).json({ error: 'Utilisateur introuvable' });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: 'Mot de passe incorrect' });
  const token = uuidv4();
  sessions[token] = { userId: user.id, role: user.role, name: user.name, username: user.username };
  res.json({ token, role: user.role, name: user.name, userId: user.id });
});

app.post('/api/logout', requireAuth, (req, res) => {
  delete sessions[req.headers['x-auth-token']];
  res.json({ ok: true });
});

app.get('/api/me', requireAuth, (req, res) => res.json(req.user));

// ─── Users ─────────────────────────────────────────────────────────────────
app.get('/api/users', requireAuth, requireRole('admin'), (req, res) => {
  res.json(readUsers().users.map(u => ({ ...u, password: undefined })));
});

app.post('/api/users', requireAuth, requireRole('admin'), async (req, res) => {
  const { username, password, role, name } = req.body;
  if (!username || !password || !role || !name) return res.status(400).json({ error: 'Champs manquants' });
  const db = readUsers();
  if (db.users.find(u => u.username === username)) return res.status(400).json({ error: 'Utilisateur existe deja' });
  const user = { id: uuidv4(), username, password: await bcrypt.hash(password, 10), role, name, active: true };
  db.users.push(user);
  writeUsers(db);
  io.emit('users_updated');
  res.json({ ...user, password: undefined });
});

app.put('/api/users/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const db = readUsers();
  const idx = db.users.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Introuvable' });
  const { password, name, role, active } = req.body;
  if (name) db.users[idx].name = name;
  if (role) db.users[idx].role = role;
  if (typeof active !== 'undefined') db.users[idx].active = active;
  if (password) db.users[idx].password = await bcrypt.hash(password, 10);
  writeUsers(db);
  io.emit('users_updated');
  res.json({ ...db.users[idx], password: undefined });
});

app.delete('/api/users/:id', requireAuth, requireRole('admin'), (req, res) => {
  const db = readUsers();
  const idx = db.users.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Introuvable' });
  if (db.users[idx].username === 'admin') return res.status(400).json({ error: 'Impossible de supprimer admin' });
  db.users.splice(idx, 1);
  writeUsers(db);
  io.emit('users_updated');
  res.json({ ok: true });
});

// ─── Participants ──────────────────────────────────────────────────────────
app.get('/api/participants', requireAuth, (req, res) => res.json(readResults().participants));

app.post('/api/participants', requireAuth, requireRole('admin', 'president'), (req, res) => {
  const { name, gender, reading, category } = req.body;
  if (!name) return res.status(400).json({ error: 'Nom requis' });
  const db = readResults();
  const p = { id: uuidv4(), name, gender: gender || 'male', reading: reading || 'Warsh', category: category || 'selection', phase: 'selection', number: db.participants.length + 1, active: true, createdAt: new Date().toISOString() };
  db.participants.push(p);
  writeResults(db);
  io.emit('participants_updated', db.participants);
  res.json(p);
});

app.put('/api/participants/:id', requireAuth, requireRole('admin', 'president'), (req, res) => {
  const db = readResults();
  const idx = db.participants.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Introuvable' });
  Object.assign(db.participants[idx], req.body);
  writeResults(db);
  io.emit('participants_updated', db.participants);
  res.json(db.participants[idx]);
});

app.delete('/api/participants/:id', requireAuth, requireRole('admin', 'president'), (req, res) => {
  const db = readResults();
  db.participants = db.participants.filter(p => p.id !== req.params.id);
  db.scores = db.scores.filter(s => s.participantId !== req.params.id);
  db.final_scores = (db.final_scores || []).filter(s => s.participantId !== req.params.id);
  writeResults(db);
  io.emit('participants_updated', db.participants);
  broadcastScores(db);
  res.json({ ok: true });
});

// ─── Scoring Criteria ──────────────────────────────────────────────────────
app.get('/api/criteria', requireAuth, (req, res) => {
  const db = readResults();
  res.json(db.competition.criteria || defaultCriteria());
});

app.put('/api/criteria', requireAuth, requireRole('admin'), (req, res) => {
  const { criteria } = req.body;
  if (!Array.isArray(criteria)) return res.status(400).json({ error: 'Format invalide' });
  const db = readResults();
  db.competition.criteria = criteria;
  writeResults(db);
  io.emit('criteria_updated', criteria);
  res.json(criteria);
});

// ─── Scores ────────────────────────────────────────────────────────────────
app.get('/api/scores', requireAuth, (req, res) => {
  const db = readResults();
  const user = req.user;
  if (user.role === 'judge') return res.json(db.scores.filter(s => s.judgeId === user.userId));
  res.json(db.scores);
});

app.get('/api/final-scores', requireAuth, (req, res) => {
  const db = readResults();
  const user = req.user;
  const fs2 = db.final_scores || [];
  if (user.role === 'judge') return res.json(fs2.filter(s => s.judgeId === user.userId));
  res.json(fs2);
});

app.post('/api/scores', requireAuth, requireRole('judge', 'president', 'admin'), (req, res) => {
  const { participantId, criteria, isFinal } = req.body;
  if (!participantId || !criteria) return res.status(400).json({ error: 'Donnees manquantes' });
  const db = readResults();
  const total = Object.values(criteria).reduce((a, b) => a + (parseInt(b) || 0), 0);
  const scoreArr = isFinal ? (db.final_scores || []) : db.scores;
  const existing = scoreArr.findIndex(s => s.participantId === participantId && s.judgeId === req.user.userId);
  const entry = { id: uuidv4(), participantId, judgeId: req.user.userId, judgeName: req.user.name, criteria, total, timestamp: new Date().toISOString(), isFinal: !!isFinal };
  if (existing !== -1) scoreArr[existing] = entry;
  else scoreArr.push(entry);
  if (isFinal) db.final_scores = scoreArr;
  else db.scores = scoreArr;
  writeResults(db);
  // Broadcast updated
  broadcastScores(db);
  // Also broadcast rankings
  io.to('role_president').to('role_admin').emit('rankings_updated', {
    selection: computeRankingsGender(db, 'selection'),
    final: computeRankingsGender(db, 'final')
  });
  delete scoreUnlocks[req.user.userId];
  res.json(entry);
});

app.delete('/api/scores/:id', requireAuth, requireRole('admin', 'president'), (req, res) => {
  const db = readResults();
  db.scores = db.scores.filter(s => s.id !== req.params.id);
  db.final_scores = (db.final_scores || []).filter(s => s.id !== req.params.id);
  writeResults(db);
  broadcastScores(db);
  res.json({ ok: true });
});

// ─── Rankings ──────────────────────────────────────────────────────────────
function computeRankingsGender(db, phase) {
  const isFinal = phase === 'final';
  const scoreArr = isFinal ? (db.final_scores || []) : db.scores;
  const participants = isFinal
    ? db.participants.filter(p => p.phase === 'final')
    : db.participants;

  const compute = (list) => list.map(p => {
    const pScores = scoreArr.filter(s => s.participantId === p.id);
    if (!pScores.length) return null;
    let totals = pScores.map(s => s.total).sort((a, b) => a - b);
    if (pScores.length >= 3) totals = totals.slice(1, -1);
    const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
    return { participant: p, total: Math.round(avg * 100) / 100, judgeCount: pScores.length };
  }).filter(Boolean).sort((a, b) => b.total - a.total).map((r, i) => ({ ...r, rank: i + 1 }));

  return {
    male: compute(participants.filter(p => p.gender === 'male')),
    female: compute(participants.filter(p => p.gender === 'female')),
    all: compute(participants)
  };
}

app.get('/api/rankings', requireAuth, (req, res) => {
  const db = readResults();
  res.json({
    selection: computeRankingsGender(db, 'selection'),
    final: computeRankingsGender(db, 'final')
  });
});

// Promote top 5 male + 5 female to final
app.post('/api/promote-finalists', requireAuth, requireRole('admin', 'president'), (req, res) => {
  const db = readResults();
  const rankings = computeRankingsGender(db, 'selection');
  const top5male = rankings.male.slice(0, 5).map(r => r.participant.id);
  const top5female = rankings.female.slice(0, 5).map(r => r.participant.id);
  const finalistIds = [...top5male, ...top5female];
  db.participants = db.participants.map(p => ({
    ...p,
    phase: finalistIds.includes(p.id) ? 'final' : p.phase || 'selection'
  }));
  writeResults(db);
  io.emit('participants_updated', db.participants);
  res.json({ promoted: finalistIds.length, finalistIds });
});

// ─── Competition ────────────────────────────────────────────────────────────
// Endpoint public pour la page de login (sans auth)
app.get('/api/competition-public', (req, res) => {
  const db = readResults();
  const { title, edition, date_debut, date_fin, lieu } = db.competition;
  res.json({ title, edition, date_debut, date_fin, lieu });
});

app.get('/api/competition', requireAuth, (req, res) => res.json(readResults().competition));

app.put('/api/competition', requireAuth, requireRole('admin', 'president'), (req, res) => {
  const db = readResults();
  Object.assign(db.competition, req.body);
  writeResults(db);
  io.emit('competition_updated', db.competition);
  res.json(db.competition);
});

app.put('/api/timer-presets', requireAuth, requireRole('admin'), (req, res) => {
  const { presets } = req.body;
  if (!Array.isArray(presets)) return res.status(400).json({ error: 'Format invalide' });
  const db = readResults();
  db.competition.timerPresets = presets;
  writeResults(db);
  io.emit('competition_updated', db.competition);
  res.json(presets);
});

app.post('/api/emergency/reset', requireAuth, requireRole('admin'), (req, res) => {
  const db = readResults();
  Object.assign(db.competition, { status: 'active', currentParticipantId: null, participantHasHand: false, timerRunning: false, timerEndTime: null });
  writeResults(db);
  io.emit('competition_updated', db.competition);
  io.emit('emergency', { type: 'reset', message: 'Competition reinitialisee par Admin' });
  res.json({ ok: true });
});

app.post('/api/emergency/stop', requireAuth, requireRole('admin'), (req, res) => {
  const db = readResults();
  Object.assign(db.competition, { status: 'stopped', timerRunning: false, participantHasHand: false });
  writeResults(db);
  io.emit('competition_updated', db.competition);
  io.emit('emergency', { type: 'stop', message: 'Competition arretee par Admin' });
  res.json({ ok: true });
});

// ─── Socket.IO ─────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('+ Client:', socket.id);

  socket.on('authenticate', (token) => {
    if (!sessions[token]) return socket.emit('auth_error', 'Token invalide');
    socket.user = sessions[token];
    socket.join('role_' + socket.user.role);
    socket.join('user_' + socket.user.userId);
    socket.emit('authenticated', socket.user);

    const db = readResults();
    socket.emit('competition_updated', db.competition);
    socket.emit('participants_updated', db.participants);
    socket.emit('criteria_updated', db.competition.criteria || defaultCriteria());

    if (socket.user.role === 'judge') {
      socket.emit('scores_updated', db.scores.filter(s => s.judgeId === socket.user.userId));
      socket.emit('final_scores_updated', (db.final_scores || []).filter(s => s.judgeId === socket.user.userId));
      socket.emit('score_lock_status', { unlocked: !!scoreUnlocks[socket.user.userId] });
    } else {
      socket.emit('scores_updated', db.scores);
      socket.emit('final_scores_updated', db.final_scores || []);
    }

    socket.emit('rankings_updated', {
      selection: computeRankingsGender(db, 'selection'),
      final: computeRankingsGender(db, 'final')
    });
  });

  // Flipbook
  socket.on('page_change', (data) => {
    if (!socket.user) return;
    if (!['admin', 'president', 'participant'].includes(socket.user.role)) return;
    if (socket.user.role === 'participant' && !readResults().competition.participantHasHand) return;
    const db = readResults();
    db.competition.currentPage = data.page;
    writeResults(db);
    io.emit('page_changed', { page: data.page });
  });

  // Select participant
  socket.on('set_current_participant', (data) => {
    if (!socket.user || !['admin', 'president'].includes(socket.user.role)) return;
    const db = readResults();
    db.competition.currentParticipantId = data.participantId;
    db.competition.participantHasHand = false;
    db.competition.timerRunning = false;
    db.competition.timerEndTime = null;
    writeResults(db);
    io.emit('competition_updated', db.competition);
    io.emit('participants_updated', db.participants);
    // Notify judges to refresh scoring panel
    io.to('role_judge').emit('participant_changed', { participantId: data.participantId });
  });

  // Give/revoke hand → start/stop timer
  socket.on('give_hand', (data) => {
    if (!socket.user || !['admin', 'president'].includes(socket.user.role)) return;
    const db = readResults();
    db.competition.participantHasHand = !!data.hasHand;
    if (data.hasHand) {
      const duration = db.competition.timerDuration || 300;
      db.competition.timerRunning = true;
      db.competition.timerEndTime = Date.now() + duration * 1000;
    } else {
      // Reprendre la main → arrêter chronomètre
      db.competition.timerRunning = false;
      db.competition.timerEndTime = null;
    }
    writeResults(db);
    io.emit('competition_updated', db.competition);
    io.emit('timer_update', {
      running: db.competition.timerRunning,
      endTime: db.competition.timerEndTime,
      duration: db.competition.timerDuration
    });
  });

  // Score unlock
  socket.on('unlock_score', (data) => {
    if (!socket.user || !['admin', 'president'].includes(socket.user.role)) return;
    if (data.unlock) scoreUnlocks[data.judgeId] = true;
    else delete scoreUnlocks[data.judgeId];
    io.to('user_' + data.judgeId).emit('score_lock_status', { unlocked: !!data.unlock });
    socket.emit('score_unlock_confirmed', { judgeId: data.judgeId, judgeName: data.judgeName, unlocked: !!data.unlock });
  });

  socket.on('request_unlock', () => {
    if (!socket.user || socket.user.role !== 'judge') return;
    io.to('role_president').to('role_admin').emit('unlock_request', {
      judgeId: socket.user.userId, judgeName: socket.user.name, timestamp: new Date().toISOString()
    });
    socket.emit('unlock_request_sent');
  });

  // Timer
  // Synchronisation d'horloge : le client envoie son timestamp, le serveur répond avec le sien
  socket.on('time_sync', (clientTime) => {
    socket.emit('time_sync_response', { clientTime, serverTime: Date.now() });
  });

  socket.on('timer_start', (data) => {
    if (!socket.user || !['admin', 'president'].includes(socket.user.role)) return;
    const db = readResults();
    const duration = data.duration || db.competition.timerDuration || 300;
    db.competition.timerRunning = true;
    db.competition.timerEndTime = Date.now() + duration * 1000;
    db.competition.timerDuration = duration;
    writeResults(db);
    io.emit('timer_update', { running: true, endTime: db.competition.timerEndTime, duration });
  });

  socket.on('timer_stop', () => {
    if (!socket.user || !['admin', 'president'].includes(socket.user.role)) return;
    const db = readResults();
    db.competition.timerRunning = false;
    db.competition.timerEndTime = null;
    writeResults(db);
    io.emit('timer_update', { running: false, endTime: null, duration: db.competition.timerDuration });
  });

  socket.on('timer_reset', (data) => {
    if (!socket.user || !['admin', 'president'].includes(socket.user.role)) return;
    const db = readResults();
    db.competition.timerRunning = false;
    db.competition.timerEndTime = null;
    if (data && data.duration) db.competition.timerDuration = data.duration;
    writeResults(db);
    io.emit('timer_update', { running: false, endTime: null, duration: db.competition.timerDuration });
  });

  socket.on('toggle_results', (data) => {
    if (!socket.user || !['admin', 'president'].includes(socket.user.role)) return;
    const db = readResults();
    db.competition.resultsVisible = data.visible;
    writeResults(db);
    io.emit('competition_updated', db.competition);
    if (data.visible) {
      io.emit('results_revealed', {
        selection: computeRankingsGender(db, 'selection'),
        final: computeRankingsGender(db, 'final')
      });
    }
  });

  socket.on('broadcast', (data) => {
    if (!socket.user || !['admin', 'president'].includes(socket.user.role)) return;
    io.emit('broadcast_message', { message: data.message, from: socket.user.name });
  });

  socket.on('disconnect', () => console.log('- Client:', socket.id));
});

// ─── Start ──────────────────────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  const ifaces = require('os').networkInterfaces();
  let ip = 'localhost';
  Object.values(ifaces).flat().forEach(i => { if (i && i.family === 'IPv4' && !i.internal) ip = i.address; });
  console.log('\n Competition Nationale de Recitation du Coran Edition 9');
  console.log(' Serveur: http://localhost:' + PORT);
  console.log(' Reseau:  http://' + ip + ':' + PORT + '\n');
});
