// AutoCare Tracker - Application JavaScript

// ============================================
// DATA MANAGEMENT
// ============================================

const AppData = {
    vehicles: [],
    expenses: [],
    settings: {
        currency: 'EUR',
        distanceUnit: 'km',
        oilInterval: 15000,
        brakesInterval: 20000,
        itvInterval: 24,
        tiresInterval: 40000,
        backupReminderDays: 30
    },

    init() {
        this.loadData();
        this.setupEventListeners();
        renderCurrentPage();
        updateDashboard();
        Motion.enterPage(document.querySelector('.page.active'));
        Backup.init();
    },

    loadData() {
        try {
            const vehiclesData = localStorage.getItem('autocare_vehicles');
            const expensesData = localStorage.getItem('autocare_expenses');
            const settingsData = localStorage.getItem('autocare_settings');

            if (vehiclesData) {
                this.vehicles = JSON.parse(vehiclesData).map(normalizeVehicle).filter(Boolean);
            }
            if (expensesData) {
                this.expenses = JSON.parse(expensesData).map(normalizeExpense).filter(Boolean);
            }
            if (settingsData) {
                this.settings = { ...this.settings, ...JSON.parse(settingsData) };
            }
        } catch (error) {
            console.error('Error loading data:', error);
            this.showToast('Error al cargar los datos', 'error');
        }
    },

    saveData() {
        try {
            localStorage.setItem('autocare_vehicles', JSON.stringify(this.vehicles));
            localStorage.setItem('autocare_expenses', JSON.stringify(this.expenses));
            localStorage.setItem('autocare_settings', JSON.stringify(this.settings));
            Backup.onDataChanged();
        } catch (error) {
            console.error('Error saving data:', error);
            this.showToast('Error al guardar los datos', 'error');
        }
    },

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    formatCurrency(amount, decimals = 2) {
        const currency = ['EUR', 'USD', 'GBP'].includes(this.settings.currency) ? this.settings.currency : 'EUR';
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency,
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(parseFloat(amount) || 0);
    },

    getDistanceLabel() {
        return this.settings.distanceUnit === 'mi' ? 'Millas' : 'Kilómetros';
    },

    formatNumber(num) {
        return new Intl.NumberFormat('es-ES').format(num);
    },

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }
};

// ============================================
// SANITIZING
// ============================================

const VALID_ID = /^[a-z0-9]+$/i;

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function isValidDate(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

// Ids end up inside onclick attributes, so anything that is not alphanumeric is replaced
function normalizeVehicle(v) {
    if (!v || typeof v !== 'object') return null;
    const mileage = parseInt(v.mileage) || 0;
    const initialMileage = parseInt(v.initialMileage);
    return {
        id: VALID_ID.test(String(v.id)) ? String(v.id) : AppData.generateId(),
        make: String(v.make ?? '').trim(),
        model: String(v.model ?? '').trim(),
        year: parseInt(v.year) || null,
        plate: String(v.plate ?? '').trim().toUpperCase(),
        mileage: mileage,
        initialMileage: Number.isNaN(initialMileage) ? null : initialMileage,
        registrationDate: isValidDate(v.registrationDate) ? v.registrationDate : '',
        notes: String(v.notes ?? '').trim()
    };
}

function normalizeExpense(e) {
    if (!e || typeof e !== 'object' || !isValidDate(e.date)) return null;
    return {
        id: VALID_ID.test(String(e.id)) ? String(e.id) : AppData.generateId(),
        vehicleId: VALID_ID.test(String(e.vehicleId)) ? String(e.vehicleId) : '',
        date: e.date,
        category: CATEGORIES[e.category] ? e.category : 'other',
        description: String(e.description ?? '').trim(),
        cost: parseFloat(e.cost) || 0,
        mileage: parseInt(e.mileage) || 0,
        shop: String(e.shop ?? '').trim(),
        notes: String(e.notes ?? '').trim()
    };
}

function vehicleName(vehicle, fallback = 'Vehículo eliminado') {
    return vehicle ? escapeHtml(`${vehicle.make} ${vehicle.model}`) : fallback;
}

// ============================================
// NAVIGATION
// ============================================

function renderCurrentPage() {
    const activePage = document.querySelector('.page.active');
    if (!activePage) return;

    const pageId = activePage.id;

    switch (pageId) {
        case 'dashboardPage':
            updateDashboard();
            break;
        case 'vehiclesPage':
            renderVehicles();
            break;
        case 'expensesPage':
            renderExpenses();
            break;
        case 'reportsPage':
            renderReports();
            break;
        case 'settingsPage':
            renderSettings();
            break;
    }
}

function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const viewAllLinks = document.querySelectorAll('.view-all');
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            navigateTo(page);
        });
    });

    viewAllLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.dataset.page;
            navigateTo(page);
        });
    });

    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 992) {
            if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        }
    });
}

function navigateTo(page) {
    const pages = document.querySelectorAll('.page');
    const navItems = document.querySelectorAll('.nav-item');
    const pageTitle = document.getElementById('pageTitle');
    const pageSubtitle = document.getElementById('pageSubtitle');

    pages.forEach(p => p.classList.remove('active'));
    navItems.forEach(item => item.classList.remove('active'));

    const targetPage = document.getElementById(`${page}Page`);
    const targetNav = document.querySelector(`.nav-item[data-page="${page}"]`);

    if (targetPage) {
        targetPage.classList.add('active');
    }

    if (targetNav) {
        targetNav.classList.add('active');
    }

    // Update header title
    const titles = {
        dashboard: { title: 'Dashboard', subtitle: 'Resumen de tus vehículos' },
        vehicles: { title: 'Mis Vehículos', subtitle: 'Gestiona todos tus vehículos' },
        expenses: { title: 'Historial de Gastos', subtitle: 'Todos los gastos registrados' },
        reports: { title: 'Informes', subtitle: 'Analiza tus gastos y mantenimientos' },
        settings: { title: 'Configuración', subtitle: 'Personaliza tu aplicación' }
    };

    if (titles[page]) {
        pageTitle.textContent = titles[page].title;
        pageSubtitle.textContent = titles[page].subtitle;
    }

    // Close sidebar on mobile
    document.getElementById('sidebar').classList.remove('open');

    // Render page content
    renderCurrentPage();
    Motion.enterPage(targetPage);
}

