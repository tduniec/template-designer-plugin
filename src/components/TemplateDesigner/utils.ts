import type { TaskStep } from "@backstage/plugin-scaffolder-common";

export const FILE_PICKER_ACCEPT = {
  "application/yaml": [".yaml", ".yml"],
  "application/json": [".json"],
};

export const FILE_PICKER_TYPES = [
  {
    description: "Scaffolder template",
    accept: FILE_PICKER_ACCEPT,
  },
];

export const DEFAULT_FILE_NAME = "template.yaml";

export const isTaskStep = (candidate: unknown): candidate is TaskStep => {
  if (!candidate || typeof candidate !== "object") {
    return false;
  }
  const step = candidate as Record<string, unknown>;
  return (
    typeof step.id === "string" &&
    typeof step.name === "string" &&
    typeof step.action === "string"
  );
};

export const cloneDeep = <T,>(value: T): T => {
  if (value === undefined || value === null) {
    return value;
  }
  return JSON.parse(JSON.stringify(value)) as T;
};

export const cloneSteps = (steps: TaskStep[]): TaskStep[] =>
  steps.map((step) => cloneDeep(step));

export const asRecord = (
  candidate: unknown
): Record<string, unknown> | undefined => {
  if (!candidate || typeof candidate !== "object") {
    return undefined;
  }
  return candidate as Record<string, unknown>;
};

export const downloadString = (value: string, fileName: string) => {
  const blob = new Blob([value], { type: "text/yaml" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

export type FileSystemFileHandleLike = {
  name?: string;
  getFile: () => Promise<File>;
  createWritable?: () => Promise<{
    write: (data: Blob | string) => Promise<void>;
    close: () => Promise<void>;
  }>;
  queryPermission?: (options?: {
    mode?: "read" | "readwrite";
  }) => Promise<PermissionState>;
  requestPermission?: (options?: {
    mode?: "read" | "readwrite";
  }) => Promise<PermissionState>;
};

export type TemplateSource =
  | { type: "sample"; label: string }
  | { type: "file"; label: string; handle?: FileSystemFileHandleLike };

export type FileSystemWindow = Window &
  Partial<{
    showOpenFilePicker: (
      options?: unknown
    ) => Promise<FileSystemFileHandleLike[]>;
    showSaveFilePicker: (
      options?: unknown
    ) => Promise<FileSystemFileHandleLike>;
  }>;
