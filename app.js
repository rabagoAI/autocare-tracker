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
        Garage.init();
        // Photos load asynchronously; the garage is redrawn once they are ready
        Photos.load().then(() => {
            if (document.getElementById('vehiclesPage').classList.contains('active')) renderVehicles();
        });
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

const FUEL_TYPES = { gasoline: 'Gasolina', diesel: 'Diésel', hybrid: 'Híbrido', electric: 'Eléctrico' };

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
        color: /^#[0-9a-f]{6}$/i.test(v.color || '') ? v.color : '',
        fuelType: FUEL_TYPES[v.fuelType] ? v.fuelType : '',
        insuranceDue: isValidDate(v.insuranceDue) ? v.insuranceDue : '',
        taxDue: isValidDate(v.taxDue) ? v.taxDue : '',
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
        liters: parseFloat(e.liters) > 0 ? parseFloat(e.liters) : null,
        pricePerLiter: parseFloat(e.pricePerLiter) > 0 ? parseFloat(e.pricePerLiter) : null,
        fullTank: e.fullTank === undefined ? null : Boolean(e.fullTank),
        shop: String(e.shop ?? '').trim(),
        notes: String(e.notes ?? '').trim()
    };
}

// Current odometer: the highest of the reading typed in the vehicle and the
// mileage of its expenses, so adding, editing or deleting an expense updates it
function getCurrentMileage(vehicle) {
    const readings = AppData.expenses
        .filter(e => e.vehicleId === vehicle.id)
        .map(e => parseInt(e.mileage) || 0);
    return Math.max(parseInt(vehicle.mileage) || 0, ...readings);
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
    window.scrollTo(0, 0);
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

// Status of every maintenance item of a vehicle, whether it is close or not.
// status: ok | warning | danger | unknown (no data to calculate it)
function getMaintenanceStatus(vehicle) {
    const unit = AppData.settings.distanceUnit;
    const fmt = n => AppData.formatNumber(n);
    const name = `${vehicle.make} ${vehicle.model}`;
    const current = getCurrentMileage(vehicle);
    const vehicleExpenses = AppData.expenses.filter(e => e.vehicleId === vehicle.id);
    const startMileage = vehicle.initialMileage ?? (parseInt(vehicle.mileage) || 0);
    const items = [];

    // By distance. Oil counts from when the vehicle was added if there is no record.
    const byDistance = [
        { type: 'oil', title: 'Cambio de aceite', interval: AppData.settings.oilInterval, margin: 2000, priority: 1, fromStart: true },
        { type: 'brakes', title: 'Revisión de frenos', interval: AppData.settings.brakesInterval, margin: 2000, priority: 1 },
        { type: 'tires', title: 'Cambio de neumáticos', interval: AppData.settings.tiresInterval, margin: 5000, priority: 2 }
    ];

    byDistance.forEach(config => {
        // Electric vehicles have no engine oil
        if (config.type === 'oil' && vehicle.fuelType === 'electric') return;

        const lastRecord = vehicleExpenses
            .filter(e => e.category === config.type && e.mileage > 0)
            .sort((a, b) => b.mileage - a.mileage)[0];

        if (!lastRecord && !config.fromStart) {
            items.push({ type: config.type, title: config.title, priority: config.priority, status: 'unknown', progress: null, detail: 'Sin registros con kilometraje' });
            return;
        }

        const from = lastRecord ? lastRecord.mileage : startMileage;
        const remaining = from + config.interval - current;
        items.push({
            type: config.type,
            title: config.title,
            priority: config.priority,
            status: remaining <= 0 ? 'danger' : remaining <= config.margin ? 'warning' : 'ok',
            progress: Math.min(Math.max((current - from) / config.interval, 0), 1),
            detail: remaining <= 0 ? `Pasado por ${fmt(-remaining)} ${unit}` : `Faltan ${fmt(remaining)} ${unit}`,
            message: `${name}: ${remaining <= 0 ? `pasado por ${fmt(-remaining)} ${unit}` : `${fmt(remaining)} ${unit} restantes`}`
        });
    });

    // ITV by date: the most recent one, not the one with more km
    const lastITV = vehicleExpenses
        .filter(e => e.category === 'itv')
        .sort((a, b) => b.date.localeCompare(a.date))[0];
    const nextITV = getNextItvDate(vehicle, lastITV);

    if (nextITV) {
        const daysUntil = Math.ceil((nextITV - new Date()) / (1000 * 60 * 60 * 24));
        const from = lastITV ? parseLocalDate(lastITV.date) : null;
        items.push({
            type: 'itv',
            title: 'ITV',
            priority: 0,
            status: daysUntil <= 0 ? 'danger' : daysUntil <= 60 ? 'warning' : 'ok',
            progress: from ? Math.min(Math.max((new Date() - from) / (nextITV - from), 0), 1) : null,
            detail: daysUntil <= 0
                ? `Vencida desde el ${nextITV.toLocaleDateString('es-ES')}`
                : `${nextITV.toLocaleDateString('es-ES')} · faltan ${daysUntil} días`,
            message: `${name}: ${daysUntil <= 0 ? 'vencida' : 'vence en ' + daysUntil + ' días'}`
        });
    } else {
        items.push({ type: 'itv', title: 'ITV', priority: 0, status: 'unknown', progress: null, detail: 'Añade la fecha de matriculación o registra una ITV' });
    }

    // Yearly deadlines by date
    const deadlines = [
        { type: 'insurance', title: 'Seguro', field: 'insuranceDue', missing: 'Añade la fecha de renovación al editar el vehículo' },
        { type: 'tax', title: 'Impuesto de circulación', field: 'taxDue', missing: 'Añade la fecha de pago al editar el vehículo' }
    ];

    deadlines.forEach(config => {
        const deadline = getAnnualDeadline(vehicle[config.field], config.type, vehicleExpenses);
        if (!deadline) {
            items.push({ type: config.type, title: config.title, priority: 0, status: 'unknown', progress: null, detail: config.missing });
            return;
        }
        const { due, days } = deadline;
        const dateText = due.toLocaleDateString('es-ES');
        items.push({
            type: config.type,
            title: config.title,
            priority: 0,
            status: days < 0 ? 'danger' : days <= 30 ? 'warning' : 'ok',
            progress: Math.min(Math.max(1 - days / 365, 0), 1),
            detail: days < 0
                ? `Vencido el ${dateText}`
                : `${dateText} · ${days === 0 ? 'vence hoy' : `faltan ${days} días`}`,
            message: `${name}: ${config.title.toLowerCase()} ${days < 0 ? `vencido hace ${-days} días` : days === 0 ? 'vence hoy' : `vence en ${days} días`}`
        });
    });

    return items.sort((a, b) => a.priority - b.priority);
}

// Next occurrence of a yearly date. A payment recorded close to the due date
// (60 days before to 30 after) closes that year and moves on to the next one.
function getAnnualDeadline(baseDate, category, vehicleExpenses) {
    if (!isValidDate(baseDate)) return null;

    const dayMs = 1000 * 60 * 60 * 24;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const due = parseLocalDate(baseDate);
    while (due < new Date(today - 30 * dayMs)) {
        due.setFullYear(due.getFullYear() + 1);
    }

    const isPaid = date => vehicleExpenses.some(e => {
        if (e.category !== category) return false;
        const paidOn = parseLocalDate(e.date);
        return paidOn >= new Date(date - 60 * dayMs) && paidOn <= new Date(date.getTime() + 30 * dayMs);
    });
    if (isPaid(due)) {
        due.setFullYear(due.getFullYear() + 1);
    }

    return { due, days: Math.round((due - today) / dayMs) };
}

function calculateAlerts() {
    return AppData.vehicles
        .flatMap(vehicle => getMaintenanceStatus(vehicle)
            .filter(item => item.status === 'warning' || item.status === 'danger')
            .map(item => ({ ...item, title: item.type === 'itv' ? 'ITV próxima' : item.title, vehicle })))
        .sort((a, b) => a.priority - b.priority);
}

// Fuel consumption with the full-tank method: between two full fills, the
// liters added after the first one divided by the distance driven.
// Impossible values (a partial fill marked as full, a km typo) are discarded.
const CONSUMPTION_RANGE = { min: 2, max: 30 };

function getFuelStats(vehicleId) {
    const fills = AppData.expenses
        .filter(e => e.vehicleId === vehicleId && e.category === 'fuel')
        .sort((a, b) => a.date.localeCompare(b.date) || (a.mileage || 0) - (b.mileage || 0));

    const withLiters = fills.filter(e => e.liters > 0);
    const totalLiters = withLiters.reduce((sum, e) => sum + e.liters, 0);
    const totalCost = fills.reduce((sum, e) => sum + (parseFloat(e.cost) || 0), 0);
    const avgPrice = totalLiters > 0 ? withLiters.reduce((sum, e) => sum + parseFloat(e.cost), 0) / totalLiters : null;

    const segments = [];
    let discarded = 0;
    let previousFull = null;
    let litersSince = 0;
    let complete = true;

    fills.forEach(fill => {
        if (!previousFull) {
            if (fill.fullTank !== false && fill.mileage > 0) previousFull = fill;
            return;
        }
        if (fill.liters > 0) {
            litersSince += fill.liters;
        } else {
            complete = false;
        }
        if (fill.fullTank !== false && fill.mileage > 0) {
            const distance = fill.mileage - previousFull.mileage;
            if (complete && distance > 0 && litersSince > 0) {
                const consumption = litersSince / distance * 100;
                if (consumption >= CONSUMPTION_RANGE.min && consumption <= CONSUMPTION_RANGE.max) {
                    segments.push({ date: fill.date, distance, liters: litersSince, consumption });
                } else {
                    discarded++;
                }
            }
            previousFull = fill;
            litersSince = 0;
            complete = true;
        }
    });

    const segmentLiters = segments.reduce((sum, s) => sum + s.liters, 0);
    const segmentDistance = segments.reduce((sum, s) => sum + s.distance, 0);
    const avgConsumption = segmentDistance > 0 ? segmentLiters / segmentDistance * 100 : null;

    return {
        count: fills.length,
        totalLiters,
        totalCost,
        avgPrice,
        avgConsumption,
        lastConsumption: segments.length ? segments[segments.length - 1].consumption : null,
        costPerDistance: avgConsumption && avgPrice ? avgConsumption * avgPrice / 100 : null,
        segments,
        discarded
    };
}

function formatConsumption(value) {
    return `${value.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} l/100 ${AppData.settings.distanceUnit}`;
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
            total: vehicleExpenses,
            color: getVehicleColor(vehicle)
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
                backgroundColor: vehicleData.map(v => v.color === '#1B1E27' ? '#4B5470' : v.color),
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
    Garage.render();
}

// Sheet under the carousel: the full detail of the centered vehicle
function renderVehicleSheet(vehicle) {
    const container = document.getElementById('vehicleSheet');
    if (!container) return;

    if (!vehicle) {
        if (fuelChart) {
            fuelChart.destroy();
            fuelChart = null;
        }
        container.innerHTML = `
            <div class="empty-state large garage-empty">
                ${ROAD_SCENE}
                <h3>${AppData.vehicles.length ? '¿Tienes otro vehículo?' : 'No tienes vehículos'}</h3>
                <p>Añádelo para llevar sus gastos, mantenimientos y consumo</p>
                <button type="button" class="btn btn-primary" onclick="openVehicleModal()">+ Añadir vehículo</button>
            </div>`;
        return;
    }

    renderVehicleDetail(container, vehicle);
    Motion.reveal(container, '.detail-hero, .detail-stat, .detail-card');
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
            document.getElementById('vehicleMileage').value = getCurrentMileage(vehicle);
            document.getElementById('vehicleRegistration').value = vehicle.registrationDate || '';
            document.getElementById('vehicleInsuranceDue').value = vehicle.insuranceDue || '';
            document.getElementById('vehicleTaxDue').value = vehicle.taxDue || '';
            document.getElementById('vehicleNotes').value = vehicle.notes || '';
            document.getElementById('vehicleFuelType').value = vehicle.fuelType || '';
            setVehicleColor(getVehicleColor(vehicle));
            showPhotoPreview(Photos.get(vehicle.id));
        }
    } else {
        title.textContent = 'Añadir Vehículo';
        document.getElementById('vehicleId').value = '';
        setVehicleColor(CAR_COLORS[AppData.vehicles.length % CAR_COLORS.length]);
        showPhotoPreview(null);
    }

    pendingPhoto = undefined;
    Motion.openModal(modal);
}

