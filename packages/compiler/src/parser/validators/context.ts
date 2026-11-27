export interface LoopContext {
  isExpression: boolean; // true if the loop is a `for` expression, false if it's a `for` statement
  hasYield: boolean; // true if a `yield` statement has been encountered within this loop
}

export interface ValidationContext {
  flowName: string;
  declaredSymbols: Map<string, string>;
  loopStack: LoopContext[]; // Stack to track nested loops and their contexts (support for deeply nested loops)
}
