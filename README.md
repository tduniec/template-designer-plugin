# Backstage Template Designer Plugin

**From YAML to Canvas — simplifying Backstage scaffolding**

Empowering the **Democratization of Templates** in Backstage 🚀  
Visually **design, connect, and manage** your Backstage scaffolder templates through an **intuitive drag-and-drop interface** — all inside your Backstage instance.  
No YAML complexity. No coding required. Just creativity. **We are breaking the glass!** templating in Backstage made easy! 🚀

---

## 🌟 Why “Democratization of Templates”?

Backstage templates shouldn’t be just for developers.  
The Template Designer makes **template creation accessible to everyone** — from DevOps engineers to product teams — enabling true **collaboration and transparency** in how your software templates are built and evolve.

---

## 🚀 Features

- ⚡ **Drag & Drop Editing** — visually compose your Backstage scaffolder workflows.
- 🧩 **Three Node Types**
  - **Action Node** – represents a single scaffolder action.
  - **Template Node** – groups multiple actions into a reusable unit.
  - **Output Node** – defines exported values or pipeline results.
- 💾 **Work with Files** — open existing template definitions or save your flow as a JSON file directly from the UI.
- 🔄 **Live Flow Connections** — connect nodes with arrows to define execution order.
- 💡 **Frontend-Only Plugin** — zero backend setup required.

---

## 🖼️ Preview

Checkout the video!

[▶ Watch the PREVIEW on YouTube](https://youtu.be/Pwzlzvig4-c)

## ⚙️ Installation

From your Backstage root directory

```bash
yarn add --cwd packages/app @your-org/plugin-template-designer
```

In packages/app/src/App.tsx:

```tsx
import { TemplateDesignerPage } from "@your-org/plugin-template-designer";

const routes = (
  <FlatRoutes>
    {/* other routes */}
    <Route path="/template-designer" element={<TemplateDesignerPage />} />
  </FlatRoutes>
);
```

In `packages/app/src/components/Root/Root.tsx`:

```tsx
import DesignServicesIcon from "@mui/icons-material/DesignServices";
import { SidebarItem } from "@backstage/core-components";

<SidebarItem
  icon={DesignServicesIcon}
  to="template-designer"
  text="Template Designer"
/>;
```

## ⚙️ Usage

Visit your local Backstage instance:

http://localhost:7007/template-designer

Create and connect nodes, adjust properties, and export your flow as a JSON file.
You can also open an existing template file, modify it visually, and save your changes.

## 💾 File Management

Template Designer allows you to easily work with your Backstage scaffolder definitions:
Open a template file (.json) – load an existing flow directly into the canvas.
Edit visually – move nodes, adjust connections, rename actions.
Save – export your template back to a .json file ready for scaffolder integration.

_Template Designer can read your registered actions!_

## 🧠 Tech Stack

- React + TypeScript
- React Flow
- Backstage Core Components

## 🛠️ Development

To run locally during development:

```bash
yarn start
```

This runs a local Backstage app with hot reload support for your plugin.

## ❤️ Contributing

Template Designer is still fresh out of the oven, so rough edges and open questions are expected—and that’s part of the fun.  
If you spot a bug, have an idea, or simply want to riff on better tooling for templates, please open an issue or PR.

Help us push forward the Democratization of Templates in Backstage!
Ideas, feedback, and PRs are all welcome.

## 📄 License

Apache-2.0 © 2025 — Created by [tduniec](https://github.com/tduniec)

## 🌐 Roadmap

TODO
