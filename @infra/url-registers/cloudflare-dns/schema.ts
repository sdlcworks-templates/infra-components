import { z } from "zod";
import { RECORD_TYPE_VALUES } from "./constants";

export const RecordOverrideSchema = z.object({
  /** Subdomain label, "@" for apex, "*" for wildcard. Prefixed to the root domain. */
  name: z.string().min(1),
  /** Proxy the record through Cloudflare (orange cloud). Falls back to defaults.proxied. */
  proxied: z.boolean().optional(),
  /** Override auto-inferred record type (A/AAAA/CNAME). Auto-inferred from metadata.host otherwise. */
  type: z.enum(RECORD_TYPE_VALUES).optional(),
  /** TTL in seconds. Ignored when proxied (Cloudflare forces automatic). Falls back to defaults.ttl → CF_TTL_AUTO. */
  ttl: z.number().int().positive().optional(),
  /** Optional comment stored on the Cloudflare DNS record. */
  comment: z.string().optional(),
});

export type RecordOverride = z.infer<typeof RecordOverrideSchema>;

export const DefaultsSchema = z
  .object({
    proxied: z.boolean().default(true),
    ttl: z.number().int().positive().optional(),
  })
  .default({ proxied: true });

export const ConfigSchema = z.object({
  /** Root domain whose Cloudflare zone we're managing (e.g. "gohashira.wtf"). */
  domain: z.string().min(1),
  /**
   * Cloudflare API token with DNS edit permissions for this zone.
   * Distinct from the default CLOUDFLARE_API_TOKEN env var (which may lack DNS scope).
   */
  apiToken: z.string().min(1),
  defaults: DefaultsSchema,
  /** Per-app-component record config, keyed by app component name. */
  records: z.record(z.string().min(1), RecordOverrideSchema),
});

export type Config = z.infer<typeof ConfigSchema>;
export type Defaults = z.infer<typeof DefaultsSchema>;