// undefined: keep the current photo, null: remove it, string: new photo
let pendingPhoto;

function setVehicleColor(color) {
    document.getElementById('vehicleColor').value = color;
    document.querySelectorAll('.color-swatch').forEach(swatch => {
        swatch.classList.toggle('active', swatch.dataset.color.toLowerCase() === color.toLowerCase());
    });
}

function showPhotoPreview(dataUrl) {
    const preview = document.getElementById('vehiclePhotoPreview');
    preview.innerHTML = dataUrl ? `<img src="${dataUrl}" alt="Foto del vehículo">` : '<span>Sin foto: se mostrará el dibujo con el color elegido</span>';
    document.getElementById('removeVehiclePhoto').hidden = !dataUrl;
}

async function handleVehiclePhoto(event) {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
        pendingPhoto = await Photos.resize(file);
        showPhotoPreview(pendingPhoto);
    } catch (error) {
        console.error('Photo:', error);
        AppData.showToast('No se ha podido leer esa imagen', 'error');
    }
}

function closeVehicleModal() {
    Motion.closeModal(document.getElementById('vehicleModal'));
}

async function saveVehicle(e) {
    e.preventDefault();

    const id = document.getElementById('vehicleId').value;
    const vehicleData = {
        make: document.getElementById('vehicleMake').value.trim(),
        model: document.getElementById('vehicleModel').value.trim(),
        year: parseInt(document.getElementById('vehicleYear').value) || null,
        plate: document.getElementById('vehiclePlate').value.trim().toUpperCase(),
        mileage: parseInt(document.getElementById('vehicleMileage').value) || 0,
        registrationDate: document.getElementById('vehicleRegistration').value,
        insuranceDue: document.getElementById('vehicleInsuranceDue').value,
        taxDue: document.getElementById('vehicleTaxDue').value,
        color: document.getElementById('vehicleColor').value,
        fuelType: document.getElementById('vehicleFuelType').value,
        notes: document.getElementById('vehicleNotes').value.trim()
    };
    let savedId = id;

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
        savedId = newVehicle.id;
        Garage.selectedId = newVehicle.id;
        AppData.showToast('Vehículo añadido correctamente', 'success');
        Motion.driveBy(getVehicleEmoji(newVehicle.make));
        Motion.confetti(null, AppData.vehicles.length === 1 ? 120 : 60);
    }

    if (pendingPhoto) {
        await Photos.save(savedId, pendingPhoto);
    } else if (pendingPhoto === null) {
        await Photos.remove(savedId);
    }

    AppData.saveData();
    closeVehicleModal();
    renderCurrentPage();
    updateDashboard();
}

