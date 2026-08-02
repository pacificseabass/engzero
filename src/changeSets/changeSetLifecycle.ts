import { InvalidStatusTransitionError } from "../util/errors.js";
import type { ChangeSetStatus } from "./changeSetTypes.js";

// "closed" is reached through ChangeSetService.close, never through setStatus,
// so no status lists it as a target here.
const ALLOWED_TRANSITIONS: Record<ChangeSetStatus, ChangeSetStatus[]> = {
  created: ["planning", "failed"],
  planning: ["executing", "failed"],
  executing: ["validating", "failed"],
  validating: ["ready_for_review", "failed"],
  ready_for_review: ["deployed", "failed"],
  deployed: ["failed"],
  failed: ["planning"],
  closed: [],
};

export function canTransition(
  from: ChangeSetStatus,
  to: ChangeSetStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertTransition(
  from: ChangeSetStatus,
  to: ChangeSetStatus,
): void {
  if (!canTransition(from, to)) {
    throw new InvalidStatusTransitionError(from, to);
  }
}

export function assertCloseable(status: ChangeSetStatus): void {
  if (status === "closed") {
    throw new InvalidStatusTransitionError(status, "closed");
  }
}
