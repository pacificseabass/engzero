import { describe, expect, it } from "vitest";

import {
  assertCloseable,
  assertTransition,
  canTransition,
} from "../../src/changeSets/changeSetLifecycle.js";
import type { ChangeSetStatus } from "../../src/changeSets/changeSetTypes.js";
import { InvalidStatusTransitionError } from "../../src/util/errors.js";

describe("change-set lifecycle", () => {
  const forwardPath: ChangeSetStatus[] = [
    "created",
    "planning",
    "executing",
    "validating",
    "ready_for_review",
    "deployed",
  ];

  it("allows each forward step of the lifecycle", () => {
    for (let i = 0; i < forwardPath.length - 1; i += 1) {
      expect(canTransition(forwardPath[i], forwardPath[i + 1])).toBe(true);
    }
  });

  it("rejects skipping forward steps", () => {
    expect(canTransition("created", "executing")).toBe(false);
    expect(canTransition("planning", "ready_for_review")).toBe(false);
    expect(canTransition("executing", "deployed")).toBe(false);
  });

  it("rejects moving backwards", () => {
    expect(canTransition("executing", "planning")).toBe(false);
    expect(canTransition("deployed", "ready_for_review")).toBe(false);
  });

  it("allows failing from any active status", () => {
    for (const status of forwardPath) {
      expect(canTransition(status, "failed")).toBe(true);
    }
  });

  it("allows retrying a failed change set by replanning", () => {
    expect(canTransition("failed", "planning")).toBe(true);
    expect(canTransition("failed", "executing")).toBe(false);
  });

  it("treats closed as terminal and unreachable via setStatus", () => {
    for (const status of [...forwardPath, "failed"] as ChangeSetStatus[]) {
      expect(canTransition(status, "closed")).toBe(false);
      expect(canTransition("closed", status)).toBe(false);
    }
  });

  it("throws a typed error on invalid transitions", () => {
    expect(() => assertTransition("created", "deployed")).toThrow(
      InvalidStatusTransitionError,
    );
    expect(() => assertTransition("created", "planning")).not.toThrow();
  });

  it("only rejects closing an already closed change set", () => {
    expect(() => assertCloseable("closed")).toThrow(
      InvalidStatusTransitionError,
    );
    expect(() => assertCloseable("created")).not.toThrow();
    expect(() => assertCloseable("failed")).not.toThrow();
  });
});
