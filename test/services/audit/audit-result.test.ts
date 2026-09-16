import { describe, expect, it } from "vitest";
import { AuditResultValidationError, parseAuditResult } from "../../../src/services/audit/audit-result.js";

describe("parseAuditResult", () => {
  it("accepts a valid result", () => {
    expect(parseAuditResult('{"score":100,"risks":[]}')).toEqual({ score: 100, risks: [] });
  });

  it("accepts risks when the score is below 100", () => {
    const result = parseAuditResult({
      score: 75,
      risks: [{ id: "123456", level: "high", description: "Unsafe command execution" }],
    });

    expect(result.risks[0]?.level).toBe("high");
  });

  it.each([
    ["invalid JSON", "not-json"],
    ["out-of-range score", { score: 101, risks: [] }],
    ["risks on a perfect score", { score: 100, risks: [{ id: "123456", level: "low", description: "risk" }] }],
    ["no risks below a perfect score", { score: 99, risks: [] }],
    ["unknown properties", { score: 100, risks: [], extra: true }],
  ])("rejects %s", (_name, value) => {
    expect(() => parseAuditResult(value)).toThrow(AuditResultValidationError);
  });
});
