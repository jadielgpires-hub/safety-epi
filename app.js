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
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  serverTimestamp,
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
const managementRoles = new Set(["administrador", "master", "gestor"]);

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
  collaboratorsPanel: document.querySelector("#collaborators-panel"),
  placeholderPanel: document.querySelector("#placeholder-panel"),
  placeholderTitle: document.querySelector("#placeholder-title"),
  backDashboard: document.querySelector("#back-dashboard"),
  toast: document.querySelector("#toast"),
  menuToggle: document.querySelector("#menu-toggle"),
  sidebar: document.querySelector("#sidebar"),
  sidebarBackdrop: document.querySelector("#sidebar-backdrop"),
  collaboratorCountMetric: document.querySelector("#collaborator-count-metric"),
  collaboratorCountCaption: document.querySelector("#collaborator-count-caption"),
  newCollaboratorButton: document.querySelector("#new-collaborator-button"),
  collaboratorSearch: document.querySelector("#collaborator-search"),
  collaboratorTableBody: document.querySelector("#collaborator-table-body"),
  collaboratorEmpty: document.querySelector("#collaborator-empty"),
  collaboratorSummary: document.querySelector("#collaborator-summary"),
  collaboratorModal: document.querySelector("#collaborator-modal"),
  collaboratorModalTitle: document.querySelector("#collaborator-modal-title"),
  collaboratorForm: document.querySelector("#collaborator-form"),
  collaboratorId: document.querySelector("#collaborator-id"),
  collaboratorName: document.querySelector("#collaborator-name"),
  collaboratorRegistration: document.querySelector("#collaborator-registration"),
  collaboratorRole: document.querySelector("#collaborator-role"),
  collaboratorSector: document.querySelector("#collaborator-sector"),
  collaboratorAdmission: document.querySelector("#collaborator-admission"),
  collaboratorManager: document.querySelector("#collaborator-manager"),
  collaboratorStatus: document.querySelector("#collaborator-status"),
  collaboratorFormMessage: document.querySelector("#collaborator-form-message"),
  collaboratorSaveButton: document.querySelector("#collaborator-save-button"),
  collaboratorSaveLabel: document.querySelector("#collaborator-save-button .button-label"),
  closeCollaboratorModal: document.querySelector("#close-collaborator-modal"),
  cancelCollaboratorModal: document.querySelector("#cancel-collaborator-modal"),
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
let collaborators = [];
let stopCollaboratorsListener = null;

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

function isManagement() {
  return managementRoles.has(normalizeRole(currentUserProfile?.role));
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
  ui.newCollaboratorButton.classList.toggle("hidden", !managementRoles.has(role));

  ui.loadingScreen.classList.add("hidden");
  ui.loginView.classList.add("hidden");
  ui.appView.classList.remove("hidden");

  startCollaboratorsListener();
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
  } catch (error) {
    setLoginLoading(false);
    showLoginMessage(authErrorMessage(error));
  }
}

