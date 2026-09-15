const firebaseConfig = {
    apiKey: "AIzaSyByB4JxeYLrucEadyXGH3_U4_NxfOyrQD8",
    authDomain: "control-horas-60814.firebaseapp.com",
    projectId: "control-horas-60814",
    storageBucket: "control-horas-60814.firebasestorage.app",
    messagingSenderId: "516941797220",
    appId: "1:516941797220:web:5f930ee2de2e22cfa74c71",
    measurementId: "G-CDN4BE2423"
};

const isConfigValid = !firebaseConfig.apiKey.includes("TU_API");

let db = null;
let auth = null;
let currentUser = null;

if (isConfigValid) {
    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        } else {
            firebase.app();
        }
        db = firebase.firestore();
        auth = firebase.auth();
    } catch (e) {
        console.warn("No se pudo inicializar Firebase, usando modo offline con datos de prueba.", e);
    }
}

const quartersData = [
    {
        id: 'Q1',
        name: 'Q1',
        months: [
            { key: '01', name: 'Enero' },
            { key: '02', name: 'Febrero' },
            { key: '03', name: 'Marzo' }
        ]
    },
    {
        id: 'Q2',
        name: 'Q2',
        months: [
            { key: '04', name: 'Abril' },
            { key: '05', name: 'Mayo' },
            { key: '06', name: 'Junio' }
        ]
    },
    {
        id: 'Q3',
        name: 'Q3',
        months: [
            { key: '07', name: 'Julio' },
            { key: '08', name: 'Agosto' },
            { key: '09', name: 'Septiembre' }
        ]
    },
    {
        id: 'Q4',
        name: 'Q4',
        months: [
            { key: '10', name: 'Octubre' },
            { key: '11', name: 'Noviembre' },
            { key: '12', name: 'Diciembre' }
        ]
    }
];

const defaultTasks = [
    { id: '1', desc: 'Monthly bag', hours: 10, date: '2026-01-01', notes: 'Bolsa de horas base mensual automática.', month: '01' },
    { id: '2', desc: 'Changes on live assets (header)', hours: -2, date: '2026-01-10', notes: 'Actualización y corrección de cabecera en producción.', month: '01' },
    { id: '3', desc: 'Issues with promotional codes', hours: -3, date: '2026-01-15', notes: 'Depuración y solución de códigos de descuento inválidos.', month: '01' },
    { id: '4', desc: 'Teams requests + meetings', hours: -5, date: '2026-01-28', notes: 'Reuniones de coordinación y requerimientos del cliente.', month: '01' },
    { id: '5', desc: 'Monthly bag', hours: 10, date: '2026-02-01', notes: 'Bolsa de horas base mensual automática.', month: '02' },
    { id: '6', desc: 'Teams requests + meetings', hours: -5, date: '2026-02-12', notes: 'Seguimiento de proyectos y planning semanal.', month: '02' },
    { id: '7', desc: 'Price update process and review', hours: -5, date: '2026-02-22', notes: 'Revisión y carga de tarifas actualizadas en catálogo.', month: '02' },
    { id: '8', desc: 'Monthly bag', hours: 10, date: '2026-03-01', notes: 'Bolsa de 10 horas agregada automáticamente para el mes.', month: '03' },
    { id: '9', desc: 'Investigation of no-showing products/images', hours: -3, date: '2026-03-09', notes: 'Auditoría de imágenes rotas en la API de productos.', month: '03' },
    { id: '10', desc: 'Teams requests + meetings', hours: -4, date: '2026-03-18', notes: 'Alineación de objetivos Q1 y revisión de entregables.', month: '03' },
    { id: '11', desc: 'Update of low-fat products', hours: -3, date: '2026-03-27', notes: 'Etiquetado nutricional y actualización masiva.', month: '03' }
];

let tasks = [];
let expandedQuarters = {
    'Q1': true,
    'Q2': false,
    'Q3': false,
    'Q4': false
};

function checkConfig() {
    if (!isConfigValid) {
        document.getElementById('config-banner').classList.remove('hidden');
    }
}

