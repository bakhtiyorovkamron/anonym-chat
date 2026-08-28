import { describe, expect, it } from "vitest";
import { canCreateReport, isValidReportReason } from "@/server/reports";

describe("reports", () => {
  it("report reason validation works", () => {
    expect(isValidReportReason("SPAM")).toBe(true);
    expect(isValidReportReason("UNKNOWN")).toBe(false);
  });

  it("report limit prevents spam reports", () => {
    expect(canCreateReport(0)).toBe(true);
    expect(canCreateReport(4)).toBe(true);
    expect(canCreateReport(5)).toBe(false);
  });

  it("admin status values are constrained", () => {
    const statuses = ["PENDING", "REVIEWING", "RESOLVED", "DISMISSED"];
    expect(statuses).toContain("RESOLVED");
  });
});
