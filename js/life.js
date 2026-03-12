/* ─────────────────────────────────────────────────────────
   life.js — physics-based photo playground
   48 photos burst from center, drift with Brownian motion,
   flee the cursor, can be grabbed + flung, click to open.
   ───────────────────────────────────────────────────────── */
'use strict';

// ── Photo list ────────────────────────────────────────────
// Add captions by filling in the caption string.
const PHOTOS = [
  { file: '72430701594__69D1D736-105D-426C-86D8-BDCD485B7181.fullsizerender.jpeg', caption: '' },
  { file: 'C3834B75-DC9B-4A43-8F46-D47861D04C46.jpeg',                            caption: '' },
  { file: 'DSCN0212_Original.jpeg',                                                 caption: '' },
  { file: 'DSCN0219_Original.jpeg',                                                 caption: '' },
  { file: 'E955417A-ED31-45F7-8DFC-AFFA1524D2F7.jpeg',                            caption: '' },
  { file: 'IMG_0045.jpeg',                                                          caption: '' },
  { file: 'IMG_0061.jpeg',                                                          caption: '' },
  { file: 'IMG_0724.jpeg',                                                          caption: '' },
  { file: 'IMG_0780.jpeg',                                                          caption: '' },
  { file: 'IMG_1634.jpeg',                                                          caption: '' },
  { file: 'IMG_2341.jpeg',                                                          caption: '' },
  { file: 'IMG_2444.jpeg',                                                          caption: '' },
  { file: 'IMG_2966.jpeg',                                                          caption: '' },
  { file: 'IMG_2983.jpeg',                                                          caption: '' },
  { file: 'IMG_2984.jpeg',                                                          caption: '' },
  { file: 'IMG_3157.jpeg',                                                          caption: '' },
  { file: 'IMG_3411.jpeg',                                                          caption: '' },
  { file: 'IMG_3732.jpeg',                                                          caption: '' },
  { file: 'IMG_4192.jpeg',                                                          caption: '' },
  { file: 'IMG_4741.jpeg',                                                          caption: '' },
  { file: 'IMG_5148.jpeg',                                                          caption: '' },
  { file: 'IMG_5172.jpeg',                                                          caption: '' },
  { file: 'IMG_5328.jpeg',                                                          caption: '' },
  { file: 'IMG_5500.jpeg',                                                          caption: '' },
  { file: 'IMG_5501.jpeg',                                                          caption: '' },
  { file: 'IMG_5573.jpeg',                                                          caption: '' },
  { file: 'IMG_5578.jpeg',                                                          caption: '' },
  { file: 'IMG_5581.jpeg',                                                          caption: '' },
  { file: 'IMG_5726.jpeg',                                                          caption: '' },
  { file: 'IMG_5813.jpeg',                                                          caption: '' },
  { file: 'IMG_5949 2.jpeg',                                                        caption: '' },
  { file: 'IMG_5980.jpeg',                                                          caption: '' },
  { file: 'IMG_5986.jpeg',                                                          caption: '' },
  { file: 'IMG_6034.jpeg',                                                          caption: '' },
  { file: 'IMG_6082.jpeg',                                                          caption: '' },
  { file: 'IMG_6255.jpeg',                                                          caption: '' },
  { file: 'IMG_6285.jpeg',                                                          caption: '' },
  { file: 'IMG_6441.jpeg',                                                          caption: '' },
  { file: 'IMG_6771.jpeg',                                                          caption: '' },
  { file: 'IMG_6814.jpeg',                                                          caption: '' },
  { file: 'IMG_7027.jpeg',                                                          caption: '' },
  { file: 'IMG_7220 2.jpeg',                                                        caption: '' },
  { file: 'IMG_7224 2.jpeg',                                                        caption: '' },
  { file: 'IMG_8704.jpeg',                                                          caption: '' },
  { file: 'IMG_9516.jpeg',                                                          caption: '' },
  { file: 'MbnxydH6SEuAr924uU-lNg.jpeg',                                           caption: '' },
  { file: 'ad454d36-6dae-480c-96ff-189006dd5232.jpeg',                             caption: '' },
];

