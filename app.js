import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDxHYAPM-1LthEfb-FA1_gTEv1A8uL5l3U",
  authDomain: "safety-epi.firebaseapp.com",
  projectId: "safety-epi",
  storageBucket: "safety-epi.firebasestorage.app",
  messagingSenderId: "450999995915",
  appId: "1:450999995915:web:5ef379ac2785e17a41410e",
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

const allowedRoles = new Set(["administrador", "master", "gestor", "colaborador"]);

const ui = {
  loadingScreen: document.querySelector("#loading-screen"),
  loginView: document.querySelector("#login-view"),
  appView: document.querySelector("#app-view"),
  loginForm: document.querySelector("#login-form"),
  email: document.querySelector("#email"),
  password: document.querySelector("#password"),
  togglePassword: document.querySelector("#toggle-password"),
  loginButton: document.querySelector("#login-button"),
  loginButtonLabel: document.querySelector("#login-button .button-label"),
  loginButtonSpinner: document.querySelector("#login-button .button-spinner"),
  loginMessage: document.querySelector("#login-message"),
  logoutButton: document.querySelector("#logout-button"),
  userName: document.querySelector("#user-name"),
  userRole: document.querySelector("#user-role"),
  userAvatar: document.querySelector("#user-avatar"),
  welcomeName: document.querySelector("#welcome-name"),
  usersNavItem: document.querySelector("#users-nav-item"),
  navItems: [...document.querySelectorAll(".nav-item")],
  pageTitle: document.querySelector("#page-title"),
  dashboardPanel: document.querySelector("#dashboard-panel"),
  placeholderPanel: document.querySelector("#placeholder-panel"),
  placeholderTitle: document.querySelector("#placeholder-title"),
  backDashboard: document.querySelector("#back-dashboard"),
  toast: document.querySelector("#toast"),
  menuToggle: document.querySelector("#menu-toggle"),
  sidebar: document.querySelector("#sidebar"),
  sidebarBackdrop: document.querySelector("#sidebar-backdrop"),
};

const moduleNames = {
  dashboard: "Dashboard",
  colaboradores: "Colaboradores",
  obras: "Obras",
  epis: "EPIs",
  equipamentos: "Equipamentos",
  kits: "KITs",
  estoque: "Estoque",
  inspecoes: "Inspeções",
  movimentacoes: "Movimentações",
  relatorios: "Relatórios",
  usuarios: "Usuários",
};

let currentUserProfile = null;
let toastTimer = null;

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

function roleLabel(role) {
  const labels = {
    administrador: "Administrador",
    master: "Master",
    gestor: "Gestor",
    colaborador: "Colaborador",
  };
  return labels[role] || "Perfil não definido";
}

function initials(name) {
  return String(name || "Usuário")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "U";
}

function setLoginLoading(isLoading) {
  ui.loginButton.disabled = isLoading;
  ui.email.disabled = isLoading;
  ui.password.disabled = isLoading;
  ui.loginButtonLabel.textContent = isLoading ? "Entrando..." : "Entrar";
  ui.loginButtonSpinner.classList.toggle("hidden", !isLoading);
}

function showLoginMessage(text, type = "error") {
  ui.loginMessage.textContent = text;
  ui.loginMessage.className = `message ${type}`;
}

function clearLoginMessage() {
  ui.loginMessage.textContent = "";
  ui.loginMessage.className = "message hidden";
}

function showToast(text) {
  clearTimeout(toastTimer);
  ui.toast.textContent = text;
  ui.toast.classList.remove("hidden");
  toastTimer = setTimeout(() => ui.toast.classList.add("hidden"), 3300);
}

function showLogin() {
  ui.loadingScreen.classList.add("hidden");
  ui.appView.classList.add("hidden");
  ui.loginView.classList.remove("hidden");
  setLoginLoading(false);
}

function showApp(profile) {
  currentUserProfile = profile;

  const role = normalizeRole(profile.role);
  const name = profile.nome || auth.currentUser?.email || "Usuário";

  ui.userName.textContent = name;
  ui.userRole.textContent = roleLabel(role);
  ui.userAvatar.textContent = initials(name);
  ui.welcomeName.textContent = `Olá, ${String(name).split(/\s+/)[0]}.`;
  ui.usersNavItem.classList.toggle("hidden", role !== "administrador");

  ui.loadingScreen.classList.add("hidden");
  ui.loginView.classList.add("hidden");
  ui.appView.classList.remove("hidden");

  navigateTo("dashboard");
}

async function loadUserProfile(user) {
  const ref = doc(db, "usuarios", user.uid);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    throw new Error("PROFILE_NOT_FOUND");
  }

  const data = snapshot.data();
  const role = normalizeRole(data.role);

  if (data.ativo !== true) {
    throw new Error("USER_INACTIVE");
  }

  if (!allowedRoles.has(role)) {
    throw new Error("INVALID_ROLE");
  }

  return {
    id: snapshot.id,
    ...data,
    role,
  };
}

