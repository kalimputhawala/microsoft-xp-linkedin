/* LinkedIn XP Theme: a local presentation layer over LinkedIn's native UI. */
(() => {
    'use strict';

    const is_top_frame = window.top === window;
    const profile_cache_key = 'l-x-public-profile-v1';
    const nav_items = [
        { key: 'home', label: 'Home', route: '/feed/', icon: 'home' },
        { key: 'network', label: 'Network', route: '/mynetwork/', icon: 'network' },
        { key: 'jobs', label: 'Jobs', route: '/jobs/', icon: 'jobs' },
        { key: 'messaging', label: 'Messaging', route: '/messaging/', icon: 'messaging' },
        { key: 'notifications', label: 'Notifications', route: '/notifications/', icon: 'notifications' }
    ];
    const svg_paths = {
        windows: '<path fill="#ef4d24" d="M3 5l12-2v12H3z"/><path fill="#72ac35" d="M17 3l12 2v10H17z"/><path fill="#35a2e2" d="M3 17h12v12L3 27z"/><path fill="#ffd23b" d="M17 17h12v10l-12 2z"/>',
        home: '<path fill="#bd7636" stroke="#6e482b" d="M3 15L16 3l13 12-3 3-10-9L6 18z"/><path fill="#ffecb6" stroke="#93613c" d="M7 16l9-8 9 8v13H7z"/><path fill="#74b0db" stroke="#477795" d="M10 17h5v6h-5z"/><path fill="#ac6539" d="M18 19h5v10h-5z"/>',
        network: '<path fill="#d1e4f9" stroke="#567797" d="M15 8h2v15h-2zM7 21h18v2H7z"/><rect x="10" y="2" width="12" height="10" rx="1" fill="#80b8ee" stroke="#386794"/><rect x="2" y="21" width="11" height="9" rx="1" fill="#79b45f" stroke="#527549"/><rect x="20" y="21" width="11" height="9" rx="1" fill="#79b45f" stroke="#527549"/><path fill="#ddeefd" d="M12 4h8v5h-8zM4 23h7v4H4zM22 23h7v4h-7z"/>',
        jobs: '<rect x="3" y="9" width="26" height="20" rx="3" fill="#b58044" stroke="#724d27"/><path fill="none" stroke="#724d27" stroke-width="3" d="M11 9V5h10v4"/><path fill="#d7a66b" stroke="#724d27" d="M3 10h26v9H3z"/><path fill="#f9d784" stroke="#825521" d="M13 16h6v6h-6z"/>',
        messaging: '<path fill="#ffda42" stroke="#aa881c" d="M3 4h26v20H17l-7 6v-6H3z"/><path fill="#fff8c4" d="M6 7h20v13H6z"/><path stroke="#917449" stroke-width="2" d="M9 10h14M9 14h12M9 18h8"/>',
        notifications: '<path fill="#ffc944" stroke="#a77a18" d="M16 3c-6 0-8 5-8 12v6l-4 4h24l-4-4v-6c0-7-2-12-8-12z"/><path fill="#b58a23" d="M12 27h8c-1 5-7 5-8 0z"/><path fill="none" stroke="#fff2aa" stroke-width="2" d="M12 7c-2 2-3 5-3 9"/>',
        profile: '<circle cx="16" cy="10" r="7" fill="#f5c48e" stroke="#886541"/><path fill="#6aa0d9" stroke="#43688f" d="M4 29c0-8 5-12 12-12s12 4 12 12z"/>',
        linkedin: '<rect x="1" y="1" width="30" height="30" rx="3" fill="#0a66c2"/><circle cx="8" cy="8" r="2.2" fill="#fff"/><path fill="#fff" d="M6 12h4v14H6zM13 12h4v2c1-2 3-3 5-2 3 0 4 2 4 5v9h-4v-8c0-2-1-3-2-3-2 0-3 1-3 3v8h-4z"/>',
        smile: '<circle cx="16" cy="16" r="14" fill="#ffdc32" stroke="#bd9210"/><ellipse cx="11" cy="12" rx="2" ry="3" fill="#53352c"/><ellipse cx="21" cy="12" rx="2" ry="3" fill="#53352c"/><path d="M8 19c2 9 14 9 16 0z" fill="#fff" stroke="#6d4833" stroke-width="1.5"/>'
    };
    let shell = null;
    let native_header = null;
    let native_me = null;
    let menu = null;
    let start_button = null;
    let task_label = null;
    let profile_link = null;
    let profile_image = null;
    let profile_name = null;
    let refresh_pending = false;
    let profile_fallback_open = false;
    let observed_shadow_root = null;
    let shadow_observer = null;
    let profile_info = readProfileCache();
    const native_nav = new Map();
    const menu_links = new Map();

    function createIcon(icon_name) {
        const icon = document.createElement('span');
        icon.className = 'l-x-icon';
        icon.setAttribute('aria-hidden', 'true');
        // Every SVG fragment above is authored here; no page content enters HTML.
        icon.innerHTML = '<svg viewBox="0 0 32 32" focusable="false" aria-hidden="true">' + svg_paths[icon_name] + '</svg>';
        return icon;
    }

    function setAttribute(element, name, value) {
        if (element && element.getAttribute(name) !== value) {
            element.setAttribute(name, value);
        }
    }

    function setText(element, value) {
        if (element && element.textContent !== value) {
            element.textContent = value;
        }
    }

    function linkedinUrl(value) {
        if (typeof value !== 'string' || !value.trim()) {
            return null;
        }
        try {
            const url = new URL(value, location.origin);
            if (url.protocol === 'https:' && ['www.linkedin.com', 'linkedin.com'].includes(url.hostname)) {
                return url;
            }
        } catch (_) {
            // Missing or malformed page links are simply ignored.
        }
        return null;
    }

    function imageUrl(value) {
        if (typeof value !== 'string' || !value.trim()) {
            return '';
        }
        try {
            const url = new URL(value, location.origin);
            return url.protocol === 'https:' ? url.href : '';
        } catch (_) {
            return '';
        }
    }

    function readProfileCache() {
        if (!is_top_frame) {
            return {};
        }
        try {
            const cached_info = JSON.parse(sessionStorage.getItem(profile_cache_key) || '{}');
            const url = linkedinUrl(cached_info.href);
            return {
                href: url && url.pathname.startsWith('/in/') ? url.href : '',
                name: typeof cached_info.name === 'string' ? cached_info.name.slice(0, 100) : '',
                image: imageUrl(cached_info.image || '')
            };
        } catch (_) {
            return {};
        }
    }

    function saveProfileCache() {
        try {
            // Only the user's displayed public profile link, avatar and name.
            sessionStorage.setItem(profile_cache_key, JSON.stringify(profile_info));
        } catch (_) {
            // The theme also works when browser storage is unavailable.
        }
    }

    function findNativeHeader(source_document = document) {
        return Array.from(source_document.querySelectorAll('header, #global-nav')).find((header) => {
            return !header.closest('#l-x-shell') &&
                header.querySelector('a[href*="/mynetwork"]') &&
                header.querySelector('a[href*="/messaging"]');
        }) || null;
    }

    function findInteropHeader() {
        for (const iframe of document.querySelectorAll('iframe[data-testid="interop-iframe"]')) {
            try {
                const frame_document = iframe.contentDocument;
                const frame_header = frame_document ? findNativeHeader(frame_document) : null;
                if (frame_header) {
                    return frame_header;
                }
            } catch (_) {
                // Only same-origin LinkedIn frames are considered.
            }
        }
        return null;
    }

    function captureNativeNavigation() {
        native_nav.clear();
        if (!native_header) {
            return;
        }
        const anchors = Array.from(native_header.querySelectorAll('a[href]'));
        for (const item of nav_items) {
            const nav_anchor = anchors.find((anchor) => {
                const url = linkedinUrl(anchor.href);
                return url && url.pathname.startsWith(item.route.replace(/\/$/, ''));
            });
            const home_button = item.key === 'home' ? Array.from(native_header.querySelectorAll('button')).find((button) => {
                const label = button.getAttribute('aria-label') || button.textContent.trim();
                return /^Home(?:,|$)/i.test(label);
            }) : null;
            if (nav_anchor || home_button) {
                native_nav.set(item.key, nav_anchor || home_button);
            }
            const menu_link = menu_links.get(item.key);
            if (menu_link) {
                const target_url = nav_anchor ? linkedinUrl(nav_anchor.href) : null;
                setAttribute(menu_link, 'href', target_url ? target_url.href : location.origin + item.route);
            }
        }
        native_me = Array.from(native_header.querySelectorAll('button')).find((button) => {
            return /^(Me|You)(?:\s|$)/i.test(button.textContent.trim()) ||
                /(?:^|\s)(Me|You)\s*$/i.test(button.textContent.trim()) ||
                /^(Me|You)(?:,|$)/i.test(button.getAttribute('aria-label') || '');
        }) || null;
    }

    function captureProfile() {
        // Other pages can have sidebars about another member; only the feed's
        // own profile card supplies the public profile link and display name.
        const sidebar = location.pathname.startsWith('/feed') ?
            document.querySelector('aside[aria-label="Sidebar"], .profile-rail-card, .feed-identity-module') :
            document.querySelector('.profile-rail-card, .feed-identity-module');
        const own_anchor = sidebar ? Array.from(sidebar.querySelectorAll('a[href*="/in/"]')).find((anchor) => {
            const url = linkedinUrl(anchor.href);
            return url && url.pathname.startsWith('/in/');
        }) : null;
        const me_image = native_me ? native_me.querySelector('img') : null;
        const own_image = own_anchor ? own_anchor.querySelector('img') : null;
        const sidebar_image = sidebar ? sidebar.querySelector('img') : null;
        const avatar = own_image || me_image || sidebar_image;
        const sidebar_heading = sidebar ? sidebar.querySelector('h1, h2, h3, .feed-identity-module__actor-meta') : null;
        const anchor_name = own_anchor ? own_anchor.textContent.trim().replace(/\s+/g, ' ') : '';
        const heading_name = sidebar_heading ? sidebar_heading.textContent.trim().replace(/\s+/g, ' ') : '';
        const image_name = avatar ? (avatar.getAttribute('alt') || '').trim() : '';
        const next_info = {
            href: own_anchor ? linkedinUrl(own_anchor.href).href : profile_info.href || '',
            name: heading_name || (anchor_name.length <= 100 ? anchor_name : '') ||
                (!/^(Me|Profile|Photo|Avatar)/i.test(image_name) ? image_name : '') || profile_info.name || '',
            image: avatar ? imageUrl(avatar.currentSrc || avatar.src) : profile_info.image || ''
        };
        if (JSON.stringify(next_info) !== JSON.stringify(profile_info)) {
            profile_info = next_info;
            saveProfileCache();
        }
        if (!profile_link) {
            return;
        }
        setAttribute(profile_link, 'href', profile_info.href || '#');
        setText(profile_name, profile_info.name || 'My Profile');
        setAttribute(profile_link, 'aria-label', profile_info.name ? 'View ' + profile_info.name + "'s profile" : 'View my profile');
        if (profile_info.image) {
            if (!profile_image) {
                profile_image = document.createElement('img');
                profile_image.alt = '';
                profile_image.width = 51;
                profile_image.height = 51;
                profile_link.firstElementChild.replaceWith(profile_image);
            }
            setAttribute(profile_image, 'src', profile_info.image);
        }
    }

    function closeMenu(return_focus = false) {
        if (!menu) {
            return;
        }
        menu.hidden = true;
        setAttribute(start_button, 'aria-expanded', 'false');
        if (return_focus) {
            start_button.focus();
        }
    }

    function toggleMenu() {
        const will_open = menu.hidden;
        menu.hidden = !will_open;
        setAttribute(start_button, 'aria-expanded', String(will_open));
        if (will_open) {
            captureProfile();
            const first_link = menu.querySelector('a');
            if (first_link) {
                first_link.focus();
            }
        }
    }

    function closeNativeProfile() {
        document.documentElement.classList.remove('l-x-native-menu-open');
        if (native_header && native_header.ownerDocument.documentElement) {
            native_header.ownerDocument.documentElement.classList.remove('l-x-native-menu-open');
            const native_root = native_header.getRootNode();
            if (native_root instanceof ShadowRoot) {
                native_root.host.classList.remove('l-x-native-menu-open');
            }
        }
        if (observed_shadow_root) {
            observed_shadow_root.host.classList.remove('l-x-native-menu-open');
        }
        profile_fallback_open = false;
    }

    function navigateWithNative(event, item) {
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
            return;
        }
        closeMenu();
        closeNativeProfile();
        const native_control = native_nav.get(item.key);
        if (native_control && native_control.isConnected && native_control.getRootNode() === document) {
            event.preventDefault();
            native_control.click();
            scheduleRefresh();
        }
    }

    function buildShell() {
        shell = document.createElement('div');
        shell.id = 'l-x-shell';
        menu = document.createElement('nav');
        menu.id = 'l-x-start-menu';
        menu.className = 'l-x-start-menu';
        menu.setAttribute('aria-label', 'LinkedIn Start menu');
        menu.hidden = true;

        profile_link = document.createElement('a');
        profile_link.className = 'l-x-profile';
        profile_link.href = '#';
        const profile_placeholder = document.createElement('span');
        profile_placeholder.className = 'l-x-profile-avatar';
        profile_placeholder.append(createIcon('profile'));
        profile_name = document.createElement('span');
        profile_name.textContent = 'My Profile';
        profile_link.append(profile_placeholder, profile_name);
        profile_link.addEventListener('click', (event) => {
            if (!profile_info.href) {
                event.preventDefault();
                closeMenu();
                if (native_me && native_me.isConnected && native_header) {
                    document.documentElement.classList.add('l-x-native-menu-open');
                    native_header.ownerDocument.documentElement.classList.add('l-x-native-menu-open');
                    const native_root = native_header.getRootNode();
                    if (native_root instanceof ShadowRoot) {
                        native_root.host.classList.add('l-x-native-menu-open');
                    }
                    profile_fallback_open = true;
                    native_me.click();
                }
            } else if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
                closeMenu();
            }
        });
        menu.append(profile_link);

        const links = document.createElement('div');
        links.className = 'l-x-menu-links';
        for (const item of nav_items) {
            const link = document.createElement('a');
            link.className = 'l-x-menu-link';
            link.href = location.origin + item.route;
            const label = document.createElement('span');
            label.textContent = item.label;
            link.append(createIcon(item.icon), label);
            link.addEventListener('click', (event) => navigateWithNative(event, item));
            menu_links.set(item.key, link);
            links.append(link);
        }
        const profile_item = document.createElement('a');
        profile_item.className = 'l-x-menu-link l-x-profile-shortcut';
        profile_item.href = '#';
        const profile_item_label = document.createElement('span');
        profile_item_label.textContent = 'My Profile';
        profile_item.append(createIcon('profile'), profile_item_label);
        profile_item.addEventListener('click', (event) => {
            if (profile_info.href) {
                setAttribute(profile_item, 'href', profile_info.href);
                closeMenu();
            } else {
                event.preventDefault();
                profile_link.click();
            }
        });
        links.append(profile_item);
        menu.append(links);

        const search_form = document.createElement('form');
        search_form.className = 'l-x-search';
        search_form.setAttribute('role', 'search');
        search_form.setAttribute('aria-label', 'Search LinkedIn');
        const search_input = document.createElement('input');
        search_input.type = 'search';
        search_input.name = 'keywords';
        search_input.placeholder = 'Search LinkedIn';
        search_input.setAttribute('aria-label', 'Search LinkedIn');
        const search_button = document.createElement('button');
        search_button.type = 'submit';
        search_button.textContent = 'Search';
        search_form.append(search_input, search_button);
        search_form.addEventListener('submit', (event) => {
            event.preventDefault();
            const keywords = search_input.value.trim();
            if (keywords) {
                closeMenu();
                location.assign(location.origin + '/search/results/all/?keywords=' + encodeURIComponent(keywords));
            }
        });
        menu.append(search_form);

        const footer = document.createElement('div');
        footer.className = 'l-x-menu-footer';
        footer.textContent = 'LinkedIn · Windows XP style';
        menu.append(footer);

        const taskbar = document.createElement('div');
        taskbar.className = 'l-x-taskbar';
        taskbar.setAttribute('aria-label', 'LinkedIn taskbar');
        start_button = document.createElement('button');
        start_button.type = 'button';
        start_button.className = 'l-x-start-button';
        start_button.setAttribute('aria-expanded', 'false');
        start_button.setAttribute('aria-controls', menu.id);
        start_button.setAttribute('aria-label', 'Open LinkedIn Start menu');
        const start_label = document.createElement('span');
        start_label.textContent = 'start';
        start_button.append(createIcon('windows'), start_label);
        start_button.addEventListener('click', toggleMenu);
        const task_button = document.createElement('button');
        task_button.type = 'button';
        task_button.className = 'l-x-task-button';
        task_button.setAttribute('aria-label', 'Open LinkedIn navigation');
        task_label = document.createElement('span');
        task_label.textContent = 'LinkedIn';
        task_button.append(createIcon('linkedin'), task_label);
        task_button.addEventListener('click', toggleMenu);
        const clock = document.createElement('time');
        clock.className = 'l-x-clock';
        function updateClock() {
            const now = new Date();
            setText(clock, now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
            setAttribute(clock, 'datetime', now.toISOString());
            setAttribute(clock, 'title', now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
        }
        updateClock();
        window.setInterval(updateClock, 30000);
        taskbar.append(start_button, task_button, clock);
        shell.append(menu, taskbar);
        document.body.append(shell);

        document.addEventListener('pointerdown', (event) => {
            if (shell && !shell.contains(event.target)) {
                closeMenu();
            }
            const event_path = event.composedPath();
            if (profile_fallback_open && native_header && !event_path.includes(native_header)) {
                const target = event_path.find((node) => node instanceof Element) || null;
                if (!target || !target.closest('[role="menu"], [role="dialog"], .artdeco-dropdown__content')) {
                    closeNativeProfile();
                }
            }
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && menu && !menu.hidden) {
                event.preventDefault();
                closeMenu(true);
            }
            if (event.key === 'Escape') {
                closeNativeProfile();
            }
        });
    }

    function markLayout() {
        const workspace = document.querySelector('main#workspace');
        if (workspace) {
            setAttribute(workspace, 'data-l-x-layout', 'workspace');
            const primary = workspace.querySelector('section[aria-label="Primary content"]');
            if (primary && primary.parentElement.querySelector(':scope > aside[aria-label="Sidebar"]')) {
                const columns = primary.parentElement;
                setAttribute(columns, 'data-l-x-layout', 'columns');
                if (columns.parentElement && columns.parentElement !== workspace) {
                    setAttribute(columns.parentElement, 'data-l-x-layout', 'canvas');
                }
            }
            if (workspace.parentElement && workspace.parentElement !== document.body) {
                setAttribute(workspace.parentElement, 'data-l-x-layout', 'workspace');
                const app_grid = workspace.parentElement.parentElement;
                if (app_grid && native_header && native_header.ownerDocument === document &&
                    app_grid.contains(native_header) && app_grid.contains(workspace)) {
                    setAttribute(app_grid, 'data-l-x-app-grid', '');
                }
            }
        }
        document.querySelectorAll('.feed-shared-update-v2, .artdeco-card').forEach((card) => {
            setAttribute(card, 'data-l-x-card', '');
        });
        if (location.pathname.startsWith('/feed')) {
            document.querySelectorAll('h2').forEach((heading) => {
                if (heading.textContent.trim() === 'Feed post') {
                    const card = heading.closest('[role="listitem"], article, .feed-shared-update-v2');
                    if (card) {
                        setAttribute(card, 'data-l-x-card', '');
                    }
                }
            });
        }
        const sidebar = document.querySelector('aside[aria-label="Sidebar"]');
        if (sidebar) {
            Array.from(sidebar.children).forEach((card) => setAttribute(card, 'data-l-x-card', ''));
        }
        document.querySelectorAll('iframe[data-testid="interop-iframe"]').forEach((iframe) => {
            const url = linkedinUrl(iframe.getAttribute('src'));
            if (url && url.pathname.startsWith('/preload/')) {
                setAttribute(iframe, 'data-l-x-messenger-host', '');
                if (iframe.parentElement) {
                    setAttribute(iframe.parentElement, 'data-l-x-messenger-host', '');
                }
            }
        });
    }

    function markMessenger(source_root = document) {
        const is_shadow_root = source_root instanceof ShadowRoot;
        const messenger = source_root.querySelector('.msg-overlay-container, .msg-messaging-container, .msg-conversations-container');
        if (!is_top_frame && !is_shadow_root && !messenger && !location.pathname.startsWith('/preload/')) {
            return;
        }
        if (!is_top_frame || is_shadow_root) {
            const styling_host = is_shadow_root ? source_root.host : document.documentElement;
            styling_host.classList.add('l-x-theme-active', 'l-x-messenger-frame');
            const frame_header = findNativeHeader(source_root);
            if (frame_header) {
                setAttribute(frame_header, 'data-l-x-native-header', '');
            }
        }
        if (messenger) {
            setAttribute(messenger, 'data-l-x-messenger', '');
        }
        if (location.pathname.startsWith('/messaging')) {
            const main = source_root.querySelector('main');
            if (main) {
                setAttribute(main, 'data-l-x-messenger', '');
            }
        }
        const bubble = source_root.querySelector('.msg-overlay-list-bubble');
        const header = bubble ? bubble.querySelector(':scope > header, .msg-overlay-list-bubble__header, .msg-overlay-bubble-header') : null;
        if (header) {
            setAttribute(header, 'data-l-x-msg-header', '');
            const title = Array.from(header.querySelectorAll('span, p, h2, h3')).find((element) => {
                return element.childElementCount === 0 && element.textContent.trim() === 'Messaging';
            });
            if (title) {
                setAttribute(title, 'data-l-x-msg-title', '');
                setAttribute(header, 'data-l-x-msg-titled', '');
            }
        }
        if (header && !header.querySelector('.l-x-yahoo-label')) {
            const label = document.createElement('span');
            label.className = 'l-x-yahoo-label';
            label.setAttribute('aria-hidden', 'true');
            label.title = 'Yahoo! Messenger style';
            label.append(createIcon('smile'), document.createTextNode('Yahoo!'));
            header.prepend(label);
        }
    }

    function applyShadowTheme() {
        const host = document.querySelector('[data-testid="interop-shadowdom"]');
        const shadow_root = host ? host.shadowRoot : null;
        if (shadow_root !== observed_shadow_root) {
            if (shadow_observer) {
                shadow_observer.disconnect();
            }
            observed_shadow_root = shadow_root;
            shadow_observer = null;
        }
        if (!shadow_root) {
            return null;
        }
        host.classList.add('l-x-theme-active', 'l-x-messenger-frame');
        if (!shadow_root.querySelector('#l-x-shadow-theme') && typeof L_X_SHADOW_CSS === 'string') {
            const style = document.createElement('style');
            style.id = 'l-x-shadow-theme';
            style.textContent = L_X_SHADOW_CSS;
            shadow_root.append(style);
        }
        if (!shadow_observer) {
            shadow_observer = new MutationObserver(onMutations);
            shadow_observer.observe(shadow_root, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['href', 'src', 'aria-label']
            });
        }
        markMessenger(shadow_root);
        return shadow_root;
    }

    function updateCurrentRoute() {
        let current_label = 'LinkedIn';
        for (const item of nav_items) {
            const link = menu_links.get(item.key);
            const is_current = location.pathname.startsWith(item.route.replace(/\/$/, ''));
            if (is_current) {
                current_label = 'LinkedIn · ' + item.label;
                setAttribute(link, 'aria-current', 'page');
            } else if (link && link.hasAttribute('aria-current')) {
                link.removeAttribute('aria-current');
            }
        }
        if (location.pathname.startsWith('/in/')) {
            current_label = 'LinkedIn · Profile';
        } else if (location.pathname.startsWith('/search/')) {
            current_label = 'LinkedIn · Search';
        }
        setText(task_label, current_label);
        const profile_shortcut = shell.querySelector('.l-x-profile-shortcut');
        setAttribute(profile_shortcut, 'href', profile_info.href || '#');
    }

    function refresh() {
        refresh_pending = false;
        if (!document.documentElement || !document.body) {
            return;
        }
        if (!is_top_frame) {
            markMessenger();
            return;
        }
        const shadow_root = applyShadowTheme();
        const detected_header = findNativeHeader() ||
            (shadow_root ? findNativeHeader(shadow_root) : null) || findInteropHeader();
        if (!detected_header && !shell) {
            return;
        }
        if (detected_header) {
            native_header = detected_header;
        }
        if (!shell || !shell.isConnected) {
            buildShell();
        }
        if (native_header && native_header.isConnected) {
            captureNativeNavigation();
            setAttribute(native_header, 'data-l-x-native-header', '');
        }
        captureProfile();
        document.documentElement.classList.add('l-x-theme-active');
        markLayout();
        markMessenger();
        updateCurrentRoute();
    }

    function scheduleRefresh() {
        if (!refresh_pending) {
            refresh_pending = true;
            window.requestAnimationFrame(refresh);
        }
    }

    function onMutations(records) {
        const needs_refresh = records.some((record) => {
            const target = record.target instanceof Element ? record.target :
                record.target.parentElement || record.target.host;
            return target && !target.closest('#l-x-shell, #l-x-shadow-theme, .l-x-yahoo-label') &&
                !(record.type === 'attributes' && record.attributeName.startsWith('data-l-x-'));
        });
        if (needs_refresh) {
            scheduleRefresh();
        }
    }
    const observer = new MutationObserver(onMutations);
    observer.observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['href', 'src', 'aria-label'] });
    window.addEventListener('popstate', scheduleRefresh);
    window.addEventListener('pageshow', scheduleRefresh);
    document.addEventListener('load', (event) => {
        if (event.target instanceof HTMLIFrameElement) {
            scheduleRefresh();
        }
    }, true);
    document.addEventListener('DOMContentLoaded', scheduleRefresh, { once: true });
    scheduleRefresh();
})();
