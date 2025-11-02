import { useCallback, useMemo, useState } from 'react';
import {
  Page,
  Content,
  ContentHeader,
  SupportButton,
} from '@backstage/core-components';
import App from '../DesignerFlow/DesignerFlow';
import { Button, Grid, Paper } from '@material-ui/core';
import CodeMirror from '@uiw/react-codemirror';
import { yaml } from '@codemirror/lang-yaml';
import {
  convertJsonToYaml,
  convertYamlToJson,
} from '../../utils/yamlJsonConversion';
import { useTheme } from '@material-ui/core/styles';
import initialTemplateYaml from '../../utils/initialNodes1.yaml';
import type { TaskStep } from '@backstage/plugin-scaffolder-common';

const isTaskStep = (candidate: unknown): candidate is TaskStep => {
  if (!candidate || typeof candidate !== 'object') {
    return false;
  }
  const step = candidate as Record<string, unknown>;
  return (
    typeof step.id === 'string' &&
    typeof step.name === 'string' &&
    typeof step.action === 'string'
  );
};

const cloneDeep = <T,>(value: T): T => {
  if (value === undefined || value === null) {
    return value;
  }
  return JSON.parse(JSON.stringify(value)) as T;
};

const cloneSteps = (steps: TaskStep[]): TaskStep[] =>
  steps.map(step => cloneDeep(step));

export const TemplateDesigner = () => {
  const [showYaml, setShowYaml] = useState(true);
  const theme = useTheme();

  const yamlExtensions = useMemo(() => [yaml()], []);
  const codeMirrorTheme = useMemo(
    () => (theme.palette.type === 'dark' ? 'dark' : 'light'),
    [theme.palette.type],
  );
  const templateSkeleton = useMemo(() => {
    try {
      if (typeof initialTemplateYaml === 'string') {
        const parsedJson = JSON.parse(convertYamlToJson(initialTemplateYaml));
        if (parsedJson && typeof parsedJson === 'object') {
          return parsedJson as Record<string, unknown>;
        }
        return {};
      }
      if (initialTemplateYaml && typeof initialTemplateYaml === 'object') {
        return cloneDeep(initialTemplateYaml as Record<string, unknown>);
      }
      return {};
    } catch (error) {
      return {};
    }
  }, []);

  const initialTemplateYamlString = useMemo(() => {
    if (typeof initialTemplateYaml === 'string') {
      return initialTemplateYaml;
    }
    try {
      return convertJsonToYaml(templateSkeleton);
    } catch (error) {
      return '';
    }
  }, [templateSkeleton]);

  const [templateObject, setTemplateObject] = useState<Record<string, unknown>>(
    () => cloneDeep(templateSkeleton),
  );
  const [templateYaml, setTemplateYaml] = useState<string>(
    () => initialTemplateYamlString,
  );
  const [yamlError, setYamlError] = useState<string | undefined>();

  const handleToggleYaml = useCallback(() => setShowYaml(prev => !prev), []);

  const templateSteps = useMemo(() => {
    const specCandidate = templateObject?.spec;
    if (!specCandidate || typeof specCandidate !== 'object') {
      return [];
    }

    const maybeSteps = (specCandidate as Record<string, unknown>).steps;
    if (!Array.isArray(maybeSteps)) {
      return [];
    }

    const validSteps = maybeSteps.filter(isTaskStep) as TaskStep[];
    return cloneSteps(validSteps);
  }, [templateObject]);

  const handleYamlChange = useCallback((value: string) => {
    setTemplateYaml(value);
    try {
      const parsed = JSON.parse(convertYamlToJson(value));
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Template YAML must describe an object');
      }
      setTemplateObject(parsed as Record<string, unknown>);
      setYamlError(undefined);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error parsing YAML';
      setYamlError(message);
    }
  }, []);

  const handleStepsChange = useCallback((steps: TaskStep[]) => {
    setTemplateObject(prevTemplate => {
      const base =
        prevTemplate && typeof prevTemplate === 'object'
          ? cloneDeep(prevTemplate)
          : {};
      const specCandidate =
        base.spec && typeof base.spec === 'object'
          ? (base.spec as Record<string, unknown>)
          : {};

      const nextSteps = cloneSteps(steps);

      const nextTemplate: Record<string, unknown> = {
        ...base,
        spec: {
          ...specCandidate,
          steps: nextSteps,
        },
      };

      const nextYaml = convertJsonToYaml(nextTemplate);
      setTemplateYaml(nextYaml);
      setYamlError(undefined);
      return nextTemplate;
    });
  }, []);

  return (
    <Page themeId="tool">
      <Content>
        <ContentHeader title="Template Designer">
          <SupportButton>A description of your plugin goes here.</SupportButton>
        </ContentHeader>
        <Grid container spacing={3} direction="column">
          <Grid style={{ height: 800 }} item>
            <div
              style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 12,
                }}
              >
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleToggleYaml}
                >
                  {showYaml ? 'Hide YAML' : 'Show YAML'}
                </Button>
              </div>
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  gap: 16,
                  minHeight: 0,
                }}
              >
                <div style={{ flex: showYaml ? 1.6 : 1, minWidth: 0 }}>
                  <div style={{ height: '100%' }}>
                    <App
                      steps={templateSteps}
                      onStepsChange={handleStepsChange}
                    />
                  </div>
                </div>
                {showYaml && (
                  <Paper
                    elevation={2}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      minWidth: 0,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid rgba(0,0,0,0.12)',
                        fontWeight: 600,
                        fontSize: '0.875rem',
                      }}
                    >
                      YAML Preview
                    </div>
                    {yamlError && (
                      <div
                        style={{
                          padding: '8px 16px',
                          borderBottom: '1px solid rgba(0,0,0,0.08)',
                          color: theme.palette.error.main,
                          fontSize: '0.75rem',
                          background:
                            theme.palette.type === 'dark'
                              ? 'rgba(255, 82, 82, 0.1)'
                              : 'rgba(244, 67, 54, 0.08)',
                        }}
                      >
                        {yamlError}
                      </div>
                    )}
                    <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                      <CodeMirror
                        value={templateYaml}
                        extensions={yamlExtensions}
                        theme={codeMirrorTheme}
                        height="100%"
                        onChange={handleYamlChange}
                      />
                    </div>
                  </Paper>
                )}
              </div>
            </div>
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
};
