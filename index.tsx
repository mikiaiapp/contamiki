
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

console.log("ContaMiki: Booting client application from root...");

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Critical: Could not find root element to mount React.");
}

const hideLoader = () => {
    const loader = document.getElementById('app-loader');
    if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => loader.remove(), 500);
    }
};

const mountApp = () => {
    try {
        const root = createRoot(rootElement);
        root.render(
          <React.StrictMode>
            <App />
          </React.StrictMode>
        );
        console.log("ContaMiki: React mounted successfully.");
        setTimeout(hideLoader, 200);
    } catch (err) {
        console.error("ContaMiki: Error during mount:", err);
        const status = document.getElementById('loader-status');
        if (status) {
            status.innerHTML = '<span class="text-rose-500 font-bold">Error al iniciar: ' + (err instanceof Error ? err.message : 'Error desconocido') + '</span>';
        }
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountApp);
} else {
    mountApp();
}
