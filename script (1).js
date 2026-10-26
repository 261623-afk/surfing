// Let's surf — 방어동 항구 서핑 게임
const W = 800, H = 400, BASE = 300, SX = 170;
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const $ = (id) => document.getElementById(id);

// 선명한 화면(고해상도) 대응
const dpr = Math.min(window.devicePixelRatio || 1, 2);
canvas.width = W * dpr; canvas.height = H * dpr;
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

let best = 0;
try { best = Number(localStorage.getItem("letssurf.best") || 0); } catch {}
$("best").textContent = best;

const G = { state: "ready", dist: 0, score: 0, speed: 5, z: 0, vz: 0, duck: false, held: false,
            obs: [], spawnIn: 300, last: 0 };

const waveY = (x) => BASE + Math.sin(x * 0.012) * 8 + Math.sin(x * 0.031) * 3;

// ---------- 장애물 ----------
const TYPES = [
  { kind: "buoy", w: 30, h: 44, weight: 30 },
  { kind: "drum", w: 36, h: 40, weight: 25 },
  { kind: "container", w: 72, h: 48, weight: 20 },
  { kind: "hook", w: 34, h: 0, weight: 25 },
];
function pickType() {
  let r = Math.random() * TYPES.reduce((s, t) => s + t.weight, 0);
  for (const t of TYPES) { if ((r -= t.weight) < 0) return t; }
  return TYPES[0];
}
function spawn() {
  const t = pickType();
  G.obs.push({ ...t, x: W + 40 });
  G.spawnIn = t.w + G.speed * (44 + Math.random() * 40);
}

// ---------- 조작 ----------
function jump() {
  if (G.state !== "play") return;
  if (G.z === 0) { G.vz = 11; }
}
function setDuck(v) { G.duck = v; }
function start() {
  Object.assign(G, { state: "play", dist: 0, score: 0, speed: 5, z: 0, vz: 0, duck: false, obs: [], spawnIn: 300 });
  $("overlay").hidden = true;
  G.last = performance.now();
  requestAnimationFrame(loop);
}
function togglePause() {
  if (G.state === "play") { G.state = "pause"; showOverlay("일시정지", "P 키 또는 버튼으로 계속합니다.", "계속하기"); }
  else if (G.state === "pause") { G.state = "play"; $("overlay").hidden = true; G.last = performance.now(); requestAnimationFrame(loop); }
}
function showOverlay(title, text, btn) {
  $("ov-title").textContent = title; $("ov-text").textContent = text; $("start").textContent = btn;
  $("overlay").hidden = false; $("start").focus();
}
function gameOver() {
  G.state = "over";
  const s = Math.floor(G.score);
  let msg = `점수 ${s}점`;
  if (s > best) {
    best = s; msg += " · 최고 기록 갱신!";
    try { localStorage.setItem("letssurf.best", String(best)); } catch {}
    $("best").textContent = best;
  }
  showOverlay("부딪혔어요", msg, "다시 시작");
}

$("start").addEventListener("click", () => { G.state === "pause" ? togglePause() : start(); });
window.addEventListener("keydown", (e) => {
  if (["Space", "ArrowUp", "ArrowDown"].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
    if (G.state === "ready" || G.state === "over") start(); else jump();
  } else if (e.code === "ArrowDown" || e.code === "KeyS") setDuck(true);
  else if (e.code === "KeyP") togglePause();
});
window.addEventListener("keyup", (e) => { if (e.code === "ArrowDown" || e.code === "KeyS") setDuck(false); });
canvas.addEventListener("pointerdown", jump);
const hold = (id, down, up) => {
  const b = $(id);
  b.addEventListener("pointerdown", (e) => { e.preventDefault(); b.classList.add("on"); down(); });
  ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => b.addEventListener(ev, () => { b.classList.remove("on"); up(); }));
};
hold("btn-jump", jump, () => {});
hold("btn-duck", () => setDuck(true), () => setDuck(false));
document.addEventListener("visibilitychange", () => { if (document.hidden && G.state === "play") togglePause(); });

