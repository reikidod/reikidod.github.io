/* ══════════════════════════════════════
   Шахматный Клуб — chess.js
   v2.0 — Firebase Auth + Realtime DB
   ══════════════════════════════════════ */

'use strict';

// ─── FIREBASE CONFIG ─────────────────────────────────────────────────────────
//
//  ⚠️  ИНСТРУКЦИЯ ПО НАСТРОЙКЕ:
//
//  1. Перейдите на https://console.firebase.google.com
//  2. Создайте проект (бесплатный план Spark подходит)
//  3. Добавьте Web-приложение (кнопка </> на главной странице проекта)
//  4. Скопируйте ваш firebaseConfig и вставьте ниже вместо заглушки
//  5. В консоли Firebase:
//       - Authentication → Sign-in method → Email/Password → Enable
//       - Realtime Database → Create database → Start in test mode
//  6. В Rules базы данных поставьте:
//     {
//       "rules": {
//         "games": { ".read": true, ".write": true },
//         "users": {
//           "$uid": {
//             ".read": "$uid === auth.uid",
//             ".write": "$uid === auth.uid"
//           }
//         }
//       }
//     }
//
const firebaseConfig = {
  apiKey:            "AIzaSyBIrrVBcjBRJvTJoGjeSjOmr7XJZpQoBi4",
  authDomain:        "chess-135ca.firebaseapp.com",
  databaseURL:       "https://chess-135ca-default-rtdb.firebaseio.com",
  projectId:         "chess-135ca",
  storageBucket:     "chess-135ca.firebasestorage.app",
  messagingSenderId: "263018567563",
  appId:             "1:263018567563:web:31d716c33c5aab7fa9c18e"
};

// ─── FIREBASE INIT ───────────────────────────────────────────────────────────

let db   = null;
let auth = null;
let firebaseReady = false;
let currentUser   = null;  // { uid, displayName, email } или null (гость)

try {
  firebase.initializeApp(firebaseConfig);
  db   = firebase.database();
  auth = firebase.auth();
  firebaseReady = true;

  auth.onAuthStateChanged(user => {
    if (user) {
      currentUser = { uid: user.uid, displayName: user.displayName || 'Игрок', email: user.email };
      onUserLoggedIn();
    } else {
      currentUser = null;
    }
  });
} catch (e) {
  console.warn('Firebase не настроен. Режим демо (локальная игра).');
  // Без Firebase: убираем экран авторизации и сразу показываем лобби
  setTimeout(() => {
    document.getElementById('auth').classList.remove('active');
    document.getElementById('lobby').classList.add('active');
  }, 0);
}

// ─── AUTH UI ─────────────────────────────────────────────────────────────────

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((t, i) => {
    t.classList.toggle('active', (i === 0) === (tab === 'login'));
  });
  document.getElementById('auth-login').classList.toggle('hidden', tab !== 'login');
  document.getElementById('auth-register').classList.toggle('hidden', tab !== 'register');
}

async function doLogin() {
  if (!firebaseReady) { showToast('Firebase не настроен'); return; }
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';

  if (!email || !pass) { errEl.textContent = 'Заполните все поля.'; return; }

  try {
    setAuthBtn('login', true);
    await auth.signInWithEmailAndPassword(email, pass);
    // onAuthStateChanged сам переключит экран
  } catch (e) {
    errEl.textContent = firebaseErrorRu(e.code);
  } finally {
    setAuthBtn('login', false);
  }
}

async function doRegister() {
  if (!firebaseReady) { showToast('Firebase не настроен'); return; }
  const name  = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const pass  = document.getElementById('reg-pass').value;
  const errEl = document.getElementById('reg-error');
  errEl.textContent = '';

  if (!name || !email || !pass) { errEl.textContent = 'Заполните все поля.'; return; }
  if (pass.length < 6) { errEl.textContent = 'Пароль минимум 6 символов.'; return; }

  try {
    setAuthBtn('reg', true);
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    await cred.user.updateProfile({ displayName: name });

    // Создаём профиль в БД
    await db.ref(`users/${cred.user.uid}/profile`).set({
      displayName: name,
      email:       email,
      createdAt:   Date.now(),
      wins: 0, losses: 0, draws: 0, total: 0
    });
    // onAuthStateChanged переключит экран
  } catch (e) {
    errEl.textContent = firebaseErrorRu(e.code);
  } finally {
    setAuthBtn('reg', false);
  }
}

function doGuest() {
  currentUser = null;
  showScreen('lobby');
  updateUserHeader();
}

