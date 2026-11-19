// AutoCare Tracker - Accounts (Supabase Auth, email and password)
// Without a Supabase configuration the app keeps working as before, with the
// data only in this browser.

const Auth = {
    mode: 'login',

    async start() {
        if (!Cloud.configured()) {
            // Local mode: data in this browser only
            AppData.loadData();
            await Photos.load('');
            AppData.start();
            return;
        }

        Cloud.init();
        this.setupForms();

        Cloud.client.auth.onAuthStateChange((event, session) => {
            if (event === 'PASSWORD_RECOVERY') {
                this.show('newPassword');
            } else if (event === 'SIGNED_OUT') {
                this.show('login');
            }
            // Deferred so Supabase calls are not made inside its own callback
            if (event === 'SIGNED_IN' && session && !Cloud.user && this.mode !== 'newPassword') {
                setTimeout(() => this.enter(session.user), 0);
            }
        });

        const { data } = await Cloud.client.auth.getSession();
        if (data.session && this.mode !== 'newPassword') {
            await this.enter(data.session.user);
        } else if (this.mode !== 'newPassword') {
            this.show('login');
        }
    },

    // ---------- Screens ----------
    show(mode, message = '') {
        this.mode = mode;
        document.body.classList.add('auth-active');
        document.getElementById('authScreen').hidden = false;
        document.querySelectorAll('.auth-form').forEach(form => {
            form.hidden = form.dataset.mode !== mode;
        });
        this.message(message);
        const first = document.querySelector(`.auth-form[data-mode="${mode}"] input`);
        if (first && window.matchMedia('(pointer: fine)').matches) first.focus();
    },

    hide() {
        document.body.classList.remove('auth-active');
        document.getElementById('authScreen').hidden = true;
    },

    message(text, type = 'error') {
        const el = document.getElementById('authMessage');
        el.textContent = text;
        el.className = `auth-message ${type}`;
        el.hidden = !text;
    },

    busy(form, isBusy) {
        form.querySelectorAll('button, input').forEach(el => { el.disabled = isBusy; });
        const submit = form.querySelector('button[type="submit"]');
        if (submit) {
            submit.dataset.label = submit.dataset.label || submit.textContent;
            submit.textContent = isBusy ? 'Un momento…' : submit.dataset.label;
        }
    },

    // Supabase errors in plain Spanish
    explain(error) {
        const text = String(error?.message || error || '');
        const known = [
            [/invalid login credentials/i, 'Email o contraseña incorrectos.'],
            [/email not confirmed/i, 'Todavía no has confirmado tu email. Revisa tu bandeja de entrada (y el spam).'],
            [/already registered|already exists/i, 'Ya existe una cuenta con ese email. Prueba a entrar o a recuperar la contraseña.'],
            [/password should be at least|weak password/i, 'La contraseña es demasiado débil: usa al menos 8 caracteres, con letras y números.'],
            [/rate limit|too many requests|security purposes/i, 'Demasiados intentos seguidos. Espera un minuto y vuelve a probar.'],
            [/invalid email|unable to validate email/i, 'Ese email no parece válido.'],
            [/same password|different from the old/i, 'La nueva contraseña tiene que ser distinta de la anterior.'],
            [/failed to fetch|network/i, 'No hay conexión con el servidor. Revisa tu conexión a Internet.']
        ];
        const match = known.find(([pattern]) => pattern.test(text));
        return match ? match[1] : 'Algo ha fallado. Inténtalo de nuevo en unos segundos.';
    },

    setupForms() {
        document.querySelectorAll('[data-auth-go]').forEach(link => {
            link.addEventListener('click', e => {
                e.preventDefault();
                this.show(link.dataset.authGo);
            });
        });

        const redirectTo = `${location.origin}${location.pathname}`;

        document.getElementById('loginForm').addEventListener('submit', async e => {
            e.preventDefault();
            const form = e.currentTarget;
            this.busy(form, true);
            const { data, error } = await Cloud.client.auth.signInWithPassword({
                email: form.email.value.trim(),
                password: form.password.value
            });
            this.busy(form, false);
            if (error) return this.message(this.explain(error));
            form.reset();
            await this.enter(data.user);
        });

        document.getElementById('registerForm').addEventListener('submit', async e => {
            e.preventDefault();
            const form = e.currentTarget;
            if (form.password.value !== form.password2.value) {
                return this.message('Las dos contraseñas no coinciden.');
            }
            if (!form.privacy.checked) {
                return this.message('Para crear la cuenta tienes que aceptar la Política de Privacidad.');
            }
            this.busy(form, true);
            const { data, error } = await Cloud.client.auth.signUp({
                email: form.email.value.trim(),
                password: form.password.value,
                options: {
                    emailRedirectTo: redirectTo,
                    data: { privacy_accepted_at: new Date().toISOString(), privacy_version: '2026-11' }
                }
            });
            this.busy(form, false);
            if (error) return this.message(this.explain(error));
            form.reset();
            if (data.session) {
                await this.enter(data.user);
            } else {
                this.show('login', '');
                this.message('Te hemos enviado un email para confirmar tu cuenta. Ábrelo desde este dispositivo y después entra aquí.', 'success');
            }
        });

        document.getElementById('forgotForm').addEventListener('submit', async e => {
            e.preventDefault();
            const form = e.currentTarget;
            this.busy(form, true);
            const { error } = await Cloud.client.auth.resetPasswordForEmail(form.email.value.trim(), { redirectTo });
            this.busy(form, false);
            if (error) return this.message(this.explain(error));
            form.reset();
            this.show('login');
            this.message('Si hay una cuenta con ese email, te llegará un enlace para elegir una contraseña nueva.', 'success');
        });

        document.getElementById('newPasswordForm').addEventListener('submit', async e => {
            e.preventDefault();
            const form = e.currentTarget;
            if (form.password.value !== form.password2.value) {
                return this.message('Las dos contraseñas no coinciden.');
            }
            this.busy(form, true);
            const { data, error } = await Cloud.client.auth.updateUser({ password: form.password.value });
            this.busy(form, false);
            if (error) return this.message(this.explain(error));
            form.reset();
            AppData.showToast('Contraseña cambiada', 'success');
            this.mode = 'login';
            await this.enter(data.user);
        });

        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
        document.getElementById('deleteAccountBtn').addEventListener('click', () => this.confirmDeleteAccount());
    },

    // ---------- Signed in ----------
    async enter(user) {
        if (Cloud.user?.id === user.id) return;
        Cloud.user = user;
        this.hide();
        document.body.classList.add('cloud-mode');
        document.getElementById('accountEmail').textContent = user.email;
        document.getElementById('accountAvatar').textContent = (user.email || 'U')[0].toUpperCase();

        await Photos.load(`${user.id}:`);
        try {
            await Cloud.load();
        } catch (error) {
            console.error('Cloud load:', error);
            AppData.showToast('No se han podido cargar tus datos. Revisa la conexión.', 'error');
        }
        AppData.start();
        await this.offerMigration();
        Cloud.syncPhotos().then(() => renderCurrentPage());
    },

    // Data saved in this browser before having an account
    async offerMigration() {
        const flag = `autocare_migrated_${Cloud.user.id}`;
        if (localStorage.getItem(flag) || AppData.vehicles.length > 0) return;

        let vehicles = [];
        let expenses = [];
        let settings = null;
        try {
            vehicles = JSON.parse(localStorage.getItem('autocare_vehicles') || '[]').map(normalizeVehicle).filter(Boolean);
            expenses = JSON.parse(localStorage.getItem('autocare_expenses') || '[]').map(normalizeExpense).filter(Boolean);
            settings = JSON.parse(localStorage.getItem('autocare_settings') || 'null');
        } catch {
            return;
        }
        if (!vehicles.length) return;

        const ok = await AppDialog.confirm({
            title: 'Subir tus datos a tu cuenta',
            message: `En este navegador hay ${vehicles.length} ${vehicles.length === 1 ? 'vehículo' : 'vehículos'} y ${expenses.length} gastos de antes de tener cuenta. ¿Los subimos a tu cuenta para tenerlos en todos tus dispositivos?`,
            ok: 'Subir mis datos',
            cancel: 'Ahora no'
        });
        if (!ok) return;

        const vehicleIds = new Set(vehicles.map(v => v.id));
        AppData.vehicles = vehicles;
        AppData.expenses = expenses.filter(e => vehicleIds.has(e.vehicleId));
        if (settings) AppData.settings = { ...AppData.settings, ...settings };
        AppData.saveData();
        await Cloud.queue;

        if (AppData.vehicles.length) {
            const photos = await Photos.legacy();
            for (const [vehicleId, dataUrl] of Object.entries(photos)) {
                if (vehicleIds.has(vehicleId)) await Photos.save(vehicleId, dataUrl);
            }
            localStorage.setItem(flag, new Date().toISOString());
            AppData.showToast('Tus datos ya están en tu cuenta', 'success');
            renderCurrentPage();
            updateDashboard();
        }
    },

    async logout() {
        const ok = await AppDialog.confirm({
            title: 'Cerrar sesión',
            message: 'Se borrará la copia de tus datos guardada en este dispositivo. En tu cuenta no se pierde nada.',
            ok: 'Cerrar sesión'
        });
        if (!ok) return;
        await this.forgetDevice();
        await Cloud.client.auth.signOut();
        location.reload();
    },

    async forgetDevice() {
        if (!Cloud.user) return;
        localStorage.removeItem(Cloud.cacheKey());
        await Photos.clearPrefix(`${Cloud.user.id}:`);
    },

    // Right to erasure: the account, its data and its photos
    async confirmDeleteAccount() {
        const ok = await AppDialog.confirm({
            title: 'Eliminar mi cuenta',
            message: 'Se borrarán para siempre tu cuenta, tus vehículos, tus gastos y tus fotos. No se puede deshacer. Si quieres conservar algo, descarga antes tus datos en JSON.',
            ok: 'Eliminar mi cuenta',
            danger: true
        });
        if (!ok) return;
        if (!navigator.onLine) {
            AppData.showToast('Necesitas conexión para eliminar la cuenta', 'error');
            return;
        }
        const { error } = await Cloud.client.functions.invoke('delete-account', { method: 'POST' });
        if (error) {
            console.error('Delete account:', error);
            AppData.showToast('No se ha podido eliminar la cuenta. Inténtalo de nuevo.', 'error');
            return;
        }
        await this.forgetDevice();
        await Cloud.client.auth.signOut({ scope: 'local' });
        alert('Tu cuenta y todos sus datos se han eliminado.');
        location.reload();
    }
};

// Small confirmation dialog with the app's style
const AppDialog = {
    confirm({ title, message, ok = 'Aceptar', cancel = 'Cancelar', danger = false }) {
        return new Promise(resolve => {
            const modal = document.getElementById('confirmModal');
            document.getElementById('confirmTitle').textContent = title;
            document.getElementById('confirmMessage').textContent = message;
            const okBtn = document.getElementById('confirmOk');
            const cancelBtn = document.getElementById('confirmCancel');
            okBtn.textContent = ok;
            okBtn.className = `btn ${danger ? 'btn-danger' : 'btn-primary'}`;
            cancelBtn.textContent = cancel;

            const close = result => {
                okBtn.onclick = null;
                cancelBtn.onclick = null;
                Motion.closeModal(modal);
                resolve(result);
            };
            okBtn.onclick = () => close(true);
            cancelBtn.onclick = () => close(false);
            Motion.openModal(modal);
        });
    }
};
