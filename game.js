const field = document.querySelector(".field");
const ball = document.getElementById("ball");

const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");

const scoreA = document.getElementById("scoreA");
const scoreB = document.getElementById("scoreB");
const totalParticipation =
  document.getElementById("totalParticipation");

const matchTime = document.getElementById("matchTime");
const ranking = document.getElementById("ranking");
const eventFeed = document.getElementById("eventFeed");

const crowd = document.getElementById("crowd");
const goalSound = document.getElementById("goalSound");

let running = false;
let seconds = 0;
let timer = null;

let totalPart = 0;
let goalsA = 0;
let goalsB = 0;

const players = [];

const formations = [
  { x: 18, y: 30 },
  { x: 27, y: 65 },
  { x: 38, y: 35 },
  { x: 42, y: 70 },

  { x: 82, y: 30 },
  { x: 73, y: 65 },
  { x: 62, y: 35 },
  { x: 58, y: 70 }
];

for (let i = 0; i < 8; i++) {

  players.push({
    id: i,
    team: i < 4 ? "A" : "B",
    x: formations[i].x,
    y: formations[i].y,
    likes: 0,
    goals: 0,
    username: `@jogador_${i + 1}`,
    image: ""
  });

  movePlayer(i, formations[i].x, formations[i].y);
}

let ballState = {
  x: 50,
  y: 50,
  owner: null
};

function movePlayer(id, x, y) {

  const el = document.getElementById(`player${id}`);

  if (!el) return;

  x = Math.max(4, Math.min(96, x));
  y = Math.max(8, Math.min(92, y));

  players[id].x = x;
  players[id].y = y;

  el.style.left = `${x}%`;
  el.style.top = `${y}%`;
  el.style.transform = "translate(-50%, -50%)";
}

function moveBall(x, y) {

  x = Math.max(3, Math.min(97, x));
  y = Math.max(5, Math.min(95, y));

  ballState.x = x;
  ballState.y = y;

  ball.style.left = `${x}%`;
  ball.style.top = `${y}%`;

  ball.style.transform = "translate(-50%, -50%)";
}

function distance(a, b) {

  const dx = a.x - b.x;
  const dy = a.y - b.y;

  return Math.sqrt(dx * dx + dy * dy);
}

function nearestPlayer() {

  let best = players[0];
  let bestDistance = Infinity;

  for (const player of players) {

    const d = distance(player, ballState);

    if (d < bestDistance) {
      best = player;
      bestDistance = d;
    }
  }

  return best;
}

function playMovement() {

  const target = nearestPlayer();

  if (!target) return;

  const dx = ballState.x - target.x;
  const dy = ballState.y - target.y;

  const d = Math.sqrt(dx * dx + dy * dy);

  if (d > 5) {

    const speed = 1.5;

    movePlayer(
      target.id,
      target.x + (dx / d) * speed,
      target.y + (dy / d) * speed
    );

  } else {

    ballState.owner = target.id;

    const direction =
      target.team === "A"
        ? 1
        : -1;

    const newX =
      Math.max(
        8,
        Math.min(
          92,
          ballState.x + direction * (3 + Math.random() * 6)
        )
      );

    const newY =
      Math.max(
        12,
        Math.min(
          88,
          ballState.y + (Math.random() - .5) * 10
        )
      );

    moveBall(newX, newY);

    movePlayer(
      target.id,
      newX - direction * 2,
      newY
    );
  }

  makeOthersMove();
}

function makeOthersMove() {

  players.forEach(player => {

    if (player.id === ballState.owner) return;

    const home = formations[player.id];

    const pressure =
      player.team ===
      (players[ballState.owner]?.team || "")
        ? 3
        : 7;

    const tx =
      home.x +
      (Math.random() - .5) * pressure;

    const ty =
      home.y +
      (Math.random() - .5) * pressure;

    movePlayer(player.id, tx, ty);
  });
}

function addParticipation(amount) {

  totalPart += amount;

  totalParticipation.textContent =
    totalPart.toLocaleString("pt-BR");

  const player = nearestPlayer();

  if (player) {

    player.likes += amount;

    /*
      A quantidade usada internamente para
      impulsionar o jogador fica escondida
      da interface.
    */

    if (player.likes >= 100) {

      player.likes -= 100;

      impulse(player);
    }
  }
}

function impulse(player) {

  const direction =
    player.team === "A"
      ? 1
      : -1;

  movePlayer(
    player.id,
    player.x + direction * 8,
    player.y + (Math.random() - .5) * 10
  );

  moveBall(
    player.x + direction * 7,
    player.y
  );

  showEvent(
    `${player.username} entrou na jogada!`
  );
}

function addGift(id) {

  switch (Number(id)) {

    case 5655:
      addParticipation(1);
      break;

    case 5487:
      addParticipation(5);
      break;

    case 5780:
      addParticipation(20);
      break;

    case 5879:
      addParticipation(20);
      break;

    case 14690:
      specialPlay();
      break;

    case 63005:
      rarePlay();
      break;
  }
}

function specialPlay() {

  const player = nearestPlayer();

  if (!player) return;

  moveBall(
    player.x +
    (player.team === "A" ? 12 : -12),
    player.y
  );

  showEvent(
    `${player.username} recebeu uma jogada especial!`
  );
}

function rarePlay() {

  const player = nearestPlayer();

  if (!player) return;

  moveBall(
    player.x +
    (player.team === "A" ? 18 : -18),
    player.y
  );

  movePlayer(
    player.id,
    player.x +
    (player.team === "A" ? 12 : -12),
    player.y
  );

  showEvent(
    `${player.username} fez uma jogada rara!`
  );
}

