// ============================================================
// Agenda Serrano — lógica principal
// Usa el SDK modular de Firebase directo desde CDN (funciona
// tal cual en GitHub Pages, sin paso de build).
// ============================================================
import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, setDoc, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const DEFAULT_AVATAR = "https://api.dicebear.com/7.x/initials/svg?seed=US&backgroundColor=E4763B";

// ---------- Elementos ----------
const screenLogin = document.getElementById('screen-login');
const screenApp = document.getElementById('screen-app');
const formLogin = document.getElementById('form-login');
const loginError = document.getElementById('login-error');

const userAvatar = document.getElementById('user-avatar');
const btnLogout = document.getElementById('btn-logout');
const btnSettings = document.getElementById('btn-settings');

const taskList = document.getElementById('task-list');
const emptyState = document.getElementById('empty-state');
const progressLabel = document.getElementById('progress-label');
const emberFill = document.getElementById('ember-fill');

const filterBtns = document.querySelectorAll('.filter-btn');
const btnNewTask = document.getElementById('btn-new-task');
const modalTask = document.getElementById('modal-task');
const formTask = document.getElementById('form-task');
const modalTaskTitle = document.getElementById('modal-task-title');
const taskIdInput = document.getElementById('task-id');
const taskTitleInput = document.getElementById('task-title');
const taskDescInput = document.getElementById('task-desc');

const modalSettings = document.getElementById('modal-settings');
const formSettings = document.getElementById('form-settings');
const settingsNombre = document.getElementById('settings-nombre');
const settingsApellidos = document.getElementById('settings-apellidos');
const settingsAvatar = document.getElementById('settings-avatar');
const settingsAvatarPreview = document.getElementById('settings-avatar-preview');

let currentUser = null;
let currentProfile = null;
let allTasks = [];
let activeFilter = 'all';
let unsubscribeTasks = null;
const profileCache = {}; // uid -> {nombre, apellidos, avatarUrl}

// ---------- Autenticación ----------
formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.classList.add('hidden');
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    loginError.textContent = 'No pudimos iniciar sesión. Revisa el correo y la contraseña.';
    loginError.classList.remove('hidden');
  }
});

btnLogout.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    screenLogin.classList.add('hidden');
    screenApp.classList.remove('hidden');
    await loadOrCreateProfile(user);
    subscribeToTasks();
  } else {
    currentUser = null;
    currentProfile = null;
    if (unsubscribeTasks) unsubscribeTasks();
    screenApp.classList.add('hidden');
    screenLogin.classList.remove('hidden');
    formLogin.reset();
  }
});

// ---------- Perfil ----------
async function loadOrCreateProfile(user) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    currentProfile = snap.data();
  } else {
    currentProfile = { nombre: user.email.split('@')[0], apellidos: '', avatarUrl: '', email: user.email };
    await setDoc(ref, currentProfile);
  }
  profileCache[user.uid] = currentProfile;
  userAvatar.src = currentProfile.avatarUrl || DEFAULT_AVATAR;
}

btnSettings.addEventListener('click', () => {
  settingsNombre.value = currentProfile?.nombre || '';
  settingsApellidos.value = currentProfile?.apellidos || '';
  settingsAvatar.value = currentProfile?.avatarUrl || '';
  settingsAvatarPreview.src = currentProfile?.avatarUrl || DEFAULT_AVATAR;
  modalSettings.classList.remove('hidden');
});

settingsAvatar.addEventListener('input', () => {
  settingsAvatarPreview.src = settingsAvatar.value || DEFAULT_AVATAR;
});

formSettings.addEventListener('submit', async (e) => {
  e.preventDefault();
  const updated = {
    nombre: settingsNombre.value.trim(),
    apellidos: settingsApellidos.value.trim(),
    avatarUrl: settingsAvatar.value.trim(),
    email: currentUser.email
  };
  await setDoc(doc(db, 'users', currentUser.uid), updated);
  currentProfile = updated;
  profileCache[currentUser.uid] = updated;
  userAvatar.src = updated.avatarUrl || DEFAULT_AVATAR;
  modalSettings.classList.add('hidden');
  renderTasks(); // refresca nombres de autor por si cambiaron
});

// ---------- Tareas en tiempo real ----------
function subscribeToTasks() {
  const q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
  unsubscribeTasks = onSnapshot(q, async (snapshot) => {
    allTasks = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    await ensureProfilesLoaded(allTasks);
    renderTasks();
  });
}

