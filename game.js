
const $ = (id) => document.getElementById(id);

const pitch = $("pitch");
const playersLayer = $("playersLayer");
const ballElement = $("ball");

const CONFIG = {
  wsPath: "/game",
  maxActivity: 6,
  maxRanking: 10,
  likeEvery: 10
};

const GIFTS = {
  5655: { name: "Rosa", points: 1 },
  5487: { name: "Finger Heart", points: 5 },
  5780: { name: "Buquê", points: 20 },
  5879: { name: "Donut", points: 20 },
  14690: { name: "Bola de futebol", points: 100 },
  63005: { name: "Presente raro", points: 250 }
};

const state = {
  running: false,
  connected: false,
  socket: null,
  players: [],
  nextId: 1,
  scoreHome: 0,
  scoreAway: 0,
  seconds: 0,
  homePoints: 0,
  awayPoints: 0,
  lastGoal: 0,
  audio: null,
  audioEnabled: true,
  ball: { x: 50, y: 50, vx: 0.12, vy: 0.08 },
  lastTick: 0
};

function escapeText(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function addActivity(message) {
  const list = $("activity");
  if (!list) return;

  const empty = list.querySelector(".empty-activity");
  if (empty) empty.remove();

  const item = document.createElement("li");
  item.textContent = message;
  list.prepend(item);

  while (list.children.length > CONFIG.maxActivity) {
    list.lastElementChild.remove();
  }
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function teamPlayers(team) {
  return state.players.filter(player => player.team === team);
}

function activeTeamPlayers(team) {
  return teamPlayers(team).filter(player => player.username);
}

function getHomePosition(team, index, count) {
  if (count <= 4) {
    const red = [
      { x: 17, y: 50 },
      { x: 30, y: 27 },
      { x: 30, y: 73 },
      { x: 43, y: 50 }
    ];
    const blue = [
      { x: 83, y: 50 },
      { x: 70, y: 27 },
      { x: 70, y: 73 },
      { x: 57, y: 50 }
    ];
    return (team === "home" ? red : blue)[index] || { x: team === "home" ? 25 : 75, y: 50 };
  }

  const columns = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / columns);
  const col = index % columns;
  const row = Math.floor(index / columns);
  const progressX = (col + 1) / (columns + 1);
  const progressY = (row + 1) / (rows + 1);

  return {
    x: team === "home" ? 7 + progressX * 39 : 93 - progressX * 39,
    y: 7 + progressY * 86
  };
}

function createPlayer(team, username = "") {
  const player = {
    id: state.nextId++,
    team,
    username,
    points: 0,
    likes: 0,
    gifts: 0,
    x: team === "home" ? 25 : 75,
    y: 50,
    homeX: team === "home" ? 25 : 75,
    homeY: 50,
    element: null
  };

  state.players.push(player);
  return player;
}

function reflowTeam(team) {
  const players = teamPlayers(team);

  players.forEach((player, index) => {
    const position = getHomePosition(team, index, players.length);
    player.homeX = position.x;
    player.homeY = position.y;
  });
}

function createPlayerElement(player) {
  const element = document.createElement("div");
  element.className = `field-player ${player.team}`;
  element.dataset.playerId = String(player.id);

  const shirt = document.createElement("span");
  shirt.className = "player-shirt";
  shirt.textContent = player.team === "home" ? "🔴" : "🔵";

  const name = document.createElement("span");
  name.className = "player-name";
  name.textContent = player.username || "Livre";

  element.append(shirt, name);
  playersLayer.appendChild(element);
  player.element = element;
}

function renderPlayers() {
  state.players.forEach(player => {
    if (!player.element) createPlayerElement(player);

    player.element.style.left = `${player.x}%`;
    player.element.style.top = `${player.y}%`;

    const name = player.element.querySelector(".player-name");
    if (name) name.textContent = player.username || "Livre";

    player.element.classList.toggle("has-user", Boolean(player.username));
  });

  $("playerCount").textContent =
    `Jogadores: ${activeTeamPlayers("home").length + activeTeamPlayers("away").length}`;
}

function initializePlayers() {
  if (state.players.length) return;

  for (let i = 0; i < 4; i++) createPlayer("home");
  for (let i = 0; i < 4; i++) createPlayer("away");

  reflowTeam("home");
  reflowTeam("away");

  state.players.forEach((player, index) => {
    const position = getHomePosition(
      player.team,
      teamPlayers(player.team).indexOf(player),
      teamPlayers(player.team).length
    );
    player.x = position.x;
    player.y = position.y;
  });

  renderPlayers();
}

function findPlayer(username) {
  const normalized = normalizeUsername(username);
  if (!normalized) return null;

  return state.players.find(
    player => normalizeUsername(player.username) === normalized
  ) || null;
}

function normalizeUsername(username) {
  return String(username || "")
    .trim()
    .replace(/^@/, "")
    .toLowerCase();
}

function getLeastPopulatedTeam() {
  return activeTeamPlayers("home").length <= activeTeamPlayers("away").length
    ? "home"
    : "away";
}

function assignUser(username) {
  const name = String(username || "").trim().replace(/^@/, "");
  if (!name) return null;

  const existing = findPlayer(name);
  if (existing) return existing;

  const team = getLeastPopulatedTeam();

  let player = teamPlayers(team).find(item => !item.username);

  if (!player) {
    player = createPlayer(team);
  }

  player.username = name;

  reflowTeam(team);
  addActivity(`👤 @${name} entrou no time ${team === "home" ? "vermelho" : "azul"}.`);

  renderPlayers();
  updateDashboard();

  return player;
}

function addPoints(username, points, reason = "Participação") {
  let player = assignUser(username);

  if (!player) {
    player = createPlayer(getLeastPopulatedTeam(), "Visitante");
  }

  player.points += points;

  if (player.team === "home") {
    state.homePoints += points;
  } else {
    state.awayPoints += points;
  }

  addActivity(`⚽ ${player.username}: +${points} (${reason})`);
  updateDashboard();
  return player;
}

function handleLike(data) {
  const username =
    data.username || data.uniqueId || data.nickname || data.user || "";

  const count = Number(data.count || data.likeCount || data.totalLikes || 1);
  if (!username) return;

  const player = assignUser(username);
  if (!player) return;

  player.likes += count;

  const gained = Math.floor(player.likes / CONFIG.likeEvery);
  const alreadyCounted = Math.floor((player.likes - count) / CONFIG.likeEvery);
  const points = Math.max(0, gained - alreadyCounted);

  if (points > 0) {
    addPoints(username, points, "Curtidas");
  }

  updateDashboard();
}

function handleGift(data) {
  const username =
    data.username || data.uniqueId || data.nickname || data.user || "";

  const giftId = Number(data.giftId ?? data.gift_id ?? data.id);
  const repeat = Math.max(1, Number(data.repeatCount || data.repeat_count || data.count || 1));
  const gift = GIFTS[giftId];

  if (!username) return;

  if (!gift) {
    addActivity(`🎁 Presente recebido de @${username}.`);
    return;
  }

  const player = assignUser(username);
  if (!player) return;

  player.gifts += repeat;

  if (giftId === 14690) {
    // Presente especial: impulsiona a bola em direção ao gol adversário.
    kickBall(player.team, 1.2);
  } else if (giftId === 63005) {
    // Presente raro: grande impulso na direção do gol adversário.
    kickBall(player.team, 2.2);
  }

  addPoints(username, gift.points * repeat, gift.name);
  addActivity(`🎁 @${username} enviou ${gift.name}${repeat > 1 ? ` ×${repeat}` : ""}.`);
}

function updateDashboard() {
  $("homeScore").textContent = state.scoreHome;
  $("awayScore").textContent = state.scoreAway;
  $("clock").textContent = formatTime(state.seconds);

  const total = state.homePoints + state.awayPoints;
  const homePercent = total ? Math.round(state.homePoints / total * 100) : 50;
  const awayPercent = 100 - homePercent;

  $("homePercent").textContent = `${homePercent}%`;
  $("awayPercent").textContent = `${awayPercent}%`;
  $("homeBar").style.width = `${homePercent}%`;
  $("awayBar").style.width = `${awayPercent}%`;
  $("participationTotal").textContent = total.toLocaleString("pt-BR");

  renderRanking();
}

function renderRanking() {
  const list = $("ranking");
  if (!list) return;

  const ranked = state.players
    .filter(player => player.username)
    .sort((a, b) => b.points - a.points)
    .slice(0, CONFIG.maxRanking);

  list.replaceChildren();

  if (!ranked.length) {
    const item = document.createElement("li");
    item.className = "empty-ranking";
    item.textContent = "Aguardando participantes...";
    list.appendChild(item);
    return;
  }

  ranked.forEach((player, index) => {
    const item = document.createElement("li");
    item.className = "ranking-item";

    const rank = document.createElement("span");
    rank.className = "rank-number";
    rank.textContent = String(index + 1);

    const name = document.createElement("span");
    name.className = "rank-name";
    name.textContent = `@${player.username}`;

    const points = document.createElement("strong");
    points.className = `rank-points ${player.team}`;
    points.textContent = player.points.toLocaleString("pt-BR");

    item.append(rank, name, points);
    list.appendChild(item);
  });
}

function kickBall(team, strength = 1) {
  const direction = team === "home" ? 1 : -1;
  state.ball.vx = direction * (0.12 + 0.2 * strength);
  state.ball.vy = (Math.random() - 0.5) * 0.18;
}

function updateBall() {
  state.ball.x += state.ball.vx;
  state.ball.y += state.ball.vy;

  state.ball.vx *= 0.994;
  state.ball.vy *= 0.994;

  if (state.ball.y < 3 || state.ball.y > 97) {
    state.ball.vy *= -1;
    state.ball.y = Math.max(3, Math.min(97, state.ball.y));
  }

  if (state.ball.x < 2) {
    if (state.ball.y > 38 && state.ball.y < 62) {
      scoreGoal("away");
      return;
    }
    state.ball.vx = Math.abs(state.ball.vx);
    state.ball.x = 2;
  }

  if (state.ball.x > 98) {
    if (state.ball.y > 38 && state.ball.y < 62) {
      scoreGoal("home");
      return;
    }
    state.ball.vx = -Math.abs(state.ball.vx);
    state.ball.x = 98;
  }

  // Jogadores próximos da bola disputam a posse.
  const closest = state.players
    .filter(player => player.username)
    .map(player => ({
      player,
      distance: Math.hypot(player.x - state.ball.x, player.y - state.ball.y)
    }))
    .sort((a, b) => a.distance - b.distance)[0];

  if (closest && closest.distance < 4.5) {
    const player = closest.player;
    const direction = player.team === "home" ? 1 : -1;

    state.ball.vx += direction * 0.018;
    state.ball.vy += (50 - state.ball.y) * 0.0008;
  }

  state.ball.vx = Math.max(-0.48, Math.min(0.48, state.ball.vx));
  state.ball.vy = Math.max(-0.35, Math.min(0.35, state.ball.vy));

  ballElement.style.left = `${state.ball.x}%`;
  ballElement.style.top = `${state.ball.y}%`;
}

function updatePlayers() {
  state.players.forEach(player => {
    const dx = state.ball.x - player.x;
    const dy = state.ball.y - player.y;
    const distance = Math.hypot(dx, dy);

    if (player.username && distance < 24) {
      player.x += (dx / Math.max(distance, 1)) * 0.09;
      player.y += (dy / Math.max(distance, 1)) * 0.09;
    } else {
      player.x += (player.homeX - player.x) * 0.025;
      player.y += (player.homeY - player.y) * 0.025;
    }

    player.x = Math.max(3, Math.min(97, player.x));
    player.y = Math.max(4, Math.min(96, player.y));
  });

  renderPlayers();
}

function scoreGoal(team) {
  const now = Date.now();
  if (now - state.lastGoal < 1800) return;

  state.lastGoal = now;

  if (team === "home") {
    state.scoreHome++;
    addActivity("⚽ GOOOOOL DO TIME VERMELHO!");
  } else {
    state.scoreAway++;
    addActivity("⚽ GOOOOOL DO TIME AZUL!");
  }

  playGoalSound();
  showGoalFlash();

  state.ball.x = 50;
  state.ball.y = 50;
  state.ball.vx = team === "home" ? -0.15 : 0.15;
  state.ball.vy = (Math.random() - 0.5) * 0.1;

  updateDashboard();
}

function showGoalFlash() {
  const flash = document.createElement("div");
  flash.className = "goal-flash";
  flash.textContent = "GOOOOL!";
  pitch.appendChild(flash);

  setTimeout(() => flash.remove(), 1700);
}

function initAudio() {
  if (state.audio) {
    state.audioEnabled = true;
    return state.audio;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    addActivity("🔇 Este navegador não suporta áudio Web Audio.");
    return null;
  }

  const context = new AudioContextClass();
  const master = context.createGain();
  master.gain.value = 0.18;
  master.connect(context.destination);

  // Som ambiente gerado localmente, sem precisar de arquivo MP3.
  const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
  const channel = buffer.getChannelData(0);

  for (let i = 0; i < channel.length; i++) {
    channel[i] = (Math.random() * 2 - 1) * 0.15;
  }

  const noise = context.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;

  const filter = context.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 520;
  filter.Q.value = 0.65;

  const crowdGain = context.createGain();
  crowdGain.gain.value = 0.055;

  noise.connect(filter);
  filter.connect(crowdGain);
  crowdGain.connect(master);
  noise.start();

  // Oscilação suave para criar um ambiente sonoro menos estático.
  const lfo = context.createOscillator();
  const lfoGain = context.createGain();
  lfo.frequency.value = 0.22;
  lfoGain.gain.value = 0.018;
  lfo.connect(lfoGain);
  lfoGain.connect(crowdGain.gain);
  lfo.start();

  state.audio = { context, master, crowdGain, noise, lfo };
  state.audioEnabled = true;

  const crowdElement = $("crowd");
  if (crowdElement) {
    crowdElement.volume = 0.2;
    crowdElement.play().catch(() => {});
  }

  return state.audio;
}

function playGoalSound() {
  const audio = state.audio;
  if (!audio || !state.audioEnabled) return;

  const { context, master } = audio;
  if (context.state === "suspended") context.resume().catch(() => {});

  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "sawtooth";
  oscillator.frequency.setValueAtTime(420, now);
  oscillator.frequency.exponentialRampToValueAtTime(880, now + 0.22);
  oscillator.frequency.exponentialRampToValueAtTime(540, now + 0.8);

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.22, now + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

  oscillator.connect(gain);
  gain.connect(master);
  oscillator.start(now);
  oscillator.stop(now + 0.95);

  const goalElement = $("goalSound");
  if (goalElement) {
    goalElement.currentTime = 0;
    goalElement.volume = 0.5;
    goalElement.play().catch(() => {});
  }
}

function connect() {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const url = `${protocol}//${location.host}${CONFIG.wsPath}`;

  const socket = new WebSocket(url);
  state.socket = socket;

  socket.addEventListener("open", () => {
    state.connected = true;
    setConnectionStatus("Conectado ao servidor", true);
  });

  socket.addEventListener("message", event => {
    let data;

    try {
      data = JSON.parse(event.data);
    } catch {
      return;
    }

    handleServerMessage(data);
  });

  socket.addEventListener("close", () => {
    state.connected = false;
    setConnectionStatus("Desconectado — tentando novamente", false);
    setTimeout(connect, 3000);
  });

  socket.addEventListener("error", () => {
    setConnectionStatus("Erro de conexão", false);
  });
}

function setConnectionStatus(message, connected) {
  const status = $("connectionStatus");
  if (!status) return;

  status.textContent = message;
  status.classList.toggle("connected", connected);
  status.classList.toggle("disconnected", !connected);
}

function handleServerMessage(data) {
  const type = String(data.type || data.event || data.action || "").toLowerCase();

  if (type.includes("status")) {
    const message = data.message || data.status || "Status atualizado";
    setConnectionStatus(String(message), Boolean(data.connected));
    return;
  }

  if (type.includes("like") || type.includes("curt")) {
    handleLike(data);
    return;
  }

  if (type.includes("gift") || type.includes("present")) {
    handleGift(data);
    return;
  }

  // Compatibilidade com servidores que enviam o tipo dentro de "data".
  if (data.data && typeof data.data === "object") {
    handleServerMessage({ ...data.data, type: data.data.type || type });
  }
}

function startGame() {
  state.running = true;

  const gate = $("startGate");
  if (gate) gate.classList.add("hidden");

  initAudio();

  if (state.audio?.context?.state === "suspended") {
    state.audio.context.resume().catch(() => {});
  }

  addActivity("🏟️ Partida iniciada!");
}

function tick(timestamp) {
  if (!state.lastTick) state.lastTick = timestamp;

  if (state.running) {
    updateBall();
    updatePlayers();
  }

  requestAnimationFrame(tick);
}

setInterval(() => {
  if (state.running) {
    state.seconds++;
    $("clock").textContent = formatTime(state.seconds);
  }
}, 1000);

$("startButton")?.addEventListener("click", startGame);

initializePlayers();
updateDashboard();
connect();
requestAnimationFrame(tick);