function initFirebaseSync() {
    checkConfig();
    if (!isConfigValid || !auth) {
        loadFromLocalStorageFallback();
        return;
    }

    auth.onAuthStateChanged((user) => {
        currentUser = user;
        updateAuthUI();
        listenToTasksFirestore();
    }, (error) => {
        console.warn("Auth state error, falling back to local storage:", error);
        loadFromLocalStorageFallback();
    });
}

function updateAuthUI() {
    const userInfo = document.getElementById('user-info');
    const loginGuestBtn = document.getElementById('login-guest-btn');
    const guestWarningBanner = document.getElementById('guest-warning-banner');
    const addBtnTop = document.getElementById('add-task-btn');
    const bottomActionBar = document.getElementById('bottom-action-bar');

    if (currentUser) {
        userInfo.classList.remove('hidden');
        userInfo.classList.add('flex');
        loginGuestBtn.classList.add('hidden');
        guestWarningBanner.classList.add('hidden');
        addBtnTop.classList.remove('hidden');
        bottomActionBar.classList.remove('hidden');
    } else {
        userInfo.classList.add('hidden');
        loginGuestBtn.classList.remove('hidden');
        guestWarningBanner.classList.remove('hidden');
        addBtnTop.classList.add('hidden');
        bottomActionBar.classList.add('hidden');

        if (!isConfigValid) {
            document.getElementById('config-banner').classList.remove('hidden');
        }
    }
    renderApp();
}

function loginWithGoogle() {
    if (!auth) {
        alert("Firebase Auth no está configurado en app.js.");
        closeLoginModal();
        return;
    }
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .then(() => {
            closeLoginModal();
        })
        .catch((error) => {
            console.error("Error en Google Auth:", error);
            alert("No se pudo completar el inicio de sesión con Google: " + error.message);
        });
}

function logoutFirebase() {
    if (!auth) {
        currentUser = null;
        updateAuthUI();
        return;
    }
    auth.signOut().then(() => {
        location.reload();
    });
}

function openLoginModal() {
    document.getElementById('login-modal').classList.remove('hidden');
}

function closeLoginModal() {
    document.getElementById('login-modal').classList.add('hidden');
}

function listenToTasksFirestore() {
    if (!db) {
        loadFromLocalStorageFallback();
        return;
    }
    db.collection("tasks")
      .onSnapshot((snapshot) => {
          tasks = [];
          snapshot.forEach((doc) => {
              tasks.push({ id: doc.id, ...doc.data() });
          });

          if (tasks.length === 0) {
              seedDefaultTasksToFirestore();
          } else {
              ensureMonthlyBagsFirestore();
              renderApp();
          }
      }, (error) => {
          console.error("Error leyendo Firestore, usando datos de prueba locales:", error);
          loadFromLocalStorageFallback();
      });
}

function seedDefaultTasksToFirestore() {
    if (!db) return;
    const batch = db.batch();
    defaultTasks.forEach(task => {
        const docRef = db.collection("tasks").doc(task.id);
        batch.set(docRef, task);
    });
    batch.commit();
}

function ensureMonthlyBagsFirestore() {
    if (!db) return;
    quartersData.forEach(q => {
        q.months.forEach(m => {
            const hasBag = tasks.some(t => (t.month === m.key || (t.date && t.date.substring(5, 7) === m.key)) && t.desc.toLowerCase().includes('monthly bag'));
            if (!hasBag) {
                const newBagId = 'auto_' + m.key + '_' + Date.now();
                const newBag = {
                    desc: 'Monthly bag',
                    hours: 10,
                    date: `2026-${m.key}-01`,
                    notes: 'Bolsa de 10 horas agregada automáticamente para el mes.',
                    month: m.key
                };
                db.collection("tasks").doc(newBagId).set(newBag);
            }
        });
    });
}

function loadFromLocalStorageFallback() {
    const saved = localStorage.getItem('timetracker_tasks_test');
    if (saved) {
        tasks = JSON.parse(saved);
    } else {
        tasks = JSON.parse(JSON.stringify(defaultTasks));
    }
    ensureMonthlyBagsLocal();
    renderApp();
}

