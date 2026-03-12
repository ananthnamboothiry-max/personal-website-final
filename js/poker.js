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

  /* ── Stats ─────────────────────────────────────────────── */
  let totalIn = 0, totalOut = 0, totalHours = 0;
  sessions.forEach(s => {
    totalIn    += s.buy_in;
    totalOut   += s.cash_out;
    totalHours += s.duration_hours;
  });
  const netPL = totalOut - totalIn;
  const roi   = totalIn > 0 ? ((netPL / totalIn) * 100).toFixed(1) : 0;

  const fmt = n => (n >= 0 ? '+$' : '-$') + Math.abs(n).toLocaleString();

  const set = (id, text, pos) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.classList.add(pos ? 'stat-pos' : 'stat-neg');
  };

  document.getElementById('stat-sessions').textContent = sessions.length;
  document.getElementById('stat-hours').textContent    = totalHours.toFixed(1) + 'h';
  set('stat-pnl', fmt(netPL), netPL >= 0);
  set('stat-roi', (roi >= 0 ? '+' : '') + roi + '%', roi >= 0);

  /* ── Cumulative P&L ────────────────────────────────────── */
  let running = 0;
  const cumPL = sessions.map(s => (running += s.cash_out - s.buy_in));

  /* ── Canvas chart ──────────────────────────────────────── */
  const canvas  = document.getElementById('poker-chart');
  const tooltip = document.getElementById('chart-tooltip');
  if (!canvas || !canvas.getContext) return;

  const dpr = window.devicePixelRatio || 1;
  const W   = canvas.parentElement.clientWidth - 32;
  const H   = 200;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const PAD = { top: 16, right: 16, bottom: 32, left: 52 };
  const cW  = W - PAD.left - PAD.right;
  const cH  = H - PAD.top  - PAD.bottom;

  const minV  = Math.min(0, ...cumPL);
  const maxV  = Math.max(0, ...cumPL);
  const range = maxV - minV || 100;

  const toX = i => PAD.left + (i / Math.max(cumPL.length - 1, 1)) * cW;
  const toY = v => PAD.top  + (1 - (v - minV) / range) * cH;
  const zeroY = toY(0);

  /* Grid */
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  [0, 1, 2, 3, 4].forEach(t => {
    const v = minV + (range / 4) * t;
    const y = toY(v);
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(PAD.left + cW, y);
    ctx.stroke();
    ctx.fillStyle = '#555';
    ctx.font = `10px 'JetBrains Mono', monospace`;
    ctx.textAlign = 'right';
    ctx.fillText((v >= 0 ? '+$' : '-$') + Math.abs(Math.round(v)), PAD.left - 6, y + 4);
  });

  /* Zero line */
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(PAD.left, zeroY);
  ctx.lineTo(PAD.left + cW, zeroY);
  ctx.stroke();
  ctx.setLineDash([]);

  /* Area fill */
  if (cumPL.length >= 2) {
    ctx.beginPath();
    ctx.moveTo(toX(0), zeroY);
    cumPL.forEach((v, i) => ctx.lineTo(toX(i), toY(v)));
    ctx.lineTo(toX(cumPL.length - 1), zeroY);
    ctx.closePath();
    const lastVal = cumPL[cumPL.length - 1];
    ctx.fillStyle = lastVal >= 0 ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)';
    ctx.fill();
  }

  /* Line */
  if (cumPL.length >= 2) {
    const lastVal = cumPL[cumPL.length - 1];
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(cumPL[0]));
    cumPL.forEach((v, i) => { if (i > 0) ctx.lineTo(toX(i), toY(v)); });
    ctx.strokeStyle = lastVal >= 0 ? '#16A34A' : '#DC2626';
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  /* Dots */
  cumPL.forEach((v, i) => {
    ctx.beginPath();
    ctx.arc(toX(i), toY(v), 3, 0, Math.PI * 2);
    ctx.fillStyle = v >= 0 ? '#16A34A' : '#DC2626';
    ctx.fill();
  });

  /* X labels */
  ctx.fillStyle = '#888';
  ctx.font = `10px 'JetBrains Mono', monospace`;
  ctx.textAlign = 'center';
  cumPL.forEach((_, i) => {
    ctx.fillText('S' + (i + 1), toX(i), H - PAD.bottom + 16);
  });

  /* Tooltip */
  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    const mx   = e.clientX - rect.left;
    let nearest = 0, minDist = Infinity;
    cumPL.forEach((_, i) => {
      const d = Math.abs(mx - toX(i));
      if (d < minDist) { minDist = d; nearest = i; }
    });
    if (minDist < 40) {
      const s   = sessions[nearest];
      const pnl = s.cash_out - s.buy_in;
      tooltip.style.display = 'block';
      tooltip.style.left = (toX(nearest) + 8) + 'px';
      tooltip.style.top  = (toY(cumPL[nearest]) - 32) + 'px';
      tooltip.textContent =
        `S${nearest + 1} · ${s.date} · ${pnl >= 0 ? '+$' : '-$'}${Math.abs(pnl)} · cumulative ${cumPL[nearest] >= 0 ? '+$' : '-$'}${Math.abs(cumPL[nearest])}`;
    } else {
      tooltip.style.display = 'none';
    }
  });
  canvas.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });

  /* ── Table ─────────────────────────────────────────────── */
  let sortCol = 'date', sortAsc = true;
  const tbody = document.getElementById('poker-tbody');

  function render(data) {
    if (!tbody) return;
    tbody.innerHTML = '';
    data.forEach(s => {
      const p  = s.cash_out - s.buy_in;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${s.date}</td>
        <td>${s.game}</td>
        <td>${s.venue}</td>
        <td>$${s.buy_in.toLocaleString()}</td>
        <td>$${s.cash_out.toLocaleString()}</td>
        <td class="${p >= 0 ? 'td-pos' : 'td-neg'}">${p >= 0 ? '+$' : '-$'}${Math.abs(p).toLocaleString()}</td>
        <td>${s.duration_hours}h</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function sorted() {
    return [...sessions].sort((a, b) => {
      const va = sortCol === 'profit' ? a.cash_out - a.buy_in : a[sortCol];
      const vb = sortCol === 'profit' ? b.cash_out - b.buy_in : b[sortCol];
      if (typeof va === 'string') return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortAsc ? va - vb : vb - va;
    });
  }

  render(sorted());

  document.querySelectorAll('#poker-table th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      sortAsc = sortCol === th.dataset.col ? !sortAsc : true;
      sortCol = th.dataset.col;
      document.querySelectorAll('#poker-table th').forEach(h => h.classList.remove('sort-asc','sort-desc'));
      th.classList.add(sortAsc ? 'sort-asc' : 'sort-desc');
      render(sorted());
    });
  });
})();