function confirmDeleteVehicle(vehicleId) {
    const vehicle = AppData.vehicles.find(v => v.id === vehicleId);
    if (!vehicle) return;

    document.getElementById('deleteMessage').textContent = 
        `¿Estás seguro de que quieres eliminar ${vehicle.make} ${vehicle.model}? Todos sus gastos también se eliminarán.`;
    document.getElementById('confirmDeleteBtn').onclick = () => deleteVehicle(vehicleId);
    Motion.openModal(document.getElementById('deleteModal'));
}

async function deleteVehicle(vehicleId) {
    closeDeleteModal();
    await Motion.leave(document.querySelector(`.garage-slide[data-id="${vehicleId}"]`));
    AppData.vehicles = AppData.vehicles.filter(v => v.id !== vehicleId);
    Photos.remove(vehicleId);
    AppData.expenses = AppData.expenses.filter(e => e.vehicleId !== vehicleId);
    AppData.saveData();
    AppData.showToast('Vehículo eliminado correctamente', 'success');
    renderCurrentPage();
    updateDashboard();
}

// ============================================
// VEHICLE DETAIL
// ============================================

let fuelChart = null;

// Opens the garage with this vehicle centered and scrolls to its sheet
function openVehicleDetail(vehicleId) {
    AppData.currentVehicleId = vehicleId;
    Garage.selectedId = vehicleId;
    navigateTo('vehicles');
}

