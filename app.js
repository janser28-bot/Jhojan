// ============================================================
// Agenda Serrano — lógica principal
// ============================================================
import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, setDoc, getDoc, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const DEFAULT_AVATAR = "https://api.dicebear.com/7.x/initials/svg?seed=US&backgroundColor=E4763B";
const PRIORITY_LABEL = { alta: 'Alta', media: 'Media', baja: 'Baja' };

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
const taskDueInput = document.getElementById('task-due');
const taskPriorityInput = document.getElementById('task-priority');
const taskTagsInput = document.getElementById('task-tags');
const taskAssigneeInput = document.getElementById('task-assignee');
const taskFileInput = document.getElementById('task-file');
const taskFileCurrent = document.getElementById('task-file-current');
const subtaskListEl = document.getElementById('subtask-list');
const subtaskInput = document.getElementById('subtask-input');
const btnAddSubtask = document.getElementById('btn-add-subtask');

const modalSettings = document.getElementById('modal-settings');
const formSettings = document.getElementById('form-settings');
const settingsNombre = document.getElementById('settings-nombre');
const settingsApellidos = document.getElementById('settings-apellidos');
const settingsAvatarFile = document.getElementById('settings-avatar-file');
const settingsAvatarPreview = document.getElementById('settings-avatar-preview');
const settingsAvatarStatus = document.getElementById('settings-avatar-status');

let currentUser = null;
let currentProfile = null;
let allTasks = [];
let activeFilter = 'all';
let unsubscribeTasks = null;
let currentSubtasks = [];
let currentAttachment = null;
const profileCache = {};
let allUsers = [];

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
    await loadAllUsers();
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
  const ref_ = doc(db, 'users', user.uid);
  const snap = await getDoc(ref_);
  if (snap.exists()) {
    currentProfile = snap.data();
  } else {
    currentProfile = { nombre: user.email.split('@')[0], apellidos: '', avatarUrl: '', email: user.email };
    await setDoc(ref_, currentProfile);
  }
  profileCache[user.uid] = currentProfile;
  userAvatar.src = currentProfile.avatarUrl || DEFAULT_AVATAR;
}

async function loadAllUsers() {
  const snap = await getDocs(collection(db, 'users'));
  allUsers = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  allUsers.forEach(u => { profileCache[u.uid] = u; });
  taskAssigneeInput.innerHTML = '<option value="">Sin asignar</option>' +
    allUsers.map(u => `<option value="${u.uid}">${(u.nombre || '') + ' ' + (u.apellidos || '')}</option>`).join('');
}

btnSettings.addEventListener('click', () => {
  settingsNombre.value = currentProfile?.nombre || '';
  settingsApellidos.value = currentProfile?.apellidos || '';
  settingsAvatarFile.value = '';
  settingsAvatarStatus.textContent = '';
  settingsAvatarPreview.src = currentProfile?.avatarUrl || DEFAULT_AVATAR;
  modalSettings.classList.remove('hidden');
});

settingsAvatarFile.addEventListener('change', () => {
  const file = settingsAvatarFile.files[0];
  if (!file) return;
  if (file.size > 3 * 1024 * 1024) {
    settingsAvatarStatus.textContent = 'La imagen debe pesar menos de 3 MB.';
    settingsAvatarFile.value = '';
    return;
  }
  settingsAvatarPreview.src = URL.createObjectURL(file);
  settingsAvatarStatus.textContent = 'Se subirá al guardar.';
});