// ============================================
// DASHBOARD
// ============================================

function updateDashboard() {
    const totalVehicles = AppData.vehicles.length;
    const totalExpenses = AppData.expenses.reduce((sum, e) => sum + parseFloat(e.cost), 0);
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const monthlyExpenses = AppData.expenses
        .filter(e => {
            const date = new Date(e.date);
            return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        })
        .reduce((sum, e) => sum + parseFloat(e.cost), 0);

    const alerts = calculateAlerts();

    const formatMoney = v => AppData.formatCurrency(v);
    Motion.countUp(document.getElementById('totalVehicles'), totalVehicles);
    Motion.countUp(document.getElementById('totalExpenses'), totalExpenses, formatMoney);
    Motion.countUp(document.getElementById('monthlyExpenses'), monthlyExpenses, formatMoney);
    Motion.countUp(document.getElementById('pendingAlerts'), alerts.length);

    renderRecentActivity();
    renderAlerts(alerts);
    Backup.renderReminder();
    renderCharts();
}

function calculateAlerts() {
    const alerts = [];

    AppData.vehicles.forEach(vehicle => {
        const vehicleExpenses = AppData.expenses
            .filter(e => e.vehicleId === vehicle.id)
            .sort((a, b) => parseInt(b.mileage) - parseInt(a.mileage));

        const lastMileage = vehicleExpenses.length > 0 
            ? parseInt(vehicleExpenses[0].mileage) 
            : parseInt(vehicle.mileage);

        // Oil change alert
        const lastOilChange = vehicleExpenses.find(e => e.category === 'oil');
        const lastOilMileage = lastOilChange ? parseInt(lastOilChange.mileage) : parseInt(vehicle.mileage);
        const oilDueMileage = lastOilMileage + AppData.settings.oilInterval;

        if (oilDueMileage - lastMileage <= 2000) {
            const status = oilDueMileage <= lastMileage ? 'danger' : 'warning';
            alerts.push({
                vehicle: vehicle,
                type: 'oil',
                title: 'Cambio de aceite',
                message: `${vehicle.make} ${vehicle.model}: ${AppData.formatNumber(oilDueMileage - lastMileage)} ${AppData.settings.distanceUnit} restantes`,
                status: status,
                priority: 1
            });
        }

        // ITV alert
        const nextITV = getNextItvDate(vehicle, vehicleExpenses.find(e => e.category === 'itv'));
        if (nextITV) {
            const daysUntil = Math.ceil((nextITV - new Date()) / (1000 * 60 * 60 * 24));

            if (daysUntil <= 60) {
                const status = daysUntil <= 0 ? 'danger' : 'warning';
                alerts.push({
                    vehicle: vehicle,
                    type: 'itv',
                    title: 'ITV próxima',
                    message: `${vehicle.make} ${vehicle.model}: ${daysUntil <= 0 ? 'vencida' : 'vence en ' + daysUntil + ' días'}`,
                    status: status,
                    priority: 0
                });
            }
        }

        // Tires and brakes alerts (only once there is a previous record)
        const mileageAlerts = [
            { type: 'tires', title: 'Cambio de neumáticos', interval: AppData.settings.tiresInterval, margin: 5000, priority: 2 },
            { type: 'brakes', title: 'Revisión de frenos', interval: AppData.settings.brakesInterval, margin: 2000, priority: 1 }
        ];

        mileageAlerts.forEach(config => {
            const lastRecord = vehicleExpenses.find(e => e.category === config.type && parseInt(e.mileage) > 0);
            if (!lastRecord) return;

            const dueMileage = parseInt(lastRecord.mileage) + config.interval;
            if (dueMileage - lastMileage <= config.margin) {
                alerts.push({
                    vehicle: vehicle,
                    type: config.type,
                    title: config.title,
                    message: `${vehicle.make} ${vehicle.model}: ${AppData.formatNumber(Math.max(0, dueMileage - lastMileage))} ${AppData.settings.distanceUnit} restantes`,
                    status: dueMileage <= lastMileage ? 'danger' : 'warning',
                    priority: config.priority
                });
            }
        });
    });

    return alerts.sort((a, b) => a.priority - b.priority);
}

function parseLocalDate(value) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
}

function addMonths(date, months) {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
}

// Spanish ITV for cars: first at 4 years, every 2 years until 10, then yearly.
// Without a registration date, the interval from Settings is used after the last ITV.
function getNextItvDate(vehicle, lastITV) {
    const registration = vehicle.registrationDate ? parseLocalDate(vehicle.registrationDate) : null;

    if (lastITV) {
        const lastDate = parseLocalDate(lastITV.date);
        if (!registration) {
            return addMonths(lastDate, AppData.settings.itvInterval);
        }
        const ageAtLastITV = (lastDate - registration) / (1000 * 60 * 60 * 24 * 365.25);
        return addMonths(lastDate, ageAtLastITV >= 10 ? 12 : 24);
    }

    if (!registration) return null;

    // No ITV recorded: the next legal date, keeping one that expired in the last
    // 3 months so it shows as overdue
    const limit = addMonths(new Date(), -3);
    for (let years = 4; years < 100; years += years < 10 ? 2 : 1) {
        const due = addMonths(registration, years * 12);
        if (due >= limit) return due;
    }
    return null;
}

