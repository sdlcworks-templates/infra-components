import { z } from "zod";
import * as pulumi from "@pulumi/pulumi";
import * as cloudflare from "@pulumi/cloudflare";
import { URLRegister } from "@sdlcworks/components";
import { PublicCI } from "../../_internal/interfaces";

const RecordEntrySchema = z.object({
  /** Subdomain name (e.g., "api", "console") */
  name: z.string(),
  /** App component name this record routes to (e.g., "sdlcserv", "console") */
  component: z.string(),
  /** Whether to proxy through Cloudflare (orange cloud = HTTPS + CDN + DDoS protection) */
  proxied: z.boolean().default(true),
});

const register = new URLRegister({
  name: "cloudflare-dns",
  interface: PublicCI,
  configSchema: z.object({
    /** Root domain (e.g., "gohashira.wtf"). Zone ID is looked up automatically. */
    domain: z.string(),
    /** Cloudflare API token with DNS edit permissions for this zone. */
    apiToken: z.string(),
    /** DNS A records to create, each mapping a subdomain to an app component. */
    records: z.array(RecordEntrySchema),
  }),
  provision: async ({ config, components, $ }) => {
    const results: Record<string, pulumi.Output<string>> = {};

    // Create a dedicated Cloudflare provider using the DNS-specific API token.
    // This is separate from the default CLOUDFLARE_API_TOKEN env var (set from
    // cloud_credentials) which may not have DNS edit permissions.
    const cfProvider = new cloudflare.Provider($`cf-dns-provider`, {
      apiToken: config.apiToken,
    });
    const providerOpts = { provider: cfProvider };

    // Look up the Cloudflare zone ID from the domain name.
    const zone = cloudflare.getZoneOutput(
      { filter: { name: config.domain } },
      providerOpts,
    );

    // Extract the IP from any component's metadata.
    // All components on the same k3s cluster share the same external IP.
    const firstEntry = Object.values(components)[0];
    if (!firstEntry) {
      console.error(
        "cloudflare-dns: no components found via PublicCI interface. " +
          "Ensure at least one infra component declares PublicCI.",
      );
      return results;
    }
    const ip = firstEntry.metadata.host;

    for (const record of config.records) {
      const fqdn = `${record.name}.${config.domain}`;

      new cloudflare.DnsRecord(
        $`dns-${record.name}`,
        {
          zoneId: zone.zoneId,
          name: record.name,
          type: "A",
          content: ip,
          proxied: record.proxied,
          ttl: 1, // 1 = automatic (required by Cloudflare; proxied records always use automatic TTL)
        },
        providerOpts,
      );

      const protocol = record.proxied ? "https" : "http";
      results[record.component] = pulumi.output(`${protocol}://${fqdn}`);
    }

    return results;
  },
});

export default register;