// ── Physics constants ─────────────────────────────────────
const NAV_H     = 52;
const CARD_W    = 155;
const CARD_H    = 200;   // polaroid height (image + caption strip)
const DAMP      = 0.96;  // velocity damping per frame
const DAMP_ANG  = 0.90;  // angular damping
const REPEL_R   = 190;   // mouse repulsion radius px
const REPEL_F   = 5.5;   // repulsion force strength
const DRIFT_A   = 0.009; // Brownian drift amplitude
const WALL_RES  = -0.38; // wall restitution (negative = reverse)
const CARD_REP_R = 175;  // card-to-card repulsion radius px
const CARD_REP_F = 1.4;  // card-to-card repulsion force

// ── State ─────────────────────────────────────────────────
let stageEl, stageW, stageH;
let mx = -9999, my = -9999;  // mouse in stage coords
let grabbed = null;
let grabOffX = 0, grabOffY = 0;
let mouseHist = [];
let zTop = 10;
let tick_n = 0;

// ── Card ──────────────────────────────────────────────────
class Card {
  constructor(photo, idx) {
    this.photo  = photo;
    this.idx    = idx;
    this.phase  = Math.random() * Math.PI * 2;  // drift phase offset

    // Start at stage center, fire outward in random direction
    this.x  = stageW / 2 - CARD_W / 2;
    this.y  = stageH / 2 - CARD_H / 2;
    const spd   = 6 + Math.random() * 10;
    const ang   = Math.random() * Math.PI * 2;
    this.vx     = Math.cos(ang) * spd;
    this.vy     = Math.sin(ang) * spd;
    this.angle  = (Math.random() - 0.5) * 28;
    this.omega  = (Math.random() - 0.5) * 3;
    this.dragDx = 0;  // total drag distance (click detection)

    this.el = this._build();
    stageEl.appendChild(this.el);
  }

  _build() {
    const el  = document.createElement('div');
    el.className = 'photo-card';
    // encode spaces in filename for valid URL
    const src = 'assets/photos/life/' + this.photo.file.replace(/ /g, '%20');
    el.innerHTML = `
      <div class="pc-img">
        <img src="${src}" alt="" loading="lazy" draggable="false"
          onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
        <div class="pc-ph" style="display:none;">📷</div>
      </div>
      <p class="pc-cap">${this.photo.caption || ''}</p>
    `;

    el.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      grabbed       = this;
      this.dragDx   = 0;
      grabOffX      = e.clientX - this.x;
      grabOffY      = (e.clientY - NAV_H) - this.y;
      mouseHist     = [[e.clientX, e.clientY - NAV_H, performance.now()]];
      el.classList.add('grabbed');
      el.style.zIndex = ++zTop;
      e.preventDefault();
    });

    // Set initial transform directly on el (this.el isn't assigned yet)
    el.style.transform = `translate(${this.x}px,${this.y}px) rotate(${this.angle}deg)`;
    return el;
  }

  _applyTransform() {
    this.el.style.transform = `translate(${this.x}px,${this.y}px) rotate(${this.angle}deg)`;
  }

  step(t) {
    if (grabbed === this) return;

    // Brownian drift (very gentle, each card has its own phase)
    this.vx += Math.sin(t * 0.7  + this.phase)       * DRIFT_A;
    this.vy += Math.cos(t * 0.55 + this.phase + 1.3) * DRIFT_A;

    // Mouse repulsion
    const cx = this.x + CARD_W / 2;
    const cy = this.y + CARD_H / 2;
    const dx = cx - mx;
    const dy = cy - my;
    const d2 = dx * dx + dy * dy;
    if (d2 < REPEL_R * REPEL_R && d2 > 0.01) {
      const d = Math.sqrt(d2);
      const f = Math.pow((REPEL_R - d) / REPEL_R, 1.6) * REPEL_F;
      this.vx    += (dx / d) * f;
      this.vy    += (dy / d) * f;
      this.omega += (dx / d) * f * 0.18;
    }

    // Damping
    this.vx    *= DAMP;
    this.vy    *= DAMP;
    this.omega *= DAMP_ANG;

    // Integrate
    this.x     += this.vx;
    this.y     += this.vy;
    this.angle += this.omega;

    // Wall collision
    if (this.x < 0)               { this.x = 0;               this.vx *= WALL_RES; this.omega *= 0.6; }
    if (this.y < 0)               { this.y = 0;               this.vy *= WALL_RES; }
    if (this.x > stageW - CARD_W) { this.x = stageW - CARD_W; this.vx *= WALL_RES; this.omega *= 0.6; }
    if (this.y > stageH - CARD_H) { this.y = stageH - CARD_H; this.vy *= WALL_RES; }

    this._applyTransform();
  }

  scatter() {
    const spd   = 10 + Math.random() * 12;
    const ang   = Math.random() * Math.PI * 2;
    this.vx     = Math.cos(ang) * spd;
    this.vy     = Math.sin(ang) * spd - 3;
    this.omega  = (Math.random() - 0.5) * 9;
  }
}