function renderRecentActivity() {
    const container = document.getElementById('recentActivity');
    const recentExpenses = [...AppData.expenses]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);

    if (recentExpenses.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No hay actividad reciente</p></div>';
        return;
    }

    container.innerHTML = recentExpenses.map(expense => {
        const vehicle = AppData.vehicles.find(v => v.id === expense.vehicleId);
        const icon = getCategoryIcon(expense.category);

        return `
            <div class="activity-item">
                <div class="activity-icon">${icon}</div>
                <div class="activity-content">
                    <div class="activity-title">${escapeHtml(expense.description)}</div>
                    <div class="activity-meta">${vehicleName(vehicle, 'Vehículo desconocido')} • ${AppData.formatDate(expense.date)}</div>
                </div>
                <div class="activity-amount">${AppData.formatCurrency(expense.cost)}</div>
            </div>
        `;
    }).join('');
}

function renderAlerts(alerts) {
    const container = document.getElementById('alertsList');

    if (alerts.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No hay mantenimientos próximos</p></div>';
        return;
    }

    container.innerHTML = alerts.slice(0, 5).map(alert => `
        <div class="alert-item ${alert.status}">
            <div class="alert-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
            </div>
            <div class="alert-content">
                <div class="alert-title">${escapeHtml(alert.title)}</div>
                <div class="alert-message">${escapeHtml(alert.message)}</div>
            </div>
            <span class="alert-badge">${alert.status === 'danger' ? 'Urgente' : 'Próximo'}</span>
        </div>
    `).join('');
}

// ============================================
// CHARTS
// ============================================

let expensesChart = null;
let vehicleChart = null;
let categoryReportChart = null;
let monthlyReportChart = null;

function renderCharts() {
    renderExpensesChart();
    renderVehicleChart();
}

function renderExpensesChart() {
    const ctx = document.getElementById('expensesChart');
    if (!ctx) return;

    const period = document.getElementById('chartPeriod')?.value || 'all';
    let filteredExpenses = [...AppData.expenses];

    if (period === 'year') {
        const currentYear = new Date().getFullYear();
        filteredExpenses = filteredExpenses.filter(e => new Date(e.date).getFullYear() === currentYear);
    } else if (period === 'month') {
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        filteredExpenses = filteredExpenses.filter(e => {
            const date = new Date(e.date);
            return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        });
    }

    const categories = {};
    filteredExpenses.forEach(e => {
        categories[e.category] = (categories[e.category] || 0) + parseFloat(e.cost);
    });

    const labels = Object.keys(categories).map(c => getCategoryLabel(c));
    const data = Object.values(categories);
    const colors = Object.keys(categories).map(c => getCategoryColor(c));

    if (expensesChart) {
        expensesChart.destroy();
    }

    expensesChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true
                    }
                }
            }
        }
    });
}

function renderVehicleChart() {
    const ctx = document.getElementById('vehicleChart');
    if (!ctx) return;

    const vehicleData = AppData.vehicles.map(vehicle => {
        const vehicleExpenses = AppData.expenses
            .filter(e => e.vehicleId === vehicle.id)
            .reduce((sum, e) => sum + parseFloat(e.cost), 0);
        return {
            name: `${vehicle.make} ${vehicle.model}`,
            total: vehicleExpenses
        };
    }).filter(v => v.total > 0);

    if (vehicleChart) {
        vehicleChart.destroy();
    }

    vehicleChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: vehicleData.map(v => v.name),
            datasets: [{
                label: 'Gastos totales',
                data: vehicleData.map(v => v.total),
                backgroundColor: '#2563EB',
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => AppData.formatCurrency(value)
                    }
                }
            }
        }
    });
}

// ============================================
// VEHICLES
// ============================================

const ROAD_SCENE = `
    <div class="road-scene" aria-hidden="true">
        <div class="road"></div>
        <div class="car">🚗</div>
        <div class="puff"></div>
        <div class="puff"></div>
        <div class="puff"></div>
    </div>`;

