(function() {
  // Configuration
  // In a real environment, this should point to the production CDN/Server
  // For local testing, we assume the React app is running on localhost:3000
  const isLocal = window.location.hostname === 'localhost' || 
                  window.location.hostname === '127.0.0.1' || 
                  window.location.hostname.startsWith('192.168.');
  
  const BASE_URL = isLocal ? `${window.location.protocol}//${window.location.host}` : 'https://interac-ai.web.app';

  console.log('[InterractAI] Loader initialized. BASE_URL:', BASE_URL);

  window.InterractAI = {
    init: function(config) {
      console.log('[InterractAI] init called with config:', config);
      // Store config globally so React app can pick it up
      window.InterractAI.config = config;
      
      // Inject the widget
      loadWidget();
    }
  };

  function loadWidget() {
    // 1. Ensure the mount point exists
    const WIDGET_ID = 'interact-widget-root';
    if (!document.getElementById(WIDGET_ID)) {
      console.log('[InterractAI] Creating mount point:', WIDGET_ID);
      const div = document.createElement('div');
      div.id = WIDGET_ID;
      document.body.appendChild(div);
    } else {
      console.log('[InterractAI] Mount point already exists:', WIDGET_ID);
    }

    // 2. Fetch the asset manifest to find the correct hashed filenames
    // In development mode (npm start), asset-manifest.json might not exist.
    // However, on the main InteracAI site, the app is already loaded.
    // This fetch is primarily for EXTERNAL sites embedding the widget.
    fetch(`${BASE_URL}/asset-manifest.json`)
      .then(response => {
        if (!response.ok) throw new Error('Manifest not found');
        return response.json();
      })
      .then(manifest => {
        console.log('[InterractAI] Manifest loaded, injecting assets...');
        const entrypoints = manifest.entrypoints;
        
        entrypoints.forEach(entry => {
          if (entry.endsWith('.js') && !document.querySelector(`script[src*="${entry}"]`)) {
             const script = document.createElement('script');
             script.src = `${BASE_URL}/${entry}`;
             script.async = true;
             document.body.appendChild(script);
          } else if (entry.endsWith('.css') && !document.querySelector(`link[href*="${entry}"]`)) {
             const link = document.createElement('link');
             link.rel = 'stylesheet';
             link.href = `${BASE_URL}/${entry}`;
             document.head.appendChild(link);
          }
        });
      })
      .catch(err => {
        console.warn('[InterractAI] Could not load manifest (normal in dev if on same site):', err.message);
      });
  }

  // Auto-init if config is already present (optional convenience)
  if (window.InterractAI_Config) {
    window.InterractAI.init(window.InterractAI_Config);
  }

})();