async function ensureProfilesLoaded(tasks) {
  const missing = [...new Set(tasks.map(t => t.createdBy))].filter(uid => uid && !profileCache[uid]);
  await Promise.all(missing.map(async (uid) => {
    const snap = await getDoc(doc(db, 'users', uid));
    profileCache[uid] = snap.exists() ? snap.data() : { nombre: 'Alguien', apellidos: '' };
  }));
}

function renderTasks() {
  let tasks = allTasks;
  if (activeFilter === 'pending') tasks = tasks.filter(t => !t.completed);
  if (activeFilter === 'completed') tasks = tasks.filter(t => t.completed);

  taskList.innerHTML = '';
  emptyState.classList.toggle('hidden', tasks.length > 0);

  const total = allTasks.length;
  const done = allTasks.filter(t => t.completed).length;
  progressLabel.textContent = `${done} / ${total} completadas`;
  emberFill.style.width = total ? `${Math.round((done / total) * 100)}%` : '0%';

  for (const task of tasks) {
    taskList.appendChild(renderTaskCard(task));
  }
}

function renderTaskCard(task) {
  const card = document.createElement('div');
  card.className = 'task-card' + (task.completed ? ' completed' : '');

  const author = profileCache[task.createdBy];
  const authorName = author ? `${author.nombre || ''} ${author.apellidos || ''}`.trim() : '';
  const dateStr = task.createdAt?.toDate
    ? task.createdAt.toDate().toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';

  card.innerHTML = `
    <button class="task-check" title="${task.completed ? 'Marcar pendiente' : 'Marcar completada'}">${task.completed ? '✓' : ''}</button>
    <div class="task-body">
      <div class="task-title"></div>
      <div class="task-desc"></div>
      <div class="task-meta"><span class="task-author"></span></div>
    </div>
    <div class="task-side">
      <span class="task-date">${dateStr}</span>
      <div class="task-actions">
        <button data-action="edit" title="Editar">✎</button>
        <button data-action="delete" title="Eliminar">🗑</button>
      </div>
    </div>
  `;
  card.querySelector('.task-title').textContent = task.title;
  const descEl = card.querySelector('.task-desc');
  if (task.description) { descEl.textContent = task.description; } else { descEl.remove(); }
  card.querySelector('.task-author').textContent = authorName ? `Creada por ${authorName}` : '';

  card.querySelector('.task-check').addEventListener('click', () => toggleComplete(task));
  card.querySelector('[data-action="edit"]').addEventListener('click', () => openEditTask(task));
  card.querySelector('[data-action="delete"]').addEventListener('click', () => deleteTask(task));

  return card;
}

async function toggleComplete(task) {
  await updateDoc(doc(db, 'tasks', task.id), {
    completed: !task.completed,
    completedAt: !task.completed ? serverTimestamp() : null
  });
}

async function deleteTask(task) {
  if (!confirm(`¿Eliminar la tarea "${task.title}"?`)) return;
  await deleteDoc(doc(db, 'tasks', task.id));
}

// ---------- Filtros ----------
filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    renderTasks();
  });
});

// ---------- Modal nueva/editar tarea ----------
btnNewTask.addEventListener('click', () => openNewTask());

function openNewTask() {
  modalTaskTitle.textContent = 'Nueva tarea';
  taskIdInput.value = '';
  taskTitleInput.value = '';
  taskDescInput.value = '';
  modalTask.classList.remove('hidden');
  taskTitleInput.focus();
}

function openEditTask(task) {
  modalTaskTitle.textContent = 'Editar tarea';
  taskIdInput.value = task.id;
  taskTitleInput.value = task.title;
  taskDescInput.value = task.description || '';
  modalTask.classList.remove('hidden');
  taskTitleInput.focus();
}

formTask.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = taskIdInput.value;
  const title = taskTitleInput.value.trim();
  const description = taskDescInput.value.trim();
  if (!title) return;

  if (id) {
    await updateDoc(doc(db, 'tasks', id), { title, description });
  } else {
    await addDoc(collection(db, 'tasks'), {
      title,
      description,
      completed: false,
      createdAt: serverTimestamp(),
      completedAt: null,
      createdBy: currentUser.uid
    });
  }
  modalTask.classList.add('hidden');
});

// ---------- Cerrar modales ----------
document.querySelectorAll('[data-close-modal]').forEach(btn => {
  btn.addEventListener('click', () => {
    modalTask.classList.add('hidden');
    modalSettings.classList.add('hidden');
  });
});
[modalTask, modalSettings].forEach(modal => {
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });
});