function renderVehicles() {
    const container = document.getElementById('vehiclesGrid');

    if (AppData.vehicles.length === 0) {
        container.innerHTML = `
            <div class="empty-state large">
                ${ROAD_SCENE}
                <h3>No tienes vehículos</h3>
                <p>Añade tu primer vehículo para empezar a gestionar sus gastos</p>
                <button class="btn btn-primary" onclick="openVehicleModal()">Añadir Vehículo</button>
            </div>
        `;
        return;
    }

    container.innerHTML = AppData.vehicles.map(vehicle => {
        const vehicleExpenses = AppData.expenses
            .filter(e => e.vehicleId === vehicle.id)
            .reduce((sum, e) => sum + parseFloat(e.cost), 0);
        
        const totalExpenses = vehicleExpenses;
        const lastExpense = AppData.expenses
            .filter(e => e.vehicleId === vehicle.id)
            .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

        const vehicleIcon = getVehicleEmoji(vehicle.make);

        return `
            <div class="vehicle-card" data-id="${vehicle.id}">
                <div class="vehicle-header">
                    <div class="vehicle-image">${vehicleIcon}</div>
                    <div class="vehicle-info">
                        <h3>${vehicleName(vehicle)}</h3>
                        <p>${vehicle.year || 'N/A'} • ${escapeHtml(vehicle.plate)}</p>
                    </div>
                </div>
                <div class="vehicle-stats">
                    <div class="vehicle-stat">
                        <div class="vehicle-stat-value">${AppData.formatNumber(vehicle.mileage)}</div>
                        <div class="vehicle-stat-label">${AppData.getDistanceLabel()}</div>
                    </div>
                    <div class="vehicle-stat">
                        <div class="vehicle-stat-value">${AppData.formatCurrency(totalExpenses)}</div>
                        <div class="vehicle-stat-label">Total Gastos</div>
                    </div>
                </div>
                <div class="vehicle-footer">
                    <button class="btn btn-secondary btn-sm" onclick="openVehicleModal('${vehicle.id}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        Editar
                    </button>
                    <button class="btn btn-primary btn-sm" onclick="openExpenseModal(null, '${vehicle.id}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                            <line x1="12" y1="5" x2="12" y2="19"/>
                            <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        Añadir Gasto
                    </button>
                    <button class="btn btn-danger-outline btn-sm" onclick="confirmDeleteVehicle('${vehicle.id}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function openVehicleModal(vehicleId = null) {
    const modal = document.getElementById('vehicleModal');
    const form = document.getElementById('vehicleForm');
    const title = document.getElementById('vehicleModalTitle');

    form.reset();

    if (vehicleId) {
        const vehicle = AppData.vehicles.find(v => v.id === vehicleId);
        if (vehicle) {
            title.textContent = 'Editar Vehículo';
            document.getElementById('vehicleId').value = vehicle.id;
            document.getElementById('vehicleMake').value = vehicle.make;
            document.getElementById('vehicleModel').value = vehicle.model;
            document.getElementById('vehicleYear').value = vehicle.year || '';
            document.getElementById('vehiclePlate').value = vehicle.plate;
            document.getElementById('vehicleMileage').value = vehicle.mileage;
            document.getElementById('vehicleRegistration').value = vehicle.registrationDate || '';
            document.getElementById('vehicleNotes').value = vehicle.notes || '';
        }
    } else {
        title.textContent = 'Añadir Vehículo';
        document.getElementById('vehicleId').value = '';
    }

    modal.classList.add('active');
}

function closeVehicleModal() {
    Motion.closeModal(document.getElementById('vehicleModal'));
}

function saveVehicle(e) {
    e.preventDefault();

    const id = document.getElementById('vehicleId').value;
    const vehicleData = {
        make: document.getElementById('vehicleMake').value.trim(),
        model: document.getElementById('vehicleModel').value.trim(),
        year: parseInt(document.getElementById('vehicleYear').value) || null,
        plate: document.getElementById('vehiclePlate').value.trim().toUpperCase(),
        mileage: parseInt(document.getElementById('vehicleMileage').value) || 0,
        registrationDate: document.getElementById('vehicleRegistration').value,
        notes: document.getElementById('vehicleNotes').value.trim()
    };

    if (id) {
        // Update existing
        const index = AppData.vehicles.findIndex(v => v.id === id);
        if (index !== -1) {
            AppData.vehicles[index] = { ...AppData.vehicles[index], ...vehicleData };
            AppData.showToast('Vehículo actualizado correctamente', 'success');
        }
    } else {
        // Add new
        const newVehicle = {
            id: AppData.generateId(),
            ...vehicleData,
            initialMileage: vehicleData.mileage
        };
        AppData.vehicles.push(newVehicle);
        AppData.showToast('Vehículo añadido correctamente', 'success');
        Motion.driveBy(getVehicleEmoji(newVehicle.make));
        Motion.confetti(null, AppData.vehicles.length === 1 ? 120 : 60);
    }

    AppData.saveData();
    closeVehicleModal();
    renderVehicles();
    updateDashboard();
}

function confirmDeleteVehicle(vehicleId) {
    const vehicle = AppData.vehicles.find(v => v.id === vehicleId);
    if (!vehicle) return;

    document.getElementById('deleteMessage').textContent = 
        `¿Estás seguro de que quieres eliminar ${vehicle.make} ${vehicle.model}? Todos sus gastos también se eliminarán.`;
    document.getElementById('confirmDeleteBtn').onclick = () => deleteVehicle(vehicleId);
    document.getElementById('deleteModal').classList.add('active');
}

async function deleteVehicle(vehicleId) {
    closeDeleteModal();
    await Motion.leave(document.querySelector(`.vehicle-card[data-id="${vehicleId}"]`));
    AppData.vehicles = AppData.vehicles.filter(v => v.id !== vehicleId);
    AppData.expenses = AppData.expenses.filter(e => e.vehicleId !== vehicleId);
    AppData.saveData();
    AppData.showToast('Vehículo eliminado correctamente', 'success');
    renderVehicles();
    updateDashboard();
}

// ============================================
// EXPENSES
// ============================================

// Expenses shown in the table, with its filters and sort order applied
function getFilteredExpenses() {
    const vehicleFilter = document.getElementById('filterVehicle')?.value || 'all';
    const categoryFilter = document.getElementById('filterCategory')?.value || 'all';
    const sortValue = document.getElementById('sortExpenses')?.value || 'date-desc';

    let filteredExpenses = [...AppData.expenses];

    if (vehicleFilter !== 'all') {
        filteredExpenses = filteredExpenses.filter(e => e.vehicleId === vehicleFilter);
    }

    if (categoryFilter !== 'all') {
        filteredExpenses = filteredExpenses.filter(e => e.category === categoryFilter);
    }

    // Sort
    switch (sortValue) {
        case 'date-desc':
            filteredExpenses.sort((a, b) => new Date(b.date) - new Date(a.date));
            break;
        case 'date-asc':
            filteredExpenses.sort((a, b) => new Date(a.date) - new Date(b.date));
            break;
        case 'cost-desc':
            filteredExpenses.sort((a, b) => parseFloat(b.cost) - parseFloat(a.cost));
            break;
        case 'cost-asc':
            filteredExpenses.sort((a, b) => parseFloat(a.cost) - parseFloat(b.cost));
            break;
    }

    return filteredExpenses;
}

function renderExpenses() {
    // Update vehicle filter options
    const vehicleSelect = document.getElementById('filterVehicle');
    if (vehicleSelect) {
        const currentValue = vehicleSelect.value;
        vehicleSelect.innerHTML = '<option value="all">Todos los vehículos</option>' +
            AppData.vehicles.map(v => `<option value="${v.id}">${vehicleName(v)}</option>`).join('');
        vehicleSelect.value = AppData.vehicles.some(v => v.id === currentValue) ? currentValue : 'all';
    }

    const filteredExpenses = getFilteredExpenses();

    const tbody = document.getElementById('expensesTableBody');

    if (filteredExpenses.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="7">
                    <div class="empty-state">
                        <p>No hay gastos registrados</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filteredExpenses.map(expense => {
        const vehicle = AppData.vehicles.find(v => v.id === expense.vehicleId);
        const icon = getCategoryIcon(expense.category);

        return `
            <tr data-id="${expense.id}">
                <td>${AppData.formatDate(expense.date)}</td>
                <td>${vehicleName(vehicle)}</td>
                <td><span class="category-badge ${expense.category}">${icon} ${getCategoryLabel(expense.category)}</span></td>
                <td>${escapeHtml(expense.description)}</td>
                <td>${AppData.formatNumber(expense.mileage || 0)}</td>
                <td class="cost">${AppData.formatCurrency(expense.cost)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn edit" onclick="openExpenseModal('${expense.id}')" title="Editar">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                        <button class="action-btn delete" onclick="confirmDeleteExpense('${expense.id}')" title="Eliminar">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function openExpenseModal(expenseId = null, preselectedVehicleId = null) {
    const modal = document.getElementById('expenseModal');
    const form = document.getElementById('expenseForm');
    const title = document.getElementById('expenseModalTitle');

    form.reset();

    // Populate vehicle select
    const vehicleSelect = document.getElementById('expenseVehicle');
    vehicleSelect.innerHTML = '<option value="">Seleccionar vehículo...</option>' +
        AppData.vehicles.map(v => `<option value="${v.id}">${vehicleName(v)} (${escapeHtml(v.plate)})</option>`).join('');

    // Set date to today
    document.getElementById('expenseDate').valueAsDate = new Date();

    if (expenseId) {
        const expense = AppData.expenses.find(e => e.id === expenseId);
        if (expense) {
            title.textContent = 'Editar Gasto';
            document.getElementById('expenseId').value = expense.id;
            document.getElementById('expenseVehicle').value = expense.vehicleId;
            document.getElementById('expenseDate').value = expense.date;
            document.getElementById('expenseMileage').value = expense.mileage || '';
            document.getElementById('expenseCategory').value = expense.category;
            document.getElementById('expenseDescription').value = expense.description;
            document.getElementById('expenseCost').value = expense.cost;
            document.getElementById('expenseShop').value = expense.shop || '';
            document.getElementById('expenseNotes').value = expense.notes || '';
        }
    } else {
        title.textContent = 'Registrar Gasto';
        document.getElementById('expenseId').value = '';
        
        if (preselectedVehicleId) {
            document.getElementById('expenseVehicle').value = preselectedVehicleId;
        }
    }

    modal.classList.add('active');
}

function closeExpenseModal() {
    Motion.closeModal(document.getElementById('expenseModal'));
}

function saveExpense(e) {
    e.preventDefault();

    const id = document.getElementById('expenseId').value;
    const vehicleId = document.getElementById('expenseVehicle').value;
    const mileage = parseInt(document.getElementById('expenseMileage').value) || 0;

    const expenseData = {
        vehicleId: vehicleId,
        date: document.getElementById('expenseDate').value,
        category: document.getElementById('expenseCategory').value,
        description: document.getElementById('expenseDescription').value.trim(),
        cost: parseFloat(document.getElementById('expenseCost').value),
        mileage: mileage,
        shop: document.getElementById('expenseShop').value.trim(),
        notes: document.getElementById('expenseNotes').value.trim()
    };

    // Update vehicle mileage if new mileage is higher
    if (mileage > 0) {
        const vehicle = AppData.vehicles.find(v => v.id === vehicleId);
        if (vehicle && mileage > parseInt(vehicle.mileage)) {
            vehicle.mileage = mileage;
        }
    }

    if (id) {
        // Update existing
        const index = AppData.expenses.findIndex(e => e.id === id);
        if (index !== -1) {
            AppData.expenses[index] = { ...AppData.expenses[index], ...expenseData };
            AppData.showToast('Gasto actualizado correctamente', 'success');
        }
    } else {
        // Add new
        const newExpense = {
            id: AppData.generateId(),
            ...expenseData
        };
        AppData.expenses.push(newExpense);
        AppData.showToast('Gasto registrado correctamente', 'success');
        Motion.emojiBurst(getCategoryIcon(newExpense.category), document.getElementById('addExpenseBtn'));
    }

    AppData.saveData();
    closeExpenseModal();
    renderExpenses();
    updateDashboard();
}

function confirmDeleteExpense(expenseId) {
    const expense = AppData.expenses.find(e => e.id === expenseId);
    if (!expense) return;

    const vehicle = AppData.vehicles.find(v => v.id === expense.vehicleId);
    const vehicleName = vehicle ? `${vehicle.make} ${vehicle.model}` : 'Vehículo';

    document.getElementById('deleteMessage').textContent = 
        `¿Estás seguro de que quieres eliminar este gasto de ${vehicleName}?`;
    document.getElementById('confirmDeleteBtn').onclick = () => deleteExpense(expenseId);
    document.getElementById('deleteModal').classList.add('active');
}

async function deleteExpense(expenseId) {
    closeDeleteModal();
    await Motion.leave(document.querySelector(`tr[data-id="${expenseId}"]`));
    AppData.expenses = AppData.expenses.filter(e => e.id !== expenseId);
    AppData.saveData();
    AppData.showToast('Gasto eliminado correctamente', 'success');
    renderExpenses();
    updateDashboard();
}

function closeDeleteModal() {
    Motion.closeModal(document.getElementById('deleteModal'));
}

// ============================================
// REPORTS
// ============================================

function getReportRange() {
    return {
        start: document.getElementById('reportStartDate')?.value || '',
        end: document.getElementById('reportEndDate')?.value || ''
    };
}

// Dates are stored as YYYY-MM-DD, so string comparison is enough
function getReportExpenses() {
    const { start, end } = getReportRange();
    return AppData.expenses.filter(e => (!start || e.date >= start) && (!end || e.date <= end));
}

function renderReports() {
    const reportExpenses = getReportExpenses();
    renderCategoryReportChart(reportExpenses);
    renderMonthlyReportChart(reportExpenses);
    renderVehicleSummary(reportExpenses);
    renderKmCostSummary(reportExpenses);
}

function renderCategoryReportChart(reportExpenses) {
    const ctx = document.getElementById('categoryReportChart');
    if (!ctx) return;

    const categories = {};
    reportExpenses.forEach(e => {
        categories[e.category] = (categories[e.category] || 0) + parseFloat(e.cost);
    });

    const labels = Object.keys(categories).map(c => getCategoryLabel(c));
    const data = Object.values(categories);
    const colors = Object.keys(categories).map(c => getCategoryColor(c));

    if (categoryReportChart) {
        categoryReportChart.destroy();
    }

    categoryReportChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        padding: 15,
                        usePointStyle: true
                    }
                }
            }
        }
    });
}

