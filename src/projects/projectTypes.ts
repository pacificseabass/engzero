export type ProjectManifest = {
  projectId: string;
  name: string;
  projectType?: string;
  memoryNamespace: string;
  vaultNamespace: string;
  repos: ProjectRepo[];
  riskProfile: "low" | "medium" | "high";
  deploymentTargets: DeploymentTarget[];
  toolsAllowed: string[];
  custom?: Record<string, unknown>;
};

export type ProjectRepo = {
  name: string;
  path: string;
  remote?: string;
};

export type DeploymentTarget = {
  name: string;
  provider: "local" | "gcp" | "other";
  environment?: string;
  status?: "planned" | "active" | "disabled";
};