function ensureMonthlyBagsLocal() {
    let modified = false;
    quartersData.forEach(q => {
        q.months.forEach(m => {
            const hasBag = tasks.some(t => (t.month === m.key || (t.date && t.date.substring(5, 7) === m.key)) && t.desc.toLowerCase().includes('monthly bag'));
            if (!hasBag) {
                tasks.push({
                    id: 'auto_' + m.key + '_' + Math.random(),
                    desc: 'Monthly bag',
                    hours: 10,
                    date: `2026-${m.key}-01`,
                    notes: 'Bolsa de 10 horas agregada automáticamente para el mes.',
                    month: m.key
                });
                modified = true;
            }
        });
    });
    if (modified) saveToLocalStorage();
}

function saveToLocalStorage() {
    localStorage.setItem('timetracker_tasks_test', JSON.stringify(tasks));
}

function toggleQuarter(quarterId) {
    expandedQuarters[quarterId] = !expandedQuarters[quarterId];
    renderApp();
}

function resetDataInFirebase() {
    if (!currentUser && isConfigValid) {
        alert("Debes iniciar sesión con Google para restablecer los datos.");
        openLoginModal();
        return;
    }
    if (confirm('¿Desea restablecer todas las tareas a los valores iniciales de prueba?')) {
        if (isConfigValid && db) {
            db.collection("tasks").get().then((querySnapshot) => {
                const batch = db.batch();
                querySnapshot.forEach((doc) => batch.delete(doc.ref));
                batch.commit().then(() => seedDefaultTasksToFirestore());
            });
        } else {
            localStorage.removeItem('timetracker_tasks_test');
            tasks = JSON.parse(JSON.stringify(defaultTasks));
            ensureMonthlyBagsLocal();
            renderApp();
        }
    }
}