formSettings.addEventListener('submit', async (e) => {
  e.preventDefault();
  const saveBtn = formSettings.querySelector('button[type="submit"]');
  saveBtn.disabled = true;
  try {
    let avatarUrl = currentProfile?.avatarUrl || '';
    const file = settingsAvatarFile.files[0];
    if (file) {
      settingsAvatarStatus.textContent = 'Subiendo imagen...';
      const path = `avatars/${currentUser.uid}/${Date.now()}-${file.name}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      avatarUrl = await getDownloadURL(storageRef);
    }
    const updated = {
      nombre: settingsNombre.value.trim(),
      apellidos: settingsApellidos.value.trim(),
      avatarUrl,
      email: currentUser.email
    };
    await setDoc(doc(db, 'users', currentUser.uid), updated);
    currentProfile = updated;
    profileCache[currentUser.uid] = updated;
    userAvatar.src = updated.avatarUrl || DEFAULT_AVATAR;
    modalSettings.classList.add('hidden');
    await loadAllUsers();
    renderTasks();
  } catch (err) {
    settingsAvatarStatus.textContent = 'No se pudo subir la imagen. Intenta de nuevo.';
  } finally {
    saveBtn.disabled = false;
  }
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
  const ids = new Set();
  tasks.forEach(t => { if (t.createdBy) ids.add(t.createdBy); if (t.assignedTo) ids.add(t.assignedTo); });
  const missing = [...ids].filter(uid => !profileCache[uid]);
  await Promise.all(missing.map(async (uid) => {
    const snap = await getDoc(doc(db, 'users', uid));
    profileCache[uid] = snap.exists() ? snap.data() : { nombre: 'Alguien', apellidos: '' };
  }));
}

function renderTasks() {
  let tasks = allTasks;
  if (activeFilter === 'pending') tasks = tasks.filter(t => !t.completed);
  if (activeFilter === 'completed') tasks = tasks.filter(t => t.completed);
  if (activeFilter === 'mine') tasks = tasks.filter(t => t.assignedTo === currentUser.uid);

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

function nameOf(uid) {
  const p = profileCache[uid];
  return p ? `${p.nombre || ''} ${p.apellidos || ''}`.trim() : '';
}

function renderTaskCard(task) {
  const card = document.createElement('div');
  card.className = 'task-card' + (task.completed ? ' completed' : '');

  const authorName = nameOf(task.createdBy);
  const assigneeName = task.assignedTo ? nameOf(task.assignedTo) : '';

  const createdDate = task.createdAt?.toDate ? task.createdAt.toDate() : null;
  const dateStr = createdDate ? createdDate.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
  const timeStr = createdDate ? createdDate.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '';

  const subtasks = task.subtasks || [];
  const subDone = subtasks.filter(s => s.completed).length;

  const isOverdue = task.dueDate && !task.completed && task.dueDate < todayStr();

  card.innerHTML = `
    <button class="task-check" title="${task.completed ? 'Marcar pendiente' : 'Marcar completada'}">${task.completed ? '✓' : ''}</button>
    <div class="task-body">
      <div class="task-title-row">
        <span class="task-title"></span>
        <span class="badge badge-priority-${task.priority || 'media'}">${PRIORITY_LABEL[task.priority] || 'Media'}</span>
      </div>
      <div class="task-desc"></div>
      <div class="task-tags"></div>
      ${subtasks.length ? `
        <div class="subtask-progress">Subtareas: ${subDone}/${subtasks.length}</div>
        <div class="subtask-view-list"></div>
      ` : ''}
      <div class="task-meta">
        <span class="task-author">${authorName ? `Creada por ${authorName}` : ''}</span>
        ${assigneeName ? `<span class="badge badge-assignee">👤 ${assigneeName}</span>` : ''}
        ${task.dueDate ? `<span class="badge ${isOverdue ? 'badge-overdue' : 'badge-due'}">📅 ${formatDueDate(task.dueDate)}</span>` : ''}
        ${task.attachmentUrl ? `<a class="badge badge-attachment" href="${task.attachmentUrl}" target="_blank" rel="noopener">📎 ${escapeHtml(task.attachmentName || 'Archivo')}</a>` : ''}
        ${task.dueDate ? `<a class="badge badge-calendar" target="_blank" rel="noopener">📆 Agregar a Calendar</a>` : ''}
      </div>
    </div>
    <div class="task-side">
      <span class="task-date">${dateStr}${timeStr ? ' · ' + timeStr : ''}</span>
      <div class="task-actions">
        <button data-action="edit" title="Editar">✎</button>
        <button data-action="delete" title="Eliminar">🗑</button>
      </div>
    </div>
  `;
  card.querySelector('.task-title').textContent = task.title;
  const descEl = card.querySelector('.task-desc');
  if (task.description) { descEl.textContent = task.description; } else { descEl.remove(); }

  const tagsEl = card.querySelector('.task-tags');
  if (task.tags && task.tags.length) {
    tagsEl.innerHTML = task.tags.map(t => `<span class="tag-chip">#${escapeHtml(t)}</span>`).join('');
  } else {
    tagsEl.remove();
  }

  if (subtasks.length) {
    const subView = card.querySelector('.subtask-view-list');
    subtasks.forEach((s, i) => {
      const row = document.createElement('div');
      row.className = 'subtask-view-row';
      row.innerHTML = `<input type="checkbox" ${s.completed ? 'checked' : ''}> <span class="${s.completed ? 'done' : ''}"></span>`;
      row.querySelector('span').textContent = s.title;
      row.querySelector('input').addEventListener('change', () => toggleSubtask(task, i));
      subView.appendChild(row);
    });
  }

  if (task.dueDate) {
    const calLink = card.querySelector('.badge-calendar');
    if (calLink) calLink.href = googleCalendarUrl(task);
  }

  card.querySelector('.task-check').addEventListener('click', () => toggleComplete(task));
  card.querySelector('[data-action="edit"]').addEventListener('click', () => openEditTask(task));
  card.querySelector('[data-action="delete"]').addEventListener('click', () => deleteTask(task));

  return card;
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function formatDueDate(dueDate) {
  const [y, m, d] = dueDate.split('-');
  return `${d}/${m}/${y}`;
}

function googleCalendarUrl(task) {
  const [y, m, d] = task.dueDate.split('-');
  const dateCompact = `${y}${m}${d}`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: task.title,
    dates: `${dateCompact}/${dateCompact}`,
    details: task.description || 'Tarea de Agenda Serrano'
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

async function toggleComplete(task) {
  await updateDoc(doc(db, 'tasks', task.id), {
    completed: !task.completed,
    completedAt: !task.completed ? serverTimestamp() : null
  });
}

async function toggleSubtask(task, index) {
  const subtasks = [...(task.subtasks || [])];
  subtasks[index] = { ...subtasks[index], completed: !subtasks[index].completed };
  await updateDoc(doc(db, 'tasks', task.id), { subtasks });
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

// ---------- Subtareas dentro del modal ----------
function renderSubtaskEditor() {
  subtaskListEl.innerHTML = '';
  currentSubtasks.forEach((s, i) => {
    const row = document.createElement('div');
    row.className = 'subtask-edit-row';
    row.innerHTML = `<span></span><button type="button" title="Quitar">✕</button>`;
    row.querySelector('span').textContent = s.title;
    row.querySelector('button').addEventListener('click', () => {
      currentSubtasks.splice(i, 1);
      renderSubtaskEditor();
    });
    subtaskListEl.appendChild(row);
  });
}

btnAddSubtask.addEventListener('click', () => {
  const title = subtaskInput.value.trim();
  if (!title) return;
  currentSubtasks.push({ title, completed: false });
  subtaskInput.value = '';
  renderSubtaskEditor();
});
subtaskInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); btnAddSubtask.click(); }
});

// ---------- Modal nueva/editar tarea ----------
btnNewTask.addEventListener('click', () => openNewTask());

function openNewTask() {
  modalTaskTitle.textContent = 'Nueva tarea';
  taskIdInput.value = '';
  taskTitleInput.value = '';
  taskDescInput.value = '';
  taskDueInput.value = '';
  taskPriorityInput.value = 'media';
  taskTagsInput.value = '';
  taskAssigneeInput.value = '';
  taskFileInput.value = '';
  taskFileCurrent.classList.add('hidden');
  currentSubtasks = [];
  currentAttachment = null;
  renderSubtaskEditor();
  modalTask.classList.remove('hidden');
  taskTitleInput.focus();
}

function openEditTask(task) {
  modalTaskTitle.textContent = 'Editar tarea';
  taskIdInput.value = task.id;
  taskTitleInput.value = task.title;
  taskDescInput.value = task.description || '';
  taskDueInput.value = task.dueDate || '';
  taskPriorityInput.value = task.priority || 'media';
  taskTagsInput.value = (task.tags || []).join(', ');
  taskAssigneeInput.value = task.assignedTo || '';
  taskFileInput.value = '';
  currentAttachment = task.attachmentUrl ? { url: task.attachmentUrl, name: task.attachmentName } : null;
  if (currentAttachment) {
    taskFileCurrent.textContent = `Archivo actual: ${currentAttachment.name}`;
    taskFileCurrent.classList.remove('hidden');
  } else {
    taskFileCurrent.classList.add('hidden');
  }
  currentSubtasks = (task.subtasks || []).map(s => ({ ...s }));
  renderSubtaskEditor();
  modalTask.classList.remove('hidden');
  taskTitleInput.focus();
}

formTask.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = taskIdInput.value;
  const title = taskTitleInput.value.trim();
  const description = taskDescInput.value.trim();
  const dueDate = taskDueInput.value || null;
  const priority = taskPriorityInput.value;
  const tags = taskTagsInput.value.split(',').map(t => t.trim()).filter(Boolean);
  const assignedTo = taskAssigneeInput.value || null;
  if (!title) return;

  const saveBtn = formTask.querySelector('button[type="submit"]');
  saveBtn.disabled = true;
  try {
    let attachmentUrl = currentAttachment?.url || null;
    let attachmentName = currentAttachment?.name || null;
    const file = taskFileInput.files[0];
    if (file) {
      if (file.size > 15 * 1024 * 1024) {
        alert('El archivo debe pesar menos de 15 MB.');
        return;
      }
      const path = `tasks/${currentUser.uid}/${Date.now()}-${file.name}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      attachmentUrl = await getDownloadURL(storageRef);
      attachmentName = file.name;
    }

    const payload = {
      title, description, dueDate, priority, tags, assignedTo,
      attachmentUrl, attachmentName,
      subtasks: currentSubtasks
    };

    if (id) {
      await updateDoc(doc(db, 'tasks', id), payload);
    } else {
      await addDoc(collection(db, 'tasks'), {
        ...payload,
        completed: false,
        createdAt: serverTimestamp(),
        completedAt: null,
        createdBy: currentUser.uid
      });
    }
    modalTask.classList.add('hidden');
  } catch (err) {
    alert('No se pudo guardar la tarea. Intenta de nuevo.');
  } finally {
    saveBtn.disabled = false;
  }
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
