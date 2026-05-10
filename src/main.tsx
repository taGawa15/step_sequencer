import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Sequencer } from './components/Sequencer';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root not found');

createRoot(container).render(
  <StrictMode>
    <Sequencer />
  </StrictMode>,
);
