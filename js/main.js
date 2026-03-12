/* ─────────────────────────────────────────────────────────
   main.js — index.html only (typewriter + hero easter egg)
   ───────────────────────────────────────────────────────── */
'use strict';

/* ── Typewriter ──────────────────────────────────────────── */
const phrases = [
  'Math + CS @ Stanford',
  'hardware & embedded systems',
  'network optimizations',
  'NLP research @ GSB',
  'poker player',
];
let pi = 0, ci = 0, deleting = false;
const twEl = document.getElementById('tw-text');

function tick() {
  const phrase = phrases[pi];
  if (deleting) {
    twEl.textContent = phrase.slice(0, ci--);
    if (ci < 0) {
      deleting = false;
      pi = (pi + 1) % phrases.length;
      ci = 0;
      setTimeout(tick, 380);
      return;
    }
    setTimeout(tick, 42);
  } else {
    twEl.textContent = phrase.slice(0, ++ci);
    if (ci === phrase.length) {
      deleting = true;
      setTimeout(tick, 1800);
      return;
    }
    setTimeout(tick, 72);
  }
}
if (twEl) setTimeout(tick, 600);

/* ── Hero name easter egg — 5 clicks → chip rain ────────── */
const heroName = document.getElementById('hero-name');
const chipRain = document.getElementById('chip-rain');
let clicks = 0;
const CHIPS = ['🟡', '🔴', '🔵', '⚫', '🟢'];

if (heroName && chipRain) {
  heroName.addEventListener('click', () => {
    clicks++;
    if (clicks >= 5) {
      clicks = 0;
      for (let i = 0; i < 30; i++) {
        setTimeout(() => {
          const chip = document.createElement('span');
          chip.className = 'chip';
          chip.textContent = CHIPS[Math.floor(Math.random() * CHIPS.length)];
          chip.style.left = Math.random() * 100 + 'vw';
          chip.style.animationDuration = (1.1 + Math.random() * 0.7) + 's';
          chip.style.fontSize = (1.5 + Math.random() * 0.8) + 'rem';
          chipRain.appendChild(chip);
          chip.addEventListener('animationend', () => chip.remove());
        }, i * 50);
      }
    }
  });
}
