# Sam v0.7.0: Final Proposal - Immutable Collections & Bounded Concurrency

## 1. Overview

Add two major features to Sam v0.7.0:
1. **Immutable collections via `yield`** in `for` loops
2. **Bounded concurrency** with ordered/unordered result preservation

Maintain Sam's minimalist, declarative aesthetic.

## 2. Syntax

### For loop with concurrency modifier

```sam
// Ordered by default - preserves original iterable order
let summaries = for part in chunks with { parallel: 3 } {
  let res = use Summarizer<Summary>(part)
  if (!res.ok) { return res }
  yield res.value
}

// Unordered - results may complete in any order
let summaries = for part in chunks with { parallel: 3, ordered: false } {
  yield res.value
}

// Sequential (no with block - backward compatible)
let results = for item in data {
  yield transform(item)
}
```

### `yield` expression

```sam
// Collect values into immutable array
let results = for item in data {
  yield transform(item)
}

// Filter with continue
let results = for item in data {
  if (shouldSkip(item)) { continue }
  yield item
}

// Abort flow + cancel parallel tasks
let results = for item in data with { parallel: 4 } {
  let res = use Processor(item)
  if (!res.ok) { return res }
  yield res.value
}
```

### `parallel` heterogeneous fan-out (enhancement)

```sam
let { sec, perf } = parallel {
  sec: use Auditor<SecurityReport>(diff),
  perf: use Auditor<PerformanceReport>(diff)
}
```

## 3. AST Changes (`packages/compiler/src/parser/ast.ts`)

### `ForStatementNode` extended:

```typescript
export interface ForStatementNode {
  type: "ForStatement";
  iterator: string;
  iterable: ExpressionNode;
  parallel?: number;      // Optional concurrency limit (>0)
  ordered?: boolean;      // Optional order preservation (default: true)
  body: StatementNode[];
}
```

### Add `YieldExpression` to `ExpressionNode`:

```typescript
// Added to the ExpressionNode union type
| { type: "YieldExpression"; value: ExpressionNode; }
```

## 4. Parser Changes (`packages/compiler/src/parser/parsers/flow/parseStatement.ts`)

### Modified `parseForStatement`:

After parsing `FOR IDENTIFIER IN expression`, optionally parse `WITH LBRACE ... RBRACE` block containing `parallel: N` and `ordered: true/false` keys.

### New `parseYieldStatement`:

Recognize `YIELD` keyword and parse the following expression, returning a `YieldExpression` node.

## 5. Validator Changes (`packages/compiler/src/parser/validator.ts`)

### In `validateStatements`:

1. **`parallel` validation**: Must be positive integer if present
2. **`ordered` validation**: Must be boolean if present; cannot be `true` without `parallel`
3. **`break` enforcement**: 
   - Sequential `for`: allowed (stops loop, preserves collected items)
   - Parallel `for`: **semantic error** (throws error)
4. **`return` tracking**: Flag that return may cancel pending parallel tasks
5. **`continue`**: Already handled (filter behavior)

## 6. Codegen Changes (`packages/compiler/src/codegen/generators/flow/generateFlow.ts`)

### Modified `generateForStatement`:

Branch based on `statement.parallel`:

- **Sequential** (`parallel` undefined): Existing `for...of` generation
- **Parallel** (`parallel` set): Generate concurrent execution

### Parallel codegen pattern (simplified):

```typescript
// Generates an async IIFE with concurrent execution
`(async () => {
  const ${iterator} = new Array(${iterable}.length);
  const concurrency = ${statement.parallel};
  const ordered = ${statement.ordered ?? true};
  let completed = 0;
  let hasAborted = false;
  
  // Simple semaphore using counter
  const items = ${iterable};
  const body = `\\n${bodyStmts}`;
  
  await Promise.all(items.map(async (item, idx) => {
    if (hasAborted) return;
    
    // Execute loop body - yield will assign to results[idx]
    // continue will skip this iteration
    // return will set hasAborted = true and abort
    
    ${bodyStmts.replace(/yield/g, `results[idx] =`)};
  }));
  
  return ${iterator};
})()`;
```

**Key codegen transformation**: `yield <expr>` → `results[idx] = <expr>` (when `ordered: true`) or `results.push(<expr>)` (when `ordered: false`).

The codegen needs to track the index of each iteration and transform `yield` accordingly.

## 7. Runtime Changes (`packages/runtime/src/`)

**May not need changes** if codegen generates self-contained async JavaScript. However, consider:

1. **Template literal serialization**: Ensure that when `summaries` (an array) is interpolated in `` `Resumen: ${summaries}` ``, it's properly stringified.

   **Solution at codegen level**: When generating template literal code, auto-detect array expressions and stringify them, or generate code that uses `JSON.stringify()` for non-primitive interpolations.

2. **If runtime-level task cancellation is needed**: Add a simple `AbortController`-based cancellation mechanism to the runtime's concurrent execution primitives.

## 8. Template Literal Safe Interpolation

**Problem**: `` `Resumen: ${summaries}` `` where `summaries` is `Summary[]` produces `[object Object]`.

**Solution**: In the codegen's `generateExpression` for `TemplateLiteral`, auto-detect when an interpolated expression is an `ArrayExpression` and wrap it with `JSON.stringify()`:

```typescript
// In generateFlow.ts, TemplateLiteral case:
case "TemplateLiteral": {
  let result = "`";
  expression.quasis.forEach((quasi, index) => {
    result += escapeTemplateChunk(quasi.value);
    const interpolated = expression.expressions[index];
    if (interpolated !== undefined) {
      const generated = generateExpression(interpolated, flowNames);
      // If the generated code is an array, wrap with JSON.stringify
      if (generated.includes("Array") || generated.includes("[")) {
        result += `JSON.stringify(${generated})`;
      } else {
        result += `\${${generated}}`;
      }
    }
  });
  return `${result}\``;
}
```

Or more robustly, at the AST level, mark array/typed expressions that should be stringified during interpolation.

## 9. Implementation Priority

| Phase | Task | Effort |
|------|------|--------|
| 1 | AST: Add `parallel`, `ordered` fields to `ForStatementNode`; add `YieldExpression` | Low |
| 2 | Parser: Recognize `with { parallel: N, ordered: boolean }` and `yield <expr>` | Medium |
| 3 | Validator: Validate parallel/ordered, forbid `break` in parallel, track `return` | Medium |
| 4 | Codegen: Generate concurrent execution with ordered/unordered result collection | High |
| 5 | Codegen: Safe template literal interpolation for arrays | Medium |
| 6 | Runtime: Optional - add cancellation primitives if needed | Low |
| 7 | Tests: Comprehensive test suite for all new features | High |

## 10. Backward Compatibility

- Existing `for ... in ... { }` loops work without the `with` block (sequential, ordered by default)
- `parallel { ... }` heterogeneous fan-out already works
- `let x = expr` compiles to `const x = ...` (no change)
- All existing tests should pass without modification

## 11. Open Questions & Decisions

1. **`with` as keyword**: Need to add `WITH` token type or recognize in for-context only
2. **`yield` as statement vs expression**: Chosen as statement (has effect of adding to results)
3. **Index tracking for ordered results**: Codegen must track original index of each iteration
4. **`return` cancellation in parallel**: At codegen level (generated JS uses AbortController or cancellation flags)
5. **`break` in parallel**: Explicitly forbidden with clear error message