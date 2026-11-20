// AutoCare Tracker - Supabase sync
// The app keeps its data in AppData and calls AppData.saveData() after every
// change. When signed in, saveData() asks Cloud.sync() to push only the
// differences (new, changed and deleted rows) since the last successful sync.
// Offline the last synced data is shown from a local cache; changes are not
// allowed and are undone.

const Cloud = {
    client: null,
    user: null,
    synced: { vehicles: {}, expenses: {}, settings: '' },
    queue: Promise.resolve(),
    PAGE: 1000,

    configured() {
        const config = window.AUTOCARE_CONFIG || {};
        return Boolean(config.supabaseUrl && config.supabaseKey && window.supabase?.createClient);
    },

    init() {
        if (!this.configured() || this.client) return;
        const { supabaseUrl, supabaseKey } = window.AUTOCARE_CONFIG;
        this.client = window.supabase.createClient(supabaseUrl, supabaseKey, {
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
        });
        window.addEventListener('online', () => this.renderStatus());
        window.addEventListener('offline', () => this.renderStatus());
    },

    // ---------- Row mapping (app ↔ database) ----------
    vehicleToRow(v) {
        return {
            id: v.id,
            make: v.make,
            model: v.model,
            year: v.year || null,
            plate: v.plate,
            mileage: parseInt(v.mileage) || 0,
            initial_mileage: v.initialMileage ?? null,
            registration_date: v.registrationDate || null,
            insurance_due: v.insuranceDue || null,
            tax_due: v.taxDue || null,
            color: v.color || null,
            fuel_type: v.fuelType || null,
            notes: v.notes || ''
        };
    },

    vehicleFromRow(r) {
        return normalizeVehicle({
            id: r.id, make: r.make, model: r.model, year: r.year, plate: r.plate,
            mileage: r.mileage, initialMileage: r.initial_mileage,
            registrationDate: r.registration_date || '', insuranceDue: r.insurance_due || '', taxDue: r.tax_due || '',
            color: r.color || '', fuelType: r.fuel_type || '', notes: r.notes
        });
    },

    expenseToRow(e) {
        return {
            id: e.id,
            vehicle_id: e.vehicleId,
            date: e.date,
            category: e.category,
            description: e.description || '',
            cost: Number(parseFloat(e.cost).toFixed(2)) || 0,
            mileage: parseInt(e.mileage) || 0,
            liters: e.liters ?? null,
            price_per_liter: e.pricePerLiter ?? null,
            full_tank: e.fullTank ?? null,
            shop: e.shop || '',
            notes: e.notes || ''
        };
    },

    expenseFromRow(r) {
        return normalizeExpense({
            id: r.id, vehicleId: r.vehicle_id, date: r.date, category: r.category, description: r.description,
            cost: r.cost, mileage: r.mileage, liters: r.liters, pricePerLiter: r.price_per_liter,
            fullTank: r.full_tank, shop: r.shop, notes: r.notes
        });
    },

    // ---------- Local cache (read-only offline) ----------
    cacheKey() {
        return `autocare_cloud_${this.user.id}`;
    },

    saveCache() {
        try {
            localStorage.setItem(this.cacheKey(), JSON.stringify({
                vehicles: AppData.vehicles, expenses: AppData.expenses, settings: AppData.settings, savedAt: new Date().toISOString()
            }));
        } catch (error) {
            console.warn('Cloud cache:', error);
        }
    },

    loadCache() {
        try {
            const cached = JSON.parse(localStorage.getItem(this.cacheKey()) || 'null');
            if (!cached) return false;
            AppData.vehicles = (cached.vehicles || []).map(normalizeVehicle).filter(Boolean);
            AppData.expenses = (cached.expenses || []).map(normalizeExpense).filter(Boolean);
            AppData.settings = { ...AppData.settings, ...(cached.settings || {}) };
            return true;
        } catch {
            return false;
        }
    },

    takeSnapshot() {
        this.synced = {
            vehicles: Object.fromEntries(AppData.vehicles.map(v => [v.id, JSON.stringify(this.vehicleToRow(v))])),
            expenses: Object.fromEntries(AppData.expenses.map(e => [e.id, JSON.stringify(this.expenseToRow(e))])),
            settings: JSON.stringify(AppData.settings)
        };
    },

    // ---------- Load everything for the signed-in user ----------
    // Oldest first, so the garage shows the vehicles in the order they were added
    async fetchAll(table) {
        const rows = [];
        for (let from = 0; ; from += this.PAGE) {
            const { data, error } = await this.client.from(table).select('*')
                .order('created_at').order('id').range(from, from + this.PAGE - 1);
            if (error) throw error;
            rows.push(...data);
            if (data.length < this.PAGE) return rows;
        }
    },

    async load() {
        try {
            const [vehicles, expenses, settingsRows] = await Promise.all([
                this.fetchAll('vehicles'),
                this.fetchAll('expenses'),
                this.client.from('user_settings').select('settings').then(({ data, error }) => {
                    if (error) throw error;
                    return data;
                })
            ]);
            AppData.vehicles = vehicles.map(r => this.vehicleFromRow(r)).filter(Boolean);
            AppData.expenses = expenses.map(r => this.expenseFromRow(r)).filter(Boolean);
            AppData.settings = { ...AppData.defaultSettings, ...(settingsRows[0]?.settings || {}) };
            this.takeSnapshot();
            this.saveCache();
            this.offlineData = false;
        } catch (error) {
            console.warn('Cloud load:', error);
            this.offlineData = this.loadCache();
            this.takeSnapshot();
            if (!this.offlineData) throw error;
        }
        this.renderStatus();
    },

    // ---------- Push changes ----------
    sync() {
        // Changes are applied one after another, each against the last synced state
        this.queue = this.queue.then(() => this.pushChanges()).catch(() => {});
        return this.queue;
    },

    async pushChanges() {
        const vehicles = AppData.vehicles.map(v => this.vehicleToRow(v));
        const expenses = AppData.expenses.map(e => this.expenseToRow(e));
        const changed = (rows, synced) => rows.filter(r => synced[r.id] !== JSON.stringify(r));
        const removed = (rows, synced) => Object.keys(synced).filter(id => !rows.some(r => r.id === id));

        const upsertVehicles = changed(vehicles, this.synced.vehicles);
        const upsertExpenses = changed(expenses, this.synced.expenses);
        const deleteExpenses = removed(expenses, this.synced.expenses);
        const deleteVehicles = removed(vehicles, this.synced.vehicles);
        const settingsChanged = JSON.stringify(AppData.settings) !== this.synced.settings;

        if (!upsertVehicles.length && !upsertExpenses.length && !deleteExpenses.length && !deleteVehicles.length && !settingsChanged) {
            return;
        }

        if (!navigator.onLine) {
            this.revert('Sin conexión: el cambio no se ha guardado. Puedes consultar tus datos, pero para editar necesitas conexión.');
            return;
        }

        try {
            const check = ({ error }) => { if (error) throw error; };
            // New vehicles one by one, so each gets its own created_at and the
            // garage keeps the order in which they were added
            const newVehicles = upsertVehicles.filter(r => !(r.id in this.synced.vehicles));
            const changedVehicles = upsertVehicles.filter(r => r.id in this.synced.vehicles);
            for (const row of newVehicles) {
                check(await this.client.from('vehicles').upsert(row, { onConflict: 'user_id,id' }));
            }
            if (changedVehicles.length) check(await this.client.from('vehicles').upsert(changedVehicles, { onConflict: 'user_id,id' }));
            for (let i = 0; i < upsertExpenses.length; i += 500) {
                check(await this.client.from('expenses').upsert(upsertExpenses.slice(i, i + 500), { onConflict: 'user_id,id' }));
            }
            if (deleteExpenses.length) check(await this.client.from('expenses').delete().in('id', deleteExpenses));
            if (deleteVehicles.length) check(await this.client.from('vehicles').delete().in('id', deleteVehicles));
            if (settingsChanged) {
                check(await this.client.from('user_settings').upsert({ settings: AppData.settings }, { onConflict: 'user_id' }));
            }
            this.takeSnapshot();
            this.saveCache();
        } catch (error) {
            console.error('Cloud sync:', error);
            this.revert('No se ha podido guardar en tu cuenta. Revisa la conexión e inténtalo de nuevo.');
        }
    },

    // Back to the last state saved in the cloud
    revert(message) {
        const cached = this.synced;
        AppData.vehicles = Object.values(cached.vehicles).map(json => this.vehicleFromRow(JSON.parse(json))).filter(Boolean);
        AppData.expenses = Object.values(cached.expenses).map(json => this.expenseFromRow(JSON.parse(json))).filter(Boolean);
        if (cached.settings) AppData.settings = JSON.parse(cached.settings);
        AppData.showToast(message, 'error');
        renderCurrentPage();
        updateDashboard();
    },

    // ---------- Photos (Storage, private folder per user) ----------
    photoPath(vehicleId) {
        return `${this.user.id}/${vehicleId}.jpg`;
    },

    async uploadPhoto(vehicleId, dataUrl) {
        if (!this.user || !navigator.onLine) return false;
        let error;
        try {
            // Decoded by hand: the CSP (connect-src) does not allow fetch() on data: URLs
            const [meta, base64] = dataUrl.split(',');
            const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
            const blob = new Blob([bytes], { type: meta.slice(5).split(';')[0] || 'image/jpeg' });
            ({ error } = await this.client.storage.from('vehicle-photos')
                .upload(this.photoPath(vehicleId), blob, { upsert: true, contentType: blob.type }));
        } catch (uploadError) {
            error = uploadError;
        }
        if (error) {
            console.error('Photo upload:', error);
            AppData.showToast('No se ha podido subir la foto a tu cuenta', 'error');
            return false;
        }
        return true;
    },

    async removePhoto(vehicleId) {
        if (!this.user || !navigator.onLine) return;
        const { error } = await this.client.storage.from('vehicle-photos').remove([this.photoPath(vehicleId)]);
        if (error) console.warn('Photo remove:', error);
    },

    // Downloads the photos of the account into the local photo cache
    async syncPhotos() {
        if (!this.user || !navigator.onLine) return;
        const { data, error } = await this.client.storage.from('vehicle-photos').list(this.user.id, { limit: 1000 });
        if (error) {
            console.warn('Photo list:', error);
            return;
        }
        const remote = new Set(data.map(f => f.name.replace(/\.jpg$/, '')));
        for (const vehicleId of remote) {
            if (Photos.get(vehicleId)) continue;
            const { data: blob, error: downloadError } = await this.client.storage.from('vehicle-photos').download(this.photoPath(vehicleId));
            if (downloadError) continue;
            const dataUrl = await new Promise(resolve => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            });
            await Photos.save(vehicleId, dataUrl, { local: true });
        }
        // Photos deleted from another device
        for (const vehicleId of Object.keys(Photos.cache)) {
            if (!remote.has(vehicleId)) await Photos.remove(vehicleId, { local: true });
        }
    },

    // ---------- Offline banner ----------
    renderStatus() {
        const banner = document.getElementById('offlineBanner');
        if (!banner) return;
        banner.hidden = navigator.onLine && !this.offlineData;
    }
};
