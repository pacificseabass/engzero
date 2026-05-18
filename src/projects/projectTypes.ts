export type RiskProfile = "low" | "medium" | "high";

export type ProjectManifest = {
  projectId: string;
  name: string;
  projectType?: string;
  memoryNamespace: string;
  vaultNamespace: string;
  repos: ProjectRepo[];
  riskProfile: RiskProfile;
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

export type InitProjectInput = Pick<ProjectManifest, "projectId"> &
  Partial<
    Pick<
      ProjectManifest,
      | "name"
      | "projectType"
      | "memoryNamespace"
      | "vaultNamespace"
      | "repos"
      | "riskProfile"
      | "deploymentTargets"
      | "toolsAllowed"
      | "custom"
    >
  >;
