import { z } from "zod";
import { createRuntime } from "@sam-lang/runtime";

export const CodeReviewSchema = z.object({
  approved: z.boolean(),
  risk_level: z.string(),
  summary: z.string(),
});

export type CodeReview = z.infer<typeof CodeReviewSchema>;

const sam = createRuntime([
  { name: "Reviewer", runner: "opencode", workspace: ".", systemPrompt: "You are a concise code reviewer. Analyze the input and respond strictly with the requested JSON.", timeout: 60000 }
]);

export async function ReviewSnippet(codeSnippet: string) {
  const result = await sam.use("Reviewer", codeSnippet, CodeReviewSchema);
  if (!result.ok) {
    return result;
  }
  return result.value;
}