async function doLogout() {
  if (auth) await auth.signOut();
  currentUser = null;
  updateUserHeader();
  showScreen('auth');
}

function setAuthBtn(form, loading) {
  const prefix = form === 'login' ? 'auth-login' : 'auth-register';
  const btn = document.querySelector(`#${prefix} .btn-gold`);
  if (btn) { btn.disabled = loading; btn.textContent = loading ? 'Загрузка...' : (form === 'login' ? 'Войти' : 'Создать аккаунт'); }
}

function onUserLoggedIn() {
  updateUserHeader();
  // Если мы на экране auth — переходим в лобби
  if (document.getElementById('auth').classList.contains('active')) {
    showScreen('lobby');
  }
}

function updateUserHeader() {
  const nameEl   = document.getElementById('user-name-hdr');
  const avatarEl = document.getElementById('user-avatar-hdr');
  const profBtn  = document.getElementById('profile-btn');
  const logoutBtn = document.getElementById('logout-btn');

  if (currentUser) {
    nameEl.textContent   = currentUser.displayName;
    avatarEl.textContent = currentUser.displayName[0].toUpperCase();
    profBtn.style.display  = '';
    logoutBtn.style.display = '';
  } else {
    nameEl.textContent   = 'Гость';
    avatarEl.textContent = '?';
    profBtn.style.display  = 'none';
    logoutBtn.style.display = 'none';
  }
}

function firebaseErrorRu(code) {
  const map = {
    'auth/user-not-found':      'Пользователь не найден.',
    'auth/wrong-password':      'Неверный пароль.',
    'auth/email-already-in-use':'Этот email уже зарегистрирован.',
    'auth/invalid-email':       'Некорректный email.',
    'auth/weak-password':       'Пароль слишком простой.',
    'auth/too-many-requests':   'Слишком много попыток. Подождите.',
    'auth/network-request-failed': 'Ошибка сети.',
  };
  return map[code] || `Ошибка: ${code}`;
}

// ─── PROFILE ─────────────────────────────────────────────────────────────────

async function loadProfile() {
  if (!currentUser || !db) return;

  document.getElementById('prof-name').textContent  = currentUser.displayName;
  document.getElementById('prof-email').textContent = currentUser.email;
  document.getElementById('prof-avatar').textContent = currentUser.displayName[0].toUpperCase();

  try {
    const snap = await db.ref(`users/${currentUser.uid}/profile`).get();
    const data = snap.val() || { wins:0, losses:0, draws:0, total:0 };
    document.getElementById('stat-total').textContent  = data.total  || 0;
    document.getElementById('stat-wins').textContent   = data.wins   || 0;
    document.getElementById('stat-losses').textContent = data.losses || 0;
    document.getElementById('stat-draws').textContent  = data.draws  || 0;
  } catch (e) { /* offline */ }

  try {
    const hSnap = await db.ref(`users/${currentUser.uid}/history`).limitToLast(20).get();
    const histEl = document.getElementById('history-list');
    histEl.innerHTML = '';
    if (!hSnap.exists()) {
      histEl.innerHTML = '<div class="history-empty">Игр пока нет. Сыграйте первую партию!</div>';
      return;
    }
    const games = [];
    hSnap.forEach(child => games.unshift({ id: child.key, ...child.val() }));
    games.forEach(g => {
      const div = document.createElement('div');
      div.className = 'history-item';
      const resClass = g.result === 'win' ? 'win' : g.result === 'loss' ? 'loss' : 'draw';
      const resLabel = g.result === 'win' ? 'П' : g.result === 'loss' ? 'П' : 'Н';
      const date = new Date(g.ts).toLocaleDateString('ru-RU', { day:'2-digit', month:'2-digit' });
      div.innerHTML = `
        <div class="history-result ${resClass}">${resLabel === 'Н' ? '½' : resLabel}</div>
        <div class="history-info">
          <b>${g.opponent || 'Неизвестный'}</b>
          <span>${g.mode === 'pvp' ? 'Две стороны' : g.mode === 'online' ? 'Онлайн' : 'Против ИИ'} · ${g.moves || 0} ходов</span>
        </div>
        <div class="history-date">${date}</div>`;
      histEl.appendChild(div);
    });
  } catch (e) { /* offline */ }
}

