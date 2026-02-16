import "@testing-library/jest-dom";

// Silence noisy React / MUI warnings that are expected in tests.
let restoreConsole: (() => void) | null = null;
beforeAll(() => {
  // eslint-disable-next-line no-console
  const originalError = console.error;
  // eslint-disable-next-line no-console
  console.error = (...args: any[]) => {
    const msg = String(args[0] ?? "");
    if (
      msg.includes("findDOMNode is deprecated") ||
      msg.includes("not wrapped in act(") ||
      msg.includes("Warning: An update to")
    ) {
      return;
    }
    originalError(...args);
  };
  restoreConsole = () => {
    // eslint-disable-next-line no-console
    console.error = originalError;
  };
});

afterAll(() => {
  restoreConsole?.();
});
