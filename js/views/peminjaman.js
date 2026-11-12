VIEWS.peminjaman = async function (el) {
  let txs = [];

  el.innerHTML = `
    <div class="toolbar">
      <input id="q" type="search" placeholder="Cari nama peminjam" aria-label="Cari peminjam">
      <button id="add" class="btn btn-primary" type="button">Peminjaman baru</button>
    </div>
    <p id="count" class="sub"></p>
    <div id="list" class="msg">Memuat…</div>
    <dialog id="dlg" class="dlg-wide"></dialog>`;
  const list = el.querySelector("#list"), dlg = el.querySelector("#dlg"), q = el.querySelector("#q");

  async function load() {
    const { data, error } = await db.from("transactions")
      .select("id, borrower_name, borrow_date, status, transaction_items(qty, items(name))")
      .order("id", { ascending: false })
      .limit(200);
    if (error) {
      list.className = "msg error";
      list.textContent = "Data gagal dimuat. Muat ulang halaman.";
      return;
    }
    txs = data;
    draw();
  }

  function draw() {
    const term = q.value.trim().toLowerCase();
    const rows = txs.filter((t) => t.borrower_name.toLowerCase().includes(term));
    el.querySelector("#count").textContent = term ? `${rows.length} dari ${txs.length} transaksi` : `${txs.length} transaksi`;
    if (!rows.length) {
      list.className = "empty";
      list.textContent = term ? "Tidak ada peminjam yang cocok." : "Belum ada transaksi. Klik Peminjaman baru untuk mencatat yang pertama.";
      return;
    }
    list.className = "panel table-wrap";
    list.innerHTML = `<table>
      <thead><tr><th>Peminjam</th><th>Barang</th><th>Tanggal pinjam</th><th>Status</th></tr></thead>
      <tbody>${rows.map((t) => `<tr>
        <td>${esc(t.borrower_name)}</td>
        <td>${t.transaction_items.map((ti) => `${esc(ti.items?.name)} × ${ti.qty}`).join("<br>")}</td>
        <td>${formatDate(t.borrow_date)}</td>
        <td>${t.status === "selesai" ? '<span class="badge ok">Selesai</span>' : '<span class="badge">Dipinjam</span>'}</td>
      </tr>`).join("")}</tbody></table>`;
  }

  async function openForm() {
    // Ambil stok terbaru setiap form dibuka
    const { data: stock, error } = await db.from("items")
      .select("id, code, name, available").gt("available", 0).order("name");
    if (error) return toast("Daftar barang gagal dimuat");
    if (!stock.length) return toast("Semua barang sedang habis dipinjam");

    const options = '<option value="">Pilih barang</option>'
      + stock.map((s) => `<option value="${s.id}">${esc(s.name)} (tersedia ${s.available})</option>`).join("");
    const rowHtml = `<div class="item-row">
      <select aria-label="Barang">${options}</select>
      <input type="number" min="1" step="1" value="1" aria-label="Jumlah">
      <button type="button" class="btn row-del" aria-label="Hapus baris">×</button></div>`;
    const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

    dlg.innerHTML = `
      <form id="f" novalidate>
        <h2>Peminjaman baru</h2>
        <div class="row2">
          <div class="field"><label for="f-name">Nama peminjam</label><input id="f-name" name="name" maxlength="80" autocomplete="off"></div>
          <div class="field"><label for="f-date">Tanggal pinjam</label><input id="f-date" name="date" type="date" value="${today}"></div>
        </div>
        <div class="field">
          <label>Barang</label>
          <div id="rows">${rowHtml}</div>
          <button type="button" class="link-btn" id="more">+ Tambah barang</button>
        </div>
        <p class="error" id="f-err" role="alert" hidden></p>
        <div class="dlg-actions">
          <button type="button" class="btn" id="cancel">Batal</button>
          <button type="submit" class="btn btn-primary" id="save">Simpan</button>
        </div>
      </form>`;

    const f = dlg.querySelector("#f"), rows = dlg.querySelector("#rows");
    const err = dlg.querySelector("#f-err"), save = dlg.querySelector("#save");
    const fail = (m) => { err.textContent = m; err.hidden = false; };
    const syncDel = () => rows.querySelectorAll(".row-del").forEach((b) => { b.disabled = rows.children.length === 1; });
    syncDel();

    dlg.querySelector("#more").addEventListener("click", () => {
      rows.insertAdjacentHTML("beforeend", rowHtml);
      syncDel();
      rows.lastElementChild.querySelector("select").focus();
    });
    rows.addEventListener("click", (e) => {
      const b = e.target.closest(".row-del");
      if (b && rows.children.length > 1) { b.closest(".item-row").remove(); syncDel(); }
    });
    dlg.querySelector("#cancel").addEventListener("click", () => dlg.close());

    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      err.hidden = true;
      const name = f.name.value.trim();
      if (!name) return fail("Nama peminjam wajib diisi.");
      if (!f.date.value) return fail("Tanggal pinjam wajib diisi.");

      // Gabungkan baris yang memilih barang sama
      const merged = new Map();
      for (const r of rows.children) {
        const id = Number(r.querySelector("select").value);
        const qty = parseInt(r.querySelector("input").value, 10);
        if (!id) return fail("Pilih barang pada setiap baris.");
        if (!Number.isInteger(qty) || qty < 1) return fail("Jumlah minimal 1.");
        merged.set(id, (merged.get(id) || 0) + qty);
      }
      for (const [id, qty] of merged) {
        const it = stock.find((s) => s.id === id);
        if (qty > it.available) return fail(`Stok ${it.name} hanya tersedia ${it.available}.`);
      }

      save.disabled = true; save.textContent = "Menyimpan…";
      const { error: rpcErr } = await db.rpc("create_borrowing", {
        p_borrower: name,
        p_date: f.date.value,
        p_items: [...merged].map(([item_id, qty]) => ({ item_id, qty }))
      });
      if (rpcErr) {
        save.disabled = false; save.textContent = "Simpan";
        return fail(rpcErr.code === "P0001" ? rpcErr.message : "Gagal menyimpan. Coba lagi.");
      }
      dlg.close();
      toast("Peminjaman tersimpan");
      await load();
    });

    dlg.showModal();
    f.name.focus();
  }

  q.addEventListener("input", draw);
  el.querySelector("#add").addEventListener("click", openForm);
  await load();
};