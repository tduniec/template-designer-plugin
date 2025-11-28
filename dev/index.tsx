import { createDevApp } from "@backstage/dev-utils";
import { TemplateDesignerPage, templateDesignerPlugin } from "../src/plugin";
import {
  AnyApiFactory,
  createApiFactory,
  createPlugin,
  discoveryApiRef,
  fetchApiRef,
} from "@backstage/core-plugin-api";
import { catalogApiRef } from "@backstage/plugin-catalog-react";
import { rootRouteRef } from "../src/routes";
import { CatalogApiMock } from "./CatalogApiMock";

const apiFactories: AnyApiFactory[] = [
  createApiFactory({
    api: catalogApiRef,
    deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
    factory: () => new CatalogApiMock(),
  }),
];

const templateDesignerDevPlugin = createPlugin({
  id: "templateDesignerDev",
  routes: {
    root: rootRouteRef,
  },
  apis: apiFactories,
});

createDevApp()
  .registerPlugin(templateDesignerPlugin)
  .registerPlugin(templateDesignerDevPlugin)
  .addPage({
    element: <TemplateDesignerPage />,
    title: "Root Page",
    path: "/template-designer",
  })
  .render();