function renderMonthlyReportChart(reportExpenses) {
    const ctx = document.getElementById('monthlyReportChart');
    if (!ctx) return;

    // Without a range, show the current year; with one, every month it covers
    const { start, end } = getReportRange();
    const today = new Date();
    const currentYear = today.getFullYear();
    const [startYear, startMonth] = start
        ? start.split('-').map(Number)
        : [end ? Number(end.split('-')[0]) : currentYear, 1];
    const [endYear, endMonth] = end
        ? end.split('-').map(Number)
        : (start ? [currentYear, today.getMonth() + 1] : [currentYear, 12]);

    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const multiYear = startYear !== endYear;
    const monthlyData = {};
    const labels = [];

    let y = startYear;
    let m = startMonth;
    while (y < endYear || (y === endYear && m <= endMonth)) {
        const key = `${y}-${String(m).padStart(2, '0')}`;
        monthlyData[key] = 0;
        labels.push(multiYear ? `${monthNames[m - 1]} ${String(y).slice(2)}` : monthNames[m - 1]);
        m++;
        if (m > 12) {
            m = 1;
            y++;
        }
    }

    reportExpenses.forEach(e => {
        const key = e.date.slice(0, 7);
        if (key in monthlyData) {
            monthlyData[key] += parseFloat(e.cost);
        }
    });

    if (monthlyReportChart) {
        monthlyReportChart.destroy();
    }

    monthlyReportChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Gastos mensuales',
                data: Object.values(monthlyData),
                backgroundColor: '#2563EB',
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => AppData.formatCurrency(value)
                    }
                }
            }
        }
    });
}

