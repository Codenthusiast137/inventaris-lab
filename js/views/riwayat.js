VIEWS.riwayat = async function (el) {
  let tab = "peminjaman", txs = [], rets = [];
  const names = new Map();

  el.innerHTML = `
    <div class="tabs" role="tablist" aria-label="Jenis riwayat">
      <button type="button" role="tab" data-tab="peminjaman" aria-selected="true">Peminjaman</button>
      <button type="button" role="tab" data-tab="pengembalian" aria-selected="false">Pengembalian</button>
    </div>
    <div class="toolbar filters">
      <div class="field-inline" id="status-wrap"><label for="f-status">Status</label>
        <select id="f-status">
          <option value="">Semua status</option>
          <option value="dipinjam">Dipinjam</option>
          <option value="sebagian">Sebagian</option>
          <option value="selesai">Selesai</option>
        </select></div>
      <div class="field-inline"><label for="f-from">Dari tanggal</label><input id="f-from" type="date"></div>
      <div class="field-inline"><label for="f-to">Sampai tanggal</label><input id="f-to" type="date"></div>
      <button type="button" class="btn" id="reset">Reset</button>
    </div>
    <p id="count" class="sub"></p>
    <div id="list" class="msg">Memuat…</div>`;
  const list = el.querySelector("#list"), fStatus = el.querySelector("#f-status");
  const fFrom = el.querySelector("#f-from"), fTo = el.querySelector("#f-to");

  const localDate = (ts) => { const d = new Date(ts); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const inRange = (day) => (!fFrom.value || day >= fFrom.value) && (!fTo.value || day <= fTo.value);
  const person = (id) => esc(names.get(id) ?? "-");
  const statusOf = (t) => t.status === "selesai" ? "selesai"
    : t.transaction_items.some((ti) => ti.returned_qty > 0) ? "sebagian" : "dipinjam";
  const badge = { dipinjam: '<span class="badge">Dipinjam</span>', sebagian: '<span class="badge part">Sebagian</span>', selesai: '<span class="badge ok">Selesai</span>' };

  async function load() {
    const [t, r, n] = await Promise.all([
      db.from("transactions")
        .select("id, borrower_name, borrow_date, status, created_by, transaction_items(qty, returned_qty, items(name))")
        .order("borrow_date", { ascending: false }).order("id", { ascending: false }).limit(500),
      db.from("returns")
        .select("id, qty, returned_at, returned_by, transaction_items(items(name), transactions(borrower_name))")
        .order("returned_at", { ascending: false }).limit(500),
      db.rpc("people_names")
    ]);
    if (t.error || r.error) {
      list.className = "msg error";
      list.textContent = "Data gagal dimuat. Muat ulang halaman.";
      return;
    }
    txs = t.data; rets = r.data;
    (n.data || []).forEach((p) => names.set(p.id, p.full_name));
    draw();
  }

  function draw() {
    const isLoan = tab === "peminjaman";
    el.querySelector("#status-wrap").hidden = !isLoan;
    const rows = isLoan
      ? txs.filter((t) => (!fStatus.value || statusOf(t) === fStatus.value) && inRange(t.borrow_date))
      : rets.filter((x) => inRange(localDate(x.returned_at)));
    const total = isLoan ? txs.length : rets.length;
    el.querySelector("#count").textContent = rows.length === total ? `${total} catatan` : `${rows.length} dari ${total} catatan`;

    if (!rows.length) {
      list.className = "empty";
      list.textContent = total ? "Tidak ada catatan pada filter ini." : (isLoan ? "Belum ada peminjaman." : "Belum ada pengembalian.");
      return;
    }
    list.className = "panel table-wrap";
    list.innerHTML = isLoan
      ? `<table><thead><tr><th>Tanggal pinjam</th><th>Peminjam</th><th>Barang</th><th>Status</th><th>Petugas</th></tr></thead><tbody>
        ${rows.map((t) => `<tr>
          <td>${formatDate(t.borrow_date)}</td>
          <td>${esc(t.borrower_name)}</td>
          <td>${t.transaction_items.map((ti) => `${esc(ti.items?.name)} × ${ti.qty}${ti.returned_qty ? ` <span class="mu">(kembali ${ti.returned_qty})</span>` : ""}`).join("<br>")}</td>
          <td>${badge[statusOf(t)]}</td>
          <td>${person(t.created_by)}</td></tr>`).join("")}</tbody></table>`
      : `<table><thead><tr><th>Waktu kembali</th><th>Peminjam</th><th>Barang</th><th>Jumlah</th><th>Petugas</th></tr></thead><tbody>
        ${rows.map((x) => `<tr>
          <td>${new Date(x.returned_at).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
          <td>${esc(x.transaction_items?.transactions?.borrower_name)}</td>
          <td>${esc(x.transaction_items?.items?.name)}</td>
          <td>${x.qty}</td>
          <td>${person(x.returned_by)}</td></tr>`).join("")}</tbody></table>`;
  }

  el.querySelectorAll("[role=tab]").forEach((b) => b.addEventListener("click", () => {
    tab = b.dataset.tab;
    el.querySelectorAll("[role=tab]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    draw();
  }));
  [fStatus, fFrom, fTo].forEach((i) => i.addEventListener("change", draw));
  el.querySelector("#reset").addEventListener("click", () => { fStatus.value = ""; fFrom.value = ""; fTo.value = ""; draw(); });

  await load();
};