function authErrorMessage(error) {
  const code = error?.code || "";
  const message = error?.message || "";

  if (message.includes("PROFILE_NOT_FOUND")) {
    return "Sua conta existe no login, mas não possui cadastro de acesso no sistema. Procure o administrador.";
  }

  if (message.includes("USER_INACTIVE")) {
    return "Seu acesso está inativo. Procure o administrador do sistema.";
  }

  if (message.includes("INVALID_ROLE")) {
    return "Seu perfil de acesso não está configurado corretamente.";
  }

  const map = {
    "auth/invalid-credential": "E-mail ou senha inválidos.",
    "auth/invalid-email": "Digite um endereço de e-mail válido.",
    "auth/missing-password": "Digite sua senha.",
    "auth/too-many-requests": "Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.",
    "auth/network-request-failed": "Não foi possível conectar ao Firebase. Verifique sua internet e tente novamente.",
    "auth/user-disabled": "Esta conta foi desativada no Firebase Authentication.",
  };

  if (map[code]) return map[code];

  if (code === "permission-denied" || message.includes("Missing or insufficient permissions")) {
    return "O Firestore recusou o acesso. Verifique as regras de segurança publicadas.";
  }

  console.error("Falha de autenticação:", error);
  return "Não foi possível concluir o acesso. Tente novamente.";
}

async function handleAuthenticatedUser(user) {
  try {
    const profile = await loadUserProfile(user);
    showApp(profile);
  } catch (error) {
    await signOut(auth);
    showLogin();
    showLoginMessage(authErrorMessage(error));
  }
}

async function handleLogin(event) {
  event.preventDefault();
  clearLoginMessage();

  const email = ui.email.value.trim();
  const password = ui.password.value;

  if (!email || !password) {
    showLoginMessage("Preencha o e-mail e a senha.");
    return;
  }

  setLoginLoading(true);

  try {
    await signInWithEmailAndPassword(auth, email, password);
    // A abertura da interface é tratada por onAuthStateChanged.
  } catch (error) {
    setLoginLoading(false);
    showLoginMessage(authErrorMessage(error));
  }
}

async function handleLogout() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error(error);
    showToast("Não foi possível sair agora. Tente novamente.");
  }
}

function navigateTo(moduleKey) {
  const role = normalizeRole(currentUserProfile?.role);

  if (moduleKey === "usuarios" && role !== "administrador") {
    showToast("A administração de usuários é exclusiva do Administrador.");
    return;
  }

  ui.navItems.forEach((item) => {
    item.classList.toggle("active", item.dataset.module === moduleKey);
  });

  const title = moduleNames[moduleKey] || "Safety EPI";
  ui.pageTitle.textContent = title;

  if (moduleKey === "dashboard") {
    ui.placeholderPanel.classList.add("hidden");
    ui.dashboardPanel.classList.remove("hidden");
  } else {
    ui.dashboardPanel.classList.add("hidden");
    ui.placeholderPanel.classList.remove("hidden");
    ui.placeholderTitle.textContent = title;
  }

  closeMobileMenu();
}

function togglePasswordVisibility() {
  const showing = ui.password.type === "text";
  ui.password.type = showing ? "password" : "text";
  ui.togglePassword.setAttribute("aria-label", showing ? "Mostrar senha" : "Ocultar senha");
  ui.togglePassword.setAttribute("title", showing ? "Mostrar senha" : "Ocultar senha");
}

function openMobileMenu() {
  ui.sidebar.classList.add("open");
  ui.sidebarBackdrop.classList.add("visible");
}

function closeMobileMenu() {
  ui.sidebar.classList.remove("open");
  ui.sidebarBackdrop.classList.remove("visible");
}

ui.loginForm.addEventListener("submit", handleLogin);
ui.logoutButton.addEventListener("click", handleLogout);
ui.togglePassword.addEventListener("click", togglePasswordVisibility);
ui.menuToggle.addEventListener("click", openMobileMenu);
ui.sidebarBackdrop.addEventListener("click", closeMobileMenu);
ui.backDashboard.addEventListener("click", () => navigateTo("dashboard"));

ui.navItems.forEach((item) => {
  item.addEventListener("click", () => navigateTo(item.dataset.module));
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMobileMenu();
});

try {
  await setPersistence(auth, browserLocalPersistence);
} catch (error) {
  console.warn("Não foi possível configurar persistência local:", error);
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentUserProfile = null;
    showLogin();
    return;
  }

  ui.loadingScreen.classList.remove("hidden");
  ui.loginView.classList.add("hidden");
  ui.appView.classList.add("hidden");
  await handleAuthenticatedUser(user);
});
