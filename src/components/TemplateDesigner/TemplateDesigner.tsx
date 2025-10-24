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
import { convertJsonToYaml } from '../../utils/yamlJsonConversion';
import { useTheme } from '@material-ui/core/styles';

export const TemplateDesigner = () => {
  const [showYaml, setShowYaml] = useState(true);
  const [nodesJson, setNodesJson] = useState<string>('[]');
  const theme = useTheme();

  const yamlExtensions = useMemo(() => [yaml()], []);
  const codeMirrorTheme = useMemo(
    () => (theme.palette.type === 'dark' ? 'dark' : 'light'),
    [theme.palette.type],
  );
  const yamlPreview = useMemo(() => {
    try {
      const nodes = JSON.parse(nodesJson) as Array<{
        step?: Record<string, unknown>;
      }>;
      const steps = nodes
        .map(node => node?.step)
        .filter((step): step is Record<string, unknown> => !!step);
      return convertJsonToYaml({ spec: { steps } });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error rendering YAML';
      return [
        '# Unable to render YAML preview from designer nodes.',
        `# ${message}`,
      ].join('\n');
    }
  }, [nodesJson]);

  const handleToggleYaml = useCallback(() => setShowYaml(prev => !prev), []);

  const handleNodesJsonChange = useCallback((json: string) => {
    setNodesJson(json);
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
                    <App onNodesJsonChange={handleNodesJsonChange} />
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
                    <div style={{ flex: 1, minHeight: 0 }}>
                      <CodeMirror
                        value={yamlPreview}
                        extensions={yamlExtensions}
                        editable={false}
                        theme={codeMirrorTheme}
                        height="100%"
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
