import {
  createFrontendPlugin,
  NavItemBlueprint,
  PageBlueprint,
} from "@backstage/frontend-plugin-api";
import { rootRouteRef } from "./routes";
import { TemplateDesignerIcon } from "@tduniec/plugin-template-designer-foundation";

const templateDesignerNavItem = NavItemBlueprint.make({
  params: {
    title: "Template designer",
    routeRef: rootRouteRef,
    icon: TemplateDesignerIcon,
  },
});

const templateDesignerPage = PageBlueprint.make({
  params: {
    path: "/template-designer",
    routeRef: rootRouteRef,
    loader: () =>
      import("./components/TemplateDesigner").then((m) => (
        <m.TemplateDesigner />
      )),
  },
});

/**
 * Backstage frontend plugin.
 *
 * @alpha
 */
export default createFrontendPlugin({
  pluginId: "template-designer",
  info: { packageJson: () => import("../package.json") },
  routes: {
    root: rootRouteRef,
  },
  extensions: [templateDesignerPage, templateDesignerNavItem],
});
