import { createApiFactory } from "@backstage/core-plugin-api";
import { catalogApiRef } from "@backstage/plugin-catalog-react";
import { scaffolderApiRef } from "@backstage/plugin-scaffolder-react";
import {
  ListActionsResponse,
  TemplateEntityV1beta3,
} from "@backstage/plugin-scaffolder-common";

export const MOCK_CATALOG_TEMPLATES: TemplateEntityV1beta3[] = [
  {
    apiVersion: "scaffolder.backstage.io/v1beta3",
    kind: "Template",
    metadata: {
      name: "sample-template",
      title: "Sample Template (mock)",
      description: "Mock catalog template for local dev",
    },
    spec: {
      type: "service",
      parameters: [],
      steps: [],
      output: {},
    },
  },
];

export const MOCK_SCAFFOLDER_ACTIONS: ListActionsResponse = [
  {
    id: "debug:log",
    description: "Writes a message to the task log output.",
    schema: {
      input: {
        required: ["message"],
        properties: {
          message: {
            title: "Message",
            type: "string",
            description: "Free-form text that will be printed to the logs.",
          },
        },
      },
      output: {
        properties: {},
      },
    },
  },
  {
    id: "fetch:template",
    description:
      "Fetches contents from a git repository and places them in the workspace.",
    schema: {
      input: {
        required: ["url"],
        properties: {
          url: {
            title: "Repository URL",
            type: "string",
            description: "Location of the repository or template archive.",
          },
          targetPath: {
            title: "Target Path",
            type: "string",
            description: "Relative path where the files will be written.",
            default: ".",
          },
        },
      },
      output: {
        properties: {
          targetPath: {
            type: "string",
            description: "Path where the contents were written.",
          },
        },
      },
    },
  },
  {
    id: "catalog:register",
    description: "Registers an entity in the Backstage catalog.",
    schema: {
      input: {
        required: ["catalogInfoUrl"],
        properties: {
          catalogInfoUrl: {
            title: "catalog-info.yaml URL",
            type: "string",
            description: "URL that points to the generated entity definition.",
          },
          optional: {
            title: "Optional",
            type: "boolean",
            description:
              "Mark the registration as optional and ignore failures.",
            default: false,
          },
        },
      },
      output: {
        properties: {
          entityRef: {
            title: "Entity Ref",
            type: "string",
            description: "Entity reference for the registered component.",
          },
        },
      },
    },
  },
];

export const mockCatalogApiFactory = createApiFactory({
  api: catalogApiRef,
  deps: {},
  factory: () =>
    ({
      getEntities: async () => ({ items: MOCK_CATALOG_TEMPLATES }),
    } as any),
});

export const mockScaffolderApiFactory = createApiFactory({
  api: scaffolderApiRef,
  deps: {},
  factory: () =>
    ({
      listActions: async () => MOCK_SCAFFOLDER_ACTIONS,
    } as any),
});
