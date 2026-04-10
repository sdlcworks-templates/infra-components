import { z } from "zod";
import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ArtifactRegistry, DeploymentArtifactType } from "@sdlcworks/components";

const registry = new ArtifactRegistry({
  name: "npm-public",
  acceptedArtifactTypes: [DeploymentArtifactType.file],
  configSchema: z.object({}),
  provision: async () => {
    // No cloud resources needed — npmjs.com is external.
  },
  publish: async ({ componentName, artifact, version, tag, getCredentials }) => {
    const creds = getCredentials() as { NPM_TOKEN: string };
    if (!creds.NPM_TOKEN) {
      throw new Error(
        "npm-public: NPM_TOKEN not found in cloud_credentials for provider 'npm'. " +
          "Add npm credentials to cloud_credentials in the project config.",
      );
    }

    // Write temporary .npmrc with auth token
    const npmrcPath = join(tmpdir(), `.npmrc-sdlc-${Date.now()}`);
    writeFileSync(
      npmrcPath,
      `//registry.npmjs.org/:_authToken=${creds.NPM_TOKEN}\n`,
    );

    try {
      execSync(
        `npm publish ${artifact.uri} --registry https://registry.npmjs.org --userconfig ${npmrcPath}`,
        { stdio: "inherit" },
      );
      console.error(`Published ${componentName}@${version} to npmjs.com`);
    } finally {
      try {
        unlinkSync(npmrcPath);
      } catch {}
    }
  },
});

export default registry;
