import "@testing-library/jest-dom";

if (typeof window !== "undefined") {
  if (typeof import.meta.env.VITE_APP_URL !== "string" || !import.meta.env.VITE_APP_URL.trim()) {
    import.meta.env.VITE_APP_URL = window.location.origin;
  }

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });
}
