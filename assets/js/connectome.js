// Hero background: a small "connectome". Nodes are wired to their nearest neighbours and spikes
// cascade along the edges, a nod to the 302-neuron C. elegans models behind the research work.
// Drawn once, statically, when the visitor prefers reduced motion.

const canvas = document.querySelector("[data-connectome]");
if (canvas) start(canvas);

function start(canvas) {
  const ctx = canvas.getContext("2d");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pointer = { x: -1e4, y: -1e4 };
  let w = 0, h = 0, nodes = [], edges = [], spikes = [], colors = {};
  let running = false, visible = true, lastFire = 0, lastPointerFire = 0;

  // Custom properties hold unresolved light-dark() pairs, so resolve them through a probe element.
  function readColors() {
    const probe = document.createElement("i");
    probe.style.display = "none";
    canvas.parentElement.append(probe);
    const resolve = (v) => { probe.style.color = `var(${v})`; return getComputedStyle(probe).color.match(/[\d.]+/g).slice(0, 3).join(","); };
    colors = { node: resolve("--fg-3"), accent: resolve("--accent"), signal: resolve("--signal") };
    probe.remove();
  }
  const rgba = (c, a) => `rgba(${c},${a})`;

  function build() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // jittered grid keeps the graph evenly spread without clumps
    const cell = w < 700 ? 74 : 92;
    nodes = [];
    for (let y = cell / 2; y < h; y += cell) {
      for (let x = cell / 2; x < w; x += cell) {
        if (Math.random() < 0.18) continue;
        nodes.push({
          bx: x + (Math.random() - 0.5) * cell * 0.8, by: y + (Math.random() - 0.5) * cell * 0.8,
          x: 0, y: 0, phase: Math.random() * Math.PI * 2, amp: 3 + Math.random() * 5,
          glow: 0, refractory: 0, links: [],
        });
      }
    }
    const seen = new Set();
    edges = [];
    nodes.forEach((a, i) => {
      nodes.map((b, j) => ({ j, d: Math.hypot(a.bx - b.bx, a.by - b.by) }))
        .filter((n) => n.j !== i && n.d < cell * 1.9)
        .sort((p, q) => p.d - q.d)
        .slice(0, 3)
        .forEach(({ j }) => {
          const key = i < j ? `${i}-${j}` : `${j}-${i}`;
          if (seen.has(key)) return;
          seen.add(key);
          edges.push([i, j]);
          a.links.push(j); nodes[j].links.push(i);
        });
    });
    spikes = [];
    step(0);
  }

  function fire(i, now) {
    const n = nodes[i];
    if (!n || now < n.refractory) return;
    n.glow = 1;
    n.refractory = now + 900;
    n.links.forEach((j) => spikes.length < 90 && spikes.push({ from: i, to: j, t: 0, v: 0.0012 + Math.random() * 0.0012 }));
  }

  function step(now, dt = 16) {
    const t = now * 0.0004;
    nodes.forEach((n) => {
      n.x = n.bx + Math.sin(t + n.phase) * n.amp;
      n.y = n.by + Math.cos(t * 0.8 + n.phase) * n.amp;
      n.glow = Math.max(0, n.glow - dt * 0.0016);
    });
    spikes = spikes.filter((s) => {
      s.t += s.v * dt;
      if (s.t < 1) return true;
      if (Math.random() < 0.5) fire(s.to, now);
      return false;
    });
    if (!reduced && now - lastFire > 380) {
      lastFire = now;
      fire(Math.floor(Math.random() * nodes.length), now);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 1;
    for (const [i, j] of edges) {
      const a = nodes[i], b = nodes[j];
      const near = Math.max(0, 1 - Math.hypot((a.x + b.x) / 2 - pointer.x, (a.y + b.y) / 2 - pointer.y) / 220);
      ctx.strokeStyle = rgba(colors.node, 0.13 + near * 0.25 + Math.max(a.glow, b.glow) * 0.25);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    for (const s of spikes) {
      const a = nodes[s.from], b = nodes[s.to];
      const x = a.x + (b.x - a.x) * s.t, y = a.y + (b.y - a.y) * s.t;
      const tail = Math.max(0, s.t - 0.22);
      const tx = a.x + (b.x - a.x) * tail, ty = a.y + (b.y - a.y) * tail;
      const grad = ctx.createLinearGradient(tx, ty, x, y);
      grad.addColorStop(0, rgba(colors.accent, 0));
      grad.addColorStop(1, rgba(colors.accent, 0.85));
      ctx.strokeStyle = grad; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = rgba(colors.accent, 0.95);
      ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.lineWidth = 1;
    for (const n of nodes) {
      const near = Math.max(0, 1 - Math.hypot(n.x - pointer.x, n.y - pointer.y) / 160);
      if (n.glow > 0.02) {
        ctx.fillStyle = rgba(colors.accent, n.glow * 0.18);
        ctx.beginPath(); ctx.arc(n.x, n.y, 4 + n.glow * 10, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = n.glow > 0.02 ? rgba(colors.accent, 0.5 + n.glow * 0.5) : rgba(near > 0 ? colors.signal : colors.node, 0.4 + near * 0.6);
      ctx.beginPath(); ctx.arc(n.x, n.y, 1.7 + n.glow * 1.6 + near * 1.2, 0, Math.PI * 2); ctx.fill();
    }
  }

  let prev = 0;
  function loop(now) {
    if (!running) return;
    step(now, Math.min(now - prev || 16, 48));
    prev = now;
    draw();
    requestAnimationFrame(loop);
  }
  function play() {
    if (reduced || running || !visible || document.hidden) return;
    running = true; prev = performance.now();
    requestAnimationFrame(loop);
  }
  const pause = () => { running = false; };

  readColors();
  build();
  if (reduced) {
    for (let k = 0; k < 6; k++) nodes[Math.floor(Math.random() * nodes.length)].glow = 0.8;
    draw();
  } else {
    play();
  }

  new ResizeObserver(() => { build(); if (reduced) draw(); }).observe(canvas);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? play() : pause(); }).observe(canvas);
  document.addEventListener("visibilitychange", () => (document.hidden ? pause() : play()));
  new MutationObserver(() => { readColors(); draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  const hero = canvas.parentElement;
  hero.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top;
    const now = performance.now();
    if (reduced || now - lastPointerFire < 220) return;
    lastPointerFire = now;
    let best = -1, bestD = 70;
    nodes.forEach((n, i) => { const d = Math.hypot(n.x - pointer.x, n.y - pointer.y); if (d < bestD) { bestD = d; best = i; } });
    if (best >= 0) fire(best, now);
  });
  hero.addEventListener("pointerleave", () => { pointer.x = pointer.y = -1e4; });
}
