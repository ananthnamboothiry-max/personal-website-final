/* ─────────────────────────────────────────────────────────
   life.js — physics-based photo playground
   Photos burst from center, drift with Brownian motion,
   flee the cursor, can be grabbed + flung, click to open.

   Cards load small thumbnails (assets/photos/life/thumbs/);
   the lightbox lazily loads the larger version (…/full/).
   Physics integrates with a real dt so 60Hz and 120Hz
   displays feel identical.
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
  { file: 'screenshot-2026-01-04.jpeg',                                             caption: '' },
  { file: 'IMG_7800.jpeg',                                                          caption: '' },
  { file: 'IMG_7967.jpeg',                                                          caption: '' },
  { file: 'IMG_8024.jpeg',                                                          caption: '' },
  { file: 'IMG_8033.jpeg',                                                          caption: '' },
  { file: 'IMG_8044.jpeg',                                                          caption: '' },
  { file: 'IMG_8056.jpeg',                                                          caption: '' },
];

const thumbSrc = f => 'assets/photos/life/thumbs/' + encodeURIComponent(f);
const fullSrc  = f => 'assets/photos/life/full/'   + encodeURIComponent(f);

// ── Environment ───────────────────────────────────────────
const NAV_H = parseFloat(
  getComputedStyle(document.documentElement).getPropertyValue('--nav-h')
) || 56;
const COARSE  = window.matchMedia('(pointer: coarse)').matches;
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── Physics constants (velocities are px per 60Hz frame) ──
const BASE_CARD_W = 155;
const DAMP        = 0.96;  // velocity damping per 60Hz frame
const DAMP_ANG    = 0.90;  // angular damping
const REPEL_F     = 5.5;   // cursor repulsion force strength
const DRIFT_A     = 0.009; // Brownian drift amplitude
const WALL_RES    = -0.38; // wall restitution (negative = reverse)
const CARD_REP_F  = 1.4;   // card-to-card repulsion force

// Sized at init from the stage so phones get smaller cards
let CARD_W = BASE_CARD_W, CARD_H = 200, REPEL_R = 190, CARD_REP_R = 175;

// ── State ─────────────────────────────────────────────────
let stageEl, stageW, stageH;
let mx = -9999, my = -9999;  // pointer in stage coords
let grabbed = null;
let grabPointerId = null;
let grabOffX = 0, grabOffY = 0;
let grabStartX = 0, grabStartY = 0;   // card position at grab (tap detection)
let pointerHist = [];
let zTop = 10;

// ── Card ──────────────────────────────────────────────────
class Card {
  constructor(photo, idx, total) {
    this.photo  = photo;
    this.idx    = idx;
    this.phase  = Math.random() * Math.PI * 2;  // drift phase offset

    if (REDUCED) {
      // Static scatter: no burst, no autonomous motion
      this.x = Math.random() * Math.max(stageW - CARD_W, 1);
      this.y = Math.random() * Math.max(stageH - CARD_H, 1);
      this.vx = 0; this.vy = 0;
      this.omega = 0;
    } else {
      // Start at stage center, fire outward in random direction
      this.x  = stageW / 2 - CARD_W / 2;
      this.y  = stageH / 2 - CARD_H / 2;
      const spd = 6 + Math.random() * 10;
      const ang = Math.random() * Math.PI * 2;
      this.vx    = Math.cos(ang) * spd;
      this.vy    = Math.sin(ang) * spd;
      this.omega = (Math.random() - 0.5) * 3;
    }
    this.angle = (Math.random() - 0.5) * 28;

    this.el = this._build(total);
    stageEl.appendChild(this.el);
  }

  _build(total) {
    const el  = document.createElement('div');
    el.className = 'photo-card';
    el.style.width = CARD_W + 'px';
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label',
      this.photo.caption ? this.photo.caption : `photo ${this.idx + 1} of ${total}`);
    el.innerHTML = `
      <div class="pc-img">
        <img src="${thumbSrc(this.photo.file)}" alt="" decoding="async" draggable="false" />
      </div>
      <p class="pc-cap">${this.photo.caption || ''}</p>
    `;

    el.addEventListener('pointerdown', e => {
      if (grabbed) return;  // one grab at a time; ignore extra fingers
      if (!e.isPrimary && e.pointerType !== 'touch') return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      grabbed       = this;
      grabPointerId = e.pointerId;
      grabStartX    = this.x;
      grabStartY    = this.y;
      grabOffX      = e.clientX - this.x;
      grabOffY      = (e.clientY - NAV_H) - this.y;
      pointerHist   = [[e.clientX, e.clientY - NAV_H, performance.now()]];
      el.classList.add('grabbed');
      el.style.zIndex = ++zTop;
      // Deliver move/up to us even outside the stage or window
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
      // Warm the browser cache with the full-size image while the user holds
      const warm = new Image();
      warm.src = fullSrc(this.photo.file);
      e.preventDefault();
    });

    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openLightbox(this.photo, el);
      }
    });

    // Set initial transform directly on el (this.el isn't assigned yet)
    el.style.transform = `translate3d(${this.x}px,${this.y}px,0) rotate(${this.angle}deg)`;
    return el;
  }

  _applyTransform() {
    this.el.style.transform = `translate3d(${this.x}px,${this.y}px,0) rotate(${this.angle}deg)`;
  }

  step(t, dt) {
    if (grabbed === this) return;

    if (REDUCED) {
      // Only user-initiated motion (flings) — settle and stop
      if (Math.abs(this.vx) + Math.abs(this.vy) + Math.abs(this.omega) < 0.02) return;
    } else {
      // Brownian drift (very gentle, each card has its own phase)
      this.vx += Math.sin(t * 0.7  + this.phase)       * DRIFT_A * dt;
      this.vy += Math.cos(t * 0.55 + this.phase + 1.3) * DRIFT_A * dt;

      // Pointer repulsion
      const cx = this.x + CARD_W / 2;
      const cy = this.y + CARD_H / 2;
      const dx = cx - mx;
      const dy = cy - my;
      const d2 = dx * dx + dy * dy;
      if (d2 < REPEL_R * REPEL_R && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const f = Math.pow((REPEL_R - d) / REPEL_R, 1.6) * REPEL_F * dt;
        this.vx    += (dx / d) * f;
        this.vy    += (dy / d) * f;
        this.omega += (dx / d) * f * 0.18;
      }
    }

    // Damping (frame-rate independent)
    const damp    = Math.pow(DAMP, dt);
    const dampAng = Math.pow(DAMP_ANG, dt);
    this.vx    *= damp;
    this.vy    *= damp;
    this.omega *= dampAng;

    // Integrate
    this.x     += this.vx * dt;
    this.y     += this.vy * dt;
    this.angle += this.omega * dt;

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
let lbToken = 0;          // guards against a stale full-image load clobbering
let lbReturnFocus = null; // element to restore focus to on close

function openLightbox(photo, focusOrigin) {
  const lb  = document.getElementById('lightbox');
  const img = document.getElementById('lb-img');
  const cap = document.getElementById('lb-cap');
  const token = ++lbToken;

  // Show the (already loaded) thumb instantly at the full display size so
  // the high-res swap doesn't visibly resize the image.
  img.style.width = '';
  img.style.height = '';
  img.src = thumbSrc(photo.file);
  const sizeFromThumb = () => {
    if (token !== lbToken || !img.naturalWidth) return;
    const maxW = Math.min(window.innerWidth * 0.88, 820);
    const maxH = window.innerHeight * 0.78;
    const s = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
    img.style.width  = Math.round(img.naturalWidth  * s) + 'px';
    img.style.height = Math.round(img.naturalHeight * s) + 'px';
  };
  if (img.complete && img.naturalWidth) sizeFromThumb();
  else img.onload = sizeFromThumb;

  const full = new Image();
  full.onload = () => { if (lbOpen && token === lbToken) { img.onload = null; img.src = full.src; } };
  full.src = fullSrc(photo.file);

  cap.textContent = photo.caption || '';
  lb.classList.remove('hidden');
  lbOpen = true;
  lbReturnFocus = focusOrigin || null;
  document.getElementById('lb-close').focus({ preventScroll: true });
}

function closeLightbox() {
  document.getElementById('lightbox').classList.add('hidden');
  lbOpen = false;
  lbToken++;
  if (lbReturnFocus && document.contains(lbReturnFocus)) {
    lbReturnFocus.focus({ preventScroll: true });
  }
  lbReturnFocus = null;
}

// ── Card-to-card repulsion (O(n²/2), run every 3rd frame) ─
function applyCardRepulsions(dt) {
  for (let i = 0; i < cards.length; i++) {
    const a = cards[i];
    if (grabbed === a) continue;
    const ax = a.x + CARD_W / 2;
    const ay = a.y + CARD_H / 2;
    for (let j = i + 1; j < cards.length; j++) {
      const b = cards[j];
      if (grabbed === b) continue;
      const dx = ax - (b.x + CARD_W / 2);
      const dy = ay - (b.y + CARD_H / 2);
      const d2 = dx * dx + dy * dy;
      if (d2 < CARD_REP_R * CARD_REP_R && d2 > 0.01) {
        const d  = Math.sqrt(d2);
        const f  = ((CARD_REP_R - d) / CARD_REP_R) * CARD_REP_F * dt;
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      }
    }
  }
}

// ── RAF loop (dt-scaled: identical feel at 60Hz and 120Hz) ─
let cards = [];
let lastNow = 0;
let simT = 0;
let tick_n = 0;
let repAccum = 0;

function loop(now) {
  const dtMs = lastNow ? Math.min(Math.max(now - lastNow, 2), 50) : 16.7;
  lastNow = now;
  const dt = dtMs / 16.667;   // 1.0 at 60fps
  simT += dtMs / 1000;
  tick_n++;

  // Card-to-card repulsion is O(n²) — run every 3rd frame, scaled by the
  // accumulated dt so lower/higher frame rates get the same total impulse
  repAccum += dt;
  if (!REDUCED && tick_n % 3 === 0) {
    applyCardRepulsions(repAccum);
    repAccum = 0;
  }

  cards.forEach(c => c.step(simT, dt));
  requestAnimationFrame(loop);
}

// ── Init ─────────────────────────────────────────────────
// Scripts are at bottom of <body>, DOM is already ready.
(function init() {
  stageEl = document.getElementById('life-stage');
  // Fixed elements may not report clientWidth immediately — fall back to window
  stageW  = stageEl.clientWidth  || window.innerWidth;
  stageH  = stageEl.clientHeight || (window.innerHeight - NAV_H);

  // Scale cards (and interaction radii) to the stage so phones aren't a
  // solid pile of overlapping polaroids
  const scale = stageW < 600
    ? Math.max(0.62, Math.min(1, (stageW * 0.30) / BASE_CARD_W))
    : 1;
  CARD_W     = Math.round(BASE_CARD_W * scale);
  CARD_H     = Math.round(CARD_W * 1.29);
  REPEL_R    = Math.round(190 * scale);
  CARD_REP_R = Math.round(175 * scale);

  const photos = PHOTOS;

  // Touch-appropriate copy
  if (COARSE) {
    const hint = document.getElementById('life-hint');
    if (hint) hint.textContent = 'drag to fling · tap to open';
    const lbNav = document.getElementById('lb-nav');
    if (lbNav) lbNav.textContent = 'tap outside to close';
  }

  // Build all cards
  photos.forEach((p, i) => cards.push(new Card(p, i, photos.length)));

  // ── Pointer tracking (mouse + touch) ────────────────────
  stageEl.addEventListener('pointermove', e => {
    if (grabbed && e.pointerId !== grabPointerId) return;
    mx = e.clientX;
    my = e.clientY - NAV_H;

    if (grabbed) {
      const nx = e.clientX - grabOffX;
      const ny = (e.clientY - NAV_H) - grabOffY;
      grabbed.x = nx;
      grabbed.y = ny;
      grabbed._applyTransform();
      pointerHist.push([e.clientX, e.clientY - NAV_H, performance.now()]);
      if (pointerHist.length > 6) pointerHist.shift();
    }
  });

  // ── Pointer release ─────────────────────────────────────
  function release(e) {
    // Touch leaves no hover point — clear the repulsor so cards don't
    // flee an invisible spot forever
    if (e.pointerType !== 'mouse') { mx = -9999; my = -9999; }

    if (!grabbed || e.pointerId !== grabPointerId) return;
    const card = grabbed;
    grabbed = null;
    grabPointerId = null;
    card.el.classList.remove('grabbed');

    // Compute fling velocity from recent pointer positions — but only if
    // the pointer was actually still moving at release
    const now = performance.now();
    const last = pointerHist[pointerHist.length - 1];
    if (pointerHist.length >= 2 && last && now - last[2] < 120) {
      const first = pointerHist[0];
      const dt    = Math.max(last[2] - first[2], 8);
      card.vx    = ((last[0] - first[0]) / dt) * 15;
      card.vy    = ((last[1] - first[1]) / dt) * 15;
      card.omega = card.vx * 0.07;
    }

    // Tap detection: net displacement, with a looser threshold for fingers
    const net = Math.hypot(card.x - grabStartX, card.y - grabStartY);
    const tapMax = e.pointerType === 'mouse' ? 4 : 12;
    if (net < tapMax) {
      card.x = grabStartX;
      card.y = grabStartY;
      card.vx = 0; card.vy = 0; card.omega = 0;
      card._applyTransform();
      openLightbox(card.photo, card.el);
    }
  }
  document.addEventListener('pointerup', release);
  document.addEventListener('pointercancel', release);

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
  }, 5000);

  // ── Resize ──────────────────────────────────────────────
  window.addEventListener('resize', () => {
    stageW = stageEl.clientWidth;
    stageH = stageEl.clientHeight;
  });

  // ── Start RAF ───────────────────────────────────────────
  requestAnimationFrame(loop);
}());
