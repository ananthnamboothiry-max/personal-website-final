/* ─────────────────────────────────────────────────────────
   poker.js — poker.html only
   ───────────────────────────────────────────────────────── */
'use strict';

(async () => {
  let sessions = [];
  try {
    const res = await fetch('data/poker-log.json');
    const data = await res.json();
    sessions = data.sessions || [];
  } catch (e) {
    console.warn('Could not load poker-log.json', e);
    return;
  }
  if (!sessions.length) return;

  // Chart palette (matches css custom properties)
  const C = {
    grid:    'rgba(26, 25, 21, 0.07)',
    zero:    'rgba(26, 25, 21, 0.22)',
    tick:    '#6E6B5C',
    pos:     '#3D7A50',
    posFill: 'rgba(61, 122, 80, 0.08)',
    neg:     '#B04A38',
    negFill: 'rgba(176, 74, 56, 0.08)',
  };
  const MONO = `10px 'IBM Plex Mono', monospace`;

  const esc = s => String(s).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ── Stats ─────────────────────────────────────────────── */
  let totalIn = 0, totalOut = 0;
  sessions.forEach(s => {
    totalIn  += s.buy_in;
    totalOut += s.cash_out;
  });
  const netPL = Math.round((totalOut - totalIn) * 100) / 100;
  const roi   = totalIn > 0 ? Math.round((netPL / totalIn) * 1000) / 10 : 0;

  const dollars = n => '$' + n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  // Round to cents BEFORE choosing the sign so -0.004 doesn't show as -$0.00
  const money = n => {
    const r = Math.round(n * 100) / 100;
    return (r >= 0 ? '+' : '-') + dollars(Math.abs(r));
  };

  const set = (id, text, pos) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.classList.add(pos ? 'stat-pos' : 'stat-neg');
  };

  document.getElementById('stat-sessions').textContent = sessions.length;
  set('stat-pnl', money(netPL), netPL >= 0);
  set('stat-roi', (roi > 0 ? '+' : '') + roi.toFixed(1) + '%', roi >= 0);

  /* ── Cumulative P&L (sessions in log order, evenly spaced) ─ */
  let running = 0;
  const cumPL = sessions.map(s => (running += s.cash_out - s.buy_in));

  /* ── Canvas chart ──────────────────────────────────────── */
  const canvas  = document.getElementById('poker-chart');
  const tooltip = document.getElementById('chart-tooltip');
  if (!canvas || !canvas.getContext) return;

  // Round the axis to human steps (1/2/2.5/5 × 10^n)
  function niceStep(range) {
    const target = range / 4.5;
    const p = Math.pow(10, Math.floor(Math.log10(target)));
    for (const m of [1, 2, 2.5, 5, 10]) if (target <= m * p) return m * p;
    return 10 * p;
  }

  let toX, toY, chartW;

  function draw() {
    tooltip.style.display = 'none';   // stale coordinates after a redraw

    const dpr = window.devicePixelRatio || 1;
    const W   = canvas.parentElement.clientWidth;
    const H   = 190;
    chartW = W;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const dataMin = Math.min(0, ...cumPL);
    const dataMax = Math.max(0, ...cumPL);
    const step    = niceStep((dataMax - dataMin) || 100);
    let axisMin   = Math.floor(dataMin / step) * step;
    let axisMax   = Math.ceil(dataMax / step) * step;
    if (axisMax === dataMax) axisMax += step;             // headroom
    if (axisMin === dataMin && dataMin < 0) axisMin -= step;

    const ticks = [];
    for (let v = axisMin; v <= axisMax + 1e-9; v += step) ticks.push(v);

    // Gutter sized from the widest tick label so the chart block starts at
    // the page's left column edge
    ctx.font = MONO;
    const labelFor = v => v === 0 ? '$0'
      : (v > 0 ? '+$' : '-$') + Math.abs(Math.round(v)).toLocaleString();
    const gutter = Math.ceil(Math.max(...ticks.map(v => ctx.measureText(labelFor(v)).width)));
    const PAD = { top: 14, right: 8, bottom: 30, left: gutter + 12 };

    const cW = W - PAD.left - PAD.right;
    const cH = H - PAD.top  - PAD.bottom;

    toX = i => PAD.left + (i / Math.max(cumPL.length - 1, 1)) * cW;
    toY = v => PAD.top  + (1 - (v - axisMin) / (axisMax - axisMin)) * cH;
    const zeroY = toY(0);

    /* Grid + y labels (right-aligned against each other, flush left edge) */
    ctx.lineWidth = 1;
    ticks.forEach(v => {
      const y = toY(v);
      ctx.strokeStyle = C.grid;
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(PAD.left + cW, y);
      ctx.stroke();
      ctx.fillStyle = C.tick;
      ctx.textAlign = 'right';
      ctx.fillText(labelFor(v), gutter, y + 3);
    });

    /* Zero line */
    ctx.strokeStyle = C.zero;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(PAD.left, zeroY);
    ctx.lineTo(PAD.left + cW, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    const lastVal = cumPL[cumPL.length - 1];
    const up = lastVal >= 0;

    /* Area fill */
    if (cumPL.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(toX(0), zeroY);
      cumPL.forEach((v, i) => ctx.lineTo(toX(i), toY(v)));
      ctx.lineTo(toX(cumPL.length - 1), zeroY);
      ctx.closePath();
      ctx.fillStyle = up ? C.posFill : C.negFill;
      ctx.fill();
    }

    /* Line */
    if (cumPL.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(cumPL[0]));
      cumPL.forEach((v, i) => { if (i > 0) ctx.lineTo(toX(i), toY(v)); });
      ctx.strokeStyle = up ? C.pos : C.neg;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    /* Dots (shrink once the log gets long) */
    const dotR = cumPL.length > 30 ? 1.5 : 2.5;
    cumPL.forEach((v, i) => {
      ctx.beginPath();
      ctx.arc(toX(i), toY(v), dotR, 0, Math.PI * 2);
      ctx.fillStyle = v >= 0 ? C.pos : C.neg;
      ctx.fill();
    });

    /* X labels — thin them out so they never collide */
    ctx.fillStyle = C.tick;
    ctx.textAlign = 'center';
    const slots  = Math.max(1, Math.floor(cW / 34));
    const stride = Math.max(1, Math.ceil(cumPL.length / slots));
    cumPL.forEach((_, i) => {
      const isLast = i === cumPL.length - 1;
      if (i % stride !== 0 && !isLast) return;
      if (!isLast && cumPL.length - 1 - i < stride * 0.6) return; // don't crowd the last label
      ctx.fillText('S' + (i + 1), toX(i), H - PAD.bottom + 16);
    });
  }

  draw();
  window.addEventListener('resize', draw);

  /* Tooltip (pointer events so touch taps work too) */
  function showTooltip(e) {
    const rect = canvas.getBoundingClientRect();
    const px   = e.clientX - rect.left;
    let nearest = 0, minDist = Infinity;
    cumPL.forEach((_, i) => {
      const d = Math.abs(px - toX(i));
      if (d < minDist) { minDist = d; nearest = i; }
    });
    if (minDist < 40) {
      const s   = sessions[nearest];
      const pnl = s.cash_out - s.buy_in;
      tooltip.textContent =
        `${s.game} · ${money(pnl)} · total ${money(cumPL[nearest])}`;
      tooltip.style.display = 'block';
      // Clamp inside the chart so the rightmost points don't overflow
      const tw = tooltip.offsetWidth;
      tooltip.style.left = Math.max(0, Math.min(toX(nearest) + 8, chartW - tw - 2)) + 'px';
      tooltip.style.top  = Math.max(0, toY(cumPL[nearest]) - 34) + 'px';
    } else {
      tooltip.style.display = 'none';
    }
  }
  canvas.addEventListener('pointermove', showTooltip);
  canvas.addEventListener('pointerdown', showTooltip);
  canvas.addEventListener('pointerleave', () => { tooltip.style.display = 'none'; });
  canvas.addEventListener('pointerup', e => {
    if (e.pointerType !== 'mouse') setTimeout(() => { tooltip.style.display = 'none'; }, 1600);
  });

  /* ── Table ─────────────────────────────────────────────── */
  let sortCol = null, sortAsc = false;   // default: latest session first
  const tbody = document.getElementById('poker-tbody');

  function render(data) {
    if (!tbody) return;
    tbody.innerHTML = '';
    data.forEach(s => {
      const p  = s.cash_out - s.buy_in;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${esc(s.game)}</td>
        <td>${esc(s.venue)}</td>
        <td class="td-num">${dollars(s.buy_in)}</td>
        <td class="td-num">${dollars(s.cash_out)}</td>
        <td class="td-num ${p >= 0 ? 'td-pos' : 'td-neg'}">${money(p)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function sorted() {
    if (!sortCol) return [...sessions].reverse();
    return [...sessions].sort((a, b) => {
      const va = sortCol === 'profit' ? a.cash_out - a.buy_in : a[sortCol];
      const vb = sortCol === 'profit' ? b.cash_out - b.buy_in : b[sortCol];
      if (typeof va === 'string') return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortAsc ? va - vb : vb - va;
    });
  }

  // Show the active sort column: ↑/↓ on it, quiet ↕ on the rest
  function markSort() {
    document.querySelectorAll('#poker-table th.sortable').forEach(h => {
      const active = h.dataset.col === sortCol;
      h.classList.toggle('sort-asc',  active && sortAsc);
      h.classList.toggle('sort-desc', active && !sortAsc);
      const si = h.querySelector('.si');
      if (si) si.textContent = active ? (sortAsc ? '↑' : '↓') : '↕';
    });
  }

  render(sorted());
  markSort();

  document.querySelectorAll('#poker-table th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      sortAsc = sortCol === th.dataset.col ? !sortAsc : true;
      sortCol = th.dataset.col;
      markSort();
      render(sorted());
    });
  });
})();
