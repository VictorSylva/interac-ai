(function() {
    const CONFIG = {
        apiEndpoint: window.BA_ENDPOINT || 'https://interact-backend-production.onrender.com/api/behavior-analytics/collect',
        businessId: window.BA_BUSINESS_ID || 'default',
        flushInterval: 8000,
        heartbeatInterval: 30000
    };

    let initialized = false;
    let eventQueue = [];
    let sessionId = sessionStorage.getItem('ba_session_id') || crypto.randomUUID();
    let visitorId = localStorage.getItem('ba_visitor_id') || crypto.randomUUID();
    
    sessionStorage.setItem('ba_session_id', sessionId);
    localStorage.setItem('ba_visitor_id', visitorId);

    const init = (businessId) => {
        if (initialized) return;
        CONFIG.businessId = businessId || CONFIG.businessId;
        initialized = true;
        track('session_start');
        trackPageView();
    };

    const getMetadata = () => {
        const urlParams = new URLSearchParams(window.location.search);
        return {
            referrer: document.referrer,
            utm_source: urlParams.get('utm_source'),
            utm_medium: urlParams.get('utm_medium'),
            utm_campaign: urlParams.get('utm_campaign'),
            device: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
            browser: navigator.userAgent,
            os: navigator.platform,
            country: 'Unknown'
        };
    };

    const track = (type, props = {}) => {
        const path = window.location.pathname;
        if (path.startsWith('/dashboard') || path.startsWith('/super-admin') || path.startsWith('/login') || path.startsWith('/reset-password') || path.startsWith('/accept-invitation')) {
            return;
        }
        eventQueue.push({
            type,
            path,
            timestamp: new Date().toISOString(),
            ...props
        });
    };

    const flush = async () => {
        if (eventQueue.length === 0) return;

        const payload = {
            business_id: CONFIG.businessId,
            session_id: sessionId,
            visitor_id: visitorId,
            metadata: getMetadata(),
            events: eventQueue
        };

        const currentBatch = [...eventQueue];
        eventQueue = [];

        try {
            const response = await fetch(CONFIG.apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (response.ok) {
            } else {
                throw new Error('BA Flush Failed');
            }
        } catch (err) {
            console.error('[BA Tracker] Flush error:', err);
            eventQueue = [...currentBatch, ...eventQueue];
        }
    };

    // Auto-track Pageviews
    let lastPath = window.location.pathname;
    const trackPageView = () => {
        track('pageview');
        lastPath = window.location.pathname;
    };

    const originalPushState = history.pushState;
    history.pushState = function() {
        originalPushState.apply(this, arguments);
        if (lastPath !== window.location.pathname) trackPageView();
    };

    window.addEventListener('popstate', () => {
        if (lastPath !== window.location.pathname) trackPageView();
    });

    // Auto-track Clicks
    document.addEventListener('click', (e) => {
        const target = e.target.closest('a, button, input[type="submit"]');
        if (target) {
            track('click', {
                element_id: target.id,
                element_class: target.className,
                element_text: target.innerText?.trim().substring(0, 50)
            });
        }
    });

    // Auto-track Scroll Depth
    const scrollMarkers = [25, 50, 75, 100];
    const trackedMarkers = new Set();
    window.addEventListener('scroll', () => {
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrollPercent = (scrollTop / scrollHeight) * 100;

        scrollMarkers.forEach(marker => {
            if (scrollPercent >= marker && !trackedMarkers.has(marker)) {
                trackedMarkers.add(marker);
                track('scroll', { properties: { depth: marker } });
            }
        });
    });

    // Initialize if businessId is already set (e.g. from utility)
    if (CONFIG.businessId !== 'default') {
        init();
    }

    window.addEventListener('load', () => {
        if (!initialized && CONFIG.businessId !== 'default') init();
    });

    window.addEventListener('beforeunload', flush);
    setInterval(flush, CONFIG.flushInterval);

    window.initBATracker = (businessId) => {
        init(businessId);
    };

    window.BATracker = { track, flush, init: initBATracker };
})();