function renderVehicleSummary(reportExpenses) {
    const container = document.getElementById('vehicleSummary');

    if (AppData.vehicles.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No hay vehículos registrados</p></div>';
        return;
    }

    const summaries = AppData.vehicles.map(vehicle => {
        const vehicleExpenses = reportExpenses
            .filter(e => e.vehicleId === vehicle.id)
            .reduce((sum, e) => sum + parseFloat(e.cost), 0);

        return {
            name: vehicleName(vehicle),
            total: vehicleExpenses
        };
    });

    container.innerHTML = summaries.map(s => `
        <div class="summary-item">
            <span class="summary-item-name">${s.name}</span>
            <span class="summary-item-value">${AppData.formatCurrency(s.total)}</span>
        </div>
    `).join('');
}

// Cost per distance actually driven: spending divided by the span between the
// lowest and highest known mileage (registration, expenses and current odometer)
function renderKmCostSummary(reportExpenses) {
    const container = document.getElementById('kmCostSummary');

    if (AppData.vehicles.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No hay vehículos registrados</p></div>';
        return;
    }

    const { start, end } = getReportRange();
    const hasRange = Boolean(start || end);

    const summaries = AppData.vehicles.map(vehicle => {
        const vehicleExpenses = reportExpenses.filter(e => e.vehicleId === vehicle.id);
        const total = vehicleExpenses.reduce((sum, e) => sum + parseFloat(e.cost), 0);

        const readings = vehicleExpenses.map(e => parseInt(e.mileage)).filter(m => m > 0);
        if (!hasRange) {
            readings.push(parseInt(vehicle.mileage) || 0);
            if (vehicle.initialMileage !== null && vehicle.initialMileage !== undefined) {
                readings.push(vehicle.initialMileage);
            }
        }

        const distance = readings.length > 1 ? Math.max(...readings) - Math.min(...readings) : 0;

        return {
            name: vehicleName(vehicle),
            value: distance > 0
                ? `${AppData.formatCurrency(total / distance, 3)}/${AppData.settings.distanceUnit}`
                : 'Sin datos suficientes'
        };
    });

    container.innerHTML = summaries.map(s => `
        <div class="summary-item">
            <span class="summary-item-name">${s.name}</span>
            <span class="summary-item-value">${s.value}</span>
        </div>
    `).join('');
}

// ============================================
// SETTINGS
// ============================================

function renderSettings() {
    document.getElementById('currencySetting').value = AppData.settings.currency;
    document.getElementById('distanceSetting').value = AppData.settings.distanceUnit;
    document.getElementById('oilInterval').value = AppData.settings.oilInterval;
    document.getElementById('brakesInterval').value = AppData.settings.brakesInterval;
    document.getElementById('itvInterval').value = AppData.settings.itvInterval;
    document.getElementById('tiresInterval').value = AppData.settings.tiresInterval;
    document.getElementById('backupReminderDays').value = AppData.settings.backupReminderDays;
    Backup.renderStatus();
}

