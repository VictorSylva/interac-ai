import React from 'react';
import ReactDOM from 'react-dom/client';
import ChatWidget from './components/ChatWidget';
import './index.css'; // Ensure base styles are loaded

// This is the entry point for the standalone widget
const WIDGET_DIV_ID = 'interacai-widget-root';

function initWidget() {
  // Check if element exists, if not create it
  let widgetDiv = document.getElementById(WIDGET_DIV_ID);
  if (!widgetDiv) {
    widgetDiv = document.createElement('div');
    widgetDiv.id = WIDGET_DIV_ID;
    document.body.appendChild(widgetDiv);
  }

  // Get config from window if defined
  const config = window.INTERACAI_CONFIG || {};

  const root = ReactDOM.createRoot(widgetDiv);
  root.render(
    <React.StrictMode>
      <ChatWidget {...config} />
    </React.StrictMode>
  );
}

// Auto-initialize when script loads
if (document.readyState === 'complete') {
  initWidget();
} else {
  window.addEventListener('load', initWidget);
}

// Expose to window for manual init
window.InteractAI = {
  init: initWidget
};
