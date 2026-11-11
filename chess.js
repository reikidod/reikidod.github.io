/* Шахматный Клуб — chess.js */
'use strict';

const firebaseConfig = {
  apiKey: "AIzaSyBIrrVBcjBRJvTJoGjeSjOmr7XJZpQoBi4",
  authDomain: "chess-135ca.firebaseapp.com",
  databaseURL: "https://chess-135ca-default-rtdb.firebaseio.com",
  projectId: "chess-135ca",
  storageBucket: "chess-135ca.firebasestorage.app",
  messagingSenderId: "263018567563",
  appId: "1:263018567563:web:31d716c33c5aab7fa9c18e"
};

let db = null, auth = null, firebaseReady = false, currentUser = null;

try {
  firebase.initializeApp(firebaseConfig);
  db = firebase.database();
  auth = firebase.auth();
  firebaseReady = true;
  auth.onAuthStateChanged(user => {
    if (user) {
      currentUser = { uid: user.uid, displayName: user.displayName || 'Игрок', email: user.email };
      onUserLoggedIn();
    } else currentUser = null;
  });
} catch (e) {
  console.warn('Firebase не настроен');
  setTimeout(() => {
    document.getElementById('auth').classList.remove('active');
    document.getElementById('lobby').classList.add('active');
  }, 0);
}

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((t, i) => t.classList.toggle('active', (i===0)===(tab==='login')));
  document.getElementById('auth-login').classList.toggle('hidden', tab !== 'login');
  document.getElementById('auth-register').classList.toggle('hidden', tab !== 'register');
}
async function doLogin() {
  if (!firebaseReady) { showToast('Firebase не настроен'); return; }
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';
  if (!email || !pass) { errEl.textContent = 'Заполните все поля.'; return; }
  try { await auth.signInWithEmailAndPassword(email, pass); }
  catch (e) { errEl.textContent = firebaseErrorRu(e.code); }
}
async function doRegister() {
  if (!firebaseReady) { showToast('Firebase не настроен'); return; }
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const pass = document.getElementById('reg-pass').value;
  const errEl = document.getElementById('reg-error');
  errEl.textContent = '';
  if (!name || !email || !pass) { errEl.textContent = 'Заполните все поля.'; return; }
  if (pass.length < 6) { errEl.textContent = 'Пароль минимум 6 символов.'; return; }
  try {
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    await cred.user.updateProfile({ displayName: name });
    await db.ref('users/' + cred.user.uid + '/profile').set({
      displayName: name, email, createdAt: Date.now(), wins:0, losses:0, draws:0, total:0
    });
  } catch (e) { errEl.textContent = firebaseErrorRu(e.code); }
}
function doGuest() { currentUser = null; showScreen('lobby'); updateUserHeader(); }
async function doLogout() {
  if (auth) await auth.signOut();
  currentUser = null; updateUserHeader(); showScreen('auth');
}
function onUserLoggedIn() {
  updateUserHeader();
  if (document.getElementById('auth').classList.contains('active')) showScreen('lobby');
}
function updateUserHeader() {
  const nameEl = document.getElementById('user-name-hdr');
  const avatarEl = document.getElementById('user-avatar-hdr');
  const profBtn = document.getElementById('profile-btn');
  const logoutBtn = document.getElementById('logout-btn');
  if (currentUser) {
    nameEl.textContent = currentUser.displayName;
    avatarEl.textContent = currentUser.displayName[0].toUpperCase();
    profBtn.style.display = ''; logoutBtn.style.display = '';
  } else {
    nameEl.textContent = 'Гость'; avatarEl.textContent = '?';
    profBtn.style.display = 'none'; logoutBtn.style.display = 'none';
  }
}
function firebaseErrorRu(code) {
  const map = {
    'auth/user-not-found': 'Пользователь не найден.',
    'auth/wrong-password': 'Неверный пароль.',
    'auth/email-already-in-use': 'Этот email уже зарегистрирован.',
    'auth/invalid-email': 'Некорректный email.',
    'auth/weak-password': 'Пароль слишком простой.',
    'auth/too-many-requests': 'Слишком много попыток.',
    'auth/network-request-failed': 'Ошибка сети.'
  };
  return map[code] || 'Ошибка: ' + code;
}
async function loadProfile() {
  if (!currentUser || !db) return;
  document.getElementById('prof-name').textContent = currentUser.displayName;
  document.getElementById('prof-email').textContent = currentUser.email;
  document.getElementById('prof-avatar').textContent = currentUser.displayName[0].toUpperCase();
  try {
    const snap = await db.ref('users/' + currentUser.uid + '/profile').get();
    const data = snap.val() || { wins:0, losses:0, draws:0, total:0 };
    document.getElementById('stat-total').textContent = data.total || 0;
    document.getElementById('stat-wins').textContent = data.wins || 0;
    document.getElementById('stat-losses').textContent = data.losses || 0;
    document.getElementById('stat-draws').textContent = data.draws || 0;
  } catch(e) {}
}
async function updateDisplayName() {
  if (!currentUser || !auth) return;
  const name = document.getElementById('new-name-input').value.trim();
  const msg = document.getElementById('name-change-msg');
  if (!name) { msg.textContent = 'Введите имя.'; return; }
  try {
    await auth.currentUser.updateProfile({ displayName: name });
    await db.ref('users/' + currentUser.uid + '/profile/displayName').set(name);
    currentUser.displayName = name; updateUserHeader(); loadProfile();
    msg.textContent = '✓ Имя изменено!';
  } catch(e) { msg.textContent = 'Ошибка.'; }
}

