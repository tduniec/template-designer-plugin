import { render } from "@testing-library/react";
import { TestApiProvider } from "@backstage/test-utils";
import { scaffolderApiRef } from "@backstage/plugin-scaffolder-react";
import { ThemeProvider, createTheme } from "@material-ui/core/styles";
import { TemplateWorkspace } from "./TemplateWorkspace";
import type { TemplateParametersValue } from "../../types/flowNodes";
import type { ReactNode } from "react";

const noop = () => {};

describe("TemplateWorkspace extension slots", () => {
  it("renders custom header and right panel slots", () => {
    const templateParameters: TemplateParametersValue = [];
    const headerText = "Custom Header Action";
    const rightPanelText = "Custom Right Panel";
    const theme = createTheme();

    // ReactFlow expects ResizeObserver; provide a no-op for jsdom
    (global as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };

    const Wrapper: React.FC<{ children: ReactNode }> = ({ children }) => (
      <TestApiProvider
        apis={[[scaffolderApiRef, { listActions: async () => [] } as any]]}
      >
        <ThemeProvider theme={theme}>{children}</ThemeProvider>
      </TestApiProvider>
    );

    const { getByText } = render(
      <TemplateWorkspace
        templateSteps={[]}
        templateParameters={templateParameters}
        templateOutput={undefined}
        templateYaml=""
        yamlError={undefined}
        loadError={undefined}
        showYaml={false}
        onToggleYaml={noop}
        onYamlChange={noop}
        onStepsChange={noop}
        onParametersChange={noop}
        onOutputChange={noop}
        onReload={noop}
        onSave={noop}
        onOpenTemplatePicker={noop}
        activeTemplateLabel={undefined}
        reloadButtonLabel="Reload"
        saveButtonLabel="Save"
        isReloading={false}
        isSaving={false}
        isSyncing={false}
        parametersNodeComponent={({ data }: any) => (
          <div>params-{data.rfId}</div>
        )}
        headerActionsSlot={<span>{headerText}</span>}
        rightPanelSlot={<div>{rightPanelText}</div>}
      />,
      { wrapper: Wrapper }
    );

    expect(getByText(headerText)).toBeInTheDocument();
    expect(getByText(rightPanelText)).toBeInTheDocument();
  });

  it("renders flowTopSlot content above the flow", () => {
    const templateParameters: TemplateParametersValue = [];
    const bannerText = "Flow Top Banner";
    const theme = createTheme();

    (global as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };

    const Wrapper: React.FC<{ children: ReactNode }> = ({ children }) => (
      <TestApiProvider
        apis={[[scaffolderApiRef, { listActions: async () => [] } as any]]}
      >
        <ThemeProvider theme={theme}>{children}</ThemeProvider>
      </TestApiProvider>
    );

    const { getByText } = render(
      <TemplateWorkspace
        templateSteps={[]}
        templateParameters={templateParameters}
        templateOutput={undefined}
        templateYaml=""
        yamlError={undefined}
        loadError={undefined}
        showYaml={false}
        onToggleYaml={noop}
        onYamlChange={noop}
        onStepsChange={noop}
        onParametersChange={noop}
        onOutputChange={noop}
        onReload={noop}
        onSave={noop}
        onOpenTemplatePicker={noop}
        activeTemplateLabel={undefined}
        reloadButtonLabel="Reload"
        saveButtonLabel="Save"
        isReloading={false}
        isSaving={false}
        isSyncing={false}
        parametersNodeComponent={({ data }: any) => (
          <div>params-{data.rfId}</div>
        )}
        flowTopSlot={<div>{bannerText}</div>}
      />,
      { wrapper: Wrapper }
    );

    expect(getByText(bannerText)).toBeInTheDocument();
  });
});
