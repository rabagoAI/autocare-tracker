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
        tiresInterval: 40000
    },

    init() {
        this.loadData();
        this.setupEventListeners();
        renderCurrentPage();
        updateDashboard();
    },

    loadData() {
        try {
            const vehiclesData = localStorage.getItem('autocare_vehicles');
            const expensesData = localStorage.getItem('autocare_expenses');
            const settingsData = localStorage.getItem('autocare_settings');

            if (vehiclesData) {
                this.vehicles = JSON.parse(vehiclesData);
            }
            if (expensesData) {
                this.expenses = JSON.parse(expensesData);
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
        } catch (error) {
            console.error('Error saving data:', error);
            this.showToast('Error al guardar los datos', 'error');
        }
    },

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    getCurrencySymbol() {
        const symbols = { EUR: '€', USD: '$', GBP: '£' };
        return symbols[this.settings.currency] || '€';
    },

    formatCurrency(amount) {
        return `${this.getCurrencySymbol()}${parseFloat(amount).toFixed(2)}`;
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

    document.getElementById('totalVehicles').textContent = totalVehicles;
    document.getElementById('totalExpenses').textContent = AppData.formatCurrency(totalExpenses);
    document.getElementById('monthlyExpenses').textContent = AppData.formatCurrency(monthlyExpenses);
    document.getElementById('pendingAlerts').textContent = alerts.length;

    renderRecentActivity();
    renderAlerts(alerts);
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
        const lastITV = vehicleExpenses.find(e => e.category === 'itv');
        if (lastITV) {
            const itvDate = new Date(lastITV.date);
            const nextITV = new Date(itvDate);
            nextITV.setMonth(nextITV.getMonth() + AppData.settings.itvInterval);
            
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

        // Tires alert
        const lastTires = vehicleExpenses.find(e => e.category === 'tires');
        if (lastTires) {
            const lastTiresMileage = parseInt(lastTires.mileage);
            const tiresDueMileage = lastTiresMileage + AppData.settings.tiresInterval;

            if (tiresDueMileage - lastMileage <= 5000) {
                const status = tiresDueMileage <= lastMileage ? 'danger' : 'warning';
                alerts.push({
                    vehicle: vehicle,
                    type: 'tires',
                    title: 'Cambio de neumáticos',
                    message: `${vehicle.make} ${vehicle.model}: ${AppData.formatNumber(Math.max(0, tiresDueMileage - lastMileage))} ${AppData.settings.distanceUnit} restantes`,
                    status: status,
                    priority: 2
                });
            }
        }
    });

    return alerts.sort((a, b) => a.priority - b.priority);
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
        const vehicleName = vehicle ? `${vehicle.make} ${vehicle.model}` : 'Vehículo desconocido';
        const icon = getCategoryIcon(expense.category);

        return `
            <div class="activity-item">
                <div class="activity-icon">${icon}</div>
                <div class="activity-content">
                    <div class="activity-title">${expense.description}</div>
                    <div class="activity-meta">${vehicleName} • ${AppData.formatDate(expense.date)}</div>
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
                <div class="alert-title">${alert.title}</div>
                <div class="alert-message">${alert.message}</div>
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
    const colors = [
        '#F59E0B', '#4F46E5', '#059669', '#DC2626', 
        '#4338CA', '#2563EB', '#059669', '#6B7280'
    ];

    if (expensesChart) {
        expensesChart.destroy();
    }

    expensesChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, labels.length),
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

function renderVehicles() {
    const container = document.getElementById('vehiclesGrid');

    if (AppData.vehicles.length === 0) {
        container.innerHTML = `
            <div class="empty-state large">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M5 17a2 2 0 1 0 4 0a2 2 0 0 0-4 0M15 17a2 2 0 1 0 4 0a2 2 0 0 0-4 0"/>
                    <path d="M5 17V8l4-3 4 3v9"/>
                </svg>
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
            <div class="vehicle-card">
                <div class="vehicle-header">
                    <div class="vehicle-image">${vehicleIcon}</div>
                    <div class="vehicle-info">
                        <h3>${vehicle.make} ${vehicle.model}</h3>
                        <p>${vehicle.year || 'N/A'} • ${vehicle.plate}</p>
                    </div>
                </div>
                <div class="vehicle-stats">
                    <div class="vehicle-stat">
                        <div class="vehicle-stat-value">${AppData.formatNumber(vehicle.mileage)}</div>
                        <div class="vehicle-stat-label">Kilómetros</div>
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
            document.getElementById('vehicleNotes').value = vehicle.notes || '';
        }
    } else {
        title.textContent = 'Añadir Vehículo';
        document.getElementById('vehicleId').value = '';
        document.getElementById('expenseDate').valueAsDate = new Date();
    }

    modal.classList.add('active');
}

function closeVehicleModal() {
    document.getElementById('vehicleModal').classList.remove('active');
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
            ...vehicleData
        };
        AppData.vehicles.push(newVehicle);
        AppData.showToast('Vehículo añadido correctamente', 'success');
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

