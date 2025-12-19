import type { ComponentType } from "react";
import type { TaskStep } from "@backstage/plugin-scaffolder-common";

export type JsonSchemaProperty = Record<string, unknown>;

export type ActionSchemaDecorator = (options: {
  actionId: string;
  step: TaskStep;
  schema: Record<string, JsonSchemaProperty>;
}) => Record<string, JsonSchemaProperty>;

export type ActionFieldsRendererProps = {
  actionId: string;
  step: TaskStep;
  input?: Record<string, unknown>;
  schema: Record<string, JsonSchemaProperty>;
  onUpdateInput: (key: string, value: unknown) => void;
};

export type ActionFieldsRenderer = ComponentType<ActionFieldsRendererProps>;

/**
 * Simple singleton registry used by the Action node to apply schema tweaks
 * and render optional custom UI from downstream packages (e.g. PRO).
 */
class ActionNodeCustomizationRegistry {
  private schemaDecorators: ActionSchemaDecorator[] = [];
  private fieldsRenderer: ActionFieldsRenderer | undefined;

  registerSchemaDecorator(decorator: ActionSchemaDecorator) {
    this.schemaDecorators.push(decorator);
  }

  registerFieldsRenderer(renderer: ActionFieldsRenderer) {
    this.fieldsRenderer = renderer;
  }

  getSchemaDecorators() {
    return [...this.schemaDecorators];
  }

  getFieldsRenderer(): ActionFieldsRenderer | undefined {
    return this.fieldsRenderer;
  }
}

export const actionNodeCustomizationRegistry =
  new ActionNodeCustomizationRegistry();