async function updateDisplayName() {
  if (!currentUser || !auth) return;
  const name = document.getElementById('new-name-input').value.trim();
  const msg  = document.getElementById('name-change-msg');
  if (!name) { msg.textContent = 'Введите имя.'; msg.style.color = 'var(--red)'; return; }

  try {
    await auth.currentUser.updateProfile({ displayName: name });
    await db.ref(`users/${currentUser.uid}/profile/displayName`).set(name);
    currentUser.displayName = name;
    updateUserHeader();
    loadProfile();
    msg.textContent = '✓ Имя изменено!';
    msg.style.color = 'var(--green)';
    setTimeout(() => { msg.textContent = ''; }, 2500);
  } catch (e) {
    msg.textContent = 'Ошибка сохранения.';
    msg.style.color = 'var(--red)';
  }
}

async function saveGameToHistory(result, opponentName, movesCount) {
  if (!currentUser || !db) return;
  try {
    const uid = currentUser.uid;
    const ref = db.ref(`users/${uid}/history`).push();
    await ref.set({
      result,
      opponent: opponentName,
      mode:     mode === 'pvp' ? 'pvp' : (isOnline ? 'online' : 'ai'),
      moves:    movesCount,
      ts:       Date.now()
    });

    // Update counters
    const profRef = db.ref(`users/${uid}/profile`);
    const snap = await profRef.get();
    const p = snap.val() || { wins:0, losses:0, draws:0, total:0 };
    p.total++;
    if (result === 'win')  p.wins++;
    else if (result === 'loss') p.losses++;
    else p.draws++;
    await profRef.update(p);
  } catch (e) { /* offline */ }
}

// ─── ONLINE MATCHMAKING (Firebase Realtime DB) ───────────────────────────────

let currentCode  = null;
let isOnline     = false;
let myColor      = null;   // 'w' | 'b'
let onlineGameRef = null;
let onlineListener = null;

function genCode() {
  const WORDS = [
    'KING','ROOK','PAWN','DUKE','BOLT','LION','WOLF','HAWK','BEAR','JADE',
    'RUBY','IRON','MAGE','PIKE','NOVA','FLUX','ECHO','FORT','APEX','ZEAL',
    'DART','SAGE','TUSK','VEIL','WREN','ONYX','FERN','GUST','HELM','JINX'
  ];
  const w = WORDS[Math.floor(Math.random() * WORDS.length)];
  const n = Math.floor(Math.random() * 90) + 10;
  return `${w}-${n}`;
}

async function createOnlineGame() {
  if (!firebaseReady) {
    showToast('Для онлайн-игры нужен Firebase. Проверьте chess.js');
    return;
  }

  currentCode = genCode();
  myColor = 'w';
  isOnline = true;

  document.getElementById('wr-code').textContent = currentCode;
  showScreen('waitroom');
  document.getElementById('wr-status').textContent = '● Ожидание игрока...';

  // Записываем игру в Firebase
  onlineGameRef = db.ref(`games/${currentCode}`);
  await onlineGameRef.set({
    host:   currentUser ? currentUser.displayName : 'Гость',
    status: 'waiting',
    board:  null,
    turn:   'w',
    moves:  [],
    ts:     Date.now()
  });

  // Слушаем подключение второго игрока
  onlineListener = onlineGameRef.on('value', snap => {
    const data = snap.val();
    if (!data) return;
    if (data.status === 'playing') {
      onlineGameRef.off('value', onlineListener);
      startOnlineGame('w', data.guest || 'Гость');
    }
  });
}

async function joinGame() {
  const code = document.getElementById('join-input').value.trim().toUpperCase();
  if (!code) { showToast('Введите код игры!'); return; }

  if (!firebaseReady) {
    showToast('Для онлайн-игры нужен Firebase. Проверьте chess.js');
    return;
  }

  try {
    const ref  = db.ref(`games/${code}`);
    const snap = await ref.get();

    if (!snap.exists()) {
      showToast(`Игра «${code}» не найдена`);
      return;
    }

    const data = snap.val();
    if (data.status !== 'waiting') {
      showToast('Эта игра уже началась или завершена');
      return;
    }

    const guestName = currentUser ? currentUser.displayName : 'Гость';
    await ref.update({
      status: 'playing',
      guest:  guestName
    });

    currentCode   = code;
    myColor       = 'b';
    isOnline      = true;
    onlineGameRef = ref;

    startOnlineGame('b', data.host || 'Хост');
  } catch (e) {
    showToast('Ошибка подключения: ' + e.message);
  }
}

