import * as pulumi from "@pulumi/pulumi";
import * as cloudflare from "@pulumi/cloudflare";
import { URLRegister } from "@sdlcworks/components";
import { PublicCI } from "../../_internal/interfaces";
import { LOG_PREFIX, RESOURCE_NAMES } from "./constants";
import { ConfigSchema, type Config } from "./schema";
import {
  buildComponentResultUri,
  createDnsRecord,
  invertByAppName,
  resolveFqdn,
  resolveTtl,
  warnMissingComponents,
  type ComponentEntry,
} from "./provision";

const register = new URLRegister({
  name: "cloudflare-dns",
  interface: PublicCI,
  configSchema: ConfigSchema,
  provision: async (ctx) => {
    // The framework's InferZodType wraps every top-level config field in
    // PulumiInput<T> (to accept Outputs from upstream resolutions). In practice
    // the orchestrator resolves all $[[kv]] refs before calling provision, so
    // config values are concrete by the time we run. Cast once at the boundary.
    const config = ctx.config as unknown as Config;
    const { components, $ } = ctx;

    const results: Record<string, pulumi.Output<string>> = {};

    const provider = new cloudflare.Provider($(RESOURCE_NAMES.PROVIDER), {
      apiToken: config.apiToken,
    });
    const opts = { provider };

    const zone = cloudflare.getZoneOutput(
      { filter: { name: config.domain } },
      opts,
    );

    const inverted = invertByAppName(
      components as Record<string, ComponentEntry>,
    );
    const presentAppNames = new Set(inverted.map(([appName]) => appName));
    warnMissingComponents(config, presentAppNames);

    const seenFqdn = new Map<string, string>();

    for (const [appName, { metadata }] of inverted) {
      const rcfg = config.records[appName];
      if (!rcfg) {
        console.warn(
          `${LOG_PREFIX} component '${appName}' has no record entry; skipping`,
        );
        continue;
      }

      if (!metadata.host) {
        console.error(
          `${LOG_PREFIX} component '${appName}' missing metadata.host; skipping`,
        );
        continue;
      }

      const fqdn = resolveFqdn(rcfg, config.domain);
      const previouslySeenBy = seenFqdn.get(fqdn);
      if (previouslySeenBy) {
        throw new Error(
          `${LOG_PREFIX} duplicate fqdn '${fqdn}' for components '${appName}' and '${previouslySeenBy}'`,
        );
      }
      seenFqdn.set(fqdn, appName);

      const proxied = rcfg.proxied ?? config.defaults.proxied;
      const ttl = resolveTtl(rcfg, config.defaults, proxied);
      const host = pulumi.output(metadata.host) as pulumi.Output<string>;

      createDnsRecord({
        $,
        opts,
        zoneId: zone.zoneId,
        appName,
        rcfg,
        host,
        proxied,
        ttl,
      });

      results[appName] = buildComponentResultUri({
        appName,
        fqdn,
        proxied,
        metadata,
      });
    }

    return results;
  },
});

export default register;
