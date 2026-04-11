import { z } from "zod";
import { execSync } from "node:child_process";
import { ArtifactRegistry, DeploymentArtifactType } from "@sdlcworks/components";

const registry = new ArtifactRegistry({
  name: "gcp-artifact-registry",
  acceptedArtifactTypes: [DeploymentArtifactType.oci_spec_image],
  configSchema: z.object({
    location: z.string(),
    repositoryId: z.string(),
    description: z.string().optional(),
    immutableTags: z.boolean().optional(),
  }),
  stateSchema: z.object({
    location: z.string(),
    repositoryId: z.string(),
  }),
  provision: async ({ config, state, $, gcp }) => {
    if (!gcp) throw new Error("gcp-artifact-registry requires gcloud provider");

    new gcp.artifactregistry.Repository($`repo`, {
      location: config.location,
      repositoryId: config.repositoryId,
      format: "DOCKER",
      description: config.description,
      ...(config.immutableTags
        ? { dockerConfig: { immutableTags: true } }
        : {}),
    });

    state.location = config.location;
    state.repositoryId = config.repositoryId;
  },
  publish: async ({ componentName, artifact, version, state, getCredentials }) => {
    const { location, repositoryId } = state;
    const creds = getCredentials() as {
      GCP_PROJECT_ID: string;
      GCP_SERVICE_ACCOUNT_KEY: string;
    };

    const registry = `${location}-docker.pkg.dev`;
    const target = `${registry}/${creds.GCP_PROJECT_ID}/${repositoryId}/${componentName}:${version}`;

    // Authenticate docker to GCP Artifact Registry
    execSync(
      `echo '${creds.GCP_SERVICE_ACCOUNT_KEY}' | docker login -u _json_key --password-stdin ${registry}`,
      { stdio: "inherit" },
    );

    // Tag the source image (artifact.uri is a remote docker ref, CI is pre-authenticated to source)
    execSync(`docker tag ${artifact.uri} ${target}`, { stdio: "inherit" });

    // Push to GCP Artifact Registry
    execSync(`docker push ${target}`, { stdio: "inherit" });

    console.error(`Pushed ${target}`);
  },
});

export default registry;