// ---------- 업데이트 ----------
function surferBox() {
  const y = waveY(SX + G.dist) - G.z;
  const h = G.duck && G.z === 0 ? 34 : 62;
  return { x: SX - 20 + 5, y: y - h + 5, w: 40 - 10, h: h - 10, base: y };
}
function obsBox(o) {
  if (o.kind === "hook") return { x: o.x + 5, y: 0, w: o.w - 10, h: 252 - 5 };
  const oy = waveY(o.x + o.w / 2 + G.dist) + 4;
  return { x: o.x + 5, y: oy - o.h + 5, w: o.w - 10, h: o.h - 10 };
}
const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function update(dt) {
  G.speed = Math.min(5 + G.score / 150, 11);
  const move = G.speed * dt;
  G.dist += move;
  G.score += move * 0.1;
  // 점프 물리 (숙이면 빨리 내려옴)
  if (G.z > 0 || G.vz > 0) {
    G.vz -= (G.duck ? 1.4 : 0.6) * dt;
    G.z += G.vz * dt;
    if (G.z <= 0) { G.z = 0; G.vz = 0; }
  }
  G.obs.forEach((o) => (o.x -= move));
  G.obs = G.obs.filter((o) => o.x + o.w > -40);
  G.spawnIn -= move;
  if (G.spawnIn <= 0) spawn();
  const me = surferBox();
  if (G.obs.some((o) => hit(me, obsBox(o)))) gameOver();
  $("score").textContent = Math.floor(G.score);
  $("speed").textContent = (G.speed / 5).toFixed(1) + "x";
}

