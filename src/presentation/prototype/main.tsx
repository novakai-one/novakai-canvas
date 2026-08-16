/** Mounts the prototype. The only file that touches the DOM root. */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import PrototypeApp from './app/PrototypeApp';

createRoot(document.getElementById('prototype-root')!).render(
  <StrictMode>
    <PrototypeApp />
  </StrictMode>,
);
