
// Ikon 2D sederhana per kategori (warna mengikuti kelas .cat-* di app.css)
const CAT_ART = {
  laptop: '<rect x="11" y="12" width="42" height="29" rx="3.5"/><rect x="15.5" y="16.5" width="33" height="20" rx="1.5" fill="#fff" fill-opacity=".6"/><path d="M5 45h54l-3.5 6.5a2 2 0 0 1-1.8 1H10.3a2 2 0 0 1-1.8-1z"/>',
  monitor: '<rect x="7" y="10" width="50" height="34" rx="3.5"/><rect x="11.5" y="14.5" width="41" height="25" rx="1.5" fill="#fff" fill-opacity=".6"/><rect x="28" y="44" width="8" height="8"/><rect x="19" y="51" width="26" height="5" rx="2.5"/>',
  periferal: '<rect x="4" y="34" width="40" height="20" rx="3.5"/><g fill="#fff" fill-opacity=".65"><rect x="8" y="38" width="5" height="4" rx="1"/><rect x="15" y="38" width="5" height="4" rx="1"/><rect x="22" y="38" width="5" height="4" rx="1"/><rect x="29" y="38" width="5" height="4" rx="1"/><rect x="36" y="38" width="4" height="4" rx="1"/><rect x="10" y="45" width="24" height="4" rx="1"/></g><rect x="45" y="10" width="15" height="26" rx="7.5"/><rect x="51.5" y="15" width="2" height="7" rx="1" fill="#fff" fill-opacity=".65"/>',
  proyektor: '<rect x="5" y="22" width="54" height="24" rx="5"/><circle cx="43" cy="34" r="9" fill="#fff" fill-opacity=".6"/><circle cx="43" cy="34" r="4.5"/><g fill="#fff" fill-opacity=".6"><rect x="11" y="28" width="16" height="2.5" rx="1.2"/><rect x="11" y="33" width="16" height="2.5" rx="1.2"/><rect x="11" y="38" width="16" height="2.5" rx="1.2"/></g><rect x="12" y="46" width="6" height="4" rx="1"/><rect x="46" y="46" width="6" height="4" rx="1"/>',
  jaringan: '<rect x="6" y="36" width="52" height="16" rx="4"/><g fill="#fff" fill-opacity=".65"><circle cx="16" cy="44" r="2.2"/><circle cx="24" cy="44" r="2.2"/><circle cx="32" cy="44" r="2.2"/></g><rect x="14" y="12" width="4.5" height="24" rx="2.2"/><rect x="45.5" y="12" width="4.5" height="24" rx="2.2"/><path d="M26 22a8 8 0 0 1 12 0M22.5 17.5a13 13 0 0 1 19 0" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
  aksesoris: '<rect x="19" y="24" width="26" height="34" rx="4"/><rect x="25" y="6" width="14" height="20" rx="2"/><rect x="28.5" y="10" width="2.8" height="6" rx="1" fill="#fff" fill-opacity=".65"/><rect x="33.7" y="10" width="2.8" height="6" rx="1" fill="#fff" fill-opacity=".65"/><circle cx="32" cy="42" r="4" fill="#fff" fill-opacity=".6"/>',
  umum: '<path d="M32 5 56 17.5v29L32 59 8 46.5v-29z"/><path d="M32 5 56 17.5 32 30 8 17.5z" fill="#fff" fill-opacity=".45"/><path d="M32 30v29" stroke="#fff" stroke-opacity=".6" stroke-width="2.5"/>'
};

// Mencocokkan nama kategori (termasuk kategori buatan Admin) ke ikon
function catKey(name) {
  const n = String(name ?? "").toLowerCase();
  if (/laptop|notebook/.test(n)) return "laptop";
  if (/monitor|layar|display/.test(n)) return "monitor";
  if (/perifer|periferal|peripheral|mouse|keyboard|webcam|headset/.test(n)) return "periferal";
  if (/proyektor|projector/.test(n)) return "proyektor";
  if (/jaringan|network|router|switch|wifi/.test(n)) return "jaringan";
  if (/aksesoris|accessor|kabel|flash|usb/.test(n)) return "aksesoris";
  return "umum";
}
const catArt = (name) => `<svg class="card-art" viewBox="0 0 64 64" fill="currentColor" aria-hidden="true">${CAT_ART[catKey(name)]}</svg>`;