// ---------- 그리기 ----------
function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, BASE);
  sky.addColorStop(0, "#9cc3d5"); sky.addColorStop(1, "#e9f1f3");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  // 먼 산·공장 실루엣
  const d = G.dist;
  ctx.fillStyle = "#b7cfd8";
  for (let i = -1; i < 4; i++) {
    const x = ((i * 360 - d * 0.05) % 1440 + 1440) % 1440 - 360;
    ctx.beginPath(); ctx.moveTo(x, 260); ctx.lineTo(x + 140, 170); ctx.lineTo(x + 300, 260); ctx.fill();
  }
  // 도크 간판 건물 (동해마린텍)
  const bx = ((1000 - d * 0.12) % 1600 + 1600) % 1600 - 300;
  ctx.fillStyle = "#6f8e9d"; ctx.fillRect(bx, 205, 230, 70);
  ctx.fillStyle = "#1f4e6b"; ctx.fillRect(bx + 14, 218, 202, 28);
  ctx.fillStyle = "#f2b705"; ctx.font = "700 17px 'Noto Sans KR','Malgun Gothic',sans-serif";
  ctx.textAlign = "center"; ctx.fillText("동해마린텍", bx + 115, 238);
  // 겐트리 크레인
  ctx.fillStyle = "#3d5a6b";
  for (let i = 0; i < 4; i++) {
    const x = ((i * 320 + 80 - d * 0.22) % 1280 + 1280) % 1280 - 200;
    ctx.fillRect(x, 150, 6, 130); ctx.fillRect(x + 90, 150, 6, 130);
    ctx.fillRect(x - 20, 144, 150, 10);
    ctx.fillStyle = "#f2b705"; ctx.fillRect(x + 36, 154, 22, 14); ctx.fillStyle = "#3d5a6b";
  }
}
function drawWater() {
  const layers = [
    { off: 0, y: -26, color: "#3f86a6" },
    { off: 0, y: 0, color: "#2a6a8a" },
    { off: 90, y: 28, color: "#1f4e6b" },
  ];
  layers.forEach((l, i) => {
    ctx.fillStyle = l.color; ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) ctx.lineTo(x, waveY(x + G.dist * (1 + i * 0.12) + l.off) + l.y + (i ? 0 : 0));
    ctx.lineTo(W, H); ctx.fill();
  });
  // 파도 거품선
  ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = 2; ctx.beginPath();
  for (let x = 0; x <= W; x += 8) { const y = waveY(x + G.dist) ; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.stroke();
}
function drawObstacle(o) {
  if (o.kind === "hook") {
    ctx.strokeStyle = "#2b3a44"; ctx.lineWidth = 3;
    const cx = o.x + o.w / 2;
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, 226); ctx.stroke();
    ctx.fillStyle = "#f2b705"; ctx.fillRect(cx - 14, 222, 28, 22);
    ctx.fillStyle = "#14232e"; ctx.fillRect(cx - 14, 222, 28, 4);
    ctx.lineWidth = 5; ctx.strokeStyle = "#2b3a44"; ctx.beginPath();
    ctx.moveTo(cx, 244); ctx.lineTo(cx, 250); ctx.arc(cx - 6, 250, 6, 0, Math.PI * 1.2); ctx.stroke();
    return;
  }
  const oy = waveY(o.x + o.w / 2 + G.dist) + 4, x = o.x, top = oy - o.h;
  if (o.kind === "buoy") {
    ctx.fillStyle = "#d8412f"; ctx.beginPath();
    ctx.moveTo(x, oy); ctx.lineTo(x + o.w, oy); ctx.lineTo(x + o.w - 7, top + 10); ctx.lineTo(x + 7, top + 10); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.fillRect(x + 4, top + 22, o.w - 8, 7);
    ctx.fillStyle = "#f2b705"; ctx.beginPath(); ctx.arc(x + o.w / 2, top + 6, 7, 0, Math.PI * 2); ctx.fill();
  } else if (o.kind === "drum") {
    ctx.fillStyle = "#2b6cb0"; ctx.fillRect(x, top, o.w, o.h);
    ctx.fillStyle = "#1d4d80"; ctx.fillRect(x, top + 10, o.w, 4); ctx.fillRect(x, top + o.h - 14, o.w, 4);
    ctx.fillStyle = "#f2b705"; ctx.fillRect(x + o.w / 2 - 5, top + 18, 10, 6);
  } else {
    ctx.fillStyle = "#b5482d"; ctx.fillRect(x, top, o.w, o.h);
    ctx.strokeStyle = "#8a3520"; ctx.lineWidth = 3;
    for (let i = 10; i < o.w; i += 12) { ctx.beginPath(); ctx.moveTo(x + i, top + 3); ctx.lineTo(x + i, oy - 3); ctx.stroke(); }
  }
}
function drawSurfer() {
  const y = waveY(SX + G.dist) - G.z;
  const tilt = G.z > 0 ? -G.vz * 0.01 : (waveY(SX + 6 + G.dist) - waveY(SX - 6 + G.dist)) * 0.04;
  ctx.save(); ctx.translate(SX, y); ctx.rotate(tilt);
  // 보드
  ctx.fillStyle = "#f2b705"; ctx.beginPath(); ctx.ellipse(0, 2, 30, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#14232e"; ctx.fillRect(-4, 0, 8, 2);
  const crouch = G.duck && G.z === 0;
  const h = crouch ? 34 : 62;
  // 다리·몸
  ctx.strokeStyle = "#14232e"; ctx.lineWidth = 6; ctx.lineCap = "round";
  ctx.beginPath();
  if (crouch) { ctx.moveTo(-10, 0); ctx.lineTo(-4, -14); ctx.lineTo(8, -12); ctx.moveTo(10, 0); ctx.lineTo(8, -12); }
  else { ctx.moveTo(-9, 0); ctx.lineTo(-3, -24); ctx.moveTo(9, 0); ctx.lineTo(3, -24); }
  ctx.stroke();
  ctx.strokeStyle = "#1f4e6b"; ctx.lineWidth = 12; ctx.beginPath();
  ctx.moveTo(0, crouch ? -14 : -24); ctx.lineTo(crouch ? 6 : 0, crouch ? -24 : -44); ctx.stroke();
  // 팔
  ctx.strokeStyle = "#e0a373"; ctx.lineWidth = 4; ctx.beginPath();
  const sy = crouch ? -22 : -40;
  ctx.moveTo(2, sy); ctx.lineTo(-18, sy + (G.z > 0 ? -8 : 6)); ctx.moveTo(2, sy); ctx.lineTo(22, sy + (G.z > 0 ? -8 : 6)); ctx.stroke();
  // 머리·헬멧
  const hy = crouch ? -32 : -h + 8;
  ctx.fillStyle = "#e0a373"; ctx.beginPath(); ctx.arc(crouch ? 8 : 0, hy, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#f2b705"; ctx.beginPath(); ctx.arc(crouch ? 8 : 0, hy - 2, 8.5, Math.PI, 0); ctx.fill();
  ctx.restore();
}
function draw() {
  ctx.clearRect(0, 0, W, H);
  drawBackground();
  drawWater();
  G.obs.forEach(drawObstacle);
  drawSurfer();
}

function loop(now) {
  if (G.state !== "play") { draw(); return; }
  const dt = Math.min((now - G.last) / 16.667, 2.5);
  G.last = now;
  update(dt);
  draw();
  if (G.state === "play") requestAnimationFrame(loop);
}
draw();
showOverlay("방어동 항구 서핑", "부표, 드럼통, 컨테이너는 점프로 넘고, 크레인 후크는 숙여서 피하세요.", "게임 시작");
