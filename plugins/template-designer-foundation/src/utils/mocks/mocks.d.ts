import {
  ListActionsResponse,
  TemplateEntityV1beta3,
} from "@backstage/plugin-scaffolder-common";

export declare const MOCK_CATALOG_TEMPLATES: TemplateEntityV1beta3[];
export declare const MOCK_SCAFFOLDER_ACTIONS: ListActionsResponse;
export declare const mockCatalogApiFactory: import("@backstage/core-plugin-api").ApiFactory<
  import("@backstage/catalog-client").CatalogApi,
  any,
  {
    [x: string]: unknown;
  }
>;
export declare const mockScaffolderApiFactory: import("@backstage/core-plugin-api").ApiFactory<
  import("@backstage/plugin-scaffolder-common").ScaffolderApi,
  any,
  {
    [x: string]: unknown;
  }
>;
