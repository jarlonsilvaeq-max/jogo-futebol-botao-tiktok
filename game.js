const $ = id => document.getElementById(id);
const pitch = $("pitch");
const playersRoot = $("players");
const ball = $("ball");
const crowd = $("crowd");
const goalSound = $("goalSound");

const FORMATION = [
  { x: 17, y: 27 }, { x: 27, y: 72 },
  { x: 39, y: 38 }, { x: 39, y: 62 },
  { x: 83, y: 27 }, { x: 73, y: 72 },
  { x: 61, y: 38 }, { x: 61, y: 62 }
];

const GIFT = {
  5655: { name: "Rose", participation: 1 },
  5487: { name: "Finger Heart", participation: 5 },
  5780: { name: "Bouquet Flower", participation: 20 },
  5879: { name: "Doughnut", participation: 20 },
  14690: { name: "League Ball", special: true },
  63005: { name: "Soccer Holo", rare: true }
};

const state = {
  running: false,
  elapsed: 0,
  score: [0, 0],
  totalParticipation: 0,
  players: [],
  owner: -1,
  ball: { x: 50, y: 50 },
  lastFrame: 0,
  timer: null,
  socket: null,
  activity: [],
  goalLock: false
};

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function makePlayer(id) {
  const team = id < 4 ? 0 : 1;
  const pos = FORMATION[id];

  const player = {
    id, team,
    x: pos.x, y: pos.y,
    homeX: pos.x, homeY: pos.y,
    vx: 0, vy: 0,
    username: "",
    nickname: `Jogador ${id + 1}`,
    avatar: "",
    participation: 0,
    goals: 0,
    el: null
  };

  const el = document.createElement("div");
  el.className = `player ${team === 0 ? "red" : "blue"}`;
  el.style.left = `${player.x}%`;
  el.style.top = `${player.y}%`;
  el.innerHTML = `
    <img alt="" hidden>
    <span class="user-badge">${id + 1}</span>
    <span class="name">Aguardando torcedor</span>
  `;

  player.el = el;
  playersRoot.appendChild(el);
  state.players.push(player);
  return player;
}

FORMATION.forEach((_, i) => makePlayer(i));

function setPosition(el, x, y) {
  el.style.left = `${clamp(x, 2.5, 97.5)}%`;
  el.style.top = `${clamp(y, 3, 97)}%`;
}

function updateBall() {
  setPosition(ball, state.ball.x, state.ball.y);
}

function setBall(x, y, owner = state.owner) {
  state.ball.x = clamp(x, 3, 97);
  state.ball.y = clamp(y, 4, 96);
  state.owner = owner;
  updateBall();
  const p = state.players[owner];
  $("possession").textContent = p
    ? `POSSE: ${p.username ? "@" + p.username : p.nickname}`
    : "BOLA EM DISPUTA";
}

function assignUser(user) {
  const username = String(user.username || "torcedor").replace(/^@/, "");
  let p = state.players.find(x => x.username === username);

  if (!p) {
    // Atribui novos espectadores primeiro aos lugares vazios.
    p = state.players.find(x => !x.username);
  }

  if (!p) {
    // Se o campo estiver completo, usa o jogador com menos participação.
    p = [...state.players].sort((a, b) =>
      a.participation - b.participation
    )[0];
  }

  p.username = username;
  p.nickname = user.nickname || username;
  p.avatar = user.avatar || p.avatar;

  const img = p.el.querySelector("img");
  const name = p.el.querySelector(".name");

  if (p.avatar) {
    img.src = p.avatar;
    img.hidden = false;
    img.onerror = () => { img.hidden = true; };
  }

  name.textContent = `@${username}`;
  name.title = p.nickname;

  return p;
}

function nearestPlayer(x = state.ball.x, y = state.ball.y, team = null) {
  let best = null;
  let bestDist = Infinity;

  for (const p of state.players) {
    if (team !== null && p.team !== team) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }

  return best;
}

function addParticipation(user, amount) {
  const p = assignUser(user);
  const value = clamp(Math.floor(Number(amount) || 1), 1, 500);

  p.participation += value;
  state.totalParticipation += value;

  $("totalParticipation").textContent =
    state.totalParticipation.toLocaleString("pt-BR");

  // A cada bloco interno de participação, o jogador recebe impulso.
  while (p.participation >= 100) {
    p.participation -= 100;
    impulse(p);
  }

  if (state.owner < 0) setBall(p.x, p.y, p.id);
}

