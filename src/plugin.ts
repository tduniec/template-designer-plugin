import {
  createPlugin,
  createRoutableExtension,
} from "@backstage/core-plugin-api";

import { rootRouteRef } from "./routes";

export const templateDesignerPlugin = createPlugin({
  id: "template-designer",
  routes: {
    root: rootRouteRef,
  },
});

export const TemplateDesignerPage = templateDesignerPlugin.provide(
  createRoutableExtension({
    name: "TemplateDesignerPage",
    component: () =>
      import("./components/TemplateDesigner").then((m) => m.TemplateDesigner),
    mountPoint: rootRouteRef,
  })
);

export { TemplateDesignerIcon } from "./components/TemplateDesignerIcon";
