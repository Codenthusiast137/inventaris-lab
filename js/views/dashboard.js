VIEWS.dashboard = async function (el) {
  el.innerHTML = `
    <p class="sub">Halo, ${esc(App.profile.full_name)}. Berikut kondisi inventaris saat ini.</p>
    <section class="stats">
      <div class="stat"><span>Total barang</span><strong data-count>0</strong></div>
      <div class="stat"><span>Barang tersedia</span><strong data-count>0</strong></div>
      <div class="stat"><span>Barang dipinjam</span><strong data-count>0</strong></div>
      <div class="stat"><span>Total transaksi</span><strong data-count>0</strong></div>
    </section>
    <section class="panel charts-panel">
      <div class="charts-head">
        <h2>Aktivitas</h2>
        <div class="seg" role="group" aria-label="Periode grafik">
          <button type="button" data-p="7" aria-pressed="true">7 hari</button>
          <button type="button" data-p="30" aria-pressed="false">30 hari</button>
          <button type="button" data-p="6m" aria-pressed="false">6 bulan</button>
        </div>
      </div>
      <div id="charts" class="charts">
        <figure><figcaption>Peminjaman</figcaption>
          <div class="chart-box"><canvas id="c-loans" role="img" aria-label="Grafik peminjaman"></canvas></div></figure>
        <figure><figcaption>Keluar dan masuk barang</figcaption>
          <div class="chart-box"><canvas id="c-flow" role="img" aria-label="Grafik keluar masuk barang"></canvas></div></figure>
      </div>
    </section>
    <section class="panel">
      <h2>Barang yang sedang dipinjam</h2>
      <div id="loans" class="msg">Memuat…</div>
    </section>`;
  initCharts(el);

  const [stats, loans] = await Promise.all([
    db.rpc("dashboard_stats"),
    db.from("transactions")
      .select("id, borrower_name, borrow_date, transaction_items(qty, returned_qty, items(name))")
      .eq("status", "dipinjam")
      .order("borrow_date", { ascending: false })
      .order("id", { ascending: false })
      .limit(50)
  ]);

  const loansBox = el.querySelector("#loans");
  if (stats.error || loans.error) {
    loansBox.className = "msg error";
    loansBox.textContent = "Data gagal dimuat. Periksa koneksi lalu muat ulang halaman.";
    return;
  }

  const s = stats.data;
  const values = [s.total_items, s.available_items, s.borrowed_items, s.total_transactions];
  el.querySelectorAll("[data-count]").forEach((node, i) => countUp(node, Number(values[i])));

  if (!loans.data.length) {
    loansBox.className = "empty";
    loansBox.textContent = "Tidak ada barang yang sedang dipinjam. Semua barang ada di lab.";
    return;
  }

  const rows = loans.data.map((t) => {
    const list = t.transaction_items
      .filter((ti) => ti.qty - ti.returned_qty > 0)
      .map((ti) => `${esc(ti.items?.name)} × ${ti.qty - ti.returned_qty}`)
      .join("<br>");
    return `<tr>
      <td>${esc(t.borrower_name)}</td>
      <td>${list}</td>
      <td>${formatDate(t.borrow_date)}</td>
      <td><span class="badge">Dipinjam</span></td>
    </tr>`;
  }).join("");

  loansBox.className = "table-wrap";
  loansBox.innerHTML = `<table>
    <thead><tr><th>Peminjam</th><th>Barang</th><th>Tanggal pinjam</th><th>Status</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
};

// Angka naik dari 0 saat dashboard dibuka
function countUp(node, target) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || target === 0) { node.textContent = target; return; }
  const start = performance.now(), dur = 700;
  (function tick(now) {
    const p = Math.min((now - start) / dur, 1);
    node.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(tick);
  })(start);
}