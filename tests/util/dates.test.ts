import { describe, expect, it } from "vitest";

import { formatDateStamp, formatMonthPath } from "../../src/util/dates.js";

describe("formatDateStamp", () => {
  it("renders YYYYMMDD with zero padding", () => {
    expect(formatDateStamp(new Date(2026, 4, 4))).toBe("20260504");
    expect(formatDateStamp(new Date(2026, 11, 31))).toBe("20261231");
  });
});

describe("formatMonthPath", () => {
  it("renders YYYY-MM with zero padding", () => {
    expect(formatMonthPath(new Date(2026, 4, 4))).toBe("2026-05");
    expect(formatMonthPath(new Date(2026, 11, 31))).toBe("2026-12");
  });
});
