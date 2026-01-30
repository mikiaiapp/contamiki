
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log("ContaMiki: Booting client application...");

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Critical: Could not find root element to mount React.");
}

// Ocultar el loader estático una vez que React tome el control
const mountApp = () => {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log("ContaMiki: React mounted successfully.");
};

// Pequeño delay para asegurar que el DOM esté estable
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountApp);
} else {
    mountApp();
}