let currentCode = null, isOnline = false, myColor = null, onlineGameRef = null;
function genCode() {
  const W = ['KING','ROOK','PAWN','WOLF','HAWK','BEAR','RUBY','IRON','NOVA','APEX'];
  return W[Math.floor(Math.random()*W.length)] + '-' + (Math.floor(Math.random()*90)+10);
}
async function createOnlineGame() {
  if (!firebaseReady) { showToast('Нужен Firebase'); return; }
  currentCode = genCode(); myColor = 'w'; isOnline = true;
  document.getElementById('wr-code').textContent = currentCode;
  showScreen('waitroom');
  onlineGameRef = db.ref('games/' + currentCode);
  await onlineGameRef.set({ host: currentUser ? currentUser.displayName : 'Гость', status: 'waiting', turn: 'w', ts: Date.now() });
  onlineGameRef.on('value', snap => {
    const data = snap.val();
    if (data && data.status === 'playing') { onlineGameRef.off(); startOnlineGame('w', data.guest || 'Гость'); }
  });
}
async function joinGame() {
  const code = document.getElementById('join-input').value.trim().toUpperCase();
  if (!code) { showToast('Введите код'); return; }
  if (!firebaseReady) { showToast('Нужен Firebase'); return; }
  try {
    const ref = db.ref('games/' + code);
    const snap = await ref.get();
    if (!snap.exists()) { showToast('Игра не найдена'); return; }
    const data = snap.val();
    if (data.status !== 'waiting') { showToast('Игра уже началась'); return; }
    await ref.update({ status: 'playing', guest: currentUser ? currentUser.displayName : 'Гость' });
    currentCode = code; myColor = 'b'; isOnline = true; onlineGameRef = ref;
    startOnlineGame('b', data.host || 'Хост');
  } catch(e) { showToast('Ошибка: ' + e.message); }
}
function startOnlineGame(myCol, opponentName) {
  myColor = myCol;
  const myName = currentUser ? currentUser.displayName : 'Вы';
  document.getElementById('pname-white').textContent = myCol === 'w' ? myName : opponentName;
  document.getElementById('pname-black').textContent = myCol === 'b' ? myName : opponentName;
  document.getElementById('code-area').style.display = 'block';
  document.getElementById('game-code-badge').textContent = currentCode;
  mode = 'pvp'; showScreen('game'); initGame();
  let lastRemoteTs = 0;
  onlineGameRef.on('value', snap => {
    const data = snap.val();
    if (!data || !data.lastMove) return;
    const lm = data.lastMove;
    if (lm.by === myColor) return;
    if (lm.ts && lm.ts === lastRemoteTs) return;
    lastRemoteTs = lm.ts || Date.now();
    playMove(lm.fr, lm.fc, lm.tr, lm.tc, { remote: true });
  });
}
function pushMoveOnline(fr, fc, tr, tc) {
  if (!isOnline || !onlineGameRef) return;
  onlineGameRef.update({ lastMove: { fr, fc, tr, tc, by: myColor, ts: Date.now() }, turn: myColor === 'w' ? 'b' : 'w' });
}
async function cancelOnlineGame() {
  if (onlineGameRef) { onlineGameRef.off(); await onlineGameRef.remove(); onlineGameRef = null; }
  isOnline = false; currentCode = null; showScreen('lobby');
}
function copyCode() {
  navigator.clipboard.writeText(document.getElementById('wr-code').textContent).then(() => showToast('Код скопирован'));
}
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (id === 'profile') loadProfile();
  if (id === 'lobby') updateUserHeader();
}
function showJoin() { document.getElementById('join-row').classList.add('visible'); document.getElementById('join-input').focus(); }
function hideJoin() { document.getElementById('join-row').classList.remove('visible'); }
function startLocal(m) {
  isOnline = false;
  if (onlineGameRef) { onlineGameRef.off(); onlineGameRef = null; }
  document.getElementById('code-area').style.display = 'none';
  document.getElementById('pname-white').textContent = m === 'pvp' ? 'Игрок 1' : 'Вы (Белые)';
  document.getElementById('pname-black').textContent = m === 'pvp' ? 'Игрок 2' : (m === 'easy' ? 'ИИ (Новичок)' : 'ИИ (Сложный)');
  mode = m; showScreen('game'); initGame();
}
function resetAndLobby() {
  if (onlineGameRef) onlineGameRef.off();
  isOnline = false; showScreen('lobby');
}
let toastTimer = null;
function showToast(msg, duration) {
  duration = duration || 2500;
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), duration);
}