function renderVehicleDetail(container, vehicle) {

    const unit = AppData.settings.distanceUnit;
    const expenses = AppData.expenses
        .filter(e => e.vehicleId === vehicle.id)
        .sort((a, b) => b.date.localeCompare(a.date) || b.mileage - a.mileage);
    const total = expenses.reduce((sum, e) => sum + parseFloat(e.cost), 0);
    const currentYear = String(new Date().getFullYear());
    const yearTotal = expenses
        .filter(e => e.date.startsWith(currentYear))
        .reduce((sum, e) => sum + parseFloat(e.cost), 0);
    const current = getCurrentMileage(vehicle);

    const readings = [current, ...expenses.map(e => e.mileage).filter(m => m > 0)];
    if (vehicle.initialMileage !== null && vehicle.initialMileage !== undefined) readings.push(vehicle.initialMileage);
    const distance = Math.max(...readings) - Math.min(...readings);

    const facts = [
        escapeHtml(vehicle.plate),
        vehicle.year ? `Año ${vehicle.year}` : '',
        FUEL_TYPES[vehicle.fuelType] || '',
        vehicle.registrationDate ? `Matriculado el ${AppData.formatDate(vehicle.registrationDate)}` : ''
    ].filter(Boolean).join(' · ');

    container.innerHTML = `
        <div class="detail-hero">
            <div class="detail-title">
                <span class="detail-kicker">Ficha del vehículo</span>
                <p>${facts}</p>
                ${vehicle.notes ? `<p class="detail-notes">${escapeHtml(vehicle.notes)}</p>` : ''}
            </div>
            <div class="detail-actions">
                <button type="button" class="btn btn-secondary" onclick="openVehicleModal('${vehicle.id}')">Editar</button>
                <button type="button" class="btn btn-primary" onclick="openExpenseModal(null, '${vehicle.id}')">+ Añadir gasto</button>
                <button type="button" class="btn btn-danger-outline" onclick="confirmDeleteVehicle('${vehicle.id}')" aria-label="Eliminar vehículo" title="Eliminar vehículo">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </div>
        </div>

        <div class="detail-stats">
            ${detailStat('🛣️', AppData.formatNumber(current), AppData.getDistanceLabel() + ' actuales')}
            ${detailStat('💶', AppData.formatCurrency(total), `Total gastado · ${expenses.length} ${expenses.length === 1 ? 'gasto' : 'gastos'}`)}
            ${detailStat('📏', distance > 0 ? AppData.formatCurrency(total / distance, 3) : '—', `Coste por ${unit}`)}
            ${detailStat('📅', AppData.formatCurrency(yearTotal), `Gastado en ${currentYear}`)}
        </div>

        <div class="detail-grid">
            <div class="detail-card">
                <h3>Mantenimientos</h3>
                ${renderMaintenanceList(vehicle)}
            </div>
            <div class="detail-card">
                <h3>Gasto por categoría</h3>
                ${renderCategoryBars(expenses)}
            </div>
        </div>

        <div class="detail-card">
            ${vehicle.fuelType === 'electric'
                ? `<h3>⚡ Recargas</h3>${renderChargingSummary(vehicle)}`
                : `<h3>⛽ Consumo</h3>${renderFuelSummary(getFuelStats(vehicle.id))}`}
        </div>

        <div class="detail-card">
            <h3>Historial</h3>
            ${renderTimeline(expenses)}
        </div>
    `;

    renderFuelChart(vehicle.fuelType === 'electric' ? { segments: [] } : getFuelStats(vehicle.id));
}

function detailStat(icon, value, label) {
    return `
        <div class="detail-stat">
            <span class="detail-stat-icon" aria-hidden="true">${icon}</span>
            <span class="detail-stat-value">${value}</span>
            <span class="detail-stat-label">${label}</span>
        </div>`;
}

function renderMaintenanceList(vehicle) {
    const icons = { oil: '🛢️', brakes: '🛑', tires: '🛞', itv: '📋', insurance: '🛡️', tax: '🏛️' };
    const badges = { ok: 'Al día', warning: 'Próximo', danger: 'Urgente', unknown: 'Sin datos' };

    return `<div class="maint-list">${getMaintenanceStatus(vehicle).map(item => `
        <div class="maint-item ${item.status}">
            <span class="maint-icon" aria-hidden="true">${icons[item.type]}</span>
            <div class="maint-body">
                <div class="maint-head">
                    <span class="maint-title">${escapeHtml(item.title)}</span>
                    <span class="maint-badge">${badges[item.status]}</span>
                </div>
                <div class="maint-detail">${escapeHtml(item.detail)}</div>
                ${item.progress !== null ? `<div class="maint-bar"><span style="width: ${Math.round(item.progress * 100)}%"></span></div>` : ''}
            </div>
        </div>`).join('')}
    </div>`;
}

