/* =============================================================
   Team Tasks Management System — Frontend Logic
   static/script.js
============================================================= */

'use strict';

/* ----------------------------------------------------------------
   State
---------------------------------------------------------------- */
const state = {
  tasks:          [],           // All tasks from API
  currentFilter:  '',           // Status filter
  priorityFilter: '',           // Priority filter
  searchQuery:    '',           // Search text
  editingTaskId:  null,         // null = create mode, id = edit mode
};

/* ----------------------------------------------------------------
   DOM references (resolved once DOM is ready)
---------------------------------------------------------------- */
let dom = {};

function resolveDOM() {
  dom = {
    // Sidebar & layout
    sidebar:        document.getElementById('sidebar'),
    sidebarOverlay: document.getElementById('sidebar-overlay'),
    hamburger:      document.getElementById('hamburger'),
    themeToggle:    document.getElementById('dark-mode-toggle'),
    dateDisplay:    document.getElementById('date-display'),

    // Stats
    statTotal:      document.getElementById('stat-total'),
    statPending:    document.getElementById('stat-pending'),
    statProgress:   document.getElementById('stat-progress'),
    statCompleted:  document.getElementById('stat-completed'),

    // Nav badges
    navPending:     document.getElementById('nav-pending'),
    navProgress:    document.getElementById('nav-progress'),
    navCompleted:   document.getElementById('nav-completed'),

    // Filters
    filterTabs:     document.querySelectorAll('.filter-tab'),
    priorityFilter: document.getElementById('priority-filter'),
    searchInput:    document.getElementById('search-input'),
    visibleCount:   document.getElementById('visible-count'),

    // Task grid
    tasksGrid:      document.getElementById('tasks-grid'),
    emptyState:     document.getElementById('empty-state'),

    // Modal
    modalOverlay:   document.getElementById('modal-overlay'),
    taskModal:      document.getElementById('task-modal'),
    modalTitle:     document.getElementById('modal-title'),
    openModalBtn:   document.getElementById('open-modal-btn'),
    closeModalBtn:  document.getElementById('close-modal-btn'),
    cancelBtn:      document.getElementById('cancel-btn'),
    taskForm:       document.getElementById('task-form'),
    submitBtn:      document.getElementById('submit-btn'),
    emptyAddBtn:    document.getElementById('empty-add-btn'),

    // Form fields
    taskId:         document.getElementById('task-id'),
    taskTitle:      document.getElementById('task-title'),
    taskDesc:       document.getElementById('task-desc'),
    taskAssigned:   document.getElementById('task-assigned'),
    taskDue:        document.getElementById('task-due'),
    taskStatus:     document.getElementById('task-status'),
    taskPriority:   document.getElementById('task-priority'),

    // Field errors
    titleError:     document.getElementById('title-error'),
    assignedError:  document.getElementById('assigned-error'),

    // Toast
    toastContainer: document.getElementById('toast-container'),

    // Nav links
    navLinks:       document.querySelectorAll('.nav-link[data-filter]'),
  };
}

/* ================================================================
   API Helpers
================================================================ */

async function apiFetch(url, options = {}) {
  const defaults = {
    headers: { 'Content-Type': 'application/json' },
  };
  const response = await fetch(url, { ...defaults, ...options });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Network error' }));
    throw new Error(err.error || `HTTP ${response.status}`);
  }
  return response.json();
}