function saveSettings() {
    AppData.settings.currency = document.getElementById('currencySetting').value;
    AppData.settings.distanceUnit = document.getElementById('distanceSetting').value;
    AppData.settings.oilInterval = parseInt(document.getElementById('oilInterval').value) || 15000;
    AppData.settings.brakesInterval = parseInt(document.getElementById('brakesInterval').value) || 20000;
    AppData.settings.itvInterval = parseInt(document.getElementById('itvInterval').value) || 24;
    AppData.settings.tiresInterval = parseInt(document.getElementById('tiresInterval').value) || 40000;
    const reminderDays = parseInt(document.getElementById('backupReminderDays').value);
    AppData.settings.backupReminderDays = Number.isNaN(reminderDays) ? 30 : reminderDays;

    AppData.saveData();
    AppData.showToast('Configuración guardada', 'success');
    updateDashboard();
}

function confirmClearAllData() {
    document.getElementById('deleteMessage').textContent = 
        '¿Estás seguro de que quieres eliminar TODOS los datos? Esta acción no se puede deshacer.';
    document.getElementById('confirmDeleteBtn').onclick = clearAllData;
    document.getElementById('deleteModal').classList.add('active');
}

function clearAllData() {
    AppData.vehicles = [];
    AppData.expenses = [];
    AppData.saveData();
    closeDeleteModal();
    AppData.showToast('Todos los datos han sido eliminados', 'success');
    renderVehicles();
    updateDashboard();
}

// ============================================
// EXPORT/IMPORT DATA
// ============================================

function exportData() {
    Backup.download();
    AppData.showToast('Datos exportados correctamente', 'success');
}

// Merges the imported data into the current data without deleting anything.
// Vehicles are matched by id or plate; their expenses are re-linked to the
// vehicle that is kept, so no expense is left pointing to a missing vehicle.
function mergeImportedData(data) {
    const wasEmpty = AppData.vehicles.length === 0 && AppData.expenses.length === 0;
    const idMap = {};
    let addedVehicles = 0;
    let addedExpenses = 0;

    data.vehicles.map(normalizeVehicle).filter(Boolean).forEach(vehicle => {
        const existing = AppData.vehicles.find(v => v.id === vehicle.id) ||
            (vehicle.plate && AppData.vehicles.find(v => v.plate === vehicle.plate));

        if (existing) {
            idMap[vehicle.id] = existing.id;
            existing.mileage = Math.max(existing.mileage, vehicle.mileage);
        } else {
            idMap[vehicle.id] = vehicle.id;
            AppData.vehicles.push(vehicle);
            addedVehicles++;
        }
    });

    const existingIds = new Set(AppData.expenses.map(e => e.id));
    const vehicleIds = new Set(AppData.vehicles.map(v => v.id));

    data.expenses.map(normalizeExpense).filter(Boolean).forEach(expense => {
        expense.vehicleId = idMap[expense.vehicleId] || expense.vehicleId;
        if (existingIds.has(expense.id) || !vehicleIds.has(expense.vehicleId)) return;
        AppData.expenses.push(expense);
        existingIds.add(expense.id);
        addedExpenses++;
    });

    // Settings are only restored on an empty app, so a merge never changes your preferences
    if (wasEmpty && data.settings && typeof data.settings === 'object') {
        Object.keys(AppData.settings).forEach(key => {
            if (data.settings[key] !== undefined) {
                const number = parseInt(data.settings[key]);
                AppData.settings[key] = typeof AppData.settings[key] === 'number'
                    ? (Number.isNaN(number) ? AppData.settings[key] : number)
                    : String(data.settings[key]);
            }
        });
    }

    return { addedVehicles, addedExpenses, wasEmpty };
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importObj = JSON.parse(e.target.result);

            // Validate structure
            if (!importObj.data || !Array.isArray(importObj.data.vehicles) || !Array.isArray(importObj.data.expenses)) {
                throw new Error('Archivo JSON inválido');
            }

            const confirmMsg = `¿Importar estos datos?\n\n` +
                `📁 Archivo: ${importObj.data.vehicles.length} vehículos, ${importObj.data.expenses.length} gastos\n` +
                `💾 Actual: ${AppData.vehicles.length} vehículos, ${AppData.expenses.length} gastos\n\n` +
                `Se combinarán con tus datos actuales, sin borrar nada. ` +
                `Los vehículos con la misma matrícula se unifican.`;

            if (confirm(confirmMsg)) {
                const { addedVehicles, addedExpenses, wasEmpty } = mergeImportedData(importObj.data);

                AppData.saveData();
                if (wasEmpty) {
                    // The imported file is a full copy of what is now in the app
                    Backup.markBackup('import');
                }

                AppData.showToast(`Importados ${addedVehicles} vehículos y ${addedExpenses} gastos`, 'success');
                renderCurrentPage();
                updateDashboard();
            }
        } catch (error) {
            console.error('Import error:', error);
            AppData.showToast('Error al importar: archivo inválido', 'error');
        }

        // Reset file input
        event.target.value = '';
    };

    reader.readAsText(file);
}

