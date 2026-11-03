// AutoCare Tracker - Data protection
// Persistent storage, backup reminder and backups to a folder of your choice.
// Nothing leaves the device: the folder is on your computer (if it is synced
// with Google Drive or similar, that service uploads it, not this app).

const Backup = {
    KEYS: {
        lastBackup: 'autocare_lastBackup',
        lastBackupMethod: 'autocare_lastBackupMethod',
        lastChange: 'autocare_lastChange',
        snoozeUntil: 'autocare_backupSnooze'
    },
    SNOOZE_DAYS: 7,
    AUTO_SAVE_DELAY: 3000,

    folderSupported: 'showDirectoryPicker' in window,
    folderName: '',
    folderGranted: false,
    persisted: null,
    persistRequested: false,
    autoSaveTimer: null,

    async init() {
        if (navigator.storage?.persisted) {
            this.persisted = await navigator.storage.persisted();
        }
        if (this.folderSupported) {
            const handle = await this.getFolderHandle();
            if (handle) {
                this.folderName = handle.name;
                this.folderGranted = await handle.queryPermission({ mode: 'readwrite' }) === 'granted';
            }
        }
        this.renderStatus();
        this.renderReminder();
    },

    // ---------- Data ----------
    hasData() {
        return AppData.vehicles.length > 0 || AppData.expenses.length > 0;
    },

    buildJson() {
        return JSON.stringify({
            version: '1.1',
            exportDate: new Date().toISOString(),
            appName: 'AutoCare Tracker',
            data: {
                vehicles: AppData.vehicles,
                expenses: AppData.expenses,
                settings: AppData.settings
            }
        }, null, 2);
    },

    fileName() {
        return `autocare-backup-${new Date().toISOString().split('T')[0]}.json`;
    },

    readDate(key) {
        try {
            const value = localStorage.getItem(key);
            return value ? new Date(value) : null;
        } catch {
            return null;
        }
    },

    markBackup(method) {
        try {
            localStorage.setItem(this.KEYS.lastBackup, new Date().toISOString());
            localStorage.setItem(this.KEYS.lastBackupMethod, method);
            localStorage.removeItem(this.KEYS.snoozeUntil);
        } catch (error) {
            console.warn('Backup:', error);
        }
        this.renderStatus();
        this.renderReminder();
    },

    // Called from AppData.saveData() every time something changes
    onDataChanged() {
        try {
            localStorage.setItem(this.KEYS.lastChange, new Date().toISOString());
        } catch (error) {
            console.warn('Backup:', error);
        }
        if (this.hasData()) {
            this.requestPersistence();
        }
        this.scheduleAutoSave();
        this.renderReminder();
    },

    hasUnsavedChanges() {
        const lastBackup = this.readDate(this.KEYS.lastBackup);
        const lastChange = this.readDate(this.KEYS.lastChange);
        return !lastBackup || (lastChange && lastChange > lastBackup);
    },

    daysSince(date) {
        return Math.floor((Date.now() - date) / (1000 * 60 * 60 * 24));
    },

    // ---------- Persistent storage ----------
    async requestPersistence(fromUser = false) {
        if (!navigator.storage?.persist || this.persisted) return this.persisted;
        if (this.persistRequested && !fromUser) return this.persisted;
        this.persistRequested = true;

        try {
            this.persisted = await navigator.storage.persist();
        } catch (error) {
            console.warn('Persistent storage:', error);
        }
        this.renderStatus();

        if (fromUser) {
            AppData.showToast(
                this.persisted
                    ? 'Almacenamiento protegido: el navegador no borrará tus datos'
                    : 'El navegador no ha concedido la protección. Instala la app o haz copias a menudo',
                this.persisted ? 'success' : 'error'
            );
        }
        return this.persisted;
    },

    // ---------- Download ----------
    download() {
        const url = URL.createObjectURL(new Blob([this.buildJson()], { type: 'application/json' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = this.fileName();
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.markBackup('download');
    },

    // Best available option: the folder if there is one, otherwise a download
    async saveNow() {
        if (this.folderSupported && this.folderName) {
            if (await this.saveToFolder(true)) return;
        }
        this.download();
        AppData.showToast('Copia descargada', 'success');
    },

    // ---------- Folder (File System Access API, Chrome/Edge desktop) ----------
    idb(mode, action) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('autocare', 1);
            request.onupgradeneeded = () => request.result.createObjectStore('handles');
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const db = request.result;
                const tx = db.transaction('handles', mode);
                const result = action(tx.objectStore('handles'));
                tx.oncomplete = () => {
                    db.close();
                    resolve(result.result);
                };
                tx.onerror = () => reject(tx.error);
            };
        });
    },

    async getFolderHandle() {
        try {
            return await this.idb('readonly', store => store.get('backupFolder'));
        } catch {
            return null;
        }
    },

    async chooseFolder() {
        if (!this.folderSupported) return;
        try {
            const handle = await window.showDirectoryPicker({ id: 'autocare-backup', mode: 'readwrite', startIn: 'documents' });
            await this.idb('readwrite', store => store.put(handle, 'backupFolder'));
            this.folderName = handle.name;
            this.folderGranted = true;
            await this.saveToFolder(false);
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Backup folder:', error);
                AppData.showToast('No se ha podido usar esa carpeta', 'error');
            }
        }
    },

    async forgetFolder() {
        try {
            await this.idb('readwrite', store => store.delete('backupFolder'));
        } catch (error) {
            console.warn('Backup folder:', error);
        }
        this.folderName = '';
        this.folderGranted = false;
        this.renderStatus();
        AppData.showToast('Carpeta de copias olvidada', 'success');
    },

    // interactive: may ask for permission again (needs a click from the user)
    async saveToFolder(interactive) {
        const handle = await this.getFolderHandle();
        if (!handle) return false;

        try {
            let permission = await handle.queryPermission({ mode: 'readwrite' });
            if (permission !== 'granted' && interactive) {
                permission = await handle.requestPermission({ mode: 'readwrite' });
            }
            this.folderGranted = permission === 'granted';
            if (!this.folderGranted) {
                this.renderStatus();
                return false;
            }

            const fileHandle = await handle.getFileHandle(this.fileName(), { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(this.buildJson());
            await writable.close();

            this.markBackup('folder');
            if (interactive || !this.autoSaveTimer) {
                AppData.showToast(`Copia guardada en la carpeta «${handle.name}»`, 'success');
            }
            return true;
        } catch (error) {
            console.error('Backup folder:', error);
            this.folderGranted = false;
            this.renderStatus();
            if (interactive) {
                AppData.showToast('No se ha podido guardar en la carpeta', 'error');
            }
            return false;
        }
    },

    // Automatic copy to the folder while the browser keeps the permission
    scheduleAutoSave() {
        if (!this.folderSupported || !this.folderName || !this.folderGranted) return;
        clearTimeout(this.autoSaveTimer);
        this.autoSaveTimer = setTimeout(async () => {
            await this.saveToFolder(false);
            this.autoSaveTimer = null;
        }, this.AUTO_SAVE_DELAY);
    },

    // ---------- Reminder on the dashboard ----------
    shouldRemind() {
        const days = AppData.settings.backupReminderDays;
        if (!days || !this.hasData() || !this.hasUnsavedChanges()) return false;

        const snooze = this.readDate(this.KEYS.snoozeUntil);
        if (snooze && snooze > new Date()) return false;

        const lastBackup = this.readDate(this.KEYS.lastBackup);
        return !lastBackup || this.daysSince(lastBackup) >= days;
    },

    snooze() {
        const until = new Date();
        until.setDate(until.getDate() + this.SNOOZE_DAYS);
        try {
            localStorage.setItem(this.KEYS.snoozeUntil, until.toISOString());
        } catch (error) {
            console.warn('Backup:', error);
        }
        this.renderReminder();
    },

    renderReminder() {
        const container = document.getElementById('backupReminder');
        if (!container) return;

        if (!this.shouldRemind()) {
            container.hidden = true;
            container.innerHTML = '';
            return;
        }

        const lastBackup = this.readDate(this.KEYS.lastBackup);
        const message = lastBackup
            ? `Hace ${this.daysSince(lastBackup)} días que no haces una copia de tus datos.`
            : 'Todavía no has hecho ninguna copia de seguridad de tus datos.';
        const action = this.folderName ? `Guardar en «${escapeHtml(this.folderName)}»` : 'Descargar copia';
        const wasHidden = container.hidden;

        container.innerHTML = `
            <div class="backup-reminder-icon" aria-hidden="true">💾</div>
            <div class="backup-reminder-text">
                <strong>${message}</strong>
                <span>Tus datos solo están en este navegador. Una copia te protege si se borran o cambias de dispositivo.</span>
            </div>
            <div class="backup-reminder-actions">
                <button type="button" class="btn btn-primary btn-sm" onclick="Backup.saveNow()">${action}</button>
                <button type="button" class="btn btn-secondary btn-sm" onclick="Backup.snooze()">Más tarde</button>
            </div>`;
        container.hidden = false;

        if (wasHidden && !Motion.reduced) {
            container.animate([
                { opacity: 0, transform: 'translateY(-12px) scale(0.98)' },
                { opacity: 1, transform: 'none' }
            ], { duration: 450, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' });
        }
    },

    // ---------- Status in Settings ----------
    renderStatus() {
        const formatDate = date => date.toLocaleDateString('es-ES', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        const infoEl = document.getElementById('lastBackupInfo');
        if (infoEl) {
            const lastBackup = this.readDate(this.KEYS.lastBackup);
            if (lastBackup) {
                const methods = { folder: 'en carpeta', import: 'archivo importado', download: 'descargada' };
                const method = methods[localStorage.getItem(this.KEYS.lastBackupMethod)] || 'descargada';
                const pending = this.hasUnsavedChanges() ? ' · hay cambios posteriores sin copiar' : '';
                infoEl.textContent = `📁 Última copia (${method}): ${formatDate(lastBackup)}${pending}`;
                infoEl.className = this.hasUnsavedChanges() ? 'backup-info' : 'backup-info success';
            } else {
                infoEl.textContent = this.hasData() ? '⚠️ Todavía no has hecho ninguna copia' : '';
                infoEl.className = 'backup-info';
            }
        }

        const persistEl = document.getElementById('persistStatus');
        if (persistEl) {
            if (!navigator.storage?.persist) {
                persistEl.innerHTML = '<span class="status-dot warn"></span> Este navegador no permite proteger el almacenamiento. Haz copias a menudo.';
            } else if (this.persisted) {
                persistEl.innerHTML = '<span class="status-dot ok"></span> Protegido: el navegador no borrará tus datos aunque falte espacio.';
            } else {
                persistEl.innerHTML = `<span class="status-dot warn"></span> Sin proteger: el navegador podría borrar los datos si le falta espacio.
                    <button type="button" class="link-btn" onclick="Backup.requestPersistence(true)">Proteger ahora</button>`;
            }
        }

        const folderEl = document.getElementById('folderStatus');
        if (folderEl) {
            if (!this.folderSupported) {
                folderEl.innerHTML = `<p class="help-text">Tu navegador no permite guardar en una carpeta. Funciona en Chrome o Edge de escritorio; aquí usa <strong>Exportar Datos</strong>.</p>`;
            } else if (!this.folderName) {
                folderEl.innerHTML = `
                    <p class="help-text">Elige una carpeta y las copias se guardarán ahí con un clic. Si eliges la carpeta de Google Drive de tu ordenador, se subirán solas a Drive.</p>
                    <button type="button" class="btn btn-secondary" onclick="Backup.chooseFolder()">📂 Elegir carpeta de copias</button>`;
            } else {
                const state = this.folderGranted
                    ? '<span class="status-dot ok"></span> Copia automática activa: se guarda unos segundos después de cada cambio.'
                    : '<span class="status-dot warn"></span> El navegador pide permiso de nuevo en cada visita. Pulsa «Guardar ahora» para reactivarlo.';
                folderEl.innerHTML = `
                    <p class="folder-name">📂 Carpeta: <strong>${escapeHtml(this.folderName)}</strong></p>
                    <p class="help-text">${state}</p>
                    <div class="data-controls">
                        <button type="button" class="btn btn-primary" onclick="Backup.saveToFolder(true)">Guardar ahora</button>
                        <button type="button" class="btn btn-secondary" onclick="Backup.chooseFolder()">Cambiar carpeta</button>
                        <button type="button" class="link-btn" onclick="Backup.forgetFolder()">Olvidar carpeta</button>
                    </div>`;
            }
        }
    }
};