function startOnlineGame(myCol, opponentName) {
  myColor = myCol;

  const myName  = currentUser ? currentUser.displayName : 'Вы';
  const whiteName = myCol === 'w' ? myName : opponentName;
  const blackName = myCol === 'b' ? myName : opponentName;

  document.getElementById('pname-white').textContent = whiteName;
  document.getElementById('pname-black').textContent = blackName;
  document.getElementById('code-area').style.display  = 'block';
  document.getElementById('game-code-badge').textContent = currentCode;

  mode = 'pvp';
  showScreen('game');
  initGame();

  // Слушаем ходы противника
  onlineGameRef.on('value', snap => {
    const data = snap.val();
    if (!data || !data.lastMove) return;
    const lm = data.lastMove;

    // Применяем ход только если он не наш
    if (lm.by !== myColor) {
      doMove(lm.fr, lm.fc, lm.tr, lm.tc, true /* remote */);
      renderBoard(); updateStatus(); updateEval(); updatePlayerBanners();
    }

    if (data.status === 'finished') {
      onlineGameRef.off();
    }
  });
}

// Отправить ход в Firebase (вызывается из doMove)
function pushMoveOnline(fr, fc, tr, tc) {
  if (!isOnline || !onlineGameRef) return;
  onlineGameRef.update({
    lastMove: { fr, fc, tr, tc, by: myColor, ts: Date.now() },
    turn: (myColor === 'w' ? 'b' : 'w')
  });
}

async function cancelOnlineGame() {
  if (onlineGameRef) {
    onlineGameRef.off();
    await onlineGameRef.remove();
    onlineGameRef = null;
  }
  isOnline = false;
  currentCode = null;
  showScreen('lobby');
}

function copyCode() {
  const code = document.getElementById('wr-code').textContent;
  navigator.clipboard.writeText(code).then(() => showToast('Код скопирован: ' + code));
}

// ─── SCREEN ROUTING ──────────────────────────────────────────────────────────

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');

  if (id === 'profile') loadProfile();
  if (id === 'lobby')   updateUserHeader();
}

function showJoin() {
  document.getElementById('join-row').classList.add('visible');
  document.getElementById('join-input').focus();
}

function hideJoin() {
  document.getElementById('join-row').classList.remove('visible');
}

function startLocal(m) {
  isOnline = false;
  if (onlineGameRef) { onlineGameRef.off(); onlineGameRef = null; }

  document.getElementById('code-area').style.display = 'none';
  document.getElementById('pname-white').textContent = (m === 'pvp') ? 'Игрок 1'  : 'Вы (Белые)';
  document.getElementById('pname-black').textContent = (m === 'pvp') ? 'Игрок 2'  :
                                                        (m === 'easy') ? 'ИИ (Новичок)' : 'ИИ (Сложный)';
  mode = m;
  showScreen('game');
  initGame();
}

function resetAndLobby() {
  if (onlineGameRef) { onlineGameRef.off(); }
  isOnline = false;
  showScreen('lobby');
}

// ─── TOAST ───────────────────────────────────────────────────────────────────

let toastTimer = null;
function showToast(msg, duration = 2500) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), duration);
}

// ─── SVG PIECE RENDERER ──────────────────────────────────────────────────────

