export function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

export class RuntimeError extends Error {
  constructor(
    message: string,
    readonly code: string,
    name = "RuntimeError",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = name;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, new.target);
    }
  }
}

export class ConfigError extends RuntimeError {
  constructor(
    message: string,
    code = "config-error",
    options?: ErrorOptions,
  ) {
    super(message, code, "ConfigError", options);
  }
}

export class VaultPermissionError extends RuntimeError {
  constructor(
    message: string,
    code = "vault-permission-error",
    options?: ErrorOptions,
  ) {
    super(message, code, "VaultPermissionError", options);
  }
}

export class ProjectNotFoundError extends RuntimeError {
  constructor(
    message: string,
    code = "project-not-found",
    options?: ErrorOptions,
  ) {
    super(message, code, "ProjectNotFoundError", options);
  }
}

export class InvalidStatusTransitionError extends RuntimeError {
  constructor(
    readonly from: string,
    readonly to: string,
    options?: ErrorOptions,
  ) {
    super(
      `Invalid change-set status transition: ${from} -> ${to}`,
      "invalid-status-transition",
      "InvalidStatusTransitionError",
      options,
    );
  }
}

export class ChangeSetNotFoundError extends RuntimeError {
  constructor(
    message: string,
    code = "change-set-not-found",
    options?: ErrorOptions,
  ) {
    super(message, code, "ChangeSetNotFoundError", options);
  }
}

export class StateStoreError extends RuntimeError {
  constructor(
    message: string,
    code = "state-store-error",
    options?: ErrorOptions,
  ) {
    super(message, code, "StateStoreError", options);
  }
}

export class MarkdownWriteError extends RuntimeError {
  constructor(
    message: string,
    code = "markdown-write-error",
    options?: ErrorOptions,
  ) {
    super(message, code, "MarkdownWriteError", options);
  }
}

export class InvalidStateError extends RuntimeError {
  constructor(
    message: string,
    code = "invalid-state",
    options?: ErrorOptions,
  ) {
    super(message, code, "InvalidStateError", options);
  }
}

export class InvalidPath extends RuntimeError {
  constructor(
    readonly path: string,
    code = "invalid-path",
    readonly details: Record<string, string> = {},
    options?: ErrorOptions,
  ) {
    super(`Invalid path: ${path}`, code, "InvalidPath", options);
  }
}

export class PathNotFound extends InvalidPath {
  constructor(path: string, options?: ErrorOptions) {
    super(path, "path-not-found", {}, options);
    this.name = "PathNotFound";
  }
}

export class InvalidProjectId extends RuntimeError {
  constructor(message: string, code: string = 'invalid-project-id', options?: ErrorOptions) {
    super(message, code, 'InvalidProjectId', options)
  }
}

export class InvalidProjectIdUnicode extends InvalidProjectId {
  constructor(name: string, options?: ErrorOptions) {
    super(`${name} is not valid unicode and cannot be used as a "project id"`, 'invalid-project-id-unicode', options);
  }
}

export class ProjectAlreadyExistsError extends RuntimeError {
  constructor(projectId: string) {
    super(
      `Project already exists: ${projectId}`,
      "project-already-exists",
      "ProjectAlreadyExistsError",
    );
  }
}
