import { z } from "zod";
import { readFileSync } from "node:fs";
import { ArtifactRegistry, DeploymentArtifactType } from "@sdlcworks/components";

const registry = new ArtifactRegistry({
  name: "github-release",
  acceptedArtifactTypes: [DeploymentArtifactType.file],
  configSchema: z.object({
    /** GitHub org or user (e.g., "systemsway-qa") */
    owner: z.string(),
    /** GitHub repo name (e.g., "sdlc") */
    repo: z.string(),
  }),
  stateSchema: z.object({
    /** Persisted from config so publish() can access it */
    owner: z.string(),
    repo: z.string(),
  }),
  provision: async ({ config, state }) => {
    // No cloud resources needed — GitHub Releases is built into GitHub.
    // Persist config values to state so they're available during publish().
    state.owner = config.owner;
    state.repo = config.repo;
  },
  publish: async ({ componentName, artifact, version, tag, state, getCredentials }) => {
    const { owner, repo } = state;

    // Get GH_TOKEN from cloud_credentials (provider: "github")
    const creds = getCredentials() as { GH_TOKEN: string };
    const ghToken = creds.GH_TOKEN;
    if (!ghToken) {
      throw new Error(
        "github-release: GH_TOKEN not found in cloud_credentials for provider 'github'. " +
          "Add github credentials to cloud_credentials in the project config.",
      );
    }

    // Use the release tag created by the Go CLI (avoids creating a second tag that triggers rollback)
    const tagName = tag;

    const headers = {
      Authorization: `Bearer ${ghToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };

    // Check if a release with this tag already exists
    const checkRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/releases/tags/${encodeURIComponent(tagName)}`,
      { headers },
    );

    let release: any;

    if (checkRes.ok) {
      // Release already exists — use it
      release = await checkRes.json();
      console.error(`GitHub Release '${tagName}' already exists, uploading asset to it`);
    } else {
      // Create a new GitHub Release
      const createRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/releases`,
        {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            tag_name: tagName,
            name: `${componentName} v${version}`,
            draft: false,
            prerelease: false,
            generate_release_notes: true,
          }),
        },
      );

      if (!createRes.ok) {
        const err = await createRes.text();
        throw new Error(
          `Failed to create GitHub Release '${tagName}': ${createRes.status} ${err}`,
        );
      }

      release = await createRes.json();
      console.error(`Created GitHub Release '${tagName}'`);
    }

    // Upload the binary as a release asset.
    // artifact.uri is an absolute local temp file path (downloaded from S3 by the Go CLI).
    const binary = readFileSync(artifact.uri);
    const assetName = `${componentName}-${process.platform}-${process.arch}`;
    const uploadUrl = (release.upload_url as string).replace(
      "{?name,label}",
      "",
    );

    const uploadRes = await fetch(`${uploadUrl}?name=${assetName}`, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/octet-stream",
      },
      body: binary,
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      throw new Error(
        `Failed to upload release asset '${assetName}': ${uploadRes.status} ${err}`,
      );
    }

    console.error(`Uploaded '${assetName}' to ${release.html_url}`);
  },
});

export default registry;
