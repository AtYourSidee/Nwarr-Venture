// background.js
// Arrière-plan animé et interactif pour Nwarr'Venture.
// Modifie les variables et constantes pour changer les couleurs, le nombre d'étoiles ou la vitesse.

const canvas = document.getElementById('bgCanvas');
const ctx = canvas.getContext('2d');

const config = {
  starCount: 180,
  starMinSize: 0.7,
  starMaxSize: 2.6,
  nebulaCount: 4,
  nebulaSpeed: 0.02, // vitesse de mouvement de la brume
  glowRadius: 120,
  repulsionRadius: 180,
  repulsionForce: 0.45,
  returnStrength: 0.008,
  friction: 0.92
};

const palette = {
  background: '#0a0a0a',
  nebula: ['rgba(115,12,15,0.18)', 'rgba(145,20,29,0.14)', 'rgba(52,12,20,0.16)'],
  starLight: ['#f8f4e8', '#e4d7b8', '#f5e4cf'],
  starGold: '#d8ad78',
  accent: 'rgba(215, 35, 45, 0.18)'
};

let stars = [];
let nebulae = [];
let width = 0;
let height = 0;
let mouse = { x: 0, y: 0, normalizedX: 0, normalizedY: 0 };

function resizeCanvas() {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width * window.devicePixelRatio;
  canvas.height = height * window.devicePixelRatio;
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
}

function createStars() {
  stars = Array.from({ length: config.starCount }, () => {
    const x = Math.random() * width;
    const y = Math.random() * height;
    return {
      x,
      y,
      x0: x,
      y0: y,
      size: Math.random() * (config.starMaxSize - config.starMinSize) + config.starMinSize,
      color: palette.starLight[Math.floor(Math.random() * palette.starLight.length)],
      baseAlpha: 0.4 + Math.random() * 0.55,
      alpha: 0,
      vx: 0,
      vy: 0,
      phase: Math.random() * Math.PI * 2
    };
  });
}

function createNebulae() {
  nebulae = Array.from({ length: config.nebulaCount }, (_, index) => ({
    x: Math.random() * width,
    y: Math.random() * height,
    radius: width * (0.18 + Math.random() * 0.18),
    speed: (0.01 + Math.random() * 0.02) * (index % 2 === 0 ? 1 : -1),
    color: palette.nebula[index % palette.nebula.length],
    offset: Math.random() * Math.PI * 2
  }));
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, palette.background);
  gradient.addColorStop(0.4, '#120810');
  gradient.addColorStop(1, '#090608');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawNebulae() {
  nebulae.forEach((nebula) => {
    nebula.x += nebula.speed * config.nebulaSpeed * width;
    nebula.y += Math.sin(performance.now() * 0.00012 + nebula.offset) * 0.2;

    if (nebula.x > width + nebula.radius) nebula.x = -nebula.radius;
    if (nebula.x < -nebula.radius) nebula.x = width + nebula.radius;

    const nebulaGradient = ctx.createRadialGradient(
      nebula.x,
      nebula.y,
      nebula.radius * 0.1,
      nebula.x,
      nebula.y,
      nebula.radius
    );
    nebulaGradient.addColorStop(0, nebula.color);
    nebulaGradient.addColorStop(1, 'transparent');

    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = nebulaGradient;
    ctx.beginPath();
    ctx.arc(nebula.x, nebula.y, nebula.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  });
}

function drawStars() {
  stars.forEach((star) => {
    star.phase += 0.02;
    star.alpha = star.baseAlpha + Math.sin(star.phase) * 0.18;

    const dx = star.x - mouse.x;
    const dy = star.y - mouse.y;
    const distance = Math.hypot(dx, dy);
    const inRange = distance < config.repulsionRadius;

    if (inRange && distance > 0) {
      const force = (1 - distance / config.repulsionRadius) * config.repulsionForce;
      star.vx += (dx / distance) * force;
      star.vy += (dy / distance) * force;
    }

    star.vx += (star.x0 - star.x) * config.returnStrength;
    star.vy += (star.y0 - star.y) * config.returnStrength;

    star.vx *= config.friction;
    star.vy *= config.friction;

    star.x += star.vx;
    star.y += star.vy;

    const glowStrength = inRange ? (1 - distance / config.repulsionRadius) * 0.45 : 0;
    const starColor = glowStrength > 0.2 ? palette.starGold : star.color;

    ctx.fillStyle = starColor;
    ctx.globalAlpha = Math.max(0.16, Math.min(1, star.alpha + glowStrength * 0.3));
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size * (1 + glowStrength * 0.2), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });
}

function drawCursorGlow() {
  // Curseur sans contour : aucune lueur ajoutée ici.
}

function animate() {
  drawBackground();
  drawNebulae();
  drawStars();
  requestAnimationFrame(animate);
}

function onMouseMove(event) {
  mouse.x = event.clientX;
  mouse.y = event.clientY;
}

function onClick(event) {
  const clickX = event.clientX;
  const clickY = event.clientY;
  const explosionRadius = 350;
  const explosionForce = 16;

  stars.forEach((star) => {
    const dx = star.x - clickX;
    const dy = star.y - clickY;
    const distance = Math.hypot(dx, dy);

    if (distance < explosionRadius && distance > 0) {
      const force = (1 - distance / explosionRadius) * explosionForce;
      star.vx += (dx / distance) * force;
      star.vy += (dy / distance) * force;
    }
  });
}

function init() {
  resizeCanvas();
  createStars();
  createNebulae();
  window.addEventListener('resize', () => {
    resizeCanvas();
    createStars();
    createNebulae();
  });
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('click', onClick);
  requestAnimationFrame(animate);
}

init();
