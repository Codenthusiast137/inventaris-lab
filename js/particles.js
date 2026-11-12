// Latar partikel: partikel melayang pelan dan menyingkir saat kursor (atau jari) mendekat
(function () {
  const canvas = document.getElementById("bg");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SOFT = canvas.hasAttribute("data-soft") ? 0.55 : 1; // halaman kerja: partikel lebih pudar agar teks tetap jelas

  // Atur sesuka hati
  const COLORS = ["239,65,54", "244,98,58", "245,166,35", "238,61,79"]; // warna partikel (RGB)
  const RADIUS = 130;   // jarak pengaruh kursor (px)
  const PUSH = 3.2;     // kekuatan dorongan
  const SPEED = 0.35;   // kecepatan melayang
  const DENSITY = 14000; // makin kecil = makin banyak partikel

  const mouse = { x: -9999, y: -9999 };
  let w, h, parts = [], timer;

  function build() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = innerWidth; h = innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.max(40, Math.min(110, Math.round((w * h) / DENSITY)));
    parts = Array.from({ length: n }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * SPEED, vy: (Math.random() - 0.5) * SPEED,
      r: 1.5 + Math.random() * 3.5,
      c: COLORS[(Math.random() * COLORS.length) | 0],
      a: 0.3 + Math.random() * 0.4,
      ox: 0, oy: 0 // geseran akibat dorongan kursor
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    for (const p of parts) {
      ctx.beginPath();
      ctx.arc(p.x + p.ox, p.y + p.oy, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.c},${(p.a * SOFT).toFixed(3)})`;
      ctx.fill();
    }
  }

  function step() {
    for (const p of parts) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < -10) p.x = w + 10; else if (p.x > w + 10) p.x = -10;
      if (p.y < -10) p.y = h + 10; else if (p.y > h + 10) p.y = -10;

      const dx = p.x + p.ox - mouse.x, dy = p.y + p.oy - mouse.y;
      const d = Math.hypot(dx, dy);
      if (d < RADIUS && d > 0.01) {
        const f = 1 - d / RADIUS;
        p.ox += (dx / d) * f * PUSH;
        p.oy += (dy / d) * f * PUSH;
      }
      p.ox *= 0.94; p.oy *= 0.94; // perlahan kembali ke jalurnya
    }
    draw();
    requestAnimationFrame(step);
  }

  addEventListener("pointermove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
  addEventListener("pointerout", (e) => { if (!e.relatedTarget) mouse.x = mouse.y = -9999; });
  addEventListener("pointerup", (e) => { if (e.pointerType === "touch") mouse.x = mouse.y = -9999; });
  addEventListener("resize", () => {
    clearTimeout(timer);
    timer = setTimeout(() => { build(); if (reduce) draw(); }, 150);
  });

  build();
  if (reduce) draw(); // pengguna "kurangi animasi": partikel diam
  else requestAnimationFrame(step);
})();