function goal(playerId) {

  const player = players[playerId];

  if (!player) return;

  /*
    Regra interna:
    o jogador precisa ter acumulado
    participação suficiente para finalizar.
    Essa regra NÃO é exibida no jogo.
  */

  if (player.likes < 1000) {

    showEvent(
      `${player.username} ainda não está pronto para finalizar.`
    );

    return;
  }

  player.likes -= 1000;

  player.goals++;

  if (player.team === "A") {
    goalsA++;
    scoreA.textContent = goalsA;
  } else {
    goalsB++;
    scoreB.textContent = goalsB;
  }

  goalSound.currentTime = 0;
  goalSound.volume = .9;
  goalSound.play().catch(() => {});

  showEvent(
    `⚽ GOOOOOL! ${player.username}`
  );

  updateRanking();

  moveBall(
    player.team === "A" ? 94 : 6,
    50
  );

  setTimeout(() => {

    moveBall(50, 50);

    players.forEach((p, i) => {
      movePlayer(i, formations[i].x, formations[i].y);
    });

  }, 2200);
}

function updateRanking() {

  const ordered =
    [...players]
      .filter(p => p.goals > 0)
      .sort((a, b) => b.goals - a.goals);

  if (!ordered.length) {

    ranking.innerHTML =
      `<div class="ranking-empty">
        Nenhum gol ainda
      </div>`;

    return;
  }

  ranking.innerHTML =
    ordered.map((p, index) => `
      <div class="ranking-item">
        <span class="ranking-position">
          ${index + 1}º
        </span>

        <strong>${p.username}</strong>

        <span style="margin-left:auto">
          ${p.goals} gol${p.goals > 1 ? "s" : ""}
        </span>
      </div>
    `).join("");
}

function showEvent(message) {

  const item =
    document.createElement("div");

  item.className = "event";
  item.textContent = message;

  eventFeed.appendChild(item);

  setTimeout(() => {
    item.remove();
  }, 3500);
}

function startMatch() {

  if (running) return;

  running = true;

  crowd.volume = .15;

  crowd.play().catch(() => {});

  timer = setInterval(() => {

    seconds++;

    const min =
      String(Math.floor(seconds / 60))
        .padStart(2, "0");

    const sec =
      String(seconds % 60)
        .padStart(2, "0");

    matchTime.textContent =
      `${min}:${sec}`;

  }, 1000);

  showEvent("Partida iniciada!");
}

function pauseMatch() {

  running = false;

  clearInterval(timer);

  crowd.pause();

  showEvent("Partida pausada.");
}

function resetMatch() {

  running = false;

  clearInterval(timer);

  seconds = 0;

  goalsA = 0;
  goalsB = 0;

  totalPart = 0;

  scoreA.textContent = "0";
  scoreB.textContent = "0";

  totalParticipation.textContent = "0";
  matchTime.textContent = "00:00";

  players.forEach((player, i) => {

    player.likes = 0;
    player.goals = 0;

    movePlayer(
      i,
      formations[i].x,
      formations[i].y
    );
  });

  moveBall(50, 50);

  updateRanking();

  crowd.pause();
  crowd.currentTime = 0;

  showEvent("Partida reiniciada.");
}

startBtn.onclick = startMatch;
pauseBtn.onclick = pauseMatch;
resetBtn.onclick = resetMatch;


/* =====================================================
   WEBSOCKET
===================================================== */

let socket;

function connectWebSocket() {

  const protocol =
    location.protocol === "https:"
      ? "wss:"
      : "ws:";

  socket =
    new WebSocket(
      `${protocol}//${location.host}/game`
    );

  socket.onopen = () => {

    showEvent("TikTok LIVE conectado.");
  };

  socket.onclose = () => {

    setTimeout(
      connectWebSocket,
      3000
    );
  };

  socket.onmessage = event => {

    let data;

    try {
      data = JSON.parse(event.data);
    } catch {
      return;
    }

    if (data.type === "like") {

      addParticipation(
        Number(data.amount || 1)
      );
    }

    if (data.type === "gift") {

      if (data.giftId) {

        addGift(
          Number(data.giftId)
        );

      } else {

        addParticipation(
          Number(data.amount || 1)
        );
      }
    }

    if (data.type === "goal") {

      const player =
        nearestPlayer();

      if (player) {
        goal(player.id);
      }
    }

    if (data.type === "player") {

      const player =
        players[data.playerId];

      if (!player) return;

      player.username =
        data.username ||
        player.username;

      const el =
        document.getElementById(
          `player${data.playerId}`
        );

      if (el) {

        const name =
          el.querySelector(
            ".player-name"
          );

        if (name) {
          name.textContent =
            player.username;
        }

        if (data.profilePicture) {

          const img =
            el.querySelector("img");

          img.src =
            data.profilePicture;
        }
      }
    }
  };
}

connectWebSocket();


/* =====================================================
   MOVIMENTO AUTOMÁTICO
===================================================== */

setInterval(() => {

  if (!running) return;

  playMovement();

}, 900);


/* =====================================================
   TESTES INTERNOS
===================================================== */

window.testLike = function(amount = 100) {

  addParticipation(amount);
};

window.testGift = function(id) {

  addGift(id);
};

window.testGoal = function(playerId = 0) {

  players[playerId].likes = 1000;

  goal(playerId);
};
