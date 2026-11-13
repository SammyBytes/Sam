import { z } from "zod";
import { createRuntime } from "@sam-lang/runtime";

export const SecurityAuditSchema = z.object({
  has_vulnerabilities: z.boolean(),
  risk_level: z.string(),
  findings_count: z.number(),
});

export type SecurityAudit = z.infer<typeof SecurityAuditSchema>;

export const ReleaseDecisionSchema = z.object({
  approved: z.boolean(),
  summary: z.string(),
});

export type ReleaseDecision = z.infer<typeof ReleaseDecisionSchema>;

const sam = createRuntime([
  { name: "SecurityAuditor", runner: "mock", workspace: "./src", systemPrompt: "Analyze the diff and return a structured SecurityAudit JSON.", timeout: 45000 },
  { name: "ReleaseSummarizer", runner: "opencode", workspace: "RELEASE_WORKSPACE" }
]);

async function EvaluateSeverity(findings: number, maxAllowed: number) {
  const exceedsLimit = findings > maxAllowed;
  if (exceedsLimit) {
    return "critical";
  }
  const hasAny = findings !== 0;
  if (hasAny) {
    return "warning";
  }
  return "clean";
}

export async function RunReleaseGate(targetBranch: string, skipAudit: boolean) {
  if (skipAudit === true) {
    return "bypassed";
  }
  const audit = await sam.use("SecurityAuditor", targetBranch, SecurityAuditSchema);
  if (!audit.ok) {
    const rawFallback = await sam.useUnsafe("ReleaseSummarizer", targetBranch);
    if (!rawFallback.ok) {
      return "pipeline_error";
    }
    return rawFallback.value;
  }
  const isRisky = audit.value.has_vulnerabilities;
  if (isRisky) {
    if (audit.value.risk_level === "critical") {
      return "blocked_critical";
    } else {
      const underThreshold = audit.value.findings_count < 5;
      if (underThreshold) {
        return "approved_with_warnings";
      }
      return "blocked_too_many_findings";
    }
  }
  const releaseNote = await sam.use("ReleaseSummarizer", targetBranch, ReleaseDecisionSchema);
  if (releaseNote.ok) {
    return releaseNote.value.summary;
  }
  return "approved_clean";
}