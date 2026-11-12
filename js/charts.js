// Grafik Dashboard: peminjaman (batang) dan keluar-masuk barang (garis)
let activeCharts = [];

const ymd = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

function chartBuckets(period) {
  const now = new Date(), out = [];
  if (period === "6m") {
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push({ key: ymd(d).slice(0, 7), label: d.toLocaleDateString("id-ID", { month: "short", year: "2-digit" }) });
    }
  } else {
    for (let i = Number(period) - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      out.push({ key: ymd(d), label: d.toLocaleDateString("id-ID", { day: "numeric", month: "short" }) });
    }
  }
  return out;
}

async function initCharts(root) {
  activeCharts.forEach((c) => c.destroy());
  activeCharts = [];
  const box = root.querySelector("#charts");
  if (!window.Chart) {
    box.innerHTML = '<div class="msg error">Grafik tidak bisa dimuat. Periksa koneksi internet lalu muat ulang.</div>';
    return;
  }
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) Chart.defaults.animation = false;
  Chart.defaults.font.family = '"Montserrat", system-ui, sans-serif';
  Chart.defaults.color = "#6b7280";

  // Ambil data 6 bulan terakhir sekali, periode lain dihitung dari data yang sama
  const now = new Date();
  const start = ymd(new Date(now.getFullYear(), now.getMonth() - 5, 1));
  const [t, r] = await Promise.all([
    db.from("transactions").select("borrow_date, transaction_items(qty)").gte("borrow_date", start).limit(5000),
    db.from("returns").select("qty, returned_at").gte("returned_at", start).limit(5000)
  ]);
  if (t.error || r.error) {
    box.innerHTML = '<div class="msg error">Data grafik gagal dimuat.</div>';
    return;
  }

  function series(period) {
    const bs = chartBuckets(period), idx = new Map(bs.map((b, i) => [b.key, i]));
    const keyOf = (day) => (period === "6m" ? day.slice(0, 7) : day);
    const loans = bs.map(() => 0), out = bs.map(() => 0), inn = bs.map(() => 0);
    t.data.forEach((x) => {
      const i = idx.get(keyOf(x.borrow_date));
      if (i === undefined) return;
      loans[i] += 1;
      out[i] += x.transaction_items.reduce((s, ti) => s + ti.qty, 0);
    });
    r.data.forEach((x) => {
      const i = idx.get(keyOf(ymd(new Date(x.returned_at))));
      if (i !== undefined) inn[i] += x.qty;
    });
    return { labels: bs.map((b) => b.label), loans, out, inn };
  }

  const sum = (a) => a.reduce((s, n) => s + n, 0);
  const cLoans = root.querySelector("#c-loans"), cFlow = root.querySelector("#c-flow");
  const s0 = series("7");
  const base = { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false } };
  const yAxis = { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "#eef0f4" } };

  const loansChart = new Chart(cLoans, {
    type: "bar",
    data: { labels: s0.labels, datasets: [{ label: "Peminjaman", data: s0.loans, backgroundColor: "#f4623a", borderRadius: 4, maxBarThickness: 36 }] },
    options: { ...base, plugins: { legend: { display: false } }, scales: { y: yAxis, x: { grid: { display: false } } } }
  });
  const flowChart = new Chart(cFlow, {
    type: "line",
    data: {
      labels: s0.labels,
      datasets: [
        { label: "Keluar (dipinjam)", data: s0.out, borderColor: "#f5a623", backgroundColor: "#f5a623", tension: 0.3, pointRadius: 3 },
        { label: "Masuk (dikembalikan)", data: s0.inn, borderColor: "#2fa36b", backgroundColor: "#2fa36b", tension: 0.3, pointRadius: 3 }
      ]
    },
    options: { ...base, plugins: { legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8 } } }, scales: { y: yAxis, x: { grid: { display: false } } } }
  });
  activeCharts = [loansChart, flowChart];

  function apply(period) {
    const s = series(period);
    loansChart.data.labels = flowChart.data.labels = s.labels;
    loansChart.data.datasets[0].data = s.loans;
    flowChart.data.datasets[0].data = s.out;
    flowChart.data.datasets[1].data = s.inn;
    loansChart.update(); flowChart.update();
    const span = period === "6m" ? "6 bulan terakhir" : `${period} hari terakhir`;
    cLoans.setAttribute("aria-label", `Grafik peminjaman, ${sum(s.loans)} transaksi dalam ${span}`);
    cFlow.setAttribute("aria-label", `Grafik keluar masuk barang dalam ${span}: ${sum(s.out)} unit keluar, ${sum(s.inn)} unit masuk`);
  }
  apply("7");

  root.querySelectorAll(".seg button").forEach((b) => b.addEventListener("click", () => {
    root.querySelectorAll(".seg button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    apply(b.dataset.p);
  }));
}