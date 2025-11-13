import { Box, Button, Grid, Paper, Typography } from "@material-ui/core";
import { useTheme } from "@material-ui/core/styles";

type TemplateLandingProps = {
  loadError?: string;
  onStartSampleTemplate: () => void;
  onOpenTemplatePicker: () => void;
};

export const TemplateLanding = ({
  loadError,
  onStartSampleTemplate,
  onOpenTemplatePicker,
}: TemplateLandingProps) => {
  const theme = useTheme();

  return (
    <Grid
      container
      justifyContent="center"
      alignItems="center"
      style={{ minHeight: "60vh" }}
    >
      <Grid item xs={12} md={10} lg={8}>
        <Grid container spacing={4} alignItems="stretch">
          <Grid item xs={12} md={6}>
            <Paper
              elevation={3}
              style={{
                padding: 32,
                height: "100%",
                minHeight: 320,
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <Box>
                <Typography variant="h6">Create new template</Typography>
                <Typography variant="body2" color="textSecondary">
                  Start with a tidy sample blueprint that includes a single
                  action step and helpful starter metadata.
                </Typography>
              </Box>
              <Box mt="auto" display="flex" justifyContent="flex-start">
                <Button
                  color="primary"
                  variant="contained"
                  onClick={onStartSampleTemplate}
                >
                  Start new template
                </Button>
              </Box>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper
              elevation={3}
              style={{
                padding: 32,
                height: "100%",
                minHeight: 320,
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <Box>
                <Typography variant="h6">Load from file</Typography>
                <Typography variant="body2" color="textSecondary">
                  Import an existing template in YAML or JSON format and iterate
                  in the visual designer.
                </Typography>
              </Box>
              <Box
                mt="auto"
                display="flex"
                flexDirection="column"
                style={{ gap: 8 }}
              >
                <Button
                  color="primary"
                  variant="outlined"
                  onClick={onOpenTemplatePicker}
                >
                  Choose file
                </Button>
                {loadError && (
                  <Typography
                    variant="body2"
                    style={{ color: theme.palette.error.main }}
                  >
                    {loadError}
                  </Typography>
                )}
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Grid>
    </Grid>
  );
};