function impulse(p) {
  const direction = p.team === 0 ? 1 : -1;
  p.vx += direction * 14;
  p.vy += (Math.random() - 0.5) * 8;

  setBall(
    p.x + direction * 4,
    p.y + (Math.random() - 0.5) * 4,
    p.id
  );

  addActivity(`⚡ @${p.username || p.nickname} entrou na jogada`);
}

function applyGift(data) {
  const gift = GIFT[Number(data.giftId)];
  const user = {
    username: data.username,
    nickname: data.nickname,
    avatar: data.avatar
  };

  if (!gift) {
    addActivity(`🎁 @${user.username || "torcedor"} enviou ${data.giftName || "um presente"}`);
    return;
  }

  const p = assignUser(user);
  const repeat = clamp(Number(data.repeatCount) || 1, 1, 99);

  if (gift.participation) {
    addParticipation(user, gift.participation * repeat);
    addActivity(`🎁 ${gift.name}: @${p.username} +${gift.participation * repeat} participação`);
    return;
  }

  if (gift.special) {
    // Jogada especial: o jogador avança em direção ao gol adversário.
    const dir = p.team === 0 ? 1 : -1;
    p.vx += dir * 38;
    p.vy += (50 - p.y) * 0.3;
    setBall(p.x + dir * 9, p.y, p.id);
    addActivity(`⚽ Jogada especial de @${p.username}`);
    return;
  }

  if (gift.rare) {
    // Jogada rara: avanço maior e companheiros apoiam a jogada.
    const dir = p.team === 0 ? 1 : -1;
    p.vx += dir * 60;
    setBall(p.x + dir * 14, p.y, p.id);

    state.players
      .filter(x => x.team === p.team && x.id !== p.id)
      .forEach((mate, i) => {
        mate.vx += dir * (12 + i * 3);
      });

    addActivity(`🏆 Jogada rara de @${p.username}`);
  }
}

function addActivity(message) {
  state.activity.unshift(message);
  state.activity = state.activity.slice(0, 5);

  $("activity").innerHTML = state.activity
    .map(text => `<div class="activity-item"></div>`)
    .join("");

  [...$("activity").children].forEach((node, i) => {
    node.textContent = state.activity[i];
  });
}

function showGoal(p) {
  if (state.goalLock) return;
  state.goalLock = true;

  state.score[p.team]++;
  p.goals++;

  $(`score${p.team === 0 ? "A" : "B"}`).textContent =
    state.score[p.team];

  $("goalFlash").classList.remove("show");
  void $("goalFlash").offsetWidth;
  $("goalFlash").classList.add("show");

  // Recomeça o som no início de cada gol.
  try {
    goalSound.pause();
    goalSound.currentTime = 0;
    goalSound.volume = 0.95;
    goalSound.play().catch(err => {
      console.warn("O navegador bloqueou o áudio do gol:", err);
    });
  } catch (err) {
    console.warn("Erro no áudio do gol:", err);
  }

  addActivity(`⚽ GOOOOL de @${p.username || p.nickname}!`);
  updateRanking();

  setTimeout(() => {
    state.players.forEach(player => {
      player.x = player.homeX;
      player.y = player.homeY;
      player.vx = 0;
      player.vy = 0;
      setPosition(player.el, player.x, player.y);
    });

    setBall(50, 50, -1);
    state.goalLock = false;
  }, 1800);
}

function updateRanking() {
  const ordered = [...state.players]
    .filter(p => p.goals > 0)
    .sort((a, b) => b.goals - a.goals);

  if (!ordered.length) {
    $("ranking").innerHTML =
      '<p class="muted">A artilharia aparece quando sair o primeiro gol.</p>';
    return;
  }

  $("ranking").innerHTML = ordered.map((p, i) => `
    <div class="ranking-row">
      <span class="rank-number">${i + 1}º</span>
      <img class="rank-avatar" alt="" src="${p.avatar || ""}">
      <span class="rank-name"></span>
      <span class="rank-goals">${p.goals} gol${p.goals === 1 ? "" : "s"}</span>
    </div>
  `).join("");

  [...$("ranking").querySelectorAll(".rank-name")].forEach((el, i) => {
    el.textContent = `@${ordered[i].username || ordered[i].nickname}`;
  });
}