function deleteVehicle(vehicleId) {
    AppData.vehicles = AppData.vehicles.filter(v => v.id !== vehicleId);
    AppData.expenses = AppData.expenses.filter(e => e.vehicleId !== vehicleId);
    AppData.saveData();
    closeDeleteModal();
    AppData.showToast('Vehículo eliminado correctamente', 'success');
    renderVehicles();
    updateDashboard();
}

// ============================================
// EXPENSES
// ============================================

function renderExpenses() {
    const vehicleFilter = document.getElementById('filterVehicle')?.value || 'all';
    const categoryFilter = document.getElementById('filterCategory')?.value || 'all';
    const sortValue = document.getElementById('sortExpenses')?.value || 'date-desc';

    // Update vehicle filter options
    const vehicleSelect = document.getElementById('filterVehicle');
    if (vehicleSelect) {
        const currentValue = vehicleSelect.value;
        vehicleSelect.innerHTML = '<option value="all">Todos los vehículos</option>' +
            AppData.vehicles.map(v => `<option value="${v.id}">${v.make} ${v.model}</option>`).join('');
        vehicleSelect.value = currentValue;
    }

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
        const vehicleName = vehicle ? `${vehicle.make} ${vehicle.model}` : 'Vehículo eliminado';
        const icon = getCategoryIcon(expense.category);

        return `
            <tr>
                <td>${AppData.formatDate(expense.date)}</td>
                <td>${vehicleName}</td>
                <td><span class="category-badge ${expense.category}">${icon} ${getCategoryLabel(expense.category)}</span></td>
                <td>${expense.description}</td>
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
        AppData.vehicles.map(v => `<option value="${v.id}">${v.make} ${v.model} (${v.plate})</option>`).join('');

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
    document.getElementById('expenseModal').classList.remove('active');
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

function deleteExpense(expenseId) {
    AppData.expenses = AppData.expenses.filter(e => e.id !== expenseId);
    AppData.saveData();
    closeDeleteModal();
    AppData.showToast('Gasto eliminado correctamente', 'success');
    renderExpenses();
    updateDashboard();
}

function closeDeleteModal() {
    document.getElementById('deleteModal').classList.remove('active');
}

// ============================================
// REPORTS
// ============================================

function renderReports() {
    renderCategoryReportChart();
    renderMonthlyReportChart();
    renderVehicleSummary();
    renderKmCostSummary();
}

function renderCategoryReportChart() {
    const ctx = document.getElementById('categoryReportChart');
    if (!ctx) return;

    const categories = {};
    AppData.expenses.forEach(e => {
        categories[e.category] = (categories[e.category] || 0) + parseFloat(e.cost);
    });

    const labels = Object.keys(categories).map(c => getCategoryLabel(c));
    const data = Object.values(categories);
    const colors = [
        '#F59E0B', '#4F46E5', '#059669', '#DC2626', 
        '#4338CA', '#2563EB', '#059669', '#6B7280'
    ];

    if (categoryReportChart) {
        categoryReportChart.destroy();
    }

    categoryReportChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, labels.length),
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

function renderMonthlyReportChart() {
    const ctx = document.getElementById('monthlyReportChart');
    if (!ctx) return;

    const monthlyData = {};
    const currentYear = new Date().getFullYear();

    // Initialize all months with 0
    for (let i = 0; i < 12; i++) {
        monthlyData[i] = 0;
    }

    // Fill with actual data
    AppData.expenses
        .filter(e => new Date(e.date).getFullYear() === currentYear)
        .forEach(e => {
            const month = new Date(e.date).getMonth();
            monthlyData[month] += parseFloat(e.cost);
        });

    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    if (monthlyReportChart) {
        monthlyReportChart.destroy();
    }

    monthlyReportChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: monthNames,
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

function renderVehicleSummary() {
    const container = document.getElementById('vehicleSummary');

    if (AppData.vehicles.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No hay vehículos registrados</p></div>';
        return;
    }

    const summaries = AppData.vehicles.map(vehicle => {
        const vehicleExpenses = AppData.expenses
            .filter(e => e.vehicleId === vehicle.id)
            .reduce((sum, e) => sum + parseFloat(e.cost), 0);

        return {
            name: `${vehicle.make} ${vehicle.model}`,
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

function renderKmCostSummary() {
    const container = document.getElementById('kmCostSummary');

    if (AppData.vehicles.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No hay vehículos registrados</p></div>';
        return;
    }

    const summaries = AppData.vehicles.map(vehicle => {
        const vehicleExpenses = AppData.expenses
            .filter(e => e.vehicleId === vehicle.id)
            .reduce((sum, e) => sum + parseFloat(e.cost), 0);

        const mileage = parseInt(vehicle.mileage) || 1;
        const costPerKm = vehicleExpenses / mileage;

        return {
            name: `${vehicle.make} ${vehicle.model}`,
            costPerKm: costPerKm
        };
    });

    container.innerHTML = summaries.map(s => `
        <div class="summary-item">
            <span class="summary-item-name">${s.name}</span>
            <span class="summary-item-value">${AppData.formatCurrency(s.costPerKm)}/${AppData.settings.distanceUnit}</span>
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
    updateLastBackupInfo(false);
}