async function handleLogout() {
  try {
    stopCollaboratorsListener?.();
    stopCollaboratorsListener = null;
    collaborators = [];
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

  ui.dashboardPanel.classList.add("hidden");
  ui.collaboratorsPanel.classList.add("hidden");
  ui.placeholderPanel.classList.add("hidden");

  if (moduleKey === "dashboard") {
    ui.dashboardPanel.classList.remove("hidden");
  } else if (moduleKey === "colaboradores") {
    ui.collaboratorsPanel.classList.remove("hidden");
    renderCollaborators();
  } else {
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

function formatDate(dateValue) {
  if (!dateValue) return "—";
  const [year, month, day] = String(dateValue).split("-");
  if (!year || !month || !day) return dateValue;
  return `${day}/${month}/${year}`;
}

function collaboratorMatchesSearch(collaborator, search) {
  if (!search) return true;
  const haystack = [
    collaborator.nomeCompleto,
    collaborator.matricula,
    collaborator.cargoFuncao,
    collaborator.setorContrato,
    collaborator.gestorResponsavel,
  ].join(" ").toLowerCase();
  return haystack.includes(search.toLowerCase());
}

function updateCollaboratorMetric() {
  if (!isManagement()) {
    ui.collaboratorCountMetric.textContent = collaborators.length ? "1" : "0";
    ui.collaboratorCountCaption.textContent = collaborators.length ? "Seu cadastro" : "Cadastro não vinculado";
    return;
  }

  const activeCount = collaborators.filter((item) => item.ativo !== false).length;
  ui.collaboratorCountMetric.textContent = String(activeCount);
  ui.collaboratorCountCaption.textContent = activeCount === 1 ? "1 colaborador ativo" : `${activeCount} colaboradores ativos`;
}

function startCollaboratorsListener() {
  stopCollaboratorsListener?.();
  stopCollaboratorsListener = null;

  const role = normalizeRole(currentUserProfile?.role);

  if (managementRoles.has(role)) {
    const q = query(collection(db, "colaboradores"), orderBy("nomeCompleto"));
    stopCollaboratorsListener = onSnapshot(q, (snapshot) => {
      collaborators = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      updateCollaboratorMetric();
      renderCollaborators();
    }, (error) => {
      console.error("Falha ao carregar colaboradores:", error);
      showToast("Não foi possível carregar os colaboradores. Verifique as regras do Firestore.");
    });
    return;
  }

  const collaboratorId = currentUserProfile?.colaboradorId;
  if (!collaboratorId) {
    collaborators = [];
    updateCollaboratorMetric();
    renderCollaborators();
    return;
  }

  const ref = doc(db, "colaboradores", collaboratorId);
  stopCollaboratorsListener = onSnapshot(ref, (snapshot) => {
    collaborators = snapshot.exists() ? [{ id: snapshot.id, ...snapshot.data() }] : [];
    updateCollaboratorMetric();
    renderCollaborators();
  }, (error) => {
    console.error("Falha ao carregar cadastro do colaborador:", error);
    showToast("Não foi possível carregar sua ficha de colaborador.");
  });
}

function renderCollaborators() {
  if (!ui.collaboratorTableBody) return;

  const search = ui.collaboratorSearch.value.trim();
  const visible = collaborators.filter((item) => collaboratorMatchesSearch(item, search));
  const canManage = isManagement();

  ui.collaboratorTableBody.innerHTML = "";
  ui.collaboratorEmpty.classList.toggle("hidden", visible.length > 0);

  if (!canManage && !currentUserProfile?.colaboradorId) {
    ui.collaboratorEmpty.querySelector("strong").textContent = "Seu cadastro ainda não foi vinculado";
    ui.collaboratorEmpty.querySelector("span").textContent = "Peça ao administrador para vincular sua conta ao seu registro de colaborador.";
  } else if (visible.length === 0 && collaborators.length > 0) {
    ui.collaboratorEmpty.querySelector("strong").textContent = "Nenhum resultado encontrado";
    ui.collaboratorEmpty.querySelector("span").textContent = "Tente outro nome, matrícula, função, setor ou gestor.";
  } else {
    ui.collaboratorEmpty.querySelector("strong").textContent = "Nenhum colaborador cadastrado";
    ui.collaboratorEmpty.querySelector("span").textContent = canManage
      ? "Use o botão Novo colaborador para iniciar o cadastro."
      : "Seu cadastro ainda não está disponível.";
  }

  visible.forEach((collaborator) => {
    const row = document.createElement("tr");
    const active = collaborator.ativo !== false;

    const cells = [
      collaborator.nomeCompleto || "—",
      collaborator.matricula || "—",
      collaborator.cargoFuncao || "—",
      collaborator.setorContrato || "—",
      formatDate(collaborator.dataAdmissao),
      collaborator.gestorResponsavel || "—",
    ];

    cells.forEach((value, index) => {
      const cell = document.createElement("td");
      if (index === 0) {
        const name = document.createElement("strong");
        name.className = "table-primary";
        name.textContent = value;
        cell.appendChild(name);
      } else {
        cell.textContent = value;
      }
      row.appendChild(cell);
    });

    const statusCell = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = `status-badge ${active ? "active" : "inactive"}`;
    badge.textContent = active ? "Ativo" : "Inativo";
    statusCell.appendChild(badge);
    row.appendChild(statusCell);

    const actionCell = document.createElement("td");
    actionCell.className = "table-actions";
    const actionButton = document.createElement("button");
    actionButton.type = "button";
    actionButton.className = "table-action-button";
    actionButton.textContent = canManage ? "Editar" : "Ver";
    actionButton.addEventListener("click", () => openCollaboratorModal(collaborator));
    actionCell.appendChild(actionButton);
    row.appendChild(actionCell);

    ui.collaboratorTableBody.appendChild(row);
  });

  const total = collaborators.length;
  const active = collaborators.filter((item) => item.ativo !== false).length;
  const inactive = total - active;
  ui.collaboratorSummary.textContent = canManage
    ? `${total} cadastrado${total === 1 ? "" : "s"} • ${active} ativo${active === 1 ? "" : "s"} • ${inactive} inativo${inactive === 1 ? "" : "s"}`
    : total ? "Seu cadastro de colaborador" : "Cadastro não vinculado";
}

function clearCollaboratorFormMessage() {
  ui.collaboratorFormMessage.textContent = "";
  ui.collaboratorFormMessage.className = "message hidden";
}

function showCollaboratorFormMessage(text, type = "error") {
  ui.collaboratorFormMessage.textContent = text;
  ui.collaboratorFormMessage.className = `message ${type}`;
}

function setCollaboratorFormDisabled(disabled) {
  [...ui.collaboratorForm.elements].forEach((element) => {
    element.disabled = disabled;
  });
  ui.closeCollaboratorModal.disabled = disabled;
  ui.cancelCollaboratorModal.disabled = disabled;
}

function openCollaboratorModal(collaborator = null) {
  clearCollaboratorFormMessage();
  const canManage = isManagement();
  const editing = Boolean(collaborator?.id);

  ui.collaboratorId.value = collaborator?.id || "";
  ui.collaboratorName.value = collaborator?.nomeCompleto || "";
  ui.collaboratorRegistration.value = collaborator?.matricula || "";
  ui.collaboratorRole.value = collaborator?.cargoFuncao || "";
  ui.collaboratorSector.value = collaborator?.setorContrato || "";
  ui.collaboratorAdmission.value = collaborator?.dataAdmissao || "";
  ui.collaboratorManager.value = collaborator?.gestorResponsavel || "";
  ui.collaboratorStatus.value = collaborator?.ativo === false ? "false" : "true";

  ui.collaboratorModalTitle.textContent = editing ? (canManage ? "Editar colaborador" : "Dados do colaborador") : "Novo colaborador";
  ui.collaboratorSaveButton.classList.toggle("hidden", !canManage);
  ui.cancelCollaboratorModal.textContent = canManage ? "Cancelar" : "Fechar";

  [...ui.collaboratorForm.elements].forEach((element) => {
    if (element === ui.collaboratorId) return;
    element.disabled = !canManage;
  });

  ui.collaboratorModal.classList.remove("hidden");
  document.body.classList.add("modal-open");
  if (canManage) setTimeout(() => ui.collaboratorName.focus(), 40);
}

function closeCollaboratorDialog() {
  ui.collaboratorModal.classList.add("hidden");
  document.body.classList.remove("modal-open");
  ui.collaboratorForm.reset();
  ui.collaboratorId.value = "";
  ui.collaboratorStatus.value = "true";
  clearCollaboratorFormMessage();
}

async function handleCollaboratorSubmit(event) {
  event.preventDefault();
  clearCollaboratorFormMessage();

  if (!isManagement()) {
    showCollaboratorFormMessage("Seu perfil não possui permissão para alterar este cadastro.");
    return;
  }

  const nomeCompleto = ui.collaboratorName.value.trim();
  if (!nomeCompleto) {
    showCollaboratorFormMessage("Informe o nome completo do colaborador.");
    ui.collaboratorName.focus();
    return;
  }

  const payload = {
    nomeCompleto,
    matricula: ui.collaboratorRegistration.value.trim(),
    cargoFuncao: ui.collaboratorRole.value.trim(),
    setorContrato: ui.collaboratorSector.value.trim(),
    dataAdmissao: ui.collaboratorAdmission.value,
    gestorResponsavel: ui.collaboratorManager.value.trim(),
    ativo: ui.collaboratorStatus.value === "true",
    atualizadoEm: serverTimestamp(),
    atualizadoPor: auth.currentUser.uid,
  };

  const collaboratorId = ui.collaboratorId.value;
  setCollaboratorFormDisabled(true);
  ui.collaboratorSaveButton.classList.remove("hidden");
  ui.collaboratorSaveLabel.textContent = collaboratorId ? "Salvando..." : "Cadastrando...";

  try {
    if (collaboratorId) {
      await updateDoc(doc(db, "colaboradores", collaboratorId), payload);
      showToast("Cadastro do colaborador atualizado.");
    } else {
      await addDoc(collection(db, "colaboradores"), {
        ...payload,
        criadoEm: serverTimestamp(),
        criadoPor: auth.currentUser.uid,
      });
      showToast("Colaborador cadastrado com sucesso.");
    }
    closeCollaboratorDialog();
  } catch (error) {
    console.error("Falha ao salvar colaborador:", error);
    showCollaboratorFormMessage(
      error?.code === "permission-denied"
        ? "O Firestore recusou a gravação. Publique as novas regras de segurança antes de testar."
        : "Não foi possível salvar o colaborador. Tente novamente."
    );
  } finally {
    setCollaboratorFormDisabled(false);
    ui.collaboratorSaveLabel.textContent = "Salvar colaborador";
  }
}

ui.loginForm.addEventListener("submit", handleLogin);
ui.logoutButton.addEventListener("click", handleLogout);
ui.togglePassword.addEventListener("click", togglePasswordVisibility);
ui.menuToggle.addEventListener("click", openMobileMenu);
ui.sidebarBackdrop.addEventListener("click", closeMobileMenu);
ui.backDashboard.addEventListener("click", () => navigateTo("dashboard"));
ui.newCollaboratorButton.addEventListener("click", () => openCollaboratorModal());
ui.collaboratorSearch.addEventListener("input", renderCollaborators);
ui.collaboratorForm.addEventListener("submit", handleCollaboratorSubmit);
ui.closeCollaboratorModal.addEventListener("click", closeCollaboratorDialog);
ui.cancelCollaboratorModal.addEventListener("click", closeCollaboratorDialog);

ui.collaboratorModal.addEventListener("click", (event) => {
  if (event.target === ui.collaboratorModal) closeCollaboratorDialog();
});

ui.navItems.forEach((item) => {
  item.addEventListener("click", () => navigateTo(item.dataset.module));
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeMobileMenu();
    if (!ui.collaboratorModal.classList.contains("hidden")) closeCollaboratorDialog();
  }
});

try {
  await setPersistence(auth, browserLocalPersistence);
} catch (error) {
  console.warn("Não foi possível configurar persistência local:", error);
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    stopCollaboratorsListener?.();
    stopCollaboratorsListener = null;
    collaborators = [];
    currentUserProfile = null;
    showLogin();
    return;
  }

  ui.loadingScreen.classList.remove("hidden");
  ui.loginView.classList.add("hidden");
  ui.appView.classList.add("hidden");
  await handleAuthenticatedUser(user);
});
