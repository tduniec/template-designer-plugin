import { createDevApp } from "@backstage/dev-utils";
import { templateDesignerPlugin, TemplateDesignerPage } from "../src/plugin";

createDevApp()
  .registerPlugin(templateDesignerPlugin)
  .addPage({
    element: <TemplateDesignerPage />,
    title: "Root Page",
    path: "/template-designer",
  })
  .render();