const api = {
  fetchTasks:  ()       => apiFetch('/api/tasks'),
  fetchStats:  ()       => apiFetch('/api/stats'),
  createTask:  (data)   => apiFetch('/api/tasks', { method: 'POST', body: JSON.stringify(data) }),
  updateTask:  (id, d)  => apiFetch(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteTask:  (id)     => apiFetch(`/api/tasks/${id}`, { method: 'DELETE' }),
};

/* ================================================================
   Render Functions
================================================================ */

/** Return the filtered + searched subset of state.tasks */
function getFilteredTasks() {
  return state.tasks.filter(task => {
    const matchStatus   = !state.currentFilter  || task.status   === state.currentFilter;
    const matchPriority = !state.priorityFilter || task.priority === state.priorityFilter;
    const q = state.searchQuery.toLowerCase();
    const matchSearch   = !q ||
      task.title.toLowerCase().includes(q)       ||
      (task.description || '').toLowerCase().includes(q) ||
      task.assigned_to.toLowerCase().includes(q);
    return matchStatus && matchPriority && matchSearch;
  });
}

/** Build initials from a name string */
function initials(name) {
  return name.trim().split(/\s+/)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');
}

/** Format a date string to something readable */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Check if a date string is in the past */
function isOverdue(dateStr, status) {
  if (!dateStr || status === 'Completed') return false;
  return new Date(dateStr) < new Date();
}

/** Return badge HTML for a given status */
function statusBadge(status) {
  const map = {
    'Pending':     ['badge-pending',   'Pending'],
    'In Progress': ['badge-progress',  'In Progress'],
    'Completed':   ['badge-completed', 'Completed'],
  };
  const [cls, label] = map[status] || ['badge-pending', status];
  return `<span class="badge ${cls}"><span class="badge-dot"></span>${label}</span>`;
}

/** Return badge HTML for a given priority */
function priorityBadge(priority) {
  const map = {
    'High':   'badge-priority-high',
    'Medium': 'badge-priority-medium',
    'Low':    'badge-priority-low',
  };
  return `<span class="badge ${map[priority] || 'badge-priority-medium'}">${priority}</span>`;
}

/** Build the HTML for a single task card */
function buildCardHTML(task) {
  const overdue = isOverdue(task.due_date, task.status);
  const dueCls  = overdue ? 'due-date overdue' : 'due-date';
  const dueLabel = task.due_date ? formatDate(task.due_date) : 'No due date';
  const dueText  = overdue ? dueLabel + ' (Overdue)' : dueLabel;

  return `
    <div class="task-card"
         data-id="${task.id}"
         data-priority="${task.priority || 'Medium'}"
         style="animation-delay:${Math.random() * .1}s">

      <div class="card-header">
        <h3 class="card-title">${escapeHTML(task.title)}</h3>
        <div class="card-actions">
          <button class="icon-btn edit-btn" title="Edit task" data-id="${task.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="icon-btn delete delete-btn" title="Delete task" data-id="${task.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>
        </div>
      </div>

      <p class="card-description">${escapeHTML(task.description || 'No description provided.')}</p>

      <div class="card-meta">
        ${statusBadge(task.status)}
        ${priorityBadge(task.priority || 'Medium')}
      </div>

      <div class="card-footer">
        <div class="assigned-chip">
          <div class="assigned-avatar">${initials(task.assigned_to)}</div>
          ${escapeHTML(task.assigned_to)}
        </div>
        <span class="${dueCls}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="11" height="11" style="display:inline;vertical-align:middle;margin-right:3px">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          ${dueText}
        </span>
      </div>
    </div>
  `;
}

/** Render the full tasks grid */
function renderTasks() {
  const filtered = getFilteredTasks();
  dom.visibleCount.textContent = filtered.length;

  if (filtered.length === 0) {
    dom.tasksGrid.innerHTML  = '';
    dom.tasksGrid.style.display = 'none';
    dom.emptyState.style.display = 'flex';
    return;
  }

  dom.tasksGrid.style.display = 'grid';
  dom.emptyState.style.display = 'none';
  dom.tasksGrid.innerHTML = filtered.map(buildCardHTML).join('');

  // Attach card action listeners
  dom.tasksGrid.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(parseInt(btn.dataset.id, 10)));
  });
  dom.tasksGrid.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => handleDeleteTask(parseInt(btn.dataset.id, 10)));
  });
}

/** Update the stats cards and nav badges */
function renderStats(stats) {
  animateCounter(dom.statTotal,     stats.total);
  animateCounter(dom.statPending,   stats.pending);
  animateCounter(dom.statProgress,  stats.in_progress);
  animateCounter(dom.statCompleted, stats.completed);

  dom.navPending.textContent  = stats.pending;
  dom.navProgress.textContent = stats.in_progress;
  dom.navCompleted.textContent= stats.completed;
}

