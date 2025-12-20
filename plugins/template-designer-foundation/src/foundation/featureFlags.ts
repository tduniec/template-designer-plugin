import type { FeatureFlagClient } from "./types";

/**
 * Default flag client used by OSS; PRO can swap for a richer provider.
 */
export const noopFeatureFlags: FeatureFlagClient = {
  isEnabled: () => false,
};
