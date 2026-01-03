import '@testing-library/jest-dom';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock CSS custom properties
const mockGetPropertyValue = (property: string) => {
  const vars: Record<string, string> = {
    '--slack-bg': '#1a1d21',
    '--slack-sidebar': '#19171d',
    '--slack-hover': '#27242c',
    '--slack-active': '#4a154b',
    '--slack-border': '#3d3c40',
    '--slack-text': '#d1d2d3',
    '--slack-text-muted': '#ababad',
    '--slack-link': '#1d9bd1',
  };
  return vars[property] || '';
};

const originalGetComputedStyle = window.getComputedStyle;
window.getComputedStyle = (element: Element) => {
  const style = originalGetComputedStyle(element);
  return {
    ...style,
    getPropertyValue: mockGetPropertyValue,
  };
};
