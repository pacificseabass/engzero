export class ConfigError extends Error {}

export class VaultPermissionError extends Error {}

export class ProjectNotFoundError extends Error {}

export class ChangeSetNotFoundError extends Error {}

export class StateStoreError extends Error {}

export class MarkdownWriteError extends Error {}

export class InvalidStateError extends Error {}

export class PermissionError extends Error {}

export class InvalidPath extends Error {
  path: string;
  constructor(path: string, code?: string, extra?: Record<string, string>) {
    const data = {
      path,
      code: code ?? "invalid-path",
      ...extra,
    };
    super(JSON.stringify(data));
    this.name = "InvalidPath";
    this.path = path;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, InvalidPath);
    }
  }
}

export class PathNotFound extends InvalidPath {
  constructor(path: string) {
    super(path, "path-not-found");
    this.name = "PathNotFound";
  }
}