const PIECE_URLS = {
  wK: "https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg",
  wQ: "https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg",
  wR: "https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg",
  wB: "https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg",
  wN: "https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg",
  wP: "https://upload.wikimedia.org/wikipedia/commons/4/45/Chess_plt45.svg",
  bK: "https://upload.wikimedia.org/wikipedia/commons/f/f0/Chess_kdt45.svg",
  bQ: "https://upload.wikimedia.org/wikipedia/commons/4/47/Chess_qdt45.svg",
  bR: "https://upload.wikimedia.org/wikipedia/commons/f/ff/Chess_rdt45.svg",
  bB: "https://upload.wikimedia.org/wikipedia/commons/9/98/Chess_bdt45.svg",
  bN: "https://upload.wikimedia.org/wikipedia/commons/e/ef/Chess_ndt45.svg",
  bP: "https://upload.wikimedia.org/wikipedia/commons/c/c7/Chess_pdt45.svg"
};
function svgPiece(code) {
  const url = PIECE_URLS[code];
  if (!url) return '';
  return '<img src="' + url + '" alt="' + code + '" draggable="false" style="width:90%;height:90%;object-fit:contain;pointer-events:none;">';
}
const PIECE_NAMES = { K:'Король', Q:'Ферзь', R:'Ладья', B:'Слон', N:'Конь', P:'Пешка' };
const PIECE_MOVES = { K:'на 1 клетку', Q:'любое направление', R:'горизонт/вертикаль', B:'диагональ', N:'буквой Г', P:'вперёд, бьёт по диагонали' };
function buildPieceGuide() {
  const el = document.getElementById('piece-guide');
  if (!el) return;
  el.innerHTML = '';
  ['wK','wQ','wR','wB','wN','wP'].forEach(code => {
    const type = code[1];
    const row = document.createElement('div');
    row.className = 'pg-row';
    row.innerHTML = svgPiece(code) + '<div class="pg-info"><b>' + PIECE_NAMES[type] + '</b><span>' + PIECE_MOVES[type] + '</span></div>';
    el.appendChild(row);
  });
}
const INIT_BOARD = [
  ['bR','bN','bB','bQ','bK','bB','bN','bR'],
  ['bP','bP','bP','bP','bP','bP','bP','bP'],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  ['wP','wP','wP','wP','wP','wP','wP','wP'],
  ['wR','wN','wB','wQ','wK','wB','wN','wR']
];
const PIECE_VALUES = { P:1, N:3, B:3, R:5, Q:9, K:100 };