function renderCategoryBars(expenses) {
    if (expenses.length === 0) {
        return '<div class="empty-state"><p>Todavía no hay gastos</p></div>';
    }

    const totals = {};
    expenses.forEach(e => {
        totals[e.category] = (totals[e.category] || 0) + parseFloat(e.cost);
    });
    const rows = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    const max = rows[0][1] || 1;
    const sum = rows.reduce((acc, [, value]) => acc + value, 0) || 1;

    return `<div class="category-bars">${rows.map(([category, value]) => `
        <div class="category-bar">
            <div class="category-bar-head">
                <span>${getCategoryIcon(category)} ${getCategoryLabel(category)}</span>
                <span><strong>${AppData.formatCurrency(value)}</strong> · ${Math.round(value / sum * 100)}%</span>
            </div>
            <div class="category-bar-track">
                <span style="width: ${Math.max(value / max * 100, 2)}%; background: ${getCategoryColor(category)}"></span>
            </div>
        </div>`).join('')}
    </div>`;
}

// Electric vehicles: charges are recorded as "Combustible" expenses without liters
function renderChargingSummary(vehicle) {
    const charges = AppData.expenses.filter(e => e.vehicleId === vehicle.id && e.category === 'fuel');
    if (charges.length === 0) {
        return `<p class="help-text">Aún no hay recargas. Regístralas como gasto de <strong>Combustible</strong> con los km del momento y calcularemos lo que te cuesta la energía por ${AppData.settings.distanceUnit}.</p>`;
    }

    const total = charges.reduce((sum, e) => sum + parseFloat(e.cost), 0);
    const readings = charges.map(e => e.mileage).filter(m => m > 0);
    const distance = readings.length > 1 ? Math.max(...readings) - Math.min(...readings) : 0;
    const unit = AppData.settings.distanceUnit;

    return `
        <div class="detail-stats compact">
            ${detailStat('⚡', charges.length, 'Recargas')}
            ${detailStat('💶', AppData.formatCurrency(total), 'Gastado en energía')}
            ${detailStat('📏', distance > 0 ? `${AppData.formatCurrency(total / distance, 3)}/${unit}` : '—', `Energía por ${unit}`)}
            ${detailStat('🏷️', AppData.formatCurrency(total / charges.length), 'Media por recarga')}
        </div>
        <p class="help-text">Las recargas se registran como gasto de Combustible; con los km de cada una calculamos el coste por ${unit}.</p>`;
}

function renderFuelSummary(fuel) {
    if (fuel.count === 0) {
        return `<p class="help-text">Aún no hay repostajes. Al registrar un gasto de <strong>Combustible</strong>, indica los litros, los km y si llenaste el depósito: con dos depósitos llenos calculamos tu consumo real.</p>`;
    }

    const stats = [
        detailStat('⛽', fuel.avgConsumption ? formatConsumption(fuel.avgConsumption) : '—', 'Consumo medio'),
        detailStat('🔄', fuel.lastConsumption ? formatConsumption(fuel.lastConsumption) : '—', 'Último tramo'),
        detailStat('🏷️', fuel.avgPrice ? `${AppData.formatCurrency(fuel.avgPrice, 3)}/l` : '—', 'Precio medio'),
        detailStat('💸', fuel.costPerDistance ? `${AppData.formatCurrency(fuel.costPerDistance, 3)}/${AppData.settings.distanceUnit}` : '—', 'Combustible por ' + AppData.settings.distanceUnit)
    ].join('');

    let hint = fuel.avgConsumption
        ? `${fuel.count} repostajes · ${fuel.totalLiters.toLocaleString('es-ES', { maximumFractionDigits: 1 })} l · ${AppData.formatCurrency(fuel.totalCost)}`
        : 'Para calcular el consumo hacen falta al menos dos repostajes con depósito lleno, litros y km.';
    if (fuel.discarded) {
        hint += ` · ⚠️ ${fuel.discarded} ${fuel.discarded === 1 ? 'tramo descartado' : 'tramos descartados'} por datos incoherentes (¿un repostaje parcial marcado como lleno o unos km mal escritos?)`;
    }

    return `
        <div class="detail-stats compact">${stats}</div>
        <p class="help-text">${hint}</p>
        ${fuel.segments.length >= 2 ? '<div class="fuel-chart"><canvas id="fuelChart"></canvas></div>' : ''}`;
}

function renderFuelChart(fuel) {
    const ctx = document.getElementById('fuelChart');
    if (fuelChart) {
        fuelChart.destroy();
        fuelChart = null;
    }
    if (!ctx) return;

    fuelChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: fuel.segments.map(s => AppData.formatDate(s.date)),
            datasets: [{
                label: `l/100 ${AppData.settings.distanceUnit}`,
                data: fuel.segments.map(s => Number(s.consumption.toFixed(2))),
                borderColor: '#0D9488',
                backgroundColor: 'rgba(13, 148, 136, 0.12)',
                fill: true,
                tension: 0.35,
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: false } }
        }
    });
}

