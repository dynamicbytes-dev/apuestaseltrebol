import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom no implementa estas APIs del navegador y las usa la aplicacion.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

if (!window.print) {
  window.print = () => {};
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});