function tick(dt) {
  if (!state.running) return;

  // O jogo é simulado em tempo real; os movimentos são interpolados.
  const owner = state.players[state.owner];

  for (const p of state.players) {
    let tx = p.homeX;
    let ty = p.homeY;

    if (owner && p.id !== owner.id) {
      if (p.team !== owner.team) {
        // A defesa adversária pressiona o portador da bola.
        tx = owner.x + (p.team === 0 ? 8 : -8);
        ty = owner.y + (p.y < owner.y ? -7 : 7);
      } else {
        // Companheiros se aproximam para dar opção de passe.
        tx = owner.x + (p.team === 0 ? 10 : -10);
        ty = owner.y + (p.y < owner.y ? -10 : 10);
      }
    } else if (!owner) {
      tx = state.ball.x;
      ty = state.ball.y;
    }

    // Aproximação suave ao destino.
    const dx = tx - p.x;
    const dy = ty - p.y;
    p.vx += dx * 0.08;
    p.vy += dy * 0.08;

    p.vx *= 0.92;
    p.vy *= 0.92;

    p.x = clamp(p.x + p.vx * dt, 4, 96);
    p.y = clamp(p.y + p.vy * dt, 6, 94);

    setPosition(p.el, p.x, p.y);
  }

  if (owner) {
    // A bola acompanha o portador, com pequenas variações.
    const dir = owner.team === 0 ? 1 : -1;
    state.ball.x += dir * dt * 2.5;
    state.ball.y += (owner.y - state.ball.y) * 0.08;

    // Pressão adversária pode causar troca de posse.
    const defender = nearestPlayer(owner.x, owner.y, owner.team === 0 ? 1 : 0);
    if (defender && Math.hypot(defender.x - owner.x, defender.y - owner.y) < 4) {
      if (Math.random() < 0.025) {
        setBall(defender.x, defender.y, defender.id);
      }
    }

    // Finalização interna, sem expor a regra na interface.
    if (owner.participation >= 1000 &&
        (owner.team === 0 ? state.ball.x > 82 : state.ball.x < 18)) {
      owner.participation -= 1000;
      showGoal(owner);
    }

    // Passe para companheiro quando há pressão.
    if (defender && Math.hypot(defender.x - owner.x, defender.y - owner.y) < 5 &&
        Math.random() < 0.015) {
      const mate = nearestPlayer(owner.x + (owner.team === 0 ? 12 : -12), owner.y, owner.team);
      if (mate && mate.id !== owner.id) {
        setBall(mate.x, mate.y, mate.id);
      }
    }

    if (state.ball.x < 4 || state.ball.x > 96) {
      setBall(50, 50, -1);
    } else {
      updateBall();
    }
  } else {
    const candidate = nearestPlayer();
    if (candidate && Math.hypot(candidate.x - state.ball.x, candidate.y - state.ball.y) < 4) {
      setBall(candidate.x, candidate.y, candidate.id);
    }
  }

  state.elapsed += dt;
  const total = Math.floor(state.elapsed);
  $("clock").textContent =
    `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function animate(now) {
  if (!state.lastFrame) state.lastFrame = now;
  const dt = Math.min((now - state.lastFrame) / 1000, 0.05);
  state.lastFrame = now;
  tick(dt);
  requestAnimationFrame(animate);
}

function connect() {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const socket = new WebSocket(`${protocol}//${location.host}/game`);
  state.socket = socket;

  socket.addEventListener("open", () => {
    $("statusText").textContent = "Servidor conectado";
  });

  socket.addEventListener("close", () => {
    $("statusText").textContent = "Reconectando…";
    $("statusDot").classList.remove("online");
    setTimeout(connect, 3000);
  });

  socket.addEventListener("error", () => {
    $("statusText").textContent = "Falha na conexão";
  });

  socket.addEventListener("message", event => {
    let data;
    try { data = JSON.parse(event.data); } catch { return; }

    if (data.type === "status") {
      const connected = data.status === "connected";
      $("statusText").textContent = connected
        ? `TikTok conectado: @${data.username || "085.game.players"}`
        : data.status === "connecting"
          ? "Conectando ao TikTok…"
          : "TikTok desconectado";
      $("statusDot").classList.toggle("online", connected);
      return;
    }

    if (data.type === "like") {
      addParticipation({
        username: data.username,
        nickname: data.nickname,
        avatar: data.avatar
      }, data.amount);
      return;
    }

    if (data.type === "gift") {
      applyGift(data);
    }
  });
}

$("startButton").addEventListener("click", async () => {
  $("startGate").style.display = "none";
  state.running = true;

  // Navegadores móveis exigem uma interação para liberar o áudio.
  crowd.volume = 0.16;
  try {
    await crowd.play();
  } catch (err) {
    addActivity("O navegador bloqueou a torcida. Verifique o áudio do navegador.");
    console.warn("Não foi possível iniciar a torcida:", err);
  }
});

connect();
requestAnimationFrame(animate);
