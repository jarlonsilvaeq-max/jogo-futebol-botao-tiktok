const players = [
  { name:"Jogador A", user:"@jogador_a", likes:0, goals:0 },
  { name:"Jogador B", user:"@jogador_b", likes:0, goals:0 },
  { name:"Jogador C", user:"@jogador_c", likes:0, goals:0 },
  { name:"Jogador D", user:"@jogador_d", likes:0, goals:0 }
];

const gifts = {
  5655:{name:"Rose", power:1},
  5487:{name:"Finger Heart", power:5},
  5780:{name:"Bouquet Flower", power:20},
  5879:{name:"Doughnut", power:20},
  14690:{name:"League Ball", power:50},
  63005:{name:"Soccer Holo", power:100}
};

let active = 0;
let running = false;

const crowd = document.getElementById("crowd");
const goalSound = document.getElementById("goalSound");

function render(){
  const box = document.getElementById("players");
  box.innerHTML = players.map((p,i)=>`
    <div class="row">
      <span>${p.name} <span class="muted">${p.user}</span></span>
      <span>${p.likes} curtidas · ${p.goals} gols${i===active?" ⚽":""}</span>
    </div>`).join("");

  const ranking = [...players].sort((a,b)=>b.goals-a.goals);
  document.getElementById("ranking").innerHTML =
    ranking.map(p=>`<li>${p.name} — ${p.goals} gol${p.goals===1?"":"s"}</li>`).join("");

  players.forEach((_,i)=>{
    document.getElementById("p"+i).style.outline = i===active ? "4px solid #ffd400" : "none";
  });
}

function addLikes(i, amount){
  players[i].likes += amount;
  active = i;
  render();
}

function goal(i=active, forced=false){
  const p=players[i];
  if(!forced && p.likes < 1000) return;
  if(forced) p.likes = Math.max(p.likes,1000);
  p.likes -= 1000;
  p.goals++;
  active = i;
  goalSound.currentTime=0;
  goalSound.volume=.9;
  goalSound.play().catch(()=>{});
  render();
}

function startAudio(){
  crowd.volume=.16;
  crowd.play().catch(()=>{});
}

document.getElementById("start").onclick=()=>{
  running=true;
  startAudio();
};

document.getElementById("pause").onclick=()=>{
  running=false;
  crowd.pause();
};

document.getElementById("reset").onclick=()=>{
  players.forEach(p=>{p.likes=0;p.goals=0});
  active=0;
  render();
};

document.querySelectorAll("[data-like]").forEach(btn=>{
  btn.onclick=()=>addLikes(Number(btn.dataset.like),100);
});

document.querySelectorAll("[data-gift]").forEach(btn=>{
  btn.onclick=()=>{
    const id=Number(btn.dataset.gift);
    const g=gifts[id];
    if(!g) return;
    players[active].likes += g.power;
    render();
  };
});

document.getElementById("testGoal").onclick=()=>goal(active,true);

const ws = location.protocol.startsWith("http")
  ? new WebSocket((location.protocol==="https:"?"wss://":"ws://")+location.host+"/game")
  : null;

if(ws){
  ws.onmessage=e=>{
    let msg;
    try{msg=JSON.parse(e.data)}catch{return}
    if(msg.type==="like") addLikes(active, Number(msg.amount)||1);
    if(msg.type==="gift"){
      players[active].likes += Number(msg.amount)||1;
      render();
    }
    if(msg.type==="goal") goal(active,true);
  };
}

render();
