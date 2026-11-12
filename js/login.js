const { SUPABASE_URL, SUPABASE_ANON_KEY, EMAIL_DOMAIN, REDIRECT_AFTER_LOGIN } = window.APP_CONFIG;
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const form = document.getElementById("login-form");
const errorBox = document.getElementById("error");
const submitBtn = document.getElementById("submit");
const pwInput = document.getElementById("password");
const toggleBtn = document.getElementById("toggle-pw");

const panel = document.getElementById("panel");
const panelTitle = document.getElementById("panel-title");
const panelText = document.getElementById("panel-text");
const DEFAULT_TITLE = panelTitle.textContent;
const DEFAULT_TEXT = panelText.textContent;
const FLIP_MS = 800;
let revertTimer;

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.hidden = false;
}

// Panel berputar 360° dan teksnya berganti di tengah putaran
function flipPanel(title, text) {
  clearTimeout(revertTimer);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduce) {
    panel.animate(
      [{ transform: "rotateY(0deg)" }, { transform: "rotateY(360deg)" }],
      { duration: FLIP_MS, easing: "cubic-bezier(.4, 0, .2, 1)" }
    );
  }
  return new Promise((resolve) => {
    setTimeout(() => {
      panelTitle.textContent = title;
      panelText.textContent = text;
    }, reduce ? 0 : FLIP_MS / 2);
    setTimeout(resolve, reduce ? 0 : FLIP_MS);
  });
}

function failLogin(message) {
  showError(message);
  window.LoginFX?.fail();
  flipPanel("Login gagal", "Periksa kembali data Anda, lalu coba lagi.");
  // Kembalikan teks sambutan setelah beberapa detik
  revertTimer = setTimeout(() => {
    panelTitle.textContent = DEFAULT_TITLE;
    panelText.textContent = DEFAULT_TEXT;
  }, 4000);
  resetButton();
}

toggleBtn.addEventListener("click", () => {
  const show = pwInput.type === "password";
  pwInput.type = show ? "text" : "password";
  toggleBtn.textContent = show ? "Sembunyikan" : "Lihat";
  toggleBtn.setAttribute("aria-label", show ? "Sembunyikan password" : "Tampilkan password");
});

// Jika sudah login, langsung ke dashboard
db.auth.getSession().then(({ data }) => {
  if (data.session) window.location.replace(REDIRECT_AFTER_LOGIN);
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorBox.hidden = true;

  const username = form.username.value.trim().toLowerCase();
  const password = pwInput.value;
  if (!username || !password) {
    showError("Isi username dan password.");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Memeriksa…";

  const { data, error } = await db.auth.signInWithPassword({
    email: `${username}@${EMAIL_DOMAIN}`,
    password
  });
  if (error) {
    console.error("Login error:", error);
    const wrong = error.code === "invalid_credentials" || /invalid login credentials/i.test(error.message);
    return failLogin(wrong ? "Username atau password salah." : `Gagal masuk: ${error.message}`);
  }

  // Cek profil: role dan status akun aktif
  const { data: profile, error: pErr } = await db
    .from("profiles")
    .select("role, is_active")
    .eq("id", data.user.id)
    .single();

  if (pErr || !profile) {
    await db.auth.signOut();
    return failLogin("Profil akun tidak ditemukan. Hubungi Admin.");
  }
  if (!profile.is_active) {
    await db.auth.signOut();
    return failLogin("Akun Anda dinonaktifkan. Hubungi Admin.");
  }

  // Berhasil: panel flip, lalu pindah ke dashboard
  window.LoginFX?.success();
  await flipPanel("Berhasil masuk", "Mengalihkan ke dashboard…");
  setTimeout(() => window.location.replace(REDIRECT_AFTER_LOGIN), 400);
});

function resetButton() {
  submitBtn.disabled = false;
  submitBtn.textContent = "Masuk";
}