// CSV for Excel in Spanish: semicolon separator, decimal comma and BOM for the accents
function exportExpensesCsv() {
    const expenses = getFilteredExpenses();
    if (expenses.length === 0) {
        AppData.showToast('No hay gastos que exportar', 'error');
        return;
    }

    const cell = value => {
        const text = String(value ?? '');
        return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const decimal = value => (parseFloat(value) || 0).toFixed(2).replace('.', ',');

    const header = ['Fecha', 'Vehículo', 'Matrícula', 'Categoría', 'Descripción',
        `Kilometraje (${AppData.settings.distanceUnit})`, `Coste (${AppData.settings.currency})`, 'Taller', 'Notas'];
    const rows = expenses.map(e => {
        const vehicle = AppData.vehicles.find(v => v.id === e.vehicleId);
        return [
            AppData.formatDate(e.date),
            vehicle ? `${vehicle.make} ${vehicle.model}` : '',
            vehicle ? vehicle.plate : '',
            getCategoryLabel(e.category),
            e.description,
            e.mileage || '',
            decimal(e.cost),
            e.shop,
            e.notes
        ];
    });

    const csv = '\uFEFF' + [header, ...rows].map(row => row.map(cell).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `autocare-gastos-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    AppData.showToast(`Exportados ${expenses.length} gastos a CSV`, 'success');
}

// ============================================
// HELPER FUNCTIONS
// ============================================

const CATEGORIES = {
    oil: { label: 'Cambio de Aceite', icon: '🛢️', color: '#F59E0B' },
    tires: { label: 'Ruedas/Neumáticos', icon: '🛞', color: '#4F46E5' },
    brakes: { label: 'Frenos', icon: '🛑', color: '#DB2777' },
    itv: { label: 'ITV', icon: '📋', color: '#059669' },
    parts: { label: 'Piezas/Repuestos', icon: '🔧', color: '#DC2626' },
    maintenance: { label: 'Mantenimiento General', icon: '🔨', color: '#7C3AED' },
    insurance: { label: 'Seguro', icon: '🛡️', color: '#2563EB' },
    fuel: { label: 'Combustible', icon: '⛽', color: '#0D9488' },
    other: { label: 'Otros', icon: '📦', color: '#6B7280' }
};

function getCategoryIcon(category) {
    return (CATEGORIES[category] || CATEGORIES.other).icon;
}

function getCategoryLabel(category) {
    return (CATEGORIES[category] || CATEGORIES.other).label;
}

function getCategoryColor(category) {
    return (CATEGORIES[category] || CATEGORIES.other).color;
}

function openPrivacyModal() {
    document.getElementById('privacyModal').classList.add('active');
}

function closePrivacyModal() {
    Motion.closeModal(document.getElementById('privacyModal'));
}

function getVehicleEmoji(make) {
    const makeLower = make.toLowerCase();
    if (makeLower.includes('toyota') || makeLower.includes('lexus')) return '🚗';
    if (makeLower.includes('honda')) return '🚙';
    if (makeLower.includes('ford')) return '🚐';
    if (makeLower.includes('bmw') || makeLower.includes('mercedes') || makeLower.includes('audi')) return '🏎️';
    if (makeLower.includes('volkswagen')) return '🚐';
    if (makeLower.includes('peugeot') || makeLower.includes('citroen') || makeLower.includes('renault')) return '🚗';
    if (makeLower.includes('seat')) return '🚗';
    if (makeLower.includes('fiat')) return '🚐';
    if (makeLower.includes('nissan')) return '🚙';
    if (makeLower.includes('mazda') || makeLower.includes('subaru')) return '🚙';
    if (makeLower.includes('moto') || makeLower.includes('yamaha') || makeLower.includes('honda motorcycle')) return '🏍️';
    if (makeLower.includes('kawasaki') || makeLower.includes('suzuki')) return '🏍️';
    if (makeLower.includes('harley')) return '🏍️';
    if (makeLower.includes('bike') || makeLower.includes('bicycle')) return '🚲';
    if (makeLower.includes('truck') || makeLower.includes('camión')) return '🚛';
    if (makeLower.includes('bus') || makeLower.includes('autobús')) return '🚌';
    return '🚗';
}

AppData.showToast = function(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMessage = toast.querySelector('.toast-message');
    
    toast.className = 'toast';
    if (type) {
        toast.classList.add(type);
    }
    
    toastMessage.textContent = message;
    toast.querySelector('.toast-icon').textContent = { success: '✅', error: '⚠️' }[type] || 'ℹ️';
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
};

// ============================================
// EVENT LISTENERS
// ============================================

AppData.setupEventListeners = function() {
    // Navigation
    setupNavigation();

    // Vehicle form
    document.getElementById('vehicleForm').addEventListener('submit', saveVehicle);
    document.getElementById('addVehicleBtn').addEventListener('click', () => openVehicleModal());

    // Expense form
    document.getElementById('expenseForm').addEventListener('submit', saveExpense);
    document.getElementById('addExpenseBtn').addEventListener('click', () => openExpenseModal());
    document.getElementById('addExpenseBtnPage').addEventListener('click', () => openExpenseModal());
    document.getElementById('exportCsvBtn').addEventListener('click', exportExpensesCsv);

    // Expense filters
    document.getElementById('filterVehicle')?.addEventListener('change', renderExpenses);
    document.getElementById('filterCategory')?.addEventListener('change', renderExpenses);
    document.getElementById('sortExpenses')?.addEventListener('change', renderExpenses);

    // Chart period
    document.getElementById('chartPeriod')?.addEventListener('change', () => {
        renderExpensesChart();
        renderVehicleChart();
    });

    // Settings
    const settingsInputs = document.querySelectorAll('#settingsPage input, #settingsPage select');
    settingsInputs.forEach(input => {
        input.addEventListener('change', saveSettings);
    });

    document.getElementById('clearAllData').addEventListener('click', confirmClearAllData);

    // Export/Import data
    document.getElementById('exportData').addEventListener('click', exportData);
    document.getElementById('importData').addEventListener('change', importData);

    // Report date range
    document.getElementById('generateReport')?.addEventListener('click', () => {
        const { start, end } = getReportRange();
        if (start && end && start > end) {
            AppData.showToast('La fecha de inicio debe ser anterior a la de fin', 'error');
            return;
        }
        renderReports();
        AppData.showToast('Informe actualizado', 'success');
    });

    // Modal overlays
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', () => {
            document.querySelectorAll('.modal').forEach(modal => Motion.closeModal(modal));
        });
    });

    // Close modals on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal').forEach(modal => Motion.closeModal(modal));
        }
    });
};

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    AppData.init();
});

// Offline support (only when served over http/https, not from file://)
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(error => console.warn('Service worker:', error));
    });
}
