// AutoCare Tracker - Garage
// Vehicle carousel (the centered car is the selected one), car artwork and
// optional photos. Photos are stored only in this browser (IndexedDB).

const CAR_COLORS = ['#2F5BEA', '#C9CED8', '#1B1E27', '#D7263D', '#F2F2F2', '#2E8B57', '#F5A623', '#7B3FE4'];

// ---------- Car artwork ----------
function getVehicleColor(vehicle) {
    if (/^#[0-9a-f]{6}$/i.test(vehicle.color || '')) return vehicle.color;
    const hash = [...String(vehicle.id)].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return CAR_COLORS[hash % CAR_COLORS.length];
}

function shadeColor(hex, amount) {
    const num = parseInt(hex.slice(1), 16);
    const channel = shift => Math.min(255, Math.max(0, ((num >> shift) & 255) + amount));
    return `#${[16, 8, 0].map(channel).map(c => c.toString(16).padStart(2, '0')).join('')}`;
}

function hexToRgba(hex, alpha) {
    const num = parseInt(hex.slice(1), 16);
    return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
}

// Side view of a coupe, facing right. Wheels are separate groups so they can spin.
function carSvg(vehicle) {
    const color = getVehicleColor(vehicle);
    const id = `car-${vehicle.id}`;
    const wheel = cx => `
        <g class="car-wheel" data-cx="${cx}">
            <circle cx="${cx}" cy="128" r="30" fill="#0B0C10"/>
            <circle cx="${cx}" cy="128" r="21" fill="url(#${id}-rim)"/>
            ${[0, 72, 144, 216, 288].map(angle => `<rect x="${cx - 2.5}" y="109" width="5" height="17" rx="2" fill="#1A1D26" transform="rotate(${angle} ${cx} 128)"/>`).join('')}
            <circle cx="${cx}" cy="128" r="6" fill="#2A2E3A" stroke="#9AA3B5" stroke-width="1.5"/>
        </g>`;

    return `
        <svg viewBox="0 0 400 170" role="img" aria-label="${vehicleName(vehicle)}">
            <defs>
                <linearGradient id="${id}-body" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stop-color="${shadeColor(color, 55)}"/>
                    <stop offset="0.45" stop-color="${color}"/>
                    <stop offset="1" stop-color="${shadeColor(color, -70)}"/>
                </linearGradient>
                <linearGradient id="${id}-glass" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stop-color="#3A4560"/>
                    <stop offset="1" stop-color="#0C0F18"/>
                </linearGradient>
                <radialGradient id="${id}-rim" cx="0.4" cy="0.35" r="0.7">
                    <stop offset="0" stop-color="#E6EAF2"/>
                    <stop offset="1" stop-color="#5D6475"/>
                </radialGradient>
                <linearGradient id="${id}-shine" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" stop-color="#fff" stop-opacity="0"/>
                    <stop offset="0.5" stop-color="#fff" stop-opacity="0.55"/>
                    <stop offset="1" stop-color="#fff" stop-opacity="0"/>
                </linearGradient>
                <clipPath id="${id}-clip">
                    <path d="M20,128 L18,104 Q20,94 40,90 L118,80 Q150,56 178,50 L238,47 Q262,48 292,72 L352,82 Q378,86 384,98 L388,116 Q388,126 378,128 Z"/>
                </clipPath>
            </defs>
            <ellipse class="car-shadow" cx="203" cy="160" rx="182" ry="8" fill="#000" opacity="0.55"/>
            <g class="car-body">
                <path d="M20,128 L18,104 Q20,94 40,90 L118,80 Q150,56 178,50 L238,47 Q262,48 292,72 L352,82 Q378,86 384,98 L388,116 Q388,126 378,128 L356,128 A38,38 0 0 0 280,128 L130,128 A38,38 0 0 0 54,128 Z"
                      fill="url(#${id}-body)"/>
                <path d="M132,79 Q158,60 182,56 L234,54 Q254,55 276,74 Z" fill="url(#${id}-glass)"/>
                <rect x="203" y="54" width="5" height="22" fill="${shadeColor(color, -40)}"/>
                <path d="M40,101 L372,99" stroke="#fff" stroke-opacity="0.18" stroke-width="1.5"/>
                <path d="M210,84 L214,118" stroke="#000" stroke-opacity="0.25" stroke-width="1.2"/>
                <rect x="222" y="90" width="14" height="3" rx="1.5" fill="#000" opacity="0.35"/>
                <path d="M366,90 Q380,92 384,100 L372,100 Q366,96 366,90 Z" fill="#EAF2FF"/>
                <path d="M370,92 Q378,94 381,99" stroke="#9FC0FF" stroke-width="2" fill="none" class="car-headlight"/>
                <rect x="17" y="98" width="10" height="7" rx="2" fill="#E5333B"/>
                <g clip-path="url(#${id}-clip)">
                    <rect class="car-shine" x="-120" y="40" width="90" height="100" fill="url(#${id}-shine)" transform="skewX(-20)"/>
                </g>
            </g>
            ${wheel(92)}
            ${wheel(318)}
        </svg>`;
}

function vehicleArtwork(vehicle) {
    const photo = Photos.get(vehicle.id);
    return photo
        ? `<img src="${photo}" alt="Foto de ${vehicleName(vehicle)}" loading="lazy">`
        : carSvg(vehicle);
}

// ---------- Photos (IndexedDB, only in this browser) ----------
const Photos = {
    cache: {},
    ready: null,

    db(mode, action) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('autocare-photos', 1);
            request.onupgradeneeded = () => request.result.createObjectStore('photos');
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const db = request.result;
                const tx = db.transaction('photos', mode);
                const result = action(tx.objectStore('photos'));
                tx.oncomplete = () => {
                    db.close();
                    resolve(result?.result);
                };
                tx.onerror = () => reject(tx.error);
            };
        });
    },

    load() {
        this.ready = new Promise(resolve => {
            try {
                const request = indexedDB.open('autocare-photos', 1);
                request.onupgradeneeded = () => request.result.createObjectStore('photos');
                request.onerror = () => resolve();
                request.onsuccess = () => {
                    const db = request.result;
                    const store = db.transaction('photos', 'readonly').objectStore('photos');
                    const cursor = store.openCursor();
                    cursor.onsuccess = () => {
                        const current = cursor.result;
                        if (current) {
                            this.cache[current.key] = current.value;
                            current.continue();
                        } else {
                            db.close();
                            resolve();
                        }
                    };
                    cursor.onerror = () => resolve();
                };
            } catch {
                resolve();
            }
        });
        return this.ready;
    },

    get(vehicleId) {
        return this.cache[vehicleId] || null;
    },

    async save(vehicleId, dataUrl) {
        this.cache[vehicleId] = dataUrl;
        try {
            await this.db('readwrite', store => store.put(dataUrl, vehicleId));
        } catch (error) {
            console.warn('Photos:', error);
            AppData.showToast('No se ha podido guardar la foto', 'error');
        }
    },

    async remove(vehicleId) {
        delete this.cache[vehicleId];
        try {
            await this.db('readwrite', store => store.delete(vehicleId));
        } catch (error) {
            console.warn('Photos:', error);
        }
    },

    // Resized to keep backups small: max 1200 px wide, JPEG
    resize(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(reader.error);
            reader.onload = () => {
                const img = new Image();
                img.onerror = () => reject(new Error('Imagen no válida'));
                img.onload = () => {
                    const scale = Math.min(1, 1200 / img.width);
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.round(img.width * scale);
                    canvas.height = Math.round(img.height * scale);
                    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                };
                img.src = reader.result;
            };
            reader.readAsDataURL(file);
        });
    }
};

