import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';
import { ToastProvider } from './Toast.js';
import { ErrorBoundary } from './ErrorBoundary.js';
import { I18nProvider } from './i18n/index.js';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <ErrorBoundary>
        <ToastProvider>
          <App />
        </ToastProvider>
      </ErrorBoundary>
    </I18nProvider>
  </React.StrictMode>,
);
