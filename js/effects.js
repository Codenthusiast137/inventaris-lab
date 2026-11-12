// Efek interaktif halaman login: kartu miring 3D, maskot, dan reaksi saat login
(function () {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;

  const stage = document.querySelector(".stage");
  const card = document.querySelector(".card");
  const mascot = document.getElementById("mascot");
  const mouth = document.getElementById("mouth");
  const pupils = [...mascot.querySelectorAll(".pup")];
  const pw = document.getElementById("password");
  const toggle = document.getElementById("toggle-pw");
  const MOUTH = { smile: "M28 39 Q35 44 42 39", frown: "M28 43 Q35 37 42 43", big: "M25 38 Q35 48 45 38" };
  let resetTimer;

  // Kartu miring mengikuti kursor (hanya perangkat dengan mouse)
  if (fine && !reduce) {
    stage.addEventListener("mousemove", (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `rotateX(${(-y * 6).toFixed(2)}deg) rotateY(${(x * 8).toFixed(2)}deg)`;
    });
    stage.addEventListener("mouseleave", () => { card.style.transform = ""; });

    // Mata maskot mengikuti kursor di seluruh halaman
    document.addEventListener("mousemove", (e) => {
      pupils.forEach((p) => {
        const b = p.getBoundingClientRect();
        const dx = e.clientX - (b.left + b.width / 2);
        const dy = e.clientY - (b.top + b.height / 2);
        const d = Math.hypot(dx, dy) || 1;
        const m = Math.min(4, d / 20);
        p.style.transform = `translate(${(dx / d * m).toFixed(2)}px, ${(dy / d * m).toFixed(2)}px)`;
      });
    });
  }

  // Maskot menutup mata saat mengisi password (terbuka lagi jika password ditampilkan)
  const syncShy = () => mascot.classList.toggle("shy", document.activeElement === pw && pw.type === "password");
  pw.addEventListener("focus", syncShy);
  pw.addEventListener("blur", syncShy);
  toggle.addEventListener("click", () => setTimeout(syncShy, 0));

  // Kembali tersenyum saat pengguna mengetik lagi
  document.querySelectorAll("#login-form input").forEach((i) => i.addEventListener("input", () => {
    mouth.setAttribute("d", MOUTH.smile);
    mascot.classList.remove("is-fail");
  }));

  function react(kind) {
    clearTimeout(resetTimer);
    mascot.classList.remove("shy", "is-fail", "is-ok");
    void mascot.getBoundingClientRect(); // memulai ulang animasi
    mouth.setAttribute("d", kind === "ok" ? MOUTH.big : MOUTH.frown);
    mascot.classList.add(kind === "ok" ? "is-ok" : "is-fail");
    if (kind === "fail") {
      resetTimer = setTimeout(() => {
        mascot.classList.remove("is-fail");
        mouth.setAttribute("d", MOUTH.smile);
      }, 2500);
    }
  }
  window.LoginFX = { fail: () => react("fail"), success: () => react("ok") };
})();