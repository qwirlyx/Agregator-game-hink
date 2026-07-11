(function () {
    const CONFIG_PATH = 'data/messengers.json?v=1.2';
    const GAME_BASE_URL = window.GAME_BASE_URL || '/hinkjump/';
    // Тянем конфиг игры через свой же config.php (читает файл с диска, без CORS).
    const GAME_CONFIG_URL = 'config.php';
    const EXCLUDED_SKIN_IDS = ['newYear'];
    const DEFAULT_LOCAL_FRAMES = [
        'assets/img/design/khinkali_run1.webp',
        'assets/img/design/khinkali_run2.webp'
    ];
    // Единственная страховка, если config.json игры недоступен.
    const FALLBACK_SKIN = {
        id: 'default',
        name: 'Обычный Хинкали',
        scale: 1,
        offsetX: 0,
        offsetY: 1,
        baseAnimFPS: 7,
        frames: DEFAULT_LOCAL_FRAMES
    };
    const platforms = ['telegram', 'max', 'vk', 'ok'];
    let heroSkinTimer = null;

    function isReadyUrl(url) {
        return typeof url === 'string' && /^https?:\/\//i.test(url.trim());
    }

    function fillText(id, value) {
        const node = document.getElementById(id);
        if (node && value) node.textContent = value;
    }

    function applyMessenger(platform, data) {
        const card = document.querySelector('[data-platform="' + platform + '"]');
        if (!card || !data) return;

        const title = card.querySelector('strong');
        const hint = card.querySelector('small');
        const url = (data.url || '').trim();

        if (title && data.label) title.textContent = data.label;
        if (hint && data.hint) hint.textContent = data.hint;

        if (isReadyUrl(url)) {
            card.href = url;
            card.classList.remove('is-disabled');
            card.setAttribute('aria-disabled', 'false');
            return;
        }

        card.removeAttribute('target');
        card.href = '#';
        card.classList.add('is-disabled');
        card.setAttribute('aria-disabled', 'true');
        if (hint) hint.textContent = data.hint || 'Ссылка ещё не добавлена';
    }

    function setupDisabledClick() {
        document.addEventListener('click', function (event) {
            const card = event.target.closest('.messenger-card');
            if (!card || !card.classList.contains('is-disabled')) return;
            event.preventDefault();
            card.classList.remove('shake');
            void card.offsetWidth;
            card.classList.add('shake');
        });
    }

    function clamp(value, min, max) {
        const number = Number(value);
        if (!Number.isFinite(number)) return min;
        return Math.min(max, Math.max(min, number));
    }

    function resolveGameAsset(path) {
        if (typeof path !== 'string' || !path.trim()) return '';
        const cleanPath = path.trim();
        if (/^https?:\/\//i.test(cleanPath)) return cleanPath;
        if (cleanPath.indexOf('assets/img/design/') === 0) return cleanPath;
        return GAME_BASE_URL + cleanPath.replace(/^\/+/, '');
    }

    function normalizeSkin(rawSkin) {
        if (!rawSkin || EXCLUDED_SKIN_IDS.indexOf(rawSkin.id) !== -1) return null;

        const runFrames = rawSkin.frames && Array.isArray(rawSkin.frames.run)
            ? rawSkin.frames.run
            : rawSkin.frames;

        if (!Array.isArray(runFrames) || !runFrames.length) return null;

        const frames = rawSkin.id === 'default'
            ? DEFAULT_LOCAL_FRAMES.slice()
            : runFrames.map(resolveGameAsset).filter(Boolean);

        if (!frames.length) return null;

        return {
            id: rawSkin.id || 'skin',
            name: rawSkin.name || rawSkin.id || 'skin',
            frames: frames,
            scale: clamp(rawSkin.scale || 1, 0.88, 1.18),
            offsetX: clamp(rawSkin.offsetX || 0, -7, 7),
            offsetY: clamp(rawSkin.offsetY || 0, -2, 7),
            baseAnimFPS: clamp(rawSkin.baseAnimFPS || 7, 4, 14)
        };
    }

    function normalizeSkins(rawSkins) {
        if (!Array.isArray(rawSkins)) return [FALLBACK_SKIN];
        const skins = rawSkins.map(normalizeSkin).filter(Boolean);
        return skins.length ? skins : [FALLBACK_SKIN];
    }

    async function fetchRemoteSkins() {
        try {
            const response = await fetch(GAME_CONFIG_URL, { cache: 'no-store' });
            if (!response.ok) throw new Error('Game config HTTP ' + response.status);
            const config = await response.json();
            return normalizeSkins(config.skins);
        } catch (error) {
            console.warn('Не удалось загрузить конфиг игры, использую дефолтный скин:', error);
            return [FALLBACK_SKIN];
        }
    }

    function pickRandomSkin(skins) {
        if (!skins.length) return FALLBACK_SKIN;
        return skins[Math.floor(Math.random() * skins.length)];
    }

    function preloadFrames(frames) {
        const uniqueFrames = Array.from(new Set(frames));
        return Promise.all(uniqueFrames.map(function (src) {
            return new Promise(function (resolve) {
                const image = new Image();
                image.onload = function () { resolve(src); };
                image.onerror = function () { resolve(null); };
                image.src = src;
            });
        })).then(function (loadedFrames) {
            return loadedFrames.filter(Boolean);
        });
    }

    function setHeroFrame(hero, frame) {
        hero.style.backgroundImage = 'url("' + frame.replace(/"/g, '\"') + '")';
    }

    function startHeroFrameAnimation(hero, frames, fps) {
        if (heroSkinTimer) clearInterval(heroSkinTimer);

        let index = 0;
        setHeroFrame(hero, frames[index]);

        if (frames.length < 2) return;

        const interval = Math.max(70, Math.round(1000 / fps));
        heroSkinTimer = window.setInterval(function () {
            index = (index + 1) % frames.length;
            setHeroFrame(hero, frames[index]);
        }, interval);
    }

    async function setupRandomHeroSkin() {
        const hero = document.querySelector('.hero-khinkali');
        if (!hero) return;

        const skins = await fetchRemoteSkins();
        const selectedSkin = pickRandomSkin(skins);
        const loadedFrames = await preloadFrames(selectedSkin.frames);
        const frames = loadedFrames.length ? loadedFrames : DEFAULT_LOCAL_FRAMES;

        hero.dataset.skinId = selectedSkin.id;
        hero.dataset.skinName = selectedSkin.name;
        hero.style.setProperty('--skin-scale', String(selectedSkin.scale));
        hero.style.setProperty('--skin-offset-x', Math.round(selectedSkin.offsetX * 0.75) + 'px');
        hero.style.setProperty('--skin-offset-y', Math.round(selectedSkin.offsetY * 0.45) + 'px');

        startHeroFrameAnimation(hero, frames, selectedSkin.baseAnimFPS);
    }

    async function loadConfig() {
        try {
            const response = await fetch(CONFIG_PATH, { cache: 'no-store' });
            if (!response.ok) throw new Error('Config HTTP ' + response.status);
            const config = await response.json();

            fillText('pageTitle', config.page && config.page.title);
            fillText('pageSubtitle', config.page && config.page.subtitle);
            fillText('pageNote', config.page && config.page.note);

            platforms.forEach(function (platform) {
                applyMessenger(platform, config.messengers && config.messengers[platform]);
            });
        } catch (error) {
            console.error('Не удалось загрузить data/messengers.json:', error);
        }
    }

    setupDisabledClick();
    setupRandomHeroSkin();
    loadConfig();
})();