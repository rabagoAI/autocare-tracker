// AutoCare Tracker - Motion graphics
// Web Animations API only (no libraries). Everything is skipped when the
// system asks for reduced motion.

const Motion = {
    reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,

    // Elements that enter in cascade when a page is shown
    staggerSelector: [
        '.stat-card', '.chart-card', '.dashboard-card', '.page-header', '.filters-bar',
        '.vehicle-card', '.settings-card', '.report-card', '.summary-item',
        '.activity-item', '.alert-item', '.expenses-table tbody tr', '.empty-state'
    ].join(', '),

    init() {
        window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', e => {
            this.reduced = e.matches;
        });
        this.setupRipple();
        this.setupChartDefaults();
    },

    // ---------- Page entrance ----------
    enterPage(page) {
        if (this.reduced || !page) return;
        const items = [...page.querySelectorAll(this.staggerSelector)]
            .filter(el => !el.parentElement.closest('.empty-state'))
            .slice(0, 40);

        items.forEach((el, i) => {
            el.animate([
                { opacity: 0, transform: 'translateY(18px) scale(0.98)' },
                { opacity: 1, transform: 'none' }
            ], {
                duration: 500,
                delay: Math.min(i * 45, 600),
                easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                fill: 'backwards'
            });
        });
    },

    // ---------- Animated counters ----------
    countUp(el, value, format = v => Math.round(v)) {
        const from = parseFloat(el.dataset.value) || 0;
        el.dataset.value = value;

        if (this.reduced || from === value || document.hidden) {
            el.textContent = format(value);
            return;
        }

        const duration = 900;
        const start = performance.now();
        const run = (el._countRun || 0) + 1;
        el._countRun = run;

        // Fallback in case animation frames are paused (hidden tab)
        setTimeout(() => {
            if (el._countRun === run) el.textContent = format(value);
        }, duration + 150);

        const step = now => {
            if (el._countRun !== run) return;
            const t = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - t, 4);
            el.textContent = format(from + (value - from) * eased);
            if (t < 1) {
                requestAnimationFrame(step);
            } else {
                el.classList.remove('bump');
                void el.offsetWidth;
                el.classList.add('bump');
            }
        };
        requestAnimationFrame(step);
    },

    // ---------- Removing an element ----------
    leave(el) {
        if (this.reduced || !el) return Promise.resolve();
        return el.animate([
            { opacity: 1, transform: 'none' },
            { opacity: 0, transform: 'translateX(40px) scale(0.9)' }
        ], { duration: 280, easing: 'ease-in', fill: 'forwards' }).finished.catch(() => {});
    },

    // ---------- Modals ----------
    closeModal(modal) {
        if (!modal || !modal.classList.contains('active')) return;
        if (this.reduced) {
            modal.classList.remove('active');
            return;
        }
        modal.classList.add('closing');
        setTimeout(() => modal.classList.remove('active', 'closing'), 200);
    },

    // ---------- Effects layer ----------
    layer() {
        let layer = document.querySelector('.fx-layer');
        if (!layer) {
            layer = document.createElement('div');
            layer.className = 'fx-layer';
            layer.setAttribute('aria-hidden', 'true');
            document.body.appendChild(layer);
        }
        return layer;
    },

    origin(el) {
        if (!el) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        const rect = el.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    },

    // Confetti burst from an element (or the centre of the screen)
    confetti(fromEl, count = 70) {
        if (this.reduced) return;
        const layer = this.layer();
        const { x, y } = this.origin(fromEl);
        const colors = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

        for (let i = 0; i < count; i++) {
            const piece = document.createElement('div');
            piece.className = 'fx-piece fx-confetti';
            piece.style.background = colors[i % colors.length];
            layer.appendChild(piece);

            const angle = Math.random() * Math.PI * 2;
            const velocity = 180 + Math.random() * 260;
            const dx = Math.cos(angle) * velocity;
            const dy = Math.sin(angle) * velocity - 180;
            const spin = (Math.random() - 0.5) * 1080;

            piece.animate([
                { transform: `translate(${x}px, ${y}px) rotate(0deg)`, opacity: 1 },
                { transform: `translate(${x + dx * 0.7}px, ${y + dy * 0.7}px) rotate(${spin / 2}deg)`, opacity: 1, offset: 0.5 },
                { transform: `translate(${x + dx}px, ${y + dy + 420}px) rotate(${spin}deg)`, opacity: 0 }
            ], {
                duration: 1400 + Math.random() * 900,
                easing: 'cubic-bezier(0.2, 0.6, 0.4, 1)'
            }).finished.then(() => piece.remove()).catch(() => piece.remove());
        }
    },

    // A few emojis that float up and fade (e.g. the category of a new expense)
    emojiBurst(emoji, fromEl, count = 8) {
        if (this.reduced) return;
        const layer = this.layer();
        const { x, y } = this.origin(fromEl);

        for (let i = 0; i < count; i++) {
            const piece = document.createElement('div');
            piece.className = 'fx-piece fx-emoji';
            piece.textContent = emoji;
            layer.appendChild(piece);

            const dx = (Math.random() - 0.5) * 220;
            const dy = -120 - Math.random() * 160;

            piece.animate([
                { transform: `translate(${x}px, ${y}px) scale(0.3)`, opacity: 0 },
                { transform: `translate(${x + dx * 0.4}px, ${y + dy * 0.4}px) scale(1.2)`, opacity: 1, offset: 0.3 },
                { transform: `translate(${x + dx}px, ${y + dy}px) scale(0.8) rotate(${dx / 4}deg)`, opacity: 0 }
            ], {
                duration: 1100 + Math.random() * 500,
                delay: i * 40,
                easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                fill: 'backwards'
            }).finished.then(() => piece.remove()).catch(() => piece.remove());
        }
    },

    // A car crosses the bottom of the screen (new vehicle)
    driveBy(emoji = '🚗') {
        if (this.reduced) return;
        const layer = this.layer();
        const car = document.createElement('div');
        car.className = 'fx-car';
        car.textContent = emoji;
        layer.appendChild(car);

        const width = window.innerWidth;
        car.animate([
            { transform: 'translateX(-80px) scaleX(-1)' },
            { transform: `translateX(${width * 0.45}px) scaleX(-1) translateY(-6px)`, offset: 0.45 },
            { transform: `translateX(${width * 0.55}px) scaleX(-1) translateY(0)`, offset: 0.55 },
            { transform: `translateX(${width + 80}px) scaleX(-1)` }
        ], {
            duration: 2200,
            easing: 'cubic-bezier(0.45, 0, 0.55, 1)'
        }).finished.then(() => car.remove()).catch(() => car.remove());
    },

    // ---------- Ripple on buttons ----------
    setupRipple() {
        document.addEventListener('pointerdown', e => {
            if (this.reduced) return;
            const btn = e.target.closest('.btn');
            if (!btn) return;
            const rect = btn.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const ripple = document.createElement('span');
            ripple.className = 'ripple';
            ripple.style.width = ripple.style.height = `${size}px`;
            ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
            ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
            btn.appendChild(ripple);
            ripple.addEventListener('animationend', () => ripple.remove());
        });
    },

    // ---------- Chart.js: smoother, staggered animations ----------
    setupChartDefaults() {
        if (typeof Chart === 'undefined') return;
        if (this.reduced) {
            Chart.defaults.animation = false;
            return;
        }
        Chart.defaults.animation.duration = 1000;
        Chart.defaults.animation.easing = 'easeOutQuart';
        Chart.defaults.animation.delay = ctx =>
            ctx.type === 'data' && ctx.mode === 'default' ? ctx.dataIndex * 70 : 0;
    }
};

Motion.init();
