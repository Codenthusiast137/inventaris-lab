VIEWS.pengguna = async function (el) {
  let users = [];

  el.innerHTML = `
    <div class="toolbar">
      <p id="count" class="sub" style="flex:1;margin:0;align-self:center"></p>
      <button id="add" class="btn btn-primary" type="button">Tambah akun Staff</button>
    </div>
    <div id="list" class="msg">Memuat…</div>
    <dialog id="dlg" class="dlg-wide"></dialog>`;
  const list = el.querySelector("#list"), dlg = el.querySelector("#dlg");

  // Memanggil fungsi server Vercel (/api/users)
  async function api(body) {
    const { data: { session } } = await db.auth.getSession();
    let r;
    try {
      r = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(body)
      });
    } catch { throw new Error("Tidak bisa terhubung ke server."); }
    if (r.status === 404 || r.status === 405) {
      throw new Error("Fungsi server belum tersedia. Fitur ini hanya berjalan setelah aplikasi dihosting di Vercel.");
    }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Permintaan gagal.");
    return j;
  }

  async function load() {
    const { data, error } = await db.from("profiles")
      .select("id, username, full_name, role, is_active")
      .order("role", { ascending: true }).order("full_name", { ascending: true });
    if (error) {
      list.className = "msg error";
      list.textContent = "Data gagal dimuat. Muat ulang halaman.";
      return;
    }
    users = data;
    draw();
  }

  function draw() {
    const staff = users.filter((u) => u.role === "staff").length;
    el.querySelector("#count").textContent = `${users.length} akun (${staff} Staff)`;
    list.className = "panel table-wrap";
    list.innerHTML = `<table>
      <thead><tr><th>Nama</th><th>Username</th><th>Role</th><th>Status</th><th></th></tr></thead>
      <tbody>${users.map((u) => {
        const isAdmin = u.role === "admin";
        return `<tr>
          <td>${esc(u.full_name)}</td>
          <td>${esc(u.username)}</td>
          <td>${isAdmin ? '<span class="badge part">Admin</span>' : '<span class="badge ok">Staff</span>'}</td>
          <td>${isAdmin ? '<span class="mu">Akun utama</span>' : `<span class="status-cell">
            <button type="button" class="switch" role="switch" aria-checked="${u.is_active}" aria-label="Akun ${esc(u.full_name)} aktif" data-toggle="${u.id}"><i></i></button>
            <span>${u.is_active ? "Aktif" : "Nonaktif"}</span></span>`}</td>
          <td>${isAdmin ? "" : `<button type="button" class="btn" data-edit="${u.id}">Ubah</button>`}</td>
        </tr>`;
      }).join("")}</tbody></table>`;
  }

  function openForm(user) {
    dlg.innerHTML = `
      <form id="f" novalidate>
        <h2>${user ? "Ubah akun Staff" : "Tambah akun Staff"}</h2>
        <div class="field"><label for="f-name">Nama lengkap</label><input id="f-name" name="name" value="${esc(user?.full_name)}" maxlength="80" autocomplete="off"></div>
        <div class="field"><label for="f-user">Username</label><input id="f-user" name="username" value="${esc(user?.username)}" maxlength="30" autocomplete="off" autocapitalize="none">
          <span class="mu">Huruf kecil, angka, titik, strip, atau garis bawah.</span></div>
        <div class="field"><label for="f-pass">${user ? "Password baru" : "Password"}</label>
          <input id="f-pass" name="password" type="text" autocomplete="off" placeholder="${user ? "Kosongkan jika tidak diganti" : "Minimal 6 karakter"}">
        </div>
        <p class="error" id="f-err" role="alert" hidden></p>
        <div class="dlg-actions">
          <button type="button" class="btn" id="cancel">Batal</button>
          <button type="submit" class="btn btn-primary" id="save">Simpan</button>
        </div>
      </form>`;
    const f = dlg.querySelector("#f"), err = dlg.querySelector("#f-err"), save = dlg.querySelector("#save");
    const fail = (m) => { err.textContent = m; err.hidden = false; };
    dlg.querySelector("#cancel").addEventListener("click", () => dlg.close());

    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      err.hidden = true;
      const full_name = f.name.value.trim(), username = f.username.value.trim().toLowerCase(), password = f.password.value;
      if (!full_name) return fail("Nama lengkap wajib diisi.");
      if (!/^[a-z0-9._-]{3,30}$/.test(username)) return fail("Username 3-30 karakter: huruf kecil, angka, titik, strip, atau garis bawah.");
      if (!user && password.length < 6) return fail("Password minimal 6 karakter.");
      if (user && password && password.length < 6) return fail("Password baru minimal 6 karakter.");

      save.disabled = true; save.textContent = "Menyimpan…";
      try {
        await api(user
          ? { action: "update", id: user.id, full_name, username, password }
          : { action: "create", full_name, username, password });
      } catch (ex) {
        save.disabled = false; save.textContent = "Simpan";
        return fail(ex.message);
      }
      dlg.close();
      toast(user ? "Akun diperbarui" : "Akun Staff dibuat");
      await load();
    });
    dlg.showModal();
    f.name.focus();
  }

  list.addEventListener("click", async (e) => {
    const sw = e.target.closest("[data-toggle]");
    if (sw) {
      const u = users.find((x) => x.id === sw.dataset.toggle);
      sw.disabled = true;
      const { error } = await db.from("profiles").update({ is_active: !u.is_active }).eq("id", u.id);
      if (error) { sw.disabled = false; return toast("Gagal mengubah status"); }
      toast(u.is_active ? "Akun dinonaktifkan" : "Akun diaktifkan");
      return load();
    }
    const ed = e.target.closest("[data-edit]");
    if (ed) openForm(users.find((x) => x.id === ed.dataset.edit));
  });
  el.querySelector("#add").addEventListener("click", () => openForm(null));
  await load();
};