function renderApp() {
    const container = document.getElementById('quarters-container');
    container.innerHTML = '';

    let runningBalance = 0;

    quartersData.forEach(quarter => {
        const isExpanded = !!expandedQuarters[quarter.id];

        let tempBalance = runningBalance;
        quarter.months.forEach(month => {
            const monthTasks = tasks.filter(t => {
                if (t.month) return t.month === month.key;
                if (t.date) return t.date.substring(5, 7) === month.key;
                return false;
            });
            monthTasks.forEach(task => tempBalance += Number(task.hours));
        });
        const quarterEndingBalance = tempBalance;

        const quarterDiv = document.createElement('div');
        quarterDiv.className = 'bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden';

        let quarterHtml = `
            <div class="flex flex-col md:flex-row cursor-pointer select-none group" onclick="toggleQuarter('${quarter.id}')">
                <div class="bg-[#00ff88] group-hover:bg-[#00e078] transition-colors text-slate-950 font-extrabold text-xl md:w-28 flex items-center justify-between px-5 py-4 md:py-0 tracking-wider shadow-inner">
                    <span>${quarter.name}</span>
                    <i class="fa-solid fa-chevron-down text-sm transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}"></i>
                </div>
                <div class="flex-1 px-6 py-4 flex items-center justify-between bg-slate-50/50">
                    <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        ${isExpanded ? 'Haga clic para contraer trimestre' : 'Trimestre contraído (Haga clic para expandir)'}
                    </span>
                    <div class="flex items-center space-x-2 text-xs font-bold text-slate-700">
                        <span class="text-slate-400 font-normal">Balance final Q:</span>
                        <span class="px-2.5 py-1 rounded-md ${quarterEndingBalance < 0 ? 'bg-rose-100 text-rose-700 border border-rose-300' : 'bg-emerald-100 text-slate-900 border border-emerald-300'}">${quarterEndingBalance}</span>
                    </div>
                </div>
            </div>
        `;

        if (isExpanded) {
            quarterHtml += `<div class="p-4 sm:p-6 space-y-8 border-t border-slate-100">`;

            quarter.months.forEach(month => {
                const monthTasks = tasks.filter(t => {
                    if (t.month) return t.month === month.key;
                    if (t.date) return t.date.substring(5, 7) === month.key;
                    return false;
                });

                const balanceBeforeMonth = runningBalance;

                quarterHtml += `
                    <div class="border-b border-slate-100 pb-6 last:border-b-0 last:pb-0">
                        <div class="flex justify-between items-center mb-3">
                            <div class="flex items-center space-x-3">
                                <h4 class="font-bold text-slate-900 text-base sm:text-lg">${month.name}</h4>
                                <span class="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium border border-slate-200" title="Arrastre del mes anterior">
                                    Arrastre: ${balanceBeforeMonth >= 0 ? '+' : ''}${balanceBeforeMonth}h
                                </span>
                            </div>
                            <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Balance</span>
                        </div>
                        <div class="space-y-2.5">
                `;

                if (monthTasks.length === 0) {
                    quarterHtml += `
                        <div class="text-xs text-slate-400 italic py-2 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            Sin tareas registradas para ${month.name}.
                        </div>
                    `;
                }

                monthTasks.forEach(task => {
                    runningBalance += Number(task.hours);
                    const isPositiveOrZero = task.hours >= 0;
                    const formattedHours = isPositiveOrZero ? `+${task.hours}` : `${task.hours}`;
                    const isMonthlyBag = task.desc.toLowerCase().includes('monthly bag');

                    const taskBgClass = isMonthlyBag ? 'bg-[#00ff88] text-slate-950 border-emerald-400 font-medium' : 'bg-white text-slate-800 border-slate-900';
                    const balanceIsNegative = runningBalance < 0;
                    const balanceBoxClass = balanceIsNegative 
                        ? 'border border-rose-500 text-rose-600 bg-rose-50 font-bold' 
                        : 'border border-[#00ff88] text-slate-900 bg-white font-bold';

                    const showActions = currentUser !== null;

                    quarterHtml += `
                        <div class="flex items-center justify-between group">
                            <div class="flex-1 mr-3 relative flex items-center justify-between border-2 ${taskBgClass} rounded-lg px-4 py-3 shadow-xs transition hover:shadow-md cursor-pointer task-item-row"
                                 data-notes="${escapeHtml(task.notes || 'Sin notas')}"
                                 data-date="${task.date || 'No especificada'}">
                                <div class="flex items-center space-x-3 pr-2 overflow-hidden">
                                    <span class="text-sm truncate">${escapeHtml(task.desc)}</span>
                                </div>
                                <div class="flex items-center space-x-3 shrink-0">
                                    <span class="text-sm font-semibold">${formattedHours}</span>
                                    ${showActions ? `
                                        <div class="opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1.5 ml-2">
                                            <button onclick="event.stopPropagation(); openModal('${task.id}')" title="Editar" class="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center text-xs">
                                                <i class="fa-solid fa-pen"></i>
                                            </button>
                                            <button onclick="event.stopPropagation(); deleteTask('${task.id}')" title="Eliminar" class="w-6 h-6 rounded bg-rose-100 hover:bg-rose-200 text-rose-700 flex items-center justify-center text-xs">
                                                <i class="fa-solid fa-trash"></i>
                                            </button>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                            <div class="w-16 sm:w-20 h-11 rounded-lg ${balanceBoxClass} flex items-center justify-center text-sm shrink-0 shadow-xs">
                                ${runningBalance}
                            </div>
                        </div>
                    `;
                });

                const totalIsNegative = runningBalance < 0;
                const totalBarClass = totalIsNegative ? 'bg-rose-50 text-rose-600 border border-rose-200 font-bold' : 'bg-slate-100 text-slate-700 font-bold';

                quarterHtml += `
                        </div>
                        <div class="mt-3 flex items-center justify-between px-4 py-2.5 rounded-lg ${totalBarClass} text-xs">
                            <span>Balance acumulado ${month.name} (se arrastra al mes siguiente):</span>
                            <span class="text-sm">${runningBalance}</span>
                        </div>
                    </div>
                `;
            });

            quarterHtml += `</div>`;
        }

        quarterDiv.innerHTML = quarterHtml;
        container.appendChild(quarterDiv);
    });

    attachDynamicEventListeners();
}

function openModal(taskId = null) {
    if (!currentUser) {
        openLoginModal();
        return;
    }
    const modal = document.getElementById('task-modal');
    const form = document.getElementById('task-form');
    const titleEl = document.getElementById('modal-title');
    
    form.reset();
    document.getElementById('task-id').value = '';

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('task-date').value = today;

    if (taskId) {
        const task = tasks.find(t => t.id === taskId);
        if (task) {
            titleEl.innerHTML = `<i class="fa-solid fa-pen-to-square text-[#00ff88]"></i><span>Editar Tarea</span>`;
            document.getElementById('task-id').value = task.id;
            document.getElementById('task-desc').value = task.desc;
            document.getElementById('task-hours').value = task.hours;
            document.getElementById('task-date').value = task.date || '2026-01-01';
            document.getElementById('task-notes').value = task.notes || '';
        }
    } else {
        titleEl.innerHTML = `<i class="fa-solid fa-file-circle-plus text-[#00ff88]"></i><span>Agregar Nueva Tarea</span>`;
    }

    modal.classList.remove('hidden');
}

function closeModal() {
    document.getElementById('task-modal').classList.add('hidden');
}

function deleteTask(id) {
    if (!currentUser) {
        openLoginModal();
        return;
    }
    if (confirm('¿Está seguro de que desea eliminar esta tarea?')) {
        if (isConfigValid && db) {
            db.collection("tasks").doc(id).delete();
        } else {
            tasks = tasks.filter(t => t.id !== id);
            saveToLocalStorage();
            renderApp();
        }
    }
}

function handleFormSubmit(e) {
    e.preventDefault();
    if (!currentUser) {
        openLoginModal();
        return;
    }

    const id = document.getElementById('task-id').value;
    const desc = document.getElementById('task-desc').value.trim();
    const hours = parseFloat(document.getElementById('task-hours').value);
    const date = document.getElementById('task-date').value;
    const notes = document.getElementById('task-notes').value.trim();
    const monthKey = date ? date.substring(5, 7) : '01';

    const taskId = id || Date.now().toString();
    const taskPayload = {
        id: taskId,
        desc,
        hours,
        date,
        notes,
        month: monthKey
    };

    if (isConfigValid && db) {
        db.collection("tasks").doc(taskId).set(taskPayload, { merge: true })
            .then(() => closeModal())
            .catch((error) => alert("Error al guardar: " + error.message));
    } else {
        const index = tasks.findIndex(t => t.id === taskId);
        if (index >= 0) {
            tasks[index] = taskPayload;
        } else {
            tasks.push(taskPayload);
        }
        saveToLocalStorage();
        closeModal();
        renderApp();
    }
}

function attachDynamicEventListeners() {
    const tooltip = document.getElementById('task-tooltip');
    const tooltipNotes = document.getElementById('tooltip-notes');
    const tooltipDate = document.getElementById('tooltip-date');

    document.querySelectorAll('.task-item-row').forEach(row => {
        row.onmouseenter = (event) => {
            const notes = row.getAttribute('data-notes');
            const date = row.getAttribute('data-date');
            tooltipNotes.textContent = notes;
            tooltipDate.textContent = `Fecha: ${date}`;
            tooltip.classList.remove('hidden');
            updateTooltipPosition(event);
        };
        row.onmousemove = (event) => {
            updateTooltipPosition(event);
        };
        row.onmouseleave = () => {
            tooltip.classList.add('hidden');
        };
    });
}

function updateTooltipPosition(event) {
    const tooltip = document.getElementById('task-tooltip');
    const offsetX = 15;
    const offsetY = 15;
    let x = event.clientX + offsetX;
    let y = event.clientY + offsetY;

    const rect = tooltip.getBoundingClientRect();
    if (x + rect.width > window.innerWidth) x = event.clientX - rect.width - offsetX;
    if (y + rect.height > window.innerHeight) y = event.clientY - rect.height - offsetY;

    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
}

function escapeHtml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

window.onload = function() {
    initFirebaseSync();
};