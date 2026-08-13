import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from './ui/components/ErrorBoundary.js';
import { ToastProvider } from './ui/components/Toasts.js';
import { App } from './ui/App.js';
import './ui/styles.css';

const el = document.getElementById('root');
if (!el) throw new Error('Root element introuvable');

createRoot(el).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>,
);
