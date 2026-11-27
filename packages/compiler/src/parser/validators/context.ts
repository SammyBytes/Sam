import type { ExpressionNode } from "../ast";

export interface LoopContext {
  isExpression: boolean; // true if the loop is a `for` expression, false if it's a `for` statement
  hasYield: boolean; // true if a `yield` statement has been encountered within this loop
  parallel?: ExpressionNode; // Indicates if the for loop is parallel (true) or sequential (false)
  ordered?: boolean; // Indicates if the parallel execution should maintain order (true) or not (false)
  yieldCount?: number; // Count of `yield` statements encountered within this loop
}

export interface ValidationContext {
  flowName: string;
  declaredSymbols: Map<string, string>;
  loopStack: LoopContext[]; // Stack to track nested loops and their contexts (support for deeply nested loops)
}