// ── Lightbox ──────────────────────────────────────────────
let lbOpen = false;

function openLightbox(photo) {
  const lb  = document.getElementById('lightbox');
  const img = document.getElementById('lb-img');
  const cap = document.getElementById('lb-cap');
  img.src = 'assets/photos/life/' + photo.file.replace(/ /g, '%20');
  cap.textContent = photo.caption || '';
  lb.classList.remove('hidden');
  lbOpen = true;
}

function closeLightbox() {
  document.getElementById('lightbox').classList.add('hidden');
  lbOpen = false;
}

// ── RAF loop ──────────────────────────────────────────────
let cards = [];

function loop() {
  tick_n++;
  const t = tick_n * 0.016;
  cards.forEach(c => c.step(t));
  requestAnimationFrame(loop);
}

// ── Init ─────────────────────────────────────────────────
// Scripts are at bottom of <body>, DOM is already ready.
(function init() {
  stageEl = document.getElementById('life-stage');
  // Fixed elements may not report clientWidth immediately — fall back to window
  stageW  = stageEl.clientWidth  || window.innerWidth;
  stageH  = stageEl.clientHeight || (window.innerHeight - NAV_H);

  // Build all cards
  PHOTOS.forEach((p, i) => cards.push(new Card(p, i)));

  // ── Mouse tracking ──────────────────────────────────────
  stageEl.addEventListener('mousemove', e => {
    mx = e.clientX;
    my = e.clientY - NAV_H;

    if (grabbed) {
      const nx  = e.clientX - grabOffX;
      const ny  = (e.clientY - NAV_H) - grabOffY;
      const ddx = nx - grabbed.x;
      const ddy = ny - grabbed.y;
      grabbed.dragDx += Math.sqrt(ddx * ddx + ddy * ddy);
      grabbed.x = nx;
      grabbed.y = ny;
      grabbed._applyTransform();
      mouseHist.push([e.clientX, e.clientY - NAV_H, performance.now()]);
      if (mouseHist.length > 6) mouseHist.shift();
    }
  });

  // ── Mouse release ───────────────────────────────────────
  document.addEventListener('mouseup', () => {
    if (!grabbed) return;
    const card = grabbed;
    grabbed = null;
    card.el.classList.remove('grabbed');

    // Compute fling velocity from recent mouse positions
    if (mouseHist.length >= 2) {
      const first = mouseHist[0];
      const last  = mouseHist[mouseHist.length - 1];
      const dt    = Math.max(last[2] - first[2], 8);
      card.vx    = ((last[0] - first[0]) / dt) * 15;
      card.vy    = ((last[1] - first[1]) / dt) * 15;
      card.omega = card.vx * 0.07;
    }

    // Click detection: if barely moved, open lightbox
    if (card.dragDx < 5) {
      openLightbox(card.photo);
      card.vx = 0; card.vy = 0; card.omega = 0;
    }
  });

  // ── Scatter button ──────────────────────────────────────
  document.getElementById('scatter-btn').addEventListener('click', () => {
    cards.forEach(c => c.scatter());
  });

  // ── Lightbox controls ───────────────────────────────────
  document.getElementById('lb-close').addEventListener('click', closeLightbox);
  document.getElementById('lightbox').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeLightbox();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && lbOpen) closeLightbox();
  });

  // ── Fade hint out ───────────────────────────────────────
  setTimeout(() => {
    const hint = document.getElementById('life-hint');
    if (hint) hint.classList.add('gone');
  }, 4000);

  // ── Resize ──────────────────────────────────────────────
  window.addEventListener('resize', () => {
    stageW = stageEl.clientWidth;
    stageH = stageEl.clientHeight;
  });

  // ── Start RAF ───────────────────────────────────────────
  requestAnimationFrame(loop);
}());