function renderTimeline(expenses) {
    if (expenses.length === 0) {
        return '<div class="empty-state"><p>Todavía no hay gastos para este vehículo</p></div>';
    }

    const unit = AppData.settings.distanceUnit;
    const years = {};
    expenses.forEach(e => {
        const year = e.date.slice(0, 4);
        (years[year] = years[year] || []).push(e);
    });

    return Object.keys(years).sort().reverse().map(year => {
        const yearTotal = years[year].reduce((sum, e) => sum + parseFloat(e.cost), 0);
        return `
            <div class="timeline-year">
                <span>${year}</span>
                <span>${AppData.formatCurrency(yearTotal)}</span>
            </div>
            <div class="timeline">${years[year].map(e => {
                const meta = [
                    AppData.formatDate(e.date),
                    e.mileage ? `${AppData.formatNumber(e.mileage)} ${unit}` : '',
                    e.liters ? `${e.liters.toLocaleString('es-ES', { maximumFractionDigits: 2 })} l` : '',
                    e.shop ? escapeHtml(e.shop) : ''
                ].filter(Boolean).join(' · ');
                return `
                    <div class="timeline-item" data-id="${e.id}">
                        <span class="timeline-dot" style="background: ${getCategoryColor(e.category)}">${getCategoryIcon(e.category)}</span>
                        <div class="timeline-body">
                            <div class="timeline-title">${escapeHtml(e.description) || getCategoryLabel(e.category)}</div>
                            <div class="timeline-meta">${meta}</div>
                        </div>
                        <div class="timeline-cost">${AppData.formatCurrency(e.cost)}</div>
                        <button type="button" class="action-btn edit" onclick="openExpenseModal('${e.id}')" title="Editar gasto" aria-label="Editar gasto">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                    </div>`;
            }).join('')}
            </div>`;
    }).join('');
}

// ============================================
// EXPENSES
// ============================================

