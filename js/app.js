const MENUS = [
  { id: "dashboard",    label: "Dashboard",    roles: ["admin", "staff"] },
  { id: "barang",       label: "Barang",       roles: ["admin", "staff"] },
  { id: "peminjaman",   label: "Peminjaman",   roles: ["admin", "staff"] },
  { id: "pengembalian", label: "Pengembalian", roles: ["admin", "staff"] },
  { id: "riwayat",      label: "Riwayat",      roles: ["admin", "staff"] },
  { id: "pengguna",     label: "Pengguna",     roles: ["admin"] }
];

const viewEl = document.getElementById("view");
const navEl = document.getElementById("nav");
const sidebar = document.getElementById("sidebar");
const scrim = document.getElementById("scrim");
let allowed = [];

function setSidebar(open) {
  sidebar.classList.toggle("open", open);
  scrim.classList.toggle("show", open);
}
document.getElementById("menu-btn").addEventListener("click", () => setSidebar(true));
scrim.addEventListener("click", () => setSidebar(false));

document.getElementById("logout").addEventListener("click", async () => {
  await db.auth.signOut();
  location.replace("index.html");
});

function route() {
  const id = location.hash.slice(1) || "dashboard";
  const menu = allowed.find((m) => m.id === id) || allowed[0];

  navEl.querySelectorAll("a").forEach((a) => {
    const active = a.dataset.id === menu.id;
    a.classList.toggle("active", active);
    if (active) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  document.getElementById("page-title").textContent = menu.label;
  document.title = `${menu.label} · LabInventory`;
  setSidebar(false);

  const render = VIEWS[menu.id] || ((el) => {
    el.innerHTML = `<div class="panel"><div class="empty">Halaman ${esc(menu.label)} akan dibuat pada tahap berikutnya.</div></div>`;
  });
  render(viewEl);
}

(async function init() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) return location.replace("index.html");

  const { data: profile, error } = await db
    .from("profiles")
    .select("id, username, full_name, role, is_active")
    .eq("id", session.user.id)
    .single();

  if (error || !profile || !profile.is_active) {
    await db.auth.signOut();
    return location.replace("index.html");
  }

  App.profile = profile;
  allowed = MENUS.filter((m) => m.roles.includes(profile.role));
  document.getElementById("me-name").textContent = profile.full_name;
  document.getElementById("me-role").textContent = profile.role === "admin" ? "Admin" : "Staff";
  navEl.innerHTML = allowed.map((m) => `<a href="#${m.id}" data-id="${m.id}">${m.label}</a>`).join("");

  db.auth.onAuthStateChange((event) => { if (event === "SIGNED_OUT") location.replace("index.html"); });
  window.addEventListener("hashchange", route);
  route();
})();