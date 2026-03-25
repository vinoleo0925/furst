import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress specific benign WASM/TensorFlow logs that might be confusing
const suppressLog = (...args: any[]) => {
  for (const arg of args) {
    if (typeof arg === 'string' && arg.includes('Created TensorFlow Lite XNNPACK delegate')) {
      return true;
    }
  }
  return false;
};

const originalConsoleInfo = console.info;
console.info = (...args) => {
  if (suppressLog(...args)) return;
  originalConsoleInfo(...args);
};

const originalConsoleLog = console.log;
console.log = (...args) => {
  if (suppressLog(...args)) return;
  originalConsoleLog(...args);
};

const originalConsoleWarn = console.warn;
console.warn = (...args) => {
  if (suppressLog(...args)) return;
  originalConsoleWarn(...args);
};

const originalConsoleError = console.error;
console.error = (...args) => {
  if (suppressLog(...args)) return;
  originalConsoleError(...args);
};

const originalConsoleDebug = console.debug;
console.debug = (...args) => {
  if (suppressLog(...args)) return;
  originalConsoleDebug(...args);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
