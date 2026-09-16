import type { AuditResult, AuditRisk, AuditRiskLevel } from "./audit-service.js";

const riskLevels = new Set<AuditRiskLevel>(["low", "medium", "high", "critical"]);

export class AuditResultValidationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AuditResultValidationError";
  }
}

export function parseAuditResult(value: string | unknown): AuditResult {
  let candidate: unknown = value;

  if (typeof value === "string") {
    try {
      candidate = JSON.parse(value);
    } catch (error) {
      throw new AuditResultValidationError("Codex returned invalid JSON", { cause: error });
    }
  }

  if (!isRecord(candidate)) {
    throw new AuditResultValidationError("Audit result must be an object");
  }

  const keys = Object.keys(candidate);
  if (keys.some((key) => key !== "score" && key !== "risks")) {
    throw new AuditResultValidationError("Audit result contains unsupported properties");
  }

  if (!Number.isInteger(candidate.score) || (candidate.score as number) < 0 || (candidate.score as number) > 100) {
    throw new AuditResultValidationError("Audit score must be an integer from 0 through 100");
  }

  if (!Array.isArray(candidate.risks)) {
    throw new AuditResultValidationError("Audit risks must be an array");
  }

  const risks = candidate.risks.map(parseRisk);
  const score = candidate.score as number;
  if (score === 100 && risks.length > 0) {
    throw new AuditResultValidationError("A perfect score cannot contain risks");
  }
  if (score < 100 && risks.length === 0) {
    throw new AuditResultValidationError("A score below 100 must contain at least one risk");
  }

  return { score, risks };
}

function parseRisk(value: unknown, index: number): AuditRisk {
  if (!isRecord(value)) {
    throw new AuditResultValidationError(`Risk ${index + 1} must be an object`);
  }

  const keys = Object.keys(value);
  if (keys.some((key) => !["id", "level", "description"].includes(key))) {
    throw new AuditResultValidationError(`Risk ${index + 1} contains unsupported properties`);
  }
  if (typeof value.id !== "string" || value.id.length < 6) {
    throw new AuditResultValidationError(`Risk ${index + 1} must have an ID of at least six characters`);
  }
  if (typeof value.level !== "string" || !riskLevels.has(value.level as AuditRiskLevel)) {
    throw new AuditResultValidationError(`Risk ${index + 1} has an invalid level`);
  }
  if (typeof value.description !== "string" || value.description.length === 0) {
    throw new AuditResultValidationError(`Risk ${index + 1} must have a non-empty description`);
  }

  return {
    id: value.id,
    level: value.level as AuditRiskLevel,
    description: value.description,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
