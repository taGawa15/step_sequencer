import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Sequencer } from './components/Sequencer';
import { ErrorBoundary } from './app/ErrorBoundary';
import { installGlobalErrorHandlers } from './utils/errorLog';
import './index.css';

// Record window.onerror / unhandledrejection into the persistent log
// before anything else can throw.
installGlobalErrorHandlers();

const container = document.getElementById('root');
if (!container) throw new Error('#root not found');

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <Sequencer />
    </ErrorBoundary>
  </StrictMode>,
);
