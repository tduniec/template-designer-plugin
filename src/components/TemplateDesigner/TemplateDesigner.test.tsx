import { TemplateDesigner } from './TemplateDesigner';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { screen } from '@testing-library/react';
import {
  TestApiProvider,
  registerMswTestHooks,
  renderInTestApp,
} from '@backstage/test-utils';
import { scaffolderApiRef } from '@backstage/plugin-scaffolder-react';

const mockScaffolderApi = {
  listActions: async () => [],
};

const ResizeObserverMock = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

if (typeof (global as any).ResizeObserver === 'undefined') {
  (global as any).ResizeObserver = ResizeObserverMock;
}

const mockScaffolderApi = {
  listActions: async () => [],
};

const ResizeObserverMock = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

if (typeof (global as any).ResizeObserver === "undefined") {
  (global as any).ResizeObserver = ResizeObserverMock;
}

describe("ExampleComponent", () => {
  const server = setupServer();
  // Enable sane handlers for network requests
  registerMswTestHooks(server);

  // setup mock response
  beforeEach(() => {
    server.use(
      rest.get("/*", (_, res, ctx) => res(ctx.status(200), ctx.json({})))
    );
  });

  it('should render', async () => {
    await renderInTestApp(
      <TestApiProvider apis={[[scaffolderApiRef, mockScaffolderApi]]}>
        <TemplateDesigner />
      </TestApiProvider>,
    );
    expect(screen.getByText('Template Designer')).toBeInTheDocument();
  });
});
