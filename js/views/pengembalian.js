VIEWS.pengembalian = async function (el) {
  let txs = [];
  const left = (ti) => ti.qty - ti.returned_qty;

  el.innerHTML = `
    <div class="toolbar">
      <input id="q" type="search" placeholder="Cari nama peminjam" aria-label="Cari peminjam">
    </div>
    <p id="count" class="sub"></p>
    <div id="list" class="msg">Memuat…</div>
    <dialog id="dlg" class="dlg-wide"></dialog>`;
  const list = el.querySelector("#list"), dlg = el.querySelector("#dlg"), q = el.querySelector("#q");

  async function load() {
    const { data, error } = await db.from("transactions")
      .select("id, borrower_name, borrow_date, transaction_items(id, qty, returned_qty, items(name))")
      .eq("status", "dipinjam")
      .order("borrow_date", { ascending: true })
      .order("id", { ascending: true })
      .limit(200);
    if (error) {
      list.className = "msg error";
      list.textContent = "Data gagal dimuat. Muat ulang halaman.";
      return;
    }
    txs = data.map((t) => ({
      ...t,
      transaction_items: t.transaction_items.filter((ti) => left(ti) > 0).sort((a, b) => a.id - b.id)
    }));
    draw();
  }

  function draw() {
    const term = q.value.trim().toLowerCase();
    const rows = txs.filter((t) => t.borrower_name.toLowerCase().includes(term));
    el.querySelector("#count").textContent = term
      ? `${rows.length} dari ${txs.length} transaksi belum selesai`
      : `${txs.length} transaksi belum selesai`;
    if (!rows.length) {
      list.className = "empty";
      list.textContent = term ? "Tidak ada peminjam yang cocok." : "Semua barang sudah kembali. Tidak ada yang perlu diproses.";
      return;
    }
    list.className = "panel table-wrap";
    list.innerHTML = `<table>
      <thead><tr><th>Peminjam</th><th>Barang belum kembali</th><th>Tanggal pinjam</th><th></th></tr></thead>
      <tbody>${rows.map((t) => `<tr>
        <td>${esc(t.borrower_name)}</td>
        <td>${t.transaction_items.map((ti) => `${esc(ti.items?.name)} × ${left(ti)}`).join("<br>")}</td>
        <td>${formatDate(t.borrow_date)}</td>
        <td><button class="btn btn-primary" type="button" data-id="${t.id}">Kembalikan</button></td>
      </tr>`).join("")}</tbody></table>`;
  }

  function openReturn(tx) {
    dlg.innerHTML = `
      <form id="f" novalidate>
        <h2>Pengembalian: ${esc(tx.borrower_name)}</h2>
        <p class="dlg-text">Isi jumlah yang dikembalikan sekarang. Biarkan 0 untuk barang yang belum kembali.</p>
        ${tx.transaction_items.map((ti) => `
          <div class="ret-row">
            <label for="r-${ti.id}">${esc(ti.items?.name)} <span class="mu">sisa ${left(ti)}</span></label>
            <input id="r-${ti.id}" type="number" min="0" max="${left(ti)}" step="1" value="0" data-line="${ti.id}" data-max="${left(ti)}">
          </div>`).join("")}
        <button type="button" class="link-btn" id="all">Kembalikan semua</button>
        <p class="error" id="f-err" role="alert" hidden></p>
        <div class="dlg-actions">
          <button type="button" class="btn" id="cancel">Batal</button>
          <button type="submit" class="btn btn-primary" id="save">Proses</button>
        </div>
      </form>`;
    const f = dlg.querySelector("#f"), err = dlg.querySelector("#f-err"), save = dlg.querySelector("#save");
    const inputs = [...dlg.querySelectorAll("input[data-line]")];
    const fail = (m) => { err.textContent = m; err.hidden = false; };

    dlg.querySelector("#all").addEventListener("click", () => inputs.forEach((i) => { i.value = i.dataset.max; }));
    dlg.querySelector("#cancel").addEventListener("click", () => dlg.close());

    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      err.hidden = true;
      const payload = [];
      let everything = true;
      for (const i of inputs) {
        const qty = parseInt(i.value, 10), max = Number(i.dataset.max);
        if (!Number.isInteger(qty) || qty < 0) return fail("Jumlah harus angka 0 atau lebih.");
        if (qty > max) return fail(`Jumlah melebihi sisa pinjaman (maksimal ${max}).`);
        if (qty > 0) payload.push({ line_id: Number(i.dataset.line), qty });
        if (qty < max) everything = false;
      }
      if (!payload.length) return fail("Isi jumlah pengembalian minimal untuk satu barang.");

      save.disabled = true; save.textContent = "Memproses…";
      const { error } = await db.rpc("return_items", { p_tx: tx.id, p_items: payload });
      if (error) {
        save.disabled = false; save.textContent = "Proses";
        return fail(error.code === "P0001" ? error.message : "Gagal memproses. Coba lagi.");
      }
      dlg.close();
      toast(everything ? "Pengembalian selesai, transaksi ditutup" : "Pengembalian sebagian tersimpan");
      await load();
    });

    dlg.showModal();
    inputs[0]?.focus();
  }

  q.addEventListener("input", draw);
  list.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-id]");
    const tx = b && txs.find((t) => String(t.id) === b.dataset.id);
    if (tx) openReturn(tx);
  });
  await load();
};