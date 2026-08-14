/** Mounts the prototype. The only file that touches the DOM root. */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import Prototype01App from './app/Prototype01App';

createRoot(document.getElementById('prototype-root')!).render(
  <StrictMode>
    <Prototype01App />
  </StrictMode>,
);