function svgPiece(code) {
  const isW = code[0] === 'w';
  const type = code[1];
  const fc = isW ? '#F5EDD8' : '#2C2218';
  const sc = '#8B6340';
  const sw = 1.5;

  const shapes = {
    K: `<rect x="23" y="5" width="6" height="12" rx="1" fill="${fc}" stroke="${sc}" stroke-width="${sw}"/>
        <rect x="20" y="8" width="12" height="6" rx="1" fill="${fc}" stroke="${sc}" stroke-width="${sw}"/>
        <path d="M14 42 Q14 28 26 26 Q38 28 38 42 Z" fill="${fc}" stroke="${sc}" stroke-width="${sw}"/>
        <rect x="12" y="41" width="28" height="5" rx="2" fill="${fc}" stroke="${sc}" stroke-width="${sw}"/>`,
    Q: `<circle cx="26" cy="10" r="4" fill="${fc}" stroke="${sc}" stroke-width="${sw}"/>
        <circle cx="13" cy="15" r="3.5" fill="${fc}" stroke="${sc}" stroke-width="${sw}"/>
        <circle cx="39" cy="15" r="3.5" fill="${fc}" stroke="${sc}" stroke-width="${sw}"/>
        <circle cx="8"  cy="26" r="3"   fill="${fc}" stroke="${sc}" stroke-width="${sw}"/>
        <circle cx="44" cy="26" r="3"   fill="${fc}" stroke="${sc}" stroke-width="${sw}"/>
        <path d="M8 27 L13 17 L20 22 L26 10 L32 22 L39 17 L44 27 L40 40 L12 40 Z"
              fill="${fc}" stroke="${sc}" stroke-width="${sw}"/>
        <rect x="11" y="40" width="30" height="5" rx="2" fill="${fc}" stroke="${sc}" stroke-width="${sw}"/>`,
    R: `<rect x="13" y="6"  width="26" height="8"  rx="1" fill="${fc}" stroke="${sc}" stroke-width="${sw}"/>
        <rect x="11" y="6"  width="6"  height="12" rx="1" fill="${fc}" stroke="${sc}" stroke-width="${sw}"/>
        <rect x="23" y="6"  width="6"  height="12" rx="1" fill="${fc}" stroke="${sc}" stroke-width="${sw}"/>
        <rect x="35" y="6"  width="6"  height="12" rx="1" fill="${fc}" stroke="${sc}" stroke-width="${sw}"/>
        <rect x="13" y="17" width="26" height="20" rx="1" fill="${fc}" stroke="${sc}" stroke-width="${sw}"/>
        <rect x="10" y="38" width="32" height="6"  rx="2" fill="${fc}" stroke="${sc}" stroke-width="${sw}"/>`,
    B: `<circle cx="26" cy="10" r="4" fill="${fc}" stroke="${sc}" stroke-width="${sw}"/>
        <circle cx="26" cy="10" r="1.5" fill="${sc}"/>
        <path d="M20 14 Q26 32 26 38 M32 14 Q26 32 26 38" stroke="${sc}" stroke-width="${sw}" fill="none"/>
        <path d="M16 38 Q26 16 36 38 Z" fill="${fc}" stroke="${sc}" stroke-width="${sw}"/>
        <rect x="11" y="38" width="30" height="5" rx="2" fill="${fc}" stroke="${sc}" stroke-width="${sw}"/>`,
    N: `<path d="M18 42 L18 28 Q16 20 20 14 Q22 8 28 8 Q34 10 34 16 Q36 18 32 22 L38 28
               L32 30 L26 26 Q24 30 22 34 L22 42 Z"
              fill="${fc}" stroke="${sc}" stroke-width="${sw}"/>
        <circle cx="30" cy="13" r="2" fill="${sc}"/>
        <path d="M20 18 Q24 14 28 16" stroke="${sc}" stroke-width="${sw}" fill="none" stroke-linecap="round"/>
        <rect x="14" y="41" width="24" height="5" rx="2" fill="${fc}" stroke="${sc}" stroke-width="${sw}"/>`,
    P: `<circle cx="26" cy="13" r="7" fill="${fc}" stroke="${sc}" stroke-width="${sw}"/>
        <path d="M20 20 Q18 30 16 38 Q18 40 26 40 Q34 40 36 38 Q34 30 32 20 Z"
              fill="${fc}" stroke="${sc}" stroke-width="${sw}"/>
        <rect x="13" y="38" width="26" height="5" rx="2" fill="${fc}" stroke="${sc}" stroke-width="${sw}"/>`
  };

  const filter = isW ? '' :
    `<filter id="df">
       <feColorMatrix type="matrix"
         values="0 0 0 0 0.17  0 0 0 0 0.13  0 0 0 0 0.09  0 0 0 1 0"/>
     </filter>`;
  const gAttr = isW ? '' : `filter="url(#df)"`;

  return `<svg viewBox="0 0 52 52" xmlns="http://www.w3.org/2000/svg">
    ${filter}<g ${gAttr}>${shapes[type] || ''}</g></svg>`;
}

// ─── PIECE GUIDE ─────────────────────────────────────────────────────────────

const PIECE_NAMES = { K:'Король', Q:'Ферзь', R:'Ладья', B:'Слон', N:'Конь', P:'Пешка' };
const PIECE_MOVES = {
  K: '1 клетка в любом направлении',
  Q: 'Любое число клеток (♜+♝)',
  R: 'Горизонталь / вертикаль',
  B: 'Только диагонали',
  N: 'Г-образно, перепрыгивает фигуры',
  P: 'Вперёд 1-2, бьёт по диагонали'
};

function buildPieceGuide() {
  const el = document.getElementById('piece-guide');
  ['K','Q','R','B','N','P'].forEach(t => {
    const row = document.createElement('div');
    row.className = 'pg-row';
    row.innerHTML = `${svgPiece('w'+t)}
      <div class="pg-info">
        <b>${PIECE_NAMES[t]}</b>
        <span>${PIECE_MOVES[t]}</span>
      </div>`;
    el.appendChild(row);
  });
}

// ─── CHESS ENGINE ────────────────────────────────────────────────────────────

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

let board, turn, sel, poss, history, capW, capB, flipped, mode, gameOver, lastMv;

