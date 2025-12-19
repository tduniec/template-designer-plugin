import type { TemplateSourceProvider } from "./types";

class TemplateSourceRegistry {
  private readonly providers = new Map<string, TemplateSourceProvider>();

  register(provider: TemplateSourceProvider) {
    if (this.providers.has(provider.id)) {
      throw new Error(`Template source '${provider.id}' already registered`);
    }
    this.providers.set(provider.id, provider);
  }

  list(): TemplateSourceProvider[] {
    return Array.from(this.providers.values());
  }
}

/**
 * Registry that lets OSS and PRO expose additional template pickers
 * (catalog, git, SaaS, etc.) without changing the core UI.
 */
export const templateSourceRegistry = new TemplateSourceRegistry();
