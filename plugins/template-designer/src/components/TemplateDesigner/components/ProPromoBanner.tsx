import { useEffect, useMemo, useState } from "react";
import { Box, Button, IconButton, Typography } from "@material-ui/core";
import CloseIcon from "@material-ui/icons/Close";

const STORAGE_KEY = "td-pro-promo-dismissed";
const PRO_LINK = "https://dx-labs.com/template-designer";

type Props = { show: boolean };

export const ProPromoBanner = ({ show }: Props) => {
  const [visible, setVisible] = useState(false);
  const [anim, setAnim] = useState<"idle" | "enter" | "hide">("idle");

  useEffect(() => {
    if (!show) {
      setVisible(false);
      setAnim("idle");
      return undefined;
    }
    const dismissed = window.sessionStorage.getItem(STORAGE_KEY);
    if (dismissed) return undefined;
    const t = window.setTimeout(() => {
      setVisible(true);
      window.requestAnimationFrame(() => setAnim("enter"));
    }, 3000); // 3s delay
    return () => {
      window.clearTimeout(t);
    };
  }, [show]);

  const handleClose = () => {
    window.sessionStorage.setItem(STORAGE_KEY, "true");
    setAnim("hide");
    window.setTimeout(() => setVisible(false), 220);
  };

  const style = useMemo(() => {
    const base = {
      borderRadius: 14,
      padding: 16,
      background:
        "linear-gradient(120deg, rgba(79,70,229,0.14), rgba(16,185,129,0.18))",
      border: "1px solid rgba(79,70,229,0.35)",
      boxShadow: "0 10px 28px rgba(0,0,0,0.08)",
      maxWidth: "min(720px, 50vw)",
      width: "100%",
      transition: "opacity 200ms ease, transform 200ms ease",
      opacity: anim === "enter" ? 1 : 0,
      transform: anim === "enter" ? "translateY(0)" : "translateY(10px)",
    } as const;
    if (anim === "hide") {
      return { ...base, opacity: 0, transform: "translateY(-6px)" };
    }
    return base;
  }, [anim]);

  if (!visible) return null;

  return (
    <Box mt={1} mb={2} display="flex" justifyContent="center">
      <Box style={style}>
        <Box
          display="flex"
          alignItems="flex-start"
          justifyContent="space-between"
        >
          <Box pr={2}>
            <Typography variant="subtitle1" style={{ fontWeight: 700 }}>
              Discover Template Designer PRO
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Unlock playground, dry-run, advanced parameter nodes, and more to
              ship better templates faster.
            </Typography>
          </Box>
          <IconButton aria-label="Zamknij" onClick={handleClose} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        <Box mt={2} display="flex" alignItems="center" style={{ gap: 12 }}>
          <Button
            variant="contained"
            color="primary"
            href={PRO_LINK}
            target="_blank"
            rel="noopener noreferrer"
            size="small"
          >
            Explore PRO
          </Button>
          <Button
            variant="text"
            color="primary"
            size="small"
            onClick={handleClose}
          >
            Maybe later
          </Button>
        </Box>
      </Box>
    </Box>
  );
};