function saveSettings() {
    AppData.settings.currency = document.getElementById('currencySetting').value;
    AppData.settings.distanceUnit = document.getElementById('distanceSetting').value;
    AppData.settings.oilInterval = parseInt(document.getElementById('oilInterval').value) || 15000;
    AppData.settings.brakesInterval = parseInt(document.getElementById('brakesInterval').value) || 20000;
    AppData.settings.itvInterval = parseInt(document.getElementById('itvInterval').value) || 24;
    AppData.settings.tiresInterval = parseInt(document.getElementById('tiresInterval').value) || 40000;

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
    const exportObj = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        appName: 'AutoCare Tracker',
        data: {
            vehicles: AppData.vehicles,
            expenses: AppData.expenses
        }
    };

    const dataStr = JSON.stringify(exportObj, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `autocare-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Update last backup info
    updateLastBackupInfo(true);

    AppData.showToast('Datos exportados correctamente', 'success');
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

            // Show confirmation dialog
            const vehicleCount = importObj.data.vehicles.length;
            const expenseCount = importObj.data.expenses.length;
            const currentVehicles = AppData.vehicles.length;
            const currentExpenses = AppData.expenses.length;

            const confirmMsg = `¿Estás seguro de importar estos datos?\n\n` +
                `📁 Archivo: ${vehicleCount} vehículos, ${expenseCount} gastos\n` +
                `💾 Actual: ${currentVehicles} vehículos, ${currentExpenses} gastos\n\n` +
                `⚠️ Esta acción sobrescribirá tus datos actuales.`;

            if (confirm(confirmMsg)) {
                // Merge vehicles (avoid duplicates by plate)
                const existingPlates = new Set(AppData.vehicles.map(v => v.plate));
                const newVehicles = importObj.data.vehicles.filter(v => !existingPlates.has(v.plate));
                AppData.vehicles = [...AppData.vehicles, ...newVehicles];

                // Replace expenses (or merge by ID)
                const existingIds = new Set(AppData.expenses.map(e => e.id));
                const newExpenses = importObj.data.expenses.filter(e => !existingIds.has(e.id));
                AppData.expenses = [...AppData.expenses, ...newExpenses];

                AppData.saveData();
                updateLastBackupInfo(false, importObj.exportDate);

                AppData.showToast(`Importados ${newVehicles.length} vehículos y ${newExpenses.length} gastos`, 'success');
                renderVehicles();
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

function updateLastBackupInfo(isExport, dateStr = null) {
    const infoEl = document.getElementById('lastBackupInfo');
    const now = new Date().toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    if (isExport) {
        infoEl.innerHTML = `✅ Última exportación: ${now}`;
        infoEl.className = 'backup-info success';
    } else if (dateStr) {
        const importDate = new Date(dateStr).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        infoEl.innerHTML = `📥 Última importación: ${importDate}`;
        infoEl.className = 'backup-info success';
    } else {
        // Check for existing backup info
        const lastBackup = localStorage.getItem('autocare_lastBackup');
        if (lastBackup) {
            const backupDate = new Date(lastBackup).toLocaleDateString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            infoEl.innerHTML = `📁 Última copia: ${backupDate}`;
            infoEl.className = 'backup-info';
        } else {
            infoEl.innerHTML = '';
        }
    }

    if (isExport || dateStr) {
        localStorage.setItem('autocare_lastBackup', new Date().toISOString());
    }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getCategoryIcon(category) {
    const icons = {
        oil: '🛢️',
        tires: '🍘',
        itv: '📋',
        parts: '🔧',
        maintenance: '🔨',
        insurance: '🛡️',
        fuel: '⛽',
        other: '📦'
    };
    return icons[category] || '📦';
}

function getCategoryLabel(category) {
    const labels = {
        oil: 'Cambio de Aceite',
        tires: 'Ruedas/Neumáticos',
        itv: 'ITV',
        parts: 'Piezas/Repuestos',
        maintenance: 'Mantenimiento General',
        insurance: 'Seguro',
        fuel: 'Combustible',
        other: 'Otros'
    };
    return labels[category] || 'Otros';
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
    updateLastBackupInfo(false); // Check for existing backup info

    // Report date range
    document.getElementById('generateReport')?.addEventListener('click', () => {
        renderReports();
        AppData.showToast('Informe actualizado', 'success');
    });

    // Modal overlays
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', () => {
            document.querySelectorAll('.modal').forEach(modal => modal.classList.remove('active'));
        });
    });

    // Close modals on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal').forEach(modal => modal.classList.remove('active'));
        }
    });
};

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    AppData.init();
});