// Lowercase without accents, so "revision" finds "Revisión"
function normalizeSearch(text) {
    return String(text ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function expenseSearchText(expense) {
    const vehicle = AppData.vehicles.find(v => v.id === expense.vehicleId);
    const [year, month] = expense.date.split('-');
    return normalizeSearch([
        expense.description, expense.shop, expense.notes,
        vehicle ? `${vehicle.make} ${vehicle.model} ${vehicle.plate}` : '',
        getCategoryLabel(expense.category),
        AppData.formatDate(expense.date), `${MONTH_NAMES[Number(month) - 1]} ${year}`,
        AppData.formatCurrency(expense.cost), String(expense.cost).replace('.', ','),
        expense.mileage || ''
    ].join(' '));
}

// Expenses shown in the table, with its search, filters and sort order applied
function getFilteredExpenses() {
    const vehicleFilter = document.getElementById('filterVehicle')?.value || 'all';
    const categoryFilter = document.getElementById('filterCategory')?.value || 'all';
    const sortValue = document.getElementById('sortExpenses')?.value || 'date-desc';

    let filteredExpenses = [...AppData.expenses];

    const words = normalizeSearch(document.getElementById('searchExpenses')?.value).split(/\s+/).filter(Boolean);
    if (words.length) {
        filteredExpenses = filteredExpenses.filter(e => {
            const text = expenseSearchText(e);
            return words.every(word => text.includes(word));
        });
    }

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
    const search = document.getElementById('searchExpenses')?.value.trim() || '';
    const isFiltered = Boolean(search) || filteredExpenses.length !== AppData.expenses.length;
    const filteredTotal = filteredExpenses.reduce((sum, e) => sum + parseFloat(e.cost), 0);
    document.getElementById('expensesSummary').textContent = AppData.expenses.length === 0 ? '' :
        `${filteredExpenses.length} ${filteredExpenses.length === 1 ? 'gasto' : 'gastos'}${isFiltered ? ` de ${AppData.expenses.length}` : ''} · ${AppData.formatCurrency(filteredTotal)}`;

    const tbody = document.getElementById('expensesTableBody');

    if (filteredExpenses.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="7">
                    <div class="empty-state">
                        <p>${AppData.expenses.length === 0
                            ? 'No hay gastos registrados'
                            : search
                                ? `Ningún gasto coincide con «${escapeHtml(search)}»`
                                : 'Ningún gasto coincide con los filtros'}</p>
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
                <td class="col-date">${AppData.formatDate(expense.date)}</td>
                <td class="col-vehicle">${vehicleName(vehicle)}</td>
                <td class="col-category"><span class="category-badge ${expense.category}">${icon} ${getCategoryLabel(expense.category)}</span></td>
                <td class="col-desc">${escapeHtml(expense.description)}</td>
                <td class="col-km${expense.mileage ? '' : ' is-empty'}">${expense.mileage ? `${AppData.formatNumber(expense.mileage)} ${AppData.settings.distanceUnit}` : '—'}</td>
                <td class="cost col-cost">${AppData.formatCurrency(expense.cost)}</td>
                <td class="col-actions">
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
    document.getElementById('expenseFullTank').checked = true;
    resetMileageWarning();

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
            document.getElementById('expenseLiters').value = expense.liters ?? '';
            document.getElementById('expensePricePerLiter').value = expense.pricePerLiter ?? '';
            document.getElementById('expenseFullTank').checked = expense.fullTank ?? true;
        }
    } else {
        title.textContent = 'Registrar Gasto';
        document.getElementById('expenseId').value = '';
        
        if (preselectedVehicleId) {
            document.getElementById('expenseVehicle').value = preselectedVehicleId;
        }
    }

    toggleFuelFields();
    Motion.openModal(modal);
}

// ---------- Fuel fields ----------
function toggleFuelFields() {
    const isFuel = document.getElementById('expenseCategory').value === 'fuel';
    document.getElementById('fuelFields').hidden = !isFuel;
}

// With two of liters, price per liter and cost, the third one is calculated
function syncFuelValues(changedId) {
    const litersEl = document.getElementById('expenseLiters');
    const priceEl = document.getElementById('expensePricePerLiter');
    const costEl = document.getElementById('expenseCost');
    const liters = parseFloat(litersEl.value);
    const price = parseFloat(priceEl.value);
    const cost = parseFloat(costEl.value);

    if (changedId !== 'expenseCost' && liters > 0 && price > 0) {
        costEl.value = (liters * price).toFixed(2);
    } else if (changedId !== 'expensePricePerLiter' && liters > 0 && cost > 0) {
        priceEl.value = (cost / liters).toFixed(3);
    } else if (changedId !== 'expenseLiters' && price > 0 && cost > 0) {
        litersEl.value = (cost / price).toFixed(2);
    }
}

// ---------- Suspicious mileage ----------
// Returns a warning when the mileage does not fit the vehicle history, or null
function checkExpenseMileage(vehicleId, date, mileage, expenseId) {
    if (!mileage || !vehicleId || !date) return null;

    const unit = AppData.settings.distanceUnit;
    const fmt = n => `${AppData.formatNumber(n)} ${unit}`;
    const others = AppData.expenses.filter(e => e.vehicleId === vehicleId && e.id !== expenseId && e.mileage > 0);

    const earlierHigher = others
        .filter(e => e.date < date && e.mileage > mileage)
        .sort((a, b) => b.mileage - a.mileage)[0];
    if (earlierHigher) {
        return `El ${AppData.formatDate(earlierHigher.date)} el vehículo ya tenía ${fmt(earlierHigher.mileage)}, más que los ${fmt(mileage)} de este gasto.`;
    }

    const laterLower = others
        .filter(e => e.date > date && e.mileage < mileage)
        .sort((a, b) => a.mileage - b.mileage)[0];
    if (laterLower) {
        return `Un gasto posterior (${AppData.formatDate(laterLower.date)}) tiene ${fmt(laterLower.mileage)}, menos que los ${fmt(mileage)} de este.`;
    }

    const vehicle = AppData.vehicles.find(v => v.id === vehicleId);
    const known = Math.max(parseInt(vehicle?.mileage) || 0, ...others.map(e => e.mileage));
    if (known > 0 && mileage - known > 30000) {
        return `Son ${fmt(mileage - known)} más que el último dato (${fmt(known)}). ¿Sobra alguna cifra?`;
    }

    return null;
}

function showMileageWarning(message) {
    const warning = document.getElementById('mileageWarning');
    warning.innerHTML = `<strong>⚠️ Revisa el kilometraje.</strong> ${escapeHtml(message)} Si es correcto, pulsa «Guardar igualmente».`;
    warning.hidden = false;
    document.getElementById('expenseSubmit').textContent = 'Guardar igualmente';
    document.getElementById('expenseMileage').focus();
    if (!Motion.reduced) {
        warning.animate([
            { transform: 'translateX(0)' }, { transform: 'translateX(-8px)' },
            { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }
        ], { duration: 350, easing: 'ease-in-out' });
    }
}

function resetMileageWarning() {
    document.getElementById('mileageWarning').hidden = true;
    document.getElementById('expenseSubmit').textContent = 'Guardar';
    delete document.getElementById('expenseForm').dataset.confirmedMileage;
}

function closeExpenseModal() {
    Motion.closeModal(document.getElementById('expenseModal'));
}

function saveExpense(e) {
    e.preventDefault();

    const id = document.getElementById('expenseId').value;
    const vehicleId = document.getElementById('expenseVehicle').value;
    const mileage = parseInt(document.getElementById('expenseMileage').value) || 0;
    const date = document.getElementById('expenseDate').value;
    const category = document.getElementById('expenseCategory').value;
    const isFuel = category === 'fuel';

    // A suspicious mileage is shown once; saving again confirms it
    const form = document.getElementById('expenseForm');
    const warning = checkExpenseMileage(vehicleId, date, mileage, id);
    if (warning && form.dataset.confirmedMileage !== `${vehicleId}|${date}|${mileage}`) {
        showMileageWarning(warning);
        form.dataset.confirmedMileage = `${vehicleId}|${date}|${mileage}`;
        return;
    }

    const expenseData = {
        vehicleId: vehicleId,
        date: date,
        category: category,
        description: document.getElementById('expenseDescription').value.trim(),
        cost: parseFloat(document.getElementById('expenseCost').value),
        mileage: mileage,
        liters: isFuel ? parseFloat(document.getElementById('expenseLiters').value) || null : null,
        pricePerLiter: isFuel ? parseFloat(document.getElementById('expensePricePerLiter').value) || null : null,
        fullTank: isFuel ? document.getElementById('expenseFullTank').checked : null,
        shop: document.getElementById('expenseShop').value.trim(),
        notes: document.getElementById('expenseNotes').value.trim()
    };

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
    renderCurrentPage();
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
    Motion.openModal(document.getElementById('deleteModal'));
}

async function deleteExpense(expenseId) {
    closeDeleteModal();
    await Motion.leave(document.querySelector(`tr[data-id="${expenseId}"]`));
    AppData.expenses = AppData.expenses.filter(e => e.id !== expenseId);
    AppData.saveData();
    AppData.showToast('Gasto eliminado correctamente', 'success');
    renderCurrentPage();
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
            readings.push(getCurrentMileage(vehicle));
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
    Motion.openModal(document.getElementById('deleteModal'));
}

function clearAllData() {
    AppData.vehicles.forEach(v => Photos.remove(v.id));
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

async function exportData() {
    const result = await Backup.exportFile();
    if (result === 'cancelled') return;
    AppData.showToast(
        result === 'shared' ? 'Copia lista: guárdala donde prefieras' : 'Copia descargada (JSON)',
        'success'
    );
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

    // Photos (backup 1.2+): only for vehicles that do not have one yet
    let addedPhotos = 0;
    if (data.photos && typeof data.photos === 'object') {
        Object.entries(data.photos).forEach(([oldId, photo]) => {
            const vehicleId = idMap[oldId];
            const isImage = typeof photo === 'string' && photo.startsWith('data:image/') && photo.length < 5_000_000;
            if (vehicleId && isImage && !Photos.get(vehicleId)) {
                Photos.save(vehicleId, photo);
                addedPhotos++;
            }
        });
    }

    return { addedVehicles, addedExpenses, addedPhotos, wasEmpty };
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
        `Kilometraje (${AppData.settings.distanceUnit})`, `Coste (${AppData.settings.currency})`, 'Litros', 'Precio por litro', 'Depósito lleno', 'Taller', 'Notas'];
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
            e.liters ? String(e.liters).replace('.', ',') : '',
            e.pricePerLiter ? String(e.pricePerLiter).replace('.', ',') : '',
            e.fullTank === null ? '' : (e.fullTank ? 'Sí' : 'No'),
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
    tax: { label: 'Impuesto de circulación', icon: '🏛️', color: '#9333EA' },
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
    Motion.openModal(document.getElementById('privacyModal'));
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
    document.querySelectorAll('.color-swatch').forEach(swatch => {
        swatch.addEventListener('click', () => setVehicleColor(swatch.dataset.color));
    });
    document.getElementById('vehicleColor').addEventListener('input', e => setVehicleColor(e.target.value));
    document.getElementById('vehiclePhoto').addEventListener('change', handleVehiclePhoto);
    document.getElementById('removeVehiclePhoto').addEventListener('click', () => {
        pendingPhoto = null;
        showPhotoPreview(null);
    });
    document.getElementById('addVehicleBtn').addEventListener('click', () => openVehicleModal());

    // Expense form
    document.getElementById('expenseForm').addEventListener('submit', saveExpense);
    document.getElementById('expenseCategory').addEventListener('change', toggleFuelFields);
    ['expenseLiters', 'expensePricePerLiter', 'expenseCost'].forEach(fieldId => {
        document.getElementById(fieldId).addEventListener('change', () => {
            if (document.getElementById('expenseCategory').value === 'fuel') syncFuelValues(fieldId);
        });
    });
    ['expenseMileage', 'expenseDate', 'expenseVehicle'].forEach(fieldId => {
        document.getElementById(fieldId).addEventListener('input', resetMileageWarning);
    });
    document.getElementById('addExpenseBtn').addEventListener('click', () => openExpenseModal());
    document.getElementById('addExpenseBtnPage').addEventListener('click', () => openExpenseModal());
    document.getElementById('exportCsvBtn').addEventListener('click', exportExpensesCsv);

    // Expense filters
    document.getElementById('filterVehicle')?.addEventListener('change', renderExpenses);
    document.getElementById('filterCategory')?.addEventListener('change', renderExpenses);
    document.getElementById('sortExpenses')?.addEventListener('change', renderExpenses);

    // Search: updates as you type (slightly delayed) and can be cleared with ✕ or Escape
    const searchInput = document.getElementById('searchExpenses');
    const clearSearch = document.getElementById('clearSearch');
    let searchTimer = null;
    searchInput.addEventListener('input', () => {
        clearSearch.hidden = !searchInput.value;
        clearTimeout(searchTimer);
        searchTimer = setTimeout(renderExpenses, 150);
    });
    searchInput.addEventListener('keydown', e => {
        if (e.key === 'Escape' && searchInput.value) {
            e.stopPropagation();
            searchInput.value = '';
            clearSearch.hidden = true;
            renderExpenses();
        }
    });
    clearSearch.addEventListener('click', () => {
        searchInput.value = '';
        clearSearch.hidden = true;
        renderExpenses();
        searchInput.focus();
    });

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
    document.getElementById('sidebarExportData').addEventListener('click', exportData);
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