VIEWS.barang = async function (el) {
  const isAdmin = App.profile.role === "admin";
  let items = [], cats = [];

  el.innerHTML = `
    <div class="toolbar">
      <input id="q" type="search" placeholder="Cari kode, nama, atau kategori" aria-label="Cari barang">
      ${isAdmin ? '<button id="add" class="btn btn-primary" type="button">Tambah barang</button>' : ""}
    </div>
    <p id="count" class="sub"></p>
    <div id="grid" class="msg">Memuat…</div>
    <dialog id="dlg"></dialog>`;
  const grid = el.querySelector("#grid"), dlg = el.querySelector("#dlg"), q = el.querySelector("#q");

  async function load() {
    const [i, c] = await Promise.all([
      db.from("items").select("id, code, name, stock, available, category_id, categories(name)").order("code"),
      db.from("categories").select("id, name").order("name")
    ]);
    if (i.error || c.error) {
      grid.className = "msg error";
      grid.textContent = "Data gagal dimuat. Muat ulang halaman.";
      return;
    }
    items = i.data; cats = c.data;
    draw();
  }

  function draw() {
    const term = q.value.trim().toLowerCase();
    const list = items.filter((it) => `${it.code} ${it.name} ${it.categories?.name ?? ""}`.toLowerCase().includes(term));
    el.querySelector("#count").textContent = term ? `${list.length} dari ${items.length} barang` : `${items.length} barang`;
    if (!list.length) {
      grid.className = "empty";
      grid.textContent = term ? "Tidak ada barang yang cocok dengan pencarian." : "Belum ada barang." + (isAdmin ? " Tambahkan barang pertama." : "");
      return;
    }
    grid.className = "cards";
    grid.innerHTML = list.map((it) => `
      <article class="item-card cat-${catKey(it.categories?.name)}">
        ${catArt(it.categories?.name)}
        <div class="meta"><span>${esc(it.code)}</span><span>${esc(it.categories?.name)}</span></div>
        <h3>${esc(it.name)}</h3>
        ${it.available === 0
          ? '<span class="badge no">Habis</span>'
          : `<span class="badge ok">${it.available} dari ${it.stock} tersedia</span>`}
        ${isAdmin ? `<div class="card-actions">
          <button class="btn" data-act="edit" data-id="${it.id}" type="button">Ubah</button>
          <button class="btn btn-danger" data-act="del" data-id="${it.id}" type="button">Hapus</button></div>` : ""}
      </article>`).join("");
  }

  function saveError(e) {
    if (e.code === "23505") return "Kode barang atau nama kategori sudah dipakai.";
    if (e.code === "23514") return "Stok tidak boleh kurang dari jumlah yang sedang dipinjam.";
    return "Gagal menyimpan. Coba lagi.";
  }

  function openForm(item) {
    const needNew = !cats.length;
    const options = cats.map((c) => `<option value="${c.id}" ${item?.category_id === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")
      + `<option value="__new" ${needNew ? "selected" : ""}>+ Kategori baru</option>`;
    dlg.innerHTML = `
      <form id="f" novalidate>
        <h2>${item ? "Ubah barang" : "Tambah barang"}</h2>
        <div class="row2">
          <div class="field"><label for="f-code">Kode</label><input id="f-code" name="code" value="${esc(item?.code)}" maxlength="20" autocomplete="off"></div>
          <div class="field"><label for="f-stock">Stok</label><input id="f-stock" name="stock" type="number" min="0" step="1" value="${item ? item.stock : ""}"></div>
        </div>
        <div class="field"><label for="f-name">Nama barang</label><input id="f-name" name="name" value="${esc(item?.name)}" maxlength="80" autocomplete="off"></div>
        <div class="field"><label for="f-cat">Kategori</label><select id="f-cat" name="cat">${options}</select></div>
        <div class="field" id="newcat-wrap" ${needNew ? "" : "hidden"}><label for="f-newcat">Nama kategori baru</label><input id="f-newcat" name="newcat" maxlength="40" autocomplete="off"></div>
        <p class="error" id="f-err" role="alert" hidden></p>
        <div class="dlg-actions">
          <button type="button" class="btn" id="cancel">Batal</button>
          <button type="submit" class="btn btn-primary" id="save">Simpan</button>
        </div>
      </form>`;
    const f = dlg.querySelector("#f"), err = dlg.querySelector("#f-err"), save = dlg.querySelector("#save");
    const fail = (m) => { err.textContent = m; err.hidden = false; };

    f.cat.addEventListener("change", () => { dlg.querySelector("#newcat-wrap").hidden = f.cat.value !== "__new"; });
    dlg.querySelector("#cancel").addEventListener("click", () => dlg.close());

    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      err.hidden = true;
      const code = f.code.value.trim().toUpperCase();
      const name = f.name.value.trim();
      const stock = parseInt(f.stock.value, 10);
      const newCat = f.newcat.value.trim();

      if (!code || !name) return fail("Kode dan nama barang wajib diisi.");
      if (!Number.isInteger(stock) || stock < 0) return fail("Stok harus berupa angka 0 atau lebih.");
      if (f.cat.value === "__new" && !newCat) return fail("Isi nama kategori baru.");
      const borrowed = item ? item.stock - item.available : 0;
      if (stock < borrowed) return fail(`Stok tidak boleh kurang dari ${borrowed}, jumlah yang sedang dipinjam.`);

      save.disabled = true; save.textContent = "Menyimpan…";
      let catId = f.cat.value;

      if (catId === "__new") {
        const made = await db.from("categories").insert({ name: newCat }).select("id").single();
        if (made.error) {
          const found = await db.from("categories").select("id").eq("name", newCat).maybeSingle();
          if (!found.data) { save.disabled = false; save.textContent = "Simpan"; return fail(saveError(made.error)); }
          catId = found.data.id;
        } else catId = made.data.id;
      }

      const row = { code, name, category_id: Number(catId), stock };
      const res = item
        ? await db.from("items").update({ ...row, available: item.available + (stock - item.stock) }).eq("id", item.id)
        : await db.from("items").insert({ ...row, available: stock });

      if (res.error) { save.disabled = false; save.textContent = "Simpan"; return fail(saveError(res.error)); }
      dlg.close();
      toast(item ? "Barang diperbarui" : "Barang ditambahkan");
      await load();
    });
    dlg.showModal();
    f.code.focus();
  }

  function openDelete(it) {
    dlg.innerHTML = `
      <form id="d" novalidate>
        <h2>Hapus barang</h2>
        <p class="dlg-text">Hapus <strong>${esc(it.name)}</strong> (${esc(it.code)}) dari daftar barang? Tindakan ini tidak bisa dibatalkan.</p>
        <p class="error" id="d-err" role="alert" hidden></p>
        <div class="dlg-actions">
          <button type="button" class="btn" id="cancel">Batal</button>
          <button type="submit" class="btn btn-danger-solid" id="confirm">Hapus</button>
        </div>
      </form>`;
    const err = dlg.querySelector("#d-err"), btn = dlg.querySelector("#confirm");
    dlg.querySelector("#cancel").addEventListener("click", () => dlg.close());
    dlg.querySelector("#d").addEventListener("submit", async (e) => {
      e.preventDefault();
      btn.disabled = true; btn.textContent = "Menghapus…";
      const { error } = await db.from("items").delete().eq("id", it.id);
      if (error) {
        err.textContent = error.code === "23503"
          ? "Barang ini tidak bisa dihapus karena sudah tercatat di transaksi peminjaman."
          : "Gagal menghapus. Coba lagi.";
        err.hidden = false; btn.disabled = false; btn.textContent = "Hapus";
        return;
      }
      dlg.close();
      toast("Barang dihapus");
      await load();
    });
    dlg.showModal();
  }

  q.addEventListener("input", draw);
  grid.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-act]");
    if (!b) return;
    const it = items.find((x) => String(x.id) === b.dataset.id);
    if (it) (b.dataset.act === "edit" ? openForm(it) : openDelete(it));
  });
  el.querySelector("#add")?.addEventListener("click", () => openForm(null));

  await load();
};