/** Animate a number counter from 0 to target */
function animateCounter(el, target) {
  const current = parseInt(el.textContent, 10) || 0;
  if (current === target) return;
  const step  = Math.ceil(Math.abs(target - current) / 18);
  const dir   = target > current ? 1 : -1;
  let   val   = current;
  const tick  = setInterval(() => {
    val += dir * step;
    if ((dir === 1 && val >= target) || (dir === -1 && val <= target)) {
      val = target;
      clearInterval(tick);
    }
    el.textContent = val;
  }, 25);
}

/* ================================================================
   Data Loading
================================================================ */

async function loadData() {
  try {
    const [tasks, stats] = await Promise.all([api.fetchTasks(), api.fetchStats()]);
    state.tasks = tasks;
    renderTasks();
    renderStats(stats);
  } catch (err) {
    showToast('Failed to load tasks: ' + err.message, 'error');
  }
}

/* ================================================================
   Modal
================================================================ */

function openModal() {
  dom.modalOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => dom.taskTitle.focus(), 120);
}

function closeModal() {
  dom.modalOverlay.classList.remove('open');
  document.body.style.overflow = '';
  resetForm();
  state.editingTaskId = null;
}

function resetForm() {
  dom.taskForm.reset();
  dom.taskId.value = '';
  dom.titleError.textContent   = '';
  dom.assignedError.textContent = '';
  dom.taskTitle.classList.remove('error');
  dom.taskAssigned.classList.remove('error');
  dom.modalTitle.textContent  = 'Add New Task';
  dom.submitBtn.textContent   = 'Create Task';
}

function openEditModal(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;

  state.editingTaskId = id;
  dom.modalTitle.textContent  = 'Edit Task';
  dom.submitBtn.textContent   = 'Save Changes';
  dom.taskId.value            = task.id;
  dom.taskTitle.value         = task.title;
  dom.taskDesc.value          = task.description || '';
  dom.taskAssigned.value      = task.assigned_to;
  dom.taskDue.value           = task.due_date    || '';
  dom.taskStatus.value        = task.status;
  dom.taskPriority.value      = task.priority    || 'Medium';

  openModal();
}

/* ================================================================
   Form Submission
================================================================ */

function validateForm() {
  let valid = true;

  dom.titleError.textContent   = '';
  dom.assignedError.textContent = '';
  dom.taskTitle.classList.remove('error');
  dom.taskAssigned.classList.remove('error');

  if (!dom.taskTitle.value.trim()) {
    dom.titleError.textContent   = 'Task title is required.';
    dom.taskTitle.classList.add('error');
    valid = false;
  }
  if (!dom.taskAssigned.value.trim()) {
    dom.assignedError.textContent = 'Please assign this task to someone.';
    dom.taskAssigned.classList.add('error');
    valid = false;
  }
  return valid;
}

async function handleFormSubmit(e) {
  e.preventDefault();
  if (!validateForm()) return;

  const payload = {
    title: dom.taskTitle.value.trim(),
    description: dom.taskDesc.value.trim(),
    assigned_to: dom.taskAssigned.value.trim(),
    due_date:    dom.taskDue.value,
    status:      dom.taskStatus.value,
    priority:    dom.taskPriority.value,
  };

  dom.submitBtn.disabled    = true;
  dom.submitBtn.textContent = 'Saving...';

  try {
    if (state.editingTaskId) {
      await api.updateTask(state.editingTaskId, payload);
      showToast('Task updated successfully!', 'success');
    } else {
      await api.createTask(payload);
      showToast('Task created successfully!', 'success');
    }
    closeModal();
    await loadData();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  } finally {
    dom.submitBtn.disabled    = false;
    dom.submitBtn.textContent = state.editingTaskId ? 'Save Changes' : 'Create Task';
  }
}

/* ================================================================
   Delete
================================================================ */

async function handleDeleteTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;

  showDeleteConfirm(task, id);
}

