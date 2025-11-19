import { useCallback, useState } from "react";
import {
  Page,
  Content,
  ContentHeader,
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
  } = useTemplateState();
  const {
    editorState,
    editorValue,
    setEditorValue,
    interactionRootRef,
    closeEditor,
    applyEditorValue,
  } = useFieldEditor();

  const handleToggleYaml = useCallback(() => {
    setShowYaml((prev) => !prev);
  }, []);

  const activeTemplateLabel = templateSource?.label;

  let reloadButtonLabel = "Reset sample";
  if (templateSource?.type === "file") {
    reloadButtonLabel = isReloading ? "Reloading..." : "Reload file";
  }

  let saveButtonLabel =
    templateSource?.type === "file" ? "Save" : "Save as file";
  if (isSaving) {
    saveButtonLabel = "Saving...";
  }

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

          {!templateObject ? (
            <TemplateLanding
              loadError={loadError}
              onStartSampleTemplate={handleStartSampleTemplate}
              onOpenTemplatePicker={handleOpenTemplatePicker}
            />
          ) : (
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
            />
          )}
        </Content>
      </Page>
      <FieldEditorDialog
        open={Boolean(editorState)}
        label={editorState?.label}
        value={editorValue}
        onChange={setEditorValue}
        onClose={closeEditor}
        onApply={applyEditorValue}
      />
    </div>
  );
};
