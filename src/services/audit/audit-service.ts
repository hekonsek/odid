export const reasoningEfforts = ["low", "medium", "high", "xhigh"] as const;

export type ReasoningEffort = (typeof reasoningEfforts)[number];

export type AuditRiskLevel = "low" | "medium" | "high" | "critical";

export interface AuditRisk {
  id: string;
  level: AuditRiskLevel;
  description: string;
}

export interface AuditResult {
  score: number;
  risks: AuditRisk[];
}

export interface AuditRunOptions {
  model?: string;
  reasoning?: ReasoningEffort;
}

export interface AuditRequest {
  subjectPath: string;
  prompt: string;
  options?: AuditRunOptions;
}

export interface AuditService {
  audit(request: AuditRequest): Promise<AuditResult>;
}