// ---------- Carousel ----------
const Garage = {
    selectedId: null,
    shownId: null,
    scrollTimer: null,
    frame: null,

    init() {
        const track = document.getElementById('garageTrack');
        track.addEventListener('scroll', () => {
            this.updateDepth();
            clearTimeout(this.scrollTimer);
            this.scrollTimer = setTimeout(() => this.selectCentered(), 120);
        }, { passive: true });

        track.addEventListener('keydown', e => {
            if (e.key === 'ArrowRight') { e.preventDefault(); this.step(1); }
            if (e.key === 'ArrowLeft') { e.preventDefault(); this.step(-1); }
        });

        document.getElementById('garagePrev').addEventListener('click', () => this.step(-1));
        document.getElementById('garageNext').addEventListener('click', () => this.step(1));
        window.addEventListener('resize', () => {
            if (document.getElementById('vehiclesPage').classList.contains('active')) {
                this.scrollTo(this.selectedId, false);
            }
        });
    },

    slides() {
        return [...document.querySelectorAll('#garageTrack .garage-slide')];
    },

    render() {
        const track = document.getElementById('garageTrack');
        const vehicles = AppData.vehicles;

        if (!vehicles.some(v => v.id === this.selectedId)) {
            this.selectedId = vehicles.some(v => v.id === AppData.currentVehicleId)
                ? AppData.currentVehicleId
                : vehicles[0]?.id || null;
        }

        track.innerHTML = vehicles.map(vehicle => `
            <button type="button" class="garage-slide" data-id="${vehicle.id}" aria-label="${vehicleName(vehicle)}">
                <div class="garage-car">${vehicleArtwork(vehicle)}</div>
                <span class="garage-plate">${escapeHtml(vehicle.plate) || '—'}</span>
            </button>`).join('') + `
            <button type="button" class="garage-slide garage-add" data-id="add" aria-label="Añadir vehículo">
                <div class="garage-car"><span class="garage-add-icon">+</span></div>
                <span class="garage-name">Añadir vehículo</span>
            </button>`;

        track.querySelectorAll('.garage-slide').forEach(slide => {
            slide.addEventListener('click', () => {
                if (slide.dataset.id === 'add' && this.centeredId() === 'add') {
                    openVehicleModal();
                    return;
                }
                if (slide.dataset.id === this.selectedId) {
                    document.getElementById('vehicleSheet').scrollIntoView({ behavior: Motion.reduced ? 'auto' : 'smooth', block: 'start' });
                    return;
                }
                this.scrollTo(slide.dataset.id, true);
            });
        });

        document.getElementById('garageDots').innerHTML = vehicles.length > 1
            ? vehicles.map(v => `<button type="button" class="garage-dot" data-id="${v.id}" aria-label="${vehicleName(v)}"></button>`).join('')
            : '';
        document.querySelectorAll('.garage-dot').forEach(dot => {
            dot.addEventListener('click', () => this.scrollTo(dot.dataset.id, true));
        });

        // Reading offsetLeft forces layout, so the selected car can be centered right away
        this.scrollTo(this.selectedId || 'add', false);
        this.select(this.selectedId || 'add', { force: true, animate: false });
    },

    scrollTo(id, smooth) {
        const track = document.getElementById('garageTrack');
        const slide = track.querySelector(`.garage-slide[data-id="${id}"]`);
        if (!slide) return;
        const left = slide.offsetLeft - (track.clientWidth - slide.offsetWidth) / 2;
        track.scrollTo({ left, behavior: smooth && !Motion.reduced ? 'smooth' : 'auto' });
        if (!smooth) this.applyDepth();
    },

    step(direction) {
        const slides = this.slides();
        const index = slides.findIndex(s => s.dataset.id === this.centeredId());
        const next = slides[Math.min(Math.max(index + direction, 0), slides.length - 1)];
        if (next) this.scrollTo(next.dataset.id, true);
    },

    centeredId() {
        const track = document.getElementById('garageTrack');
        const center = track.scrollLeft + track.clientWidth / 2;
        let best = null;
        let bestDistance = Infinity;
        this.slides().forEach(slide => {
            const distance = Math.abs(slide.offsetLeft + slide.offsetWidth / 2 - center);
            if (distance < bestDistance) {
                bestDistance = distance;
                best = slide.dataset.id;
            }
        });
        return best;
    },

    // Coverflow: each slide gets --d = its distance to the center (0..1)
    applyDepth() {
        const track = document.getElementById('garageTrack');
        const center = track.scrollLeft + track.clientWidth / 2;
        this.slides().forEach(slide => {
            const distance = Math.abs(slide.offsetLeft + slide.offsetWidth / 2 - center);
            // Neighbours stay at ~0.6, so they are still visible but dimmed
            slide.style.setProperty('--d', Math.min(distance / (slide.offsetWidth * 1.7), 1).toFixed(3));
        });
    },

    // While scrolling, once per frame
    updateDepth() {
        cancelAnimationFrame(this.frame);
        this.frame = requestAnimationFrame(() => this.applyDepth());
    },

    selectCentered() {
        this.applyDepth();
        const id = this.centeredId();
        if (id) this.select(id);
    },

    // shownId is what is centered now (a vehicle or "add"); selectedId is the last vehicle
    select(id, { force = false, animate = true } = {}) {
        if (!force && id === this.shownId) return;
        this.shownId = id;
        if (id !== 'add') this.selectedId = id;
        if (id !== 'add') AppData.currentVehicleId = id;

        this.slides().forEach(slide => slide.setAttribute('aria-current', String(slide.dataset.id === id)));
        document.querySelectorAll('.garage-dot').forEach(dot => dot.classList.toggle('active', dot.dataset.id === id));

        const slides = this.slides();
        const index = slides.findIndex(s => s.dataset.id === id);
        document.getElementById('garagePrev').disabled = index <= 0;
        document.getElementById('garageNext').disabled = index >= slides.length - 1;

        const vehicle = AppData.vehicles.find(v => v.id === id);
        const title = document.getElementById('garageTitle');
        const subtitle = document.getElementById('garageSubtitle');
        const garage = document.getElementById('garage');

        if (vehicle) {
            const color = getVehicleColor(vehicle);
            garage.style.setProperty('--car-glow', hexToRgba(color === '#1B1E27' ? '#3B6BFF' : color, 0.55));
            document.getElementById('vehiclesPage').style.setProperty('--car-glow', hexToRgba(color === '#1B1E27' ? '#3B6BFF' : color, 0.25));
            title.textContent = `${vehicle.make} ${vehicle.model}`;
            subtitle.textContent = `${AppData.formatNumber(getCurrentMileage(vehicle))} ${AppData.settings.distanceUnit} · ${AppData.vehicles.length > 1 ? 'desliza para cambiar de vehículo' : 'toca el coche para ver su ficha'}`;
        } else {
            garage.style.removeProperty('--car-glow');
            title.textContent = AppData.vehicles.length ? 'Añade otro vehículo' : 'Tu garaje está vacío';
            subtitle.textContent = AppData.vehicles.length ? 'Toca el + para añadirlo' : 'Añade tu primer vehículo para empezar';
        }

        renderVehicleSheet(vehicle);

        if (animate && !Motion.reduced) {
            Motion.carArrives(document.querySelector(`.garage-slide[data-id="${id}"] .garage-car`));
            title.animate([
                { opacity: 0, transform: 'translateY(14px)', filter: 'blur(6px)' },
                { opacity: 1, transform: 'none', filter: 'blur(0)' }
            ], { duration: 450, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
        }
    }
};
