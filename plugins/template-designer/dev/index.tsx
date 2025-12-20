import { createDevApp } from "@backstage/dev-utils";
import { templateDesignerPlugin, TemplateDesignerPage } from "../src/plugin";
import {
  mockCatalogApiFactory,
  mockScaffolderApiFactory,
} from "@tduniec/plugin-template-designer-foundation";

createDevApp()
  .registerApi(mockCatalogApiFactory)
  .registerApi(mockScaffolderApiFactory)
  .registerPlugin(templateDesignerPlugin)
  .addPage({
    element: <TemplateDesignerPage />,
    title: "Root Page",
    path: "/template-designer",
  })
  .render();
