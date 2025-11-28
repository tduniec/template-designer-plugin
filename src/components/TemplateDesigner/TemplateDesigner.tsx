import { useCallback, useMemo, useState } from "react";
import {
  Content,
  ContentHeader,
  Page,
  SupportButton,
} from "@backstage/core-components";
import { FieldEditorDialog } from "./components/FieldEditorDialog";
import { TemplateLanding } from "./components/TemplateLanding";
import { TemplateWorkspace } from "./components/TemplateWorkspace";
import { useFieldEditor } from "./useFieldEditor";
import { useTemplateState } from "./useTemplateState";

export const TemplateDesigner = () => {
  const [showYaml, setShowYaml] = useState(true);
  const {
    templateObject,
    templateYaml,
    yamlError,
    loadError,
    templateSteps,
    templateParameters,
    templateOutput,
    templateSource,
    isReloading,
    isSaving,
    isSyncing,
    fileInputRef,
    handleStartSampleTemplate,
    handleTemplateFileSelected,
    handleOpenTemplatePicker,
    handleYamlChange,
    handleStepsChange,
    handleParametersChange,
    handleOutputChange,
    handleReloadFromFile,
    handleSaveTemplate,
    availableTemplates,
    selectCatalogTemplate,
  } = useTemplateState();
  const { editorState, interactionRootRef, closeEditor, applyEditorValue } =
    useFieldEditor();

  const handleToggleYaml = useCallback(() => {
    setShowYaml((prev) => !prev);
  }, []);

  const activeTemplateLabel = templateSource?.label;

  let reloadButtonLabel = "Reset sample";
  if (templateSource?.type === "file") {
    reloadButtonLabel = isReloading ? "Reloading..." : "Reload file";
  } else if (templateSource?.type === "catalog") {
    reloadButtonLabel = "Reload template";
  }

  let saveButtonLabel =
    templateSource?.type === "file" ? "Save" : "Save as file";
  if (isSaving) {
    saveButtonLabel = "Saving...";
  }

  const workspace = useMemo(
    () =>
      templateObject ? (
        <TemplateWorkspace
          templateSteps={templateSteps}
          templateParameters={templateParameters}
          templateOutput={templateOutput}
          templateYaml={templateYaml}
          yamlError={yamlError}
          loadError={loadError}
          showYaml={showYaml}
          onToggleYaml={handleToggleYaml}
          onYamlChange={handleYamlChange}
          onStepsChange={handleStepsChange}
          onParametersChange={handleParametersChange}
          onOutputChange={handleOutputChange}
          onReload={handleReloadFromFile}
          onSave={handleSaveTemplate}
          onOpenTemplatePicker={handleOpenTemplatePicker}
          activeTemplateLabel={activeTemplateLabel}
          reloadButtonLabel={reloadButtonLabel}
          saveButtonLabel={saveButtonLabel}
          isReloading={isReloading}
          isSaving={isSaving}
          isSyncing={isSyncing}
        />
      ) : (
        <TemplateLanding
          loadError={loadError}
          onStartSampleTemplate={handleStartSampleTemplate}
          onOpenTemplatePicker={handleOpenTemplatePicker}
          availableTemplates={availableTemplates}
          selectCatalogTemplate={selectCatalogTemplate}
        />
      ),
    [
      templateObject,
      templateSteps,
      templateParameters,
      templateOutput,
      templateYaml,
      yamlError,
      loadError,
      showYaml,
      handleToggleYaml,
      handleYamlChange,
      handleStepsChange,
      handleParametersChange,
      handleOutputChange,
      handleReloadFromFile,
      handleSaveTemplate,
      handleOpenTemplatePicker,
      activeTemplateLabel,
      reloadButtonLabel,
      saveButtonLabel,
      isReloading,
      isSaving,
      isSyncing,
      handleStartSampleTemplate,
      availableTemplates,
      selectCatalogTemplate,
    ]
  );

  return (
    <div ref={interactionRootRef} style={{ height: "100%" }}>
      <Page themeId="tool">
        <Content>
          <ContentHeader title="Template Designer">
            <SupportButton>
              Template Designer turns blank Backstage YAML into a
              storyboard-like canvas, guiding anyone through drag-and-drop
              scaffolder authoring before ever touching code. Rally non-experts,
              broadcast best practices, and accelerate template launches
              directly inside Backstage.
            </SupportButton>
          </ContentHeader>

          <input
            ref={fileInputRef}
            type="file"
            accept=".yaml,.yml,.json"
            style={{ display: "none" }}
            onChange={handleTemplateFileSelected}
          />

          {workspace}
        </Content>
      </Page>
      <FieldEditorDialog
        open={Boolean(editorState)}
        label={editorState?.label}
        value={editorState?.initialValue ?? ""}
        onClose={closeEditor}
        onApply={applyEditorValue}
      />
    </div>
  );
};