let animEnabled = localStorage.getItem('chessAnim') !== '0';
let animating = false;
function toggleAnim() {
  animEnabled = !animEnabled;
  localStorage.setItem('chessAnim', animEnabled ? '1' : '0');
  const btn = document.getElementById('anim-btn');
  if (btn) btn.textContent = animEnabled ? '🎬 Анимация: вкл' : '🎬 Анимация: выкл';
  showToast(animEnabled ? 'Анимация ходов включена' : 'Анимация ходов выключена');
}
function updateAnimBtn() {
  const btn = document.getElementById('anim-btn');
  if (btn) btn.textContent = animEnabled ? '🎬 Анимация: вкл' : '🎬 Анимация: выкл';
}
function getSquareEl(r, c) {
  const boardEl = document.getElementById('board');
  if (!boardEl) return null;
  const vr = flipped ? 7 - r : r;
  const vc = flipped ? 7 - c : c;
  return boardEl.children[vr * 8 + vc] || null;
}
function animatePieceMove(fr, fc, tr, tc, pieceCode, onDone) {
  const safeDone = (function() {
    let called = false;
    return function() {
      if (called) return;
      called = true;
      animating = false;
      try { onDone(); } catch (e) { console.error(e); }
    };
  })();

  if (!animEnabled || animating || !pieceCode) { safeDone(); return; }
  const fromEl = getSquareEl(fr, fc);
  const toEl = getSquareEl(tr, tc);
  if (!fromEl || !toEl) { safeDone(); return; }

  animating = true;
  const fromRect = fromEl.getBoundingClientRect();
  const toRect = toEl.getBoundingClientRect();
  const fromImg = fromEl.querySelector('img');
  if (fromImg) fromImg.style.opacity = '0';

  const flyer = document.createElement('div');
  flyer.className = 'piece-flyer';
  flyer.innerHTML = svgPiece(pieceCode);
  flyer.style.cssText = 'position:fixed;left:' + fromRect.left + 'px;top:' + fromRect.top +
    'px;width:' + fromRect.width + 'px;height:' + fromRect.height +
    'px;display:flex;align-items:center;justify-content:center;z-index:150;pointer-events:none;' +
    'transition:transform .22s ease-out;will-change:transform;';
  document.body.appendChild(flyer);
  flyer.offsetHeight;
  flyer.style.transform = 'translate(' + (toRect.left - fromRect.left) + 'px,' + (toRect.top - fromRect.top) + 'px)';

  const cleanup = function(e) {
    if (e && e.target !== flyer) return;
    if (e && e.propertyName && e.propertyName !== 'transform') return;
    flyer.removeEventListener('transitionend', cleanup);
    if (flyer.parentNode) flyer.parentNode.removeChild(flyer);
    safeDone();
  };
  flyer.addEventListener('transitionend', cleanup);
  setTimeout(function() { cleanup(null); }, 300);
}

function playMove(fr, fc, tr, tc, options) {
  options = options || {};
  if (animating) return false;
  const piece = board[fr] && board[fr][fc];
  if (!piece) return false;

  animatePieceMove(fr, fc, tr, tc, piece, function() {
    doMove(fr, fc, tr, tc, options.remote);
    if (!options.remote && isOnline) pushMoveOnline(fr, fc, tr, tc);
    renderBoard();
    updateStatus();
    updateEval();
    updatePlayerBanners();
    if (typeof options.after === 'function') options.after();
  });
  return true;
}