function initGame() {
  board    = INIT_BOARD.map(r => [...r]);
  turn     = 'w';
  sel      = null;
  poss     = [];
  history  = [];
  capW     = [];
  capB     = [];
  flipped  = false;
  gameOver = false;
  lastMv   = null;

  document.getElementById('moves-list').innerHTML = '';
  document.getElementById('cap-w').innerHTML = '';
  document.getElementById('cap-b').innerHTML = '';

  renderBoard();
  updateStatus();
  updateEval();
  updatePlayerBanners();
}

function resetGame() { initGame(); }

// ── Rendering ────────────────────────────────────────────────────────────────

function renderBoard() {
  const el = document.getElementById('board');
  el.innerHTML = '';

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const dr = flipped ? 7 - r : r;
      const dc = flipped ? 7 - c : c;

      const sq = document.createElement('div');
      sq.className = 'sq ' + ((dr + dc) % 2 === 0 ? 'light' : 'dark');

      if (lastMv && ((dr === lastMv.fr && dc === lastMv.fc) || (dr === lastMv.tr && dc === lastMv.tc)))
        sq.classList.add('lastmv');
      if (sel && dr === sel[0] && dc === sel[1])
        sq.classList.add('sel');

      const isPoss = poss.some(p => p[0] === dr && p[1] === dc);
      if (isPoss) {
        sq.classList.add('poss');
        if (board[dr][dc]) sq.classList.add('hap');
      }

      if (!gameOver && board[dr][dc] === turn + 'K' && isInCheck(turn, board))
        sq.classList.add('inchk');

      const piece = board[dr][dc];
      if (piece) sq.innerHTML = svgPiece(piece);

      sq.addEventListener('click', () => onSqClick(dr, dc));
      el.appendChild(sq);
    }
  }

  const rcol = document.getElementById('rcol');
  rcol.innerHTML = '';
  (flipped ? [1,2,3,4,5,6,7,8] : [8,7,6,5,4,3,2,1]).forEach(n => {
    const s = document.createElement('span');
    s.textContent = n;
    rcol.appendChild(s);
  });
}

// ── Square Click ─────────────────────────────────────────────────────────────

function onSqClick(r, c) {
  if (gameOver) return;

  // В онлайн-режиме только наш цвет
  if (isOnline && turn !== myColor) return;

  const piece = board[r][c];

  if (sel) {
    const mv = poss.find(m => m[0] === r && m[1] === c);
    if (mv) {
      doMove(sel[0], sel[1], r, c);
      if (isOnline) pushMoveOnline(sel[0], sel[1], r, c);
      sel = null; poss = [];
      renderBoard(); updateStatus(); updateEval(); updatePlayerBanners();
      if (!gameOver && mode !== 'pvp' && !isOnline) setTimeout(aiMove, 420);
      return;
    }
    sel = null; poss = [];
  }

  if (piece && piece[0] === turn) {
    sel  = [r, c];
    poss = getLegal(r, c, board, turn);
  }
  renderBoard();
}

// ── Apply Move ───────────────────────────────────────────────────────────────

function doMove(fr, fc, tr, tc, remote = false) {
  const piece  = board[fr][fc];
  const target = board[tr][tc];

  if (target) {
    const capEl  = document.getElementById(turn === 'w' ? 'cap-w' : 'cap-b');
    const div    = document.createElement('div');
    div.innerHTML = svgPiece(target);
    capEl.appendChild(div);
    if (turn === 'w') capW.push(target); else capB.push(target);
  }

  const snapshot = board.map(r => [...r]);
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
  history.push({ from: [fr,fc], to: [tr,tc], note, snapshot, piece, target });
  appendMoveToList(note);

  const opp    = turn === 'w' ? 'b' : 'w';
  turn         = opp;
  const inChk  = isInCheck(opp, board);
  const hasLgl = hasAnyLegal(opp, board);

  if (!hasLgl) {
    gameOver = true;
    setTimeout(() => {
      if (inChk) {
        const winnerColor = opp === 'w' ? 'Чёрные' : 'Белые';
        showModal('Шах и мат!', `Победили ${winnerColor}! Партия из ${Math.ceil(history.length/2)} ходов.`);
        // Сохраняем в историю
        if (currentUser) {
          const iWon = (myColor === 'w' && opp === 'b') || (myColor === 'b' && opp === 'w');
          const opponent = document.getElementById(myColor === 'w' ? 'pname-black' : 'pname-white').textContent;
          saveGameToHistory(iWon ? 'win' : 'loss', opponent, Math.ceil(history.length/2));
        }
        if (isOnline && onlineGameRef) onlineGameRef.update({ status: 'finished' });
      } else {
        showModal('Пат!', 'Нет ходов, но король не под шахом — ничья!');
        if (currentUser) {
          const opponent = document.getElementById(myColor === 'w' ? 'pname-black' : 'pname-white').textContent;
          saveGameToHistory('draw', opponent, Math.ceil(history.length/2));
        }
      }
    }, 150);
  }
}

