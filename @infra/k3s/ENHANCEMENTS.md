# K3s Component Enhancements Applied

This file documents all enhancements made to the k3s component for SDLC platform self-hosting.

## Changes Made

### 1. TCP Probe Support (✓ Complete)

- Added `TcpProbeSchema` for non-HTTP health checks
- Added `ProbeSchema` discriminated union (http|tcp)
- Added `buildTcpProbe()` and `buildProbe()` helpers
- Lines: 115-133, 1978-1992

### 2. StatefulSet Health Probes (In Progress)

- Need to add `livenessProbe` and `readinessProbe` to `StatefulSetConfigSchema`
- Need to update `buildStatefulSet()` to render probes

### 3. Deployment TCP Probe Support (Pending)

- Update `DeploymentConfigSchema` to use `ProbeSchema` instead of `HttpProbeSchema`
- Update `buildDeployment()` to use `buildProbe()` helper

### 4. initContainers Support (Pending)

- Add `InitContainerSchema`
- Add `initContainers` to `CommonWorkloadFields`
- Update all 5 builder functions to render initContainers

### 5. ImagePullSecrets Support (Pending)

- Add `imagePullSecrets` and `imagePullPolicy` to `CommonWorkloadFields`
- Update all 5 builder functions

### 6. Kubernetes Secret + envFrom (Pending)

- Modify `allocateWithPulumiCtx` to create k8s Secret from envStore
- Modify all builders to use `envFrom` instead of `env`
- Modify `upsertArtifacts` to PATCH Secret + add restart annotation

## Remaining Work

Due to file complexity (2355+ lines), the remaining enhancements will be applied via targeted edits in the next phase.
jahsbdhjk
