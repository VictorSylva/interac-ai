
export const initBATracker = (businessId) => {
    if (typeof window === 'undefined') return;

    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
    window.BA_ENDPOINT = `${apiUrl}/api/behavior-analytics/collect`;
    window.BA_BUSINESS_ID = businessId || 'default';

    if (!document.getElementById('ba-tracker')) {
        const script = document.createElement('script');
        script.id = 'ba-tracker';
        script.src = '/ba_tracker.js';
        script.async = true;
        document.body.appendChild(script);
    }
};

export const trackBAEvent = (type, props) => {
    if (window.BATracker) {
        window.BATracker.track(type, props);
    }
};
