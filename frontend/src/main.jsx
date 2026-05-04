import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './i18n/index.js';
import './styles/globals.css';

// Suppress browser-extension "message channel closed" errors that are not
// caused by our code (e.g. React DevTools, LastPass, Grammarly extensions).
const _origOnUnhandledRejection = window.onunhandledrejection;
window.addEventListener('unhandledrejection', (event) => {
  const msg = event?.reason?.message || '';
  if (
    msg.includes('message channel closed') ||
    msg.includes('listener indicated an asynchronous response')
  ) {
    event.preventDefault();
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
