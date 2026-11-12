// Fungsi server Vercel untuk mengelola akun Staff.
// Kunci rahasia hanya ada di sini (environment variable), tidak pernah dikirim ke browser.
// Environment variable yang dibutuhkan di Vercel:
//   SUPABASE_URL         contoh: https://xxxx.supabase.co
//   SUPABASE_SECRET_KEY  kunci rahasia (sb_secret_... atau service_role)
//   EMAIL_DOMAIN         opsional, default "lab.app" (harus sama dengan config.js)

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Metode tidak diizinkan." });

  const URL_ = process.env.SUPABASE_URL; "https://puehaukdrysjewveblxo.supabase.co"
  const KEY = process.env.SUPABASE_SECRET_KEY; "sb_publishable_vsIeNG6X1g9bh7Ejxv1Bgg_3pv9e9ew"
  const DOMAIN = process.env.EMAIL_DOMAIN || "lab.app";
  if (!URL_ || !KEY) return res.status(500).json({ error: "Server belum dikonfigurasi (environment variable belum diisi)." });

  const call = (path, opts = {}) => fetch(`${URL_}${path}`, {
    ...opts,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...(opts.headers || {}) }
  });
  const fail = (code, error) => res.status(code).json({ error });

  try {
    // 1. Pastikan pemanggil adalah Admin aktif
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return fail(401, "Belum login.");
    const who = await fetch(`${URL_}/auth/v1/user`, { headers: { apikey: KEY, Authorization: `Bearer ${token}` } });
    if (!who.ok) return fail(401, "Sesi tidak valid. Silakan login ulang.");
    const me = await who.json();
    const [caller] = await (await call(`/rest/v1/profiles?id=eq.${me.id}&select=role,is_active`)).json();
    if (!caller || caller.role !== "admin" || !caller.is_active) return fail(403, "Hanya Admin yang boleh melakukan ini.");

    // 2. Validasi input
    const b = req.body || {};
    const full_name = String(b.full_name || "").trim();
    const username = String(b.username || "").trim().toLowerCase();
    const password = b.password ? String(b.password) : "";
    if (!full_name || full_name.length > 80) return fail(400, "Nama lengkap wajib diisi (maksimal 80 karakter).");
    if (!/^[a-z0-9._-]{3,30}$/.test(username)) return fail(400, "Username 3-30 karakter: huruf kecil, angka, titik, strip, atau garis bawah.");

    if (b.action === "create") {
      if (password.length < 6) return fail(400, "Password minimal 6 karakter.");
      const created = await call("/auth/v1/admin/users", {
        method: "POST",
        body: JSON.stringify({ email: `${username}@${DOMAIN}`, password, email_confirm: true })
      });
      const user = await created.json();
      if (!created.ok) return fail(400, "Username sudah dipakai atau data tidak valid.");

      const ins = await call("/rest/v1/profiles", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ id: user.id, username, full_name, role: "staff", is_active: true })
      });
      if (!ins.ok) {
        await call(`/auth/v1/admin/users/${user.id}`, { method: "DELETE" }); // batalkan akun yang setengah jadi
        return fail(400, "Username sudah dipakai.");
      }
      return res.status(200).json({ ok: true });
    }

    if (b.action === "update") {
      const [target] = await (await call(`/rest/v1/profiles?id=eq.${encodeURIComponent(b.id)}&select=id,username,full_name,role`)).json();
      if (!target) return fail(404, "Akun tidak ditemukan.");
      if (target.role !== "staff") return fail(403, "Hanya akun Staff yang bisa diubah di sini.");
      if (password && password.length < 6) return fail(400, "Password baru minimal 6 karakter.");

      const upd = await call(`/rest/v1/profiles?id=eq.${target.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ full_name, username })
      });
      if (!upd.ok) return fail(400, "Username sudah dipakai.");

      const authChange = {};
      if (username !== target.username) authChange.email = `${username}@${DOMAIN}`;
      if (password) authChange.password = password;
      if (Object.keys(authChange).length) {
        const r = await call(`/auth/v1/admin/users/${target.id}`, {
          method: "PUT",
          body: JSON.stringify({ ...authChange, email_confirm: true })
        });
        if (!r.ok) {
          await call(`/rest/v1/profiles?id=eq.${target.id}`, {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({ full_name: target.full_name, username: target.username })
          });
          return fail(400, "Gagal memperbarui akun login. Perubahan dibatalkan.");
        }
      }
      return res.status(200).json({ ok: true });
    }

    return fail(400, "Aksi tidak dikenal.");
  } catch (e) {
    return fail(500, "Terjadi kesalahan di server.");
  }
};