function showDeleteConfirm(task, id) {
  const modal = document.createElement('div');
  modal.className = 'confirm-overlay';

  modal.innerHTML = `
    <div class="confirm-box">
      <h3>Delete Task</h3>
      <p>Are you sure you want to delete "<b>${task.title}</b>"?</p>

      <div class="confirm-actions">
        <button class="btn btn-ghost" id="cancelDelete">Cancel</button>
        <button class="btn btn-danger" id="confirmDelete">Delete</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('cancelDelete').onclick = () => {
    modal.remove();
  };

  document.getElementById('confirmDelete').onclick = async () => {
    try {
      modal.remove();
      await api.deleteTask(id);
      showToast('Task deleted successfully', 'success');
      await loadData();
    } catch (err) {
      showToast('Error deleting task: ' + err.message, 'error');
    }
  };
}

/* ================================================================
   Toast Notifications
================================================================ */

function showToast(message, type = 'info') {
  const toast  = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  dom.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, 3200);
}

/* ================================================================
   Filter / Search
================================================================ */

function handleFilterTab(e) {
  const tab = e.currentTarget;
  dom.filterTabs.forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  state.currentFilter = tab.dataset.status;

  // Sync sidebar nav active state
  dom.navLinks.forEach(link => {
    link.classList.toggle('active', link.dataset.filter === state.currentFilter);
  });

  renderTasks();
}

function handleNavFilter(e) {
  e.preventDefault();
  const filter = e.currentTarget.dataset.filter;
  state.currentFilter = filter;

  // Sync filter tabs
  dom.filterTabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.status === filter);
  });

  // Sync nav active state
  dom.navLinks.forEach(link => {
    link.classList.toggle('active', link.dataset.filter === filter);
  });

  renderTasks();

  // Close sidebar on mobile
  if (window.innerWidth <= 900) closeSidebar();
}

/* ================================================================
   Sidebar (mobile)
================================================================ */

function openSidebar() {
  dom.sidebar.classList.add('open');
  dom.sidebarOverlay.classList.add('open');
}

function closeSidebar() {
  dom.sidebar.classList.remove('open');
  dom.sidebarOverlay.classList.remove('open');
}

/* ================================================================
   Dark Mode
================================================================ */

function applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  localStorage.setItem('theme', dark ? 'dark' : 'light');
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  applyTheme(!isDark);
}

/* ================================================================
   Utility: HTML Escape
================================================================ */

function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ================================================================
   Date Display in Topbar
================================================================ */

function updateDateDisplay() {
  const now = new Date();
  dom.dateDisplay.textContent = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year:    'numeric',
    month:   'long',
    day:     'numeric',
  });
}

/* ================================================================
   Initialise — Wire up all event listeners
================================================================ */

function init() {
  resolveDOM();

  // Restore saved theme
  const savedTheme = localStorage.getItem('theme') || 'light';
  applyTheme(savedTheme === 'dark');

  updateDateDisplay();

  // ---- Sidebar ----
  dom.hamburger.addEventListener('click', () => {
    dom.sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
  });
  dom.sidebarOverlay.addEventListener('click', closeSidebar);
  dom.themeToggle.addEventListener('click', toggleTheme);
  dom.navLinks.forEach(link => link.addEventListener('click', handleNavFilter));

  // ---- Modal ----
  dom.openModalBtn.addEventListener('click',  openModal);
  dom.closeModalBtn.addEventListener('click', closeModal);
  dom.cancelBtn.addEventListener('click',     closeModal);
  dom.emptyAddBtn.addEventListener('click',   openModal);

  // Close modal on overlay click (outside modal box)
  dom.modalOverlay.addEventListener('click', e => {
    if (e.target === dom.modalOverlay) closeModal();
  });

  // Close modal on Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && dom.modalOverlay.classList.contains('open')) closeModal();
  });

  dom.taskForm.addEventListener('submit', handleFormSubmit);

  // ---- Filter tabs ----
  dom.filterTabs.forEach(tab => tab.addEventListener('click', handleFilterTab));

  // ---- Priority filter ----
  dom.priorityFilter.addEventListener('change', () => {
    state.priorityFilter = dom.priorityFilter.value;
    renderTasks();
  });

  // ---- Search (debounced) ----
  let searchTimer;
  dom.searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.searchQuery = dom.searchInput.value;
      renderTasks();
    }, 250);
  });

  // ---- Load initial data ----
  loadData();
}

// Boot when DOM is ready
document.addEventListener('DOMContentLoaded', init);
