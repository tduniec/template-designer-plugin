export const SAMPLE_TEMPLATE_BLUEPRINT: Record<string, unknown> = {
  apiVersion: "scaffolder.backstage.io/v1beta3",
  kind: "Template",
  metadata: {
    name: "sample-template",
    title: "Sample Template",
    description: "Start from a single-step scaffolder template.",
  },
  spec: {
    owner: "user:guest",
    type: "sample",
    parameters: [
      {
        title: "Basic Information",
        properties: {
          message: {
            title: "Message",
            type: "string",
            description: "Optional log message for the sample action.",
            default: "Hello from Template Designer!",
          },
        },
      },
    ],
    steps: [
      {
        id: "sample-action",
        name: "Log Sample Message",
        action: "debug:log",
        input: {
          message: "${{ parameters.message }}",
        },
      },
    ],
    output: {},
  },
};
