export type VaultCapability = "read" | "write" | "append" | "delete";

export type VaultConfig = {
  id: string;
  label: string;
  rootPath: string;
  capabilities: VaultCapability[];
};