// ── Algebraic Notation ───────────────────────────────────────────────────────

function algebraic(piece, fr, fc, tr, tc, captured) {
  const files  = 'abcdefgh';
  const ranks  = '87654321';
  const pnames = { P:'', R:'Л', N:'К', B:'С', Q:'Ф', K:'Кр' };
  return pnames[piece[1]] +
         (piece[1] === 'P' && captured ? files[fc] : '') +
         (captured ? 'x' : '') +
         files[tc] + ranks[tr];
}

function appendMoveToList(note) {
  const list = document.getElementById('moves-list');
  const num  = Math.ceil(history.length / 2);

  if (history.length % 2 === 1) {
    const row = document.createElement('div');
    row.className = 'move-row';
    row.id = 'mr' + num;
    row.innerHTML = `<span class="mn">${num}.</span><button class="mb">${note}</button>`;
    list.appendChild(row);
  } else {
    const row = document.getElementById('mr' + num);
    if (row) {
      const b = document.createElement('button');
      b.className = 'mb';
      b.textContent = note;
      row.appendChild(b);
    }
  }
  list.scrollTop = list.scrollHeight;
}

// ── Undo ─────────────────────────────────────────────────────────────────────

function undoMove() {
  if (!history.length) return;
  if (isOnline) { showToast('Отмена хода недоступна в онлайн-игре'); return; }

  const last = history.pop();
  board    = last.snapshot;
  turn     = last.piece[0];
  gameOver = false;
  lastMv   = history.length
    ? { fr: history[history.length-1].from[0], fc: history[history.length-1].from[1],
        tr: history[history.length-1].to[0],   tc: history[history.length-1].to[1] }
    : null;

  if (last.target) {
    const capEl = document.getElementById(turn === 'w' ? 'cap-w' : 'cap-b');
    if (capEl.lastChild) capEl.removeChild(capEl.lastChild);
    if (turn === 'w') capW.pop(); else capB.pop();
  }

  const list = document.getElementById('moves-list');
  const rows = list.querySelectorAll('.move-row');
  if (rows.length) {
    const lr = rows[rows.length - 1];
    const bs = lr.querySelectorAll('.mb');
    if (bs.length > 1) bs[bs.length - 1].remove(); else lr.remove();
  }

  sel = null; poss = [];
  renderBoard(); updateStatus(); updateEval(); updatePlayerBanners();
}

// ─── MOVE GENERATION ─────────────────────────────────────────────────────────

function getRaw(r, c, bd) {
  const piece = bd[r][c];
  if (!piece) return [];
  const t    = piece[0];
  const type = piece[1];
  const opp  = t === 'w' ? 'b' : 'w';
  const moves = [];

  const add = (nr, nc) => { if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) moves.push([nr, nc]); };
  const slide = (dr, dc) => {
    let nr = r + dr, nc = c + dc;
    while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
      if (bd[nr][nc]) { if (bd[nr][nc][0] === opp) moves.push([nr, nc]); break; }
      moves.push([nr, nc]);
      nr += dr; nc += dc;
    }
  };

  if (type === 'P') {
    const dir = t === 'w' ? -1 : 1;
    const start = t === 'w' ? 6 : 1;
    if (r + dir >= 0 && r + dir < 8 && !bd[r + dir][c]) {
      moves.push([r + dir, c]);
      if (r === start && !bd[r + 2*dir][c]) moves.push([r + 2*dir, c]);
    }
    [[r+dir, c-1],[r+dir, c+1]].forEach(([nr, nc]) => {
      if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && bd[nr][nc] && bd[nr][nc][0] === opp)
        moves.push([nr, nc]);
    });
  }

  if (type === 'R' || type === 'Q') [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dr,dc]) => slide(dr,dc));
  if (type === 'B' || type === 'Q') [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([dr,dc]) => slide(dr,dc));
  if (type === 'N') [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr,dc]) => add(r+dr,c+dc));

  if (type === 'K') {
    [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].forEach(([dr,dc]) => add(r+dr,c+dc));
    const rk = t === 'w' ? 7 : 0;
    if (r === rk && c === 4) {
      if (!bd[rk][5] && !bd[rk][6] && bd[rk][7] && bd[rk][7][0] === t) moves.push([rk, 6]);
      if (!bd[rk][3] && !bd[rk][2] && !bd[rk][1] && bd[rk][0] && bd[rk][0][0] === t) moves.push([rk, 2]);
    }
  }

  return moves.filter(([nr, nc]) => !bd[nr][nc] || bd[nr][nc][0] === opp);
}

