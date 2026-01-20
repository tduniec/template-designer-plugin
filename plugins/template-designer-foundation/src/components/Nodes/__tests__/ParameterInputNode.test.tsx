/* eslint-disable no-console */
import { render } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@material-ui/core/styles";
import { ParameterInputNode } from "../ParameterInputNode";
import type { ParameterFieldDisplay } from "../../../types/flowNodes";
import type { ParameterNodeExtensions } from "../../../parameters/extensions/types";

const createField = (): ParameterFieldDisplay => ({
  id: "field-1",
  fieldName: "title",
  sectionId: "section-1",
  sectionTitle: "Main",
  required: false,
  schema: {
    title: "Title",
    type: "string",
    description: "Template title",
    default: "Hello world",
  },
});

const renderWithTheme = (node: React.ReactElement) => {
  const theme = createTheme();
  return render(<ThemeProvider theme={theme}>{node}</ThemeProvider>);
};

const originalError = console.error;
beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation((...args) => {
    const msg = args.join(" ");
    if (msg.includes("findDOMNode is deprecated")) {
      return;
    }
    originalError(...args);
  });
});

afterEach(() => {
  (console.error as jest.Mock).mockRestore();
});

describe("ParameterInputNode", () => {
  it("renders base inputs without extensions", () => {
    const { container, queryAllByLabelText } = renderWithTheme(
      <ParameterInputNode field={createField()} index={0} totalCount={1} />
    );

    expect(container.querySelector("hr")).toBeNull();
    expect(queryAllByLabelText("Field name")[0]).toBeInTheDocument();
    expect(queryAllByLabelText("Type")[0]).toBeInTheDocument();
    expect(queryAllByLabelText("Title")[0]).toBeInTheDocument();
    expect(queryAllByLabelText("Description")[0]).toBeInTheDocument();
    expect(queryAllByLabelText("Default")[0]).toBeInTheDocument();
    expect(container).toHaveTextContent(
      "Double-click text fields to edit in a modal."
    );
  });

  it("renders extras when provided", () => {
    const extensions: ParameterNodeExtensions = {
      renderInputExtras: ({ fieldId }) => (
        <div data-testid="extra-content">extra-{fieldId}</div>
      ),
    };

    const { getByTestId, container } = renderWithTheme(
      <ParameterInputNode
        field={createField()}
        index={0}
        totalCount={1}
        extensions={extensions}
        nodeId="rf-parameters"
      />
    );

    expect(container.querySelector("hr")).not.toBeNull();
    expect(getByTestId("extra-content")).toHaveTextContent("extra-field-1");
  });
});
