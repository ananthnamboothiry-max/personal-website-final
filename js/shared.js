/* ─────────────────────────────────────────────────────────
   shared.js — runs on every page
   ───────────────────────────────────────────────────────── */
'use strict';

/* ── Custom cursor ───────────────────────────────────────── */
const dot = document.getElementById('cursor-dot');
if (dot) {
  document.addEventListener('mousemove', e => {
    dot.style.left = e.clientX + 'px';
    dot.style.top  = e.clientY + 'px';
  });
}

/* ── Card-suit cursor trail ──────────────────────────────── */
const SUITS = ['♠', '♥', '♦', '♣'];
let lastTrail = 0;
document.addEventListener('mousemove', e => {
  const now = Date.now();
  if (now - lastTrail < 130) return;
  lastTrail = now;

  const el = document.createElement('span');
  el.className = 'suit-trail';
  el.textContent = SUITS[Math.floor(Math.random() * 4)];
  el.style.left = e.clientX + 'px';
  el.style.top  = e.clientY + 'px';
  if (el.textContent === '♥' || el.textContent === '♦') el.style.color = '#DC2626';
  document.body.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
});

/* ── Scroll fade-in ──────────────────────────────────────── */
const io = new IntersectionObserver(
  entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
  }),
  { threshold: 0.1 }
);
document.querySelectorAll('.fade-in').forEach(el => io.observe(el));

/* ── 3D tilt on project items ────────────────────────────── */
document.querySelectorAll('[data-tilt]').forEach(el => {
  el.addEventListener('mousemove', e => {
    const r = el.getBoundingClientRect();
    const dx = (e.clientX - r.left - r.width  / 2) / (r.width  / 2);
    const dy = (e.clientY - r.top  - r.height / 2) / (r.height / 2);
    el.style.transform = `perspective(800px) rotateY(${dx * 4}deg) rotateX(${-dy * 4}deg)`;
  });
  el.addEventListener('mouseleave', () => { el.style.transform = ''; });
});

/* ── Draggable elements ──────────────────────────────────── */
function makeDraggable(el, key) {
  const saved = localStorage.getItem(key);
  if (saved) {
    try {
      const { x, y } = JSON.parse(saved);
      el.style.position = 'absolute';
      el.style.left = x + 'px';
      el.style.top  = y + 'px';
    } catch (_) {}
  }

  let active = false, ox = 0, oy = 0;

  el.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    active = true;
    el.classList.add('dragging');
    const r  = el.getBoundingClientRect();
    const pr = (el.offsetParent || el.parentElement).getBoundingClientRect();
    el.style.position = 'absolute';
    el.style.left = (r.left - pr.left) + 'px';
    el.style.top  = (r.top  - pr.top)  + 'px';
    ox = e.clientX - r.left;
    oy = e.clientY - r.top;
    e.preventDefault();
  });

  document.addEventListener('mousemove', e => {
    if (!active) return;
    const pr = (el.offsetParent || el.parentElement).getBoundingClientRect();
    el.style.left = (e.clientX - pr.left - ox) + 'px';
    el.style.top  = (e.clientY - pr.top  - oy) + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!active) return;
    active = false;
    el.classList.remove('dragging');
    localStorage.setItem(key, JSON.stringify({
      x: parseInt(el.style.left),
      y: parseInt(el.style.top),
    }));
  });
}

document.querySelectorAll('.sticky-note').forEach(n =>
  makeDraggable(n, `note-${n.dataset.noteId}`)
);
document.querySelectorAll('.draggable-polaroid').forEach(p =>
  makeDraggable(p, `polaroid-${p.dataset.polaroidId}`)
);

/* ── Konami code easter egg ──────────────────────────────── */
const SEQ = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown',
             'ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
let ki = 0;
document.addEventListener('keydown', e => {
  ki = (e.key === SEQ[ki]) ? ki + 1 : (e.key === SEQ[0] ? 1 : 0);
  if (ki === SEQ.length) { ki = 0; showKonami(); }
});

const overlay = document.getElementById('konami-overlay');
const closeBtn = document.getElementById('konami-close');
if (closeBtn) closeBtn.addEventListener('click', () => overlay.classList.add('hidden'));
if (overlay)  overlay.addEventListener('click', e => {
  if (e.target === overlay) overlay.classList.add('hidden');
});

function showKonami() {
  const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  const SUITS_FULL = [
    {s:'♠',red:false},{s:'♥',red:true},{s:'♦',red:true},{s:'♣',red:false}
  ];
  const deck = RANKS.flatMap(r => SUITS_FULL.map(s => ({r, ...s})));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const hand = document.getElementById('konami-hand');
  if (!hand) return;
  hand.innerHTML = '';
  deck.slice(0, 5).forEach(c => {
    const div = document.createElement('div');
    div.className = 'playing-card ' + (c.red ? 'card-red' : 'card-black');
    div.innerHTML = `<div>${c.r}</div><div>${c.s}</div>`;
    hand.appendChild(div);
  });
  overlay.classList.remove('hidden');
}