function findKing(t, bd) {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (bd[r][c] === t + 'K') return [r, c];
  return null;
}

function isInCheck(t, bd) {
  const k = findKing(t, bd);
  if (!k) return false;
  const opp = t === 'w' ? 'b' : 'w';
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (bd[r][c] && bd[r][c][0] === opp &&
          getRaw(r, c, bd).some(([nr,nc]) => nr === k[0] && nc === k[1]))
        return true;
  return false;
}

function getLegal(r, c, bd, t) {
  return getRaw(r, c, bd).filter(([tr, tc]) => {
    const nb  = bd.map(row => [...row]);
    nb[tr][tc] = nb[r][c];
    nb[r][c]   = null;
    return !isInCheck(t, nb);
  });
}

function hasAnyLegal(t, bd) {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (bd[r][c] && bd[r][c][0] === t && getLegal(r, c, bd, t).length)
        return true;
  return false;
}

// ─── AI ──────────────────────────────────────────────────────────────────────

function aiMove() {
  if (gameOver || turn !== 'b') return;

  const moves = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c] && board[r][c][0] === 'b')
        getLegal(r, c, board, 'b').forEach(([tr, tc]) => moves.push({ fr:r, fc:c, tr, tc }));

  if (!moves.length) return;

  let best = null, bestScore = -Infinity;

  moves.forEach(m => {
    let score = (board[m.tr][m.tc] ? PIECE_VALUES[board[m.tr][m.tc][1]] : 0) * 2;

    if (mode === 'hard') {
      const nb = board.map(r => [...r]);
      nb[m.tr][m.tc] = nb[m.fr][m.fc];
      nb[m.fr][m.fc] = null;
      if (isInCheck('w', nb)) score += 5;
    }

    score += Math.random() * 0.5;
    if (score > bestScore) { bestScore = score; best = m; }
  });

  doMove(best.fr, best.fc, best.tr, best.tc);
  renderBoard(); updateStatus(); updateEval(); updatePlayerBanners();
}

// ─── UI HELPERS ──────────────────────────────────────────────────────────────

function updateStatus() {
  const dot = document.getElementById('sdot');
  const txt = document.getElementById('stext');
  if (gameOver) return;

  const inChk = isInCheck(turn, board);
  dot.className = 'sdot ' + (turn === 'w' ? 'w' : 'b');
  txt.innerHTML = inChk
    ? `<strong>Шах!</strong> Ход ${turn==='w'?'белых':'чёрных'}. Защитите короля.`
    : `Ход ${turn==='w'?'<strong>белых</strong>':'<strong>чёрных</strong>'}. Выберите фигуру.`;

  // В онлайн-режиме подсказка о ходе
  if (isOnline) {
    const myTurn = turn === myColor;
    if (!inChk) {
      txt.innerHTML = myTurn
        ? `Ход ${turn==='w'?'<strong>белых</strong>':'<strong>чёрных</strong>'}. <strong style="color:var(--gold)">Ваш ход!</strong>`
        : `Ход ${turn==='w'?'<strong>белых</strong>':'<strong>чёрных</strong>'}. Ждём противника...`;
    }
  }
}

function updatePlayerBanners() {
  ['white','black'].forEach(color => {
    const isActive = (color === 'white' ? turn === 'w' : turn === 'b') && !gameOver;
    document.getElementById(`pb-${color}`).classList.toggle('active-turn', isActive);
  });
}

function updateEval() {
  let score = 0;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p) score += (p[0]==='w' ? 1 : -1) * (PIECE_VALUES[p[1]] || 0);
    }
  const pct = Math.max(5, Math.min(95, 50 + score * 4));
  document.getElementById('eval-fill').style.height = pct + '%';
}

function flipBoard() { flipped = !flipped; renderBoard(); }

function showModal(title, msg) {
  document.getElementById('m-title').textContent = title;
  document.getElementById('m-msg').textContent   = msg;
  document.getElementById('modal').classList.add('show');
}
function closeModal() { document.getElementById('modal').classList.remove('show'); }

// ─── TIPS ────────────────────────────────────────────────────────────────────

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

// ─── INIT ────────────────────────────────────────────────────────────────────

buildPieceGuide();