let board, turn, sel, poss, history, capW, capB, flipped, mode, gameOver, lastMv;
function initGame() {
  board = INIT_BOARD.map(r => r.slice());
  turn = 'w'; sel = null; poss = []; history = []; capW = []; capB = [];
  flipped = false; gameOver = false; lastMv = null; animating = false;
  document.getElementById('moves-list').innerHTML = '';
  document.getElementById('cap-w').innerHTML = '';
  document.getElementById('cap-b').innerHTML = '';
  renderBoard(); updateStatus(); updateEval(); updatePlayerBanners(); updateAnimBtn();
}
function resetGame() { initGame(); }
function renderBoard() {
  const el = document.getElementById('board');
  el.innerHTML = '';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const dr = flipped ? 7-r : r;
      const dc = flipped ? 7-c : c;
      const sq = document.createElement('div');
      sq.className = 'sq ' + ((dr+dc)%2===0 ? 'light' : 'dark');
      if (lastMv && ((dr===lastMv.fr && dc===lastMv.fc) || (dr===lastMv.tr && dc===lastMv.tc))) sq.classList.add('lastmv');
      if (sel && dr===sel[0] && dc===sel[1]) sq.classList.add('sel');
      if (poss.some(p => p[0]===dr && p[1]===dc)) {
        sq.classList.add('poss');
        if (board[dr][dc]) sq.classList.add('hap');
      }
      if (!gameOver && board[dr][dc] === turn+'K' && isInCheck(turn, board)) sq.classList.add('inchk');
      if (board[dr][dc]) sq.innerHTML = svgPiece(board[dr][dc]);
      sq.addEventListener('click', () => onSqClick(dr, dc));
      el.appendChild(sq);
    }
  }
  const rcol = document.getElementById('rcol');
  rcol.innerHTML = '';
  (flipped ? [1,2,3,4,5,6,7,8] : [8,7,6,5,4,3,2,1]).forEach(n => {
    const s = document.createElement('span'); s.textContent = n; rcol.appendChild(s);
  });
}
function onSqClick(r, c) {
  if (gameOver || animating) return;
  if (isOnline && turn !== myColor) return;
  const piece = board[r][c];
  if (sel) {
    const mv = poss.find(m => m[0]===r && m[1]===c);
    if (mv) {
      const fr = sel[0], fc = sel[1];
      sel = null; poss = [];
      playMove(fr, fc, r, c, {
        after: function() {
          if (!gameOver && mode !== 'pvp' && !isOnline) setTimeout(aiMove, 120);
        }
      });
      return;
    }
    sel = null; poss = [];
  }
  if (piece && piece[0] === turn) {
    sel = [r, c];
    poss = getLegal(r, c, board, turn);
  }
  renderBoard();
}
function doMove(fr, fc, tr, tc, remote) {
  const piece = board[fr][fc];
  if (!piece) return;
  const target = board[tr][tc];
  if (target) {
    const capEl = document.getElementById(turn === 'w' ? 'cap-w' : 'cap-b');
    const div = document.createElement('div');
    div.innerHTML = svgPiece(target);
    capEl.appendChild(div);
    if (turn === 'w') capW.push(target); else capB.push(target);
  }
  const snapshot = board.map(r => r.slice());
  board[tr][tc] = piece;
  board[fr][fc] = null;
  if (piece === 'wP' && tr === 0) board[tr][tc] = 'wQ';
  if (piece === 'bP' && tr === 7) board[tr][tc] = 'bQ';
  if (piece === 'wK' && fc === 4 && tc === 6) { board[7][5] = 'wR'; board[7][7] = null; }
  if (piece === 'wK' && fc === 4 && tc === 2) { board[7][3] = 'wR'; board[7][0] = null; }
  if (piece === 'bK' && fc === 4 && tc === 6) { board[0][5] = 'bR'; board[0][7] = null; }
  if (piece === 'bK' && fc === 4 && tc === 2) { board[0][3] = 'bR'; board[0][0] = null; }
  lastMv = { fr, fc, tr, tc };
  const note = algebraic(piece, fr, fc, tr, tc, target);
  history.push({ from:[fr,fc], to:[tr,tc], note, snapshot, piece, target });
  appendMoveToList(note);
  const opp = turn === 'w' ? 'b' : 'w';
  turn = opp;
  const inChk = isInCheck(opp, board);
  const hasLgl = hasAnyLegal(opp, board);
  if (!hasLgl) {
    gameOver = true;
    setTimeout(() => {
      if (inChk) {
        showModal('Шах и мат!', 'Победили ' + (opp === 'w' ? 'Чёрные' : 'Белые') + '!');
        if (isOnline && onlineGameRef) onlineGameRef.update({ status: 'finished' });
      } else {
        showModal('Пат!', 'Ничья!');
      }
    }, 150);
  }
}
function algebraic(piece, fr, fc, tr, tc, captured) {
  const files = 'abcdefgh', ranks = '87654321';
  const pnames = { P:'', R:'Л', N:'К', B:'С', Q:'Ф', K:'Кр' };
  return pnames[piece[1]] + (piece[1]==='P' && captured ? files[fc] : '') + (captured ? 'x' : '') + files[tc] + ranks[tr];
}
function appendMoveToList(note) {
  const list = document.getElementById('moves-list');
  const num = Math.ceil(history.length / 2);
  if (history.length % 2 === 1) {
    const row = document.createElement('div');
    row.className = 'move-row';
    row.id = 'mr' + num;
    row.innerHTML = '<span class="mn">' + num + '.</span><button class="mb">' + note + '</button>';
    list.appendChild(row);
  } else {
    const row = document.getElementById('mr' + num);
    if (row) {
      const b = document.createElement('button');
      b.className = 'mb'; b.textContent = note; row.appendChild(b);
    }
  }
  list.scrollTop = list.scrollHeight;
}
function undoMove() {
  if (!history.length || isOnline || animating) { if (isOnline) showToast('Отмена недоступна онлайн'); return; }
  const last = history.pop();
  board = last.snapshot; turn = last.piece[0]; gameOver = false;
  lastMv = history.length ? { fr: history[history.length-1].from[0], fc: history[history.length-1].from[1], tr: history[history.length-1].to[0], tc: history[history.length-1].to[1] } : null;
  if (last.target) {
    const capEl = document.getElementById(turn === 'w' ? 'cap-w' : 'cap-b');
    if (capEl.lastChild) capEl.removeChild(capEl.lastChild);
    if (turn === 'w') capW.pop(); else capB.pop();
  }
  const list = document.getElementById('moves-list');
  const rows = list.querySelectorAll('.move-row');
  if (rows.length) {
    const lr = rows[rows.length-1];
    const bs = lr.querySelectorAll('.mb');
    if (bs.length > 1) bs[bs.length-1].remove(); else lr.remove();
  }
  sel = null; poss = [];
  renderBoard(); updateStatus(); updateEval(); updatePlayerBanners();
}
function getRaw(r, c, bd) {
  const piece = bd[r][c];
  if (!piece) return [];
  const t = piece[0], type = piece[1], opp = t === 'w' ? 'b' : 'w';
  const moves = [];
  const add = (nr, nc) => { if (nr>=0 && nr<8 && nc>=0 && nc<8) moves.push([nr,nc]); };
  const slide = (dr, dc) => {
    let nr = r+dr, nc = c+dc;
    while (nr>=0 && nr<8 && nc>=0 && nc<8) {
      if (bd[nr][nc]) { if (bd[nr][nc][0]===opp) moves.push([nr,nc]); break; }
      moves.push([nr,nc]); nr += dr; nc += dc;
    }
  };
  if (type === 'P') {
    const dir = t === 'w' ? -1 : 1;
    const start = t === 'w' ? 6 : 1;
    if (r+dir>=0 && r+dir<8 && !bd[r+dir][c]) {
      moves.push([r+dir, c]);
      if (r === start && !bd[r+2*dir][c]) moves.push([r+2*dir, c]);
    }
    [[r+dir,c-1],[r+dir,c+1]].forEach(([nr,nc]) => {
      if (nr>=0 && nr<8 && nc>=0 && nc<8 && bd[nr][nc] && bd[nr][nc][0]===opp) moves.push([nr,nc]);
    });
  }
  if (type === 'R' || type === 'Q') [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dr,dc]) => slide(dr,dc));
  if (type === 'B' || type === 'Q') [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([dr,dc]) => slide(dr,dc));
  if (type === 'N') [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr,dc]) => add(r+dr,c+dc));
  if (type === 'K') {
    [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].forEach(([dr,dc]) => add(r+dr,c+dc));
    const rk = t === 'w' ? 7 : 0;
    if (r === rk && c === 4) {
      if (!bd[rk][5] && !bd[rk][6] && bd[rk][7] && bd[rk][7][0]===t) moves.push([rk,6]);
      if (!bd[rk][3] && !bd[rk][2] && !bd[rk][1] && bd[rk][0] && bd[rk][0][0]===t) moves.push([rk,2]);
    }
  }
  return moves.filter(([nr,nc]) => !bd[nr][nc] || bd[nr][nc][0]===opp);
}
function findKing(t, bd) {
  for (let r=0;r<8;r++) for (let c=0;c<8;c++) if (bd[r][c]===t+'K') return [r,c];
  return null;
}
function isInCheck(t, bd) {
  const k = findKing(t, bd);
  if (!k) return false;
  const opp = t === 'w' ? 'b' : 'w';
  for (let r=0;r<8;r++) for (let c=0;c<8;c++)
    if (bd[r][c] && bd[r][c][0]===opp && getRaw(r,c,bd).some(([nr,nc]) => nr===k[0] && nc===k[1])) return true;
  return false;
}
function getLegal(r, c, bd, t) {
  return getRaw(r, c, bd).filter(([tr, tc]) => {
    const nb = bd.map(row => row.slice());
    nb[tr][tc] = nb[r][c]; nb[r][c] = null;
    return !isInCheck(t, nb);
  });
}
function hasAnyLegal(t, bd) {
  for (let r=0;r<8;r++) for (let c=0;c<8;c++)
    if (bd[r][c] && bd[r][c][0]===t && getLegal(r,c,bd,t).length) return true;
  return false;
}
function aiMove() {
  if (gameOver || turn !== 'b' || animating) return;
  const moves = [];
  for (let r=0;r<8;r++) for (let c=0;c<8;c++)
    if (board[r][c] && board[r][c][0]==='b')
      getLegal(r,c,board,'b').forEach(([tr,tc]) => moves.push({fr:r,fc:c,tr,tc}));
  if (!moves.length) return;
  let best = null, bestScore = -Infinity;
  moves.forEach(m => {
    let score = (board[m.tr][m.tc] ? PIECE_VALUES[board[m.tr][m.tc][1]] : 0) * 2;
    if (mode === 'hard') {
      const nb = board.map(r => r.slice());
      nb[m.tr][m.tc] = nb[m.fr][m.fc]; nb[m.fr][m.fc] = null;
      if (isInCheck('w', nb)) score += 5;
    }
    score += Math.random() * 0.5;
    if (score > bestScore) { bestScore = score; best = m; }
  });
  playMove(best.fr, best.fc, best.tr, best.tc);
}
function updateStatus() {
  const sdot = document.getElementById('sdot');
  const stext = document.getElementById('stext');
  if (gameOver) { stext.textContent = 'Игра окончена'; return; }
  const inChk = isInCheck(turn, board);
  sdot.className = 'sdot ' + (turn === 'w' ? 'w' : 'b');
  if (isOnline && turn !== myColor) {
    stext.innerHTML = 'Ход ' + (turn==='w'?'белых':'чёрных') + '. <strong>Ожидайте...</strong>';
  } else {
    stext.innerHTML = inChk ? '<strong>Шах!</strong> Ход ' + (turn==='w'?'белых':'чёрных') + '.' : 'Ход ' + (turn==='w'?'белых':'чёрных') + '. Выберите фигуру.';
  }
}
function updatePlayerBanners() {
  ['white','black'].forEach(color => {
    const isActive = (color==='white' ? turn==='w' : turn==='b') && !gameOver;
    document.getElementById('pb-' + color).classList.toggle('active-turn', isActive);
  });
}
function updateEval() {
  let score = 0;
  for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
    const p = board[r][c];
    if (p) score += (p[0]==='w'?1:-1) * (PIECE_VALUES[p[1]]||0);
  }
  document.getElementById('eval-fill').style.height = Math.max(5, Math.min(95, 50 + score*4)) + '%';
}
function flipBoard() { if (animating) return; flipped = !flipped; renderBoard(); }
function showModal(title, msg) {
  document.getElementById('m-title').textContent = title;
  document.getElementById('m-msg').textContent = msg;
  document.getElementById('modal').classList.add('show');
}
function closeModal() { document.getElementById('modal').classList.remove('show'); }
const TIPS = [
  'Контролируйте центр — e4, d4, e5, d5 дают больше пространства.',
  'Развивайте фигуры в начале: сначала кони и слоны, потом ладьи.',
  'Сделайте рокировку до 10-го хода, чтобы защитить короля.',
  'Конь на краю — плохая позиция. Держите его ближе к центру.',
  'Перед каждым ходом проверьте: что задумал соперник?',
  'Ладьи сильны на открытых линиях и 7-й горизонтали.',
  'В эндшпиле король — активная фигура. Не бойтесь его использовать.',
  'Ищите тактические мотивы: вилку, связку, двойной удар.'
];
let tipIdx = 0;
function nextTip() {
  tipIdx = (tipIdx + 1) % TIPS.length;
  document.getElementById('tip-text').textContent = TIPS[tipIdx];
}
buildPieceGuide();
updateAnimBtn();
