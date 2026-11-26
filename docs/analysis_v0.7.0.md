# Sam v0.7.0: Immutable Collections & Bounded Concurrency - Analysis & Proposal

## Current Implementation Analysis

### 1. `ForStatement` (AST - `packages/compiler/src/parser/ast.ts:163-168`)
```typescript
export interface ForStatementNode {
  type: "ForStatement";
  iterator: string;       // e.g., "item"
  iterable: ExpressionNode; // e.g., an array or collection
  body: StatementNode[];  // Array of statements in the loop body
}
```
- Currently compiles to `for (const iterator of iterable) { body }` in JavaScript
- Parser (`parseStatement.ts:34-51`) expects `FOR IDENTIFIER IN expression { body }`
- Codegen (`generateFlow.ts:170-187`) generates standard `for...of` loop
- Validator (`validator.ts:47-56`) checks iterator doesn't conflict with declared symbols, validates iterable expression

### 2. `ParallelExpression` (AST - `packages/compiler/src/parser/ast.ts:113-116`)
```typescript
| {
    type: "ParallelExpression";
    expressions: UseExpressionNode[];
} // e.g., parallel(use Agent1<TSchema>("input1"), use Agent2<TSchema>("input2"));
```
- Currently used for static fan-out of heterogeneous agents
- Codegen supports it as a call-style expression
- Runtime executes agents in parallel (no ordering guarantee)

### 3. `LetStatement` (AST - `packages/compiler/src/parser/ast.ts:65-66`)
```typescript
| { type: "LetStatement"; name: string | string[]; value: ExpressionNode } // e.g., let x = 5;
```
- Compiles to `const x = ...` in codegen (`generateFlow.ts:62-66`)
- No mutation exposed to user - `let` always becomes `const`

### 4. Flow Execution (Runtime - `packages/runtime/src/engine/agentAction.ts`)
- `use` agent call is async and returns `Result<T, AgentError>`
- No inherent parallel execution or concurrency limiting
- `return` in flow body aborts the entire flow

### 5. Control Flow in For Loops (Validator - `packages/compiler/src/parser/validator.ts:47-70`)
- `break`: Allowed if `loopDepth > 0`, throws error otherwise
- `continue`: Allowed if `loopDepth > 0`, throws error otherwise
- `return`: Aborts flow (no special for-loop handling)

### 6. Template Literal Interpolation (Codegen - `packages/compiler/src/codegen/generators/flow/generateFlow.ts:117-127`)
- Already supports `${expression}` interpolation
- But interpolating arrays/objects needs careful handling to avoid `[object Object]`

---

## Proposed v0.7.0 Design

### Feature 1: `yield` for Immutable Collection Building

**New AST Node**: `YieldExpression`
```typescript
// In ast.ts, add to ExpressionNode or as new type
| { type: "YieldExpression"; value: ExpressionNode; }
```

**Semantics**:
- `yield <expr>` emits `expr.value` into the enclosing `for` loop's result array
- `continue` acts as filter - skips iteration without yielding
- `return <expr>` aborts entire parent flow AND cancels pending parallel tasks
- `break` only valid in sequential `for` (stops loop, preserves collected items); error in parallel `for`

**Usage Pattern**:
```sam
let results = for part in chunks {
  let res = use Summarizer<Summary>(part)
  if (!res.ok) { return res }
  yield res.value
}
// results: Summary[] (const/let, immutable)
```

### Feature 2: Bounded Concurrency with Ordered Results

**Modifier Block**: `with { parallel: N, ordered: boolean }` in for header

```sam
// Ordered by default - preserves original iterable order
let summaries = for part in chunks with { parallel: 3 } {
  yield res.value
}

// Ordered: false - results may come in any order
let summaries = for part in chunks with { parallel: 3, ordered: false } {
  yield res.value
}
```

**Compilation Target** (simplified):
```javascript
// With ordered: true (default):
async function() {
  const results = new Array(chunks.length);
  let pending = 0;
  let completed = 0;
  
  for (let i = 0; i < chunks.length; i++) {
    pending++;
    setTimeout(async () => {
      const res = await use Summarizer(chunks[i]);
      results[i] = res.value; // Preserve index position
      completed++;
      if (completed === chunks.length) {
        // Return ordered results
      }
    }, 0);
  }
}

// With ordered: false:
async function() {
  const results = [];
  // Map concurrent executions, push results as they complete
}
```

### Feature 3: Heterogeneous Fan-out (`parallel { ... }`)

**Existing Pattern** (already works):
```sam
let { sec, perf } = parallel {
  sec: use Auditor<SecurityReport>(...),
  perf: use Auditor<PerformanceReport>(...)
}
```

**Enhancement**: Make `parallel` header work with destructuring in let statements. The `parallel` expression already supports this syntax through the existing `ParallelExpression` AST node.

### Feature 4: Safe Template Literal Interpolation

**Problem**: `` `Resumen: ${summaries}` `` where `summaries` is an array could produce `[object Object]`.

**Solution**: Auto-JSON-serialize non-primitive interpolated expressions in template literals.

**Codegen Change** (`generateFlow.ts:117-127`):
```typescript
case "TemplateLiteral": {
  let result = "`";
  expression.quasis.forEach((quasi, index) => {
    result += escapeTemplateChunk(quasi.value);
    const interpolated = expression.expressions[index];
    if (interpolated !== undefined) {
      // Auto-serialize arrays/objects for safe interpolation
      const generated = generateExpression(interpolated, flowNames);
      // Check if it's an array expression and stringify it
      result += `\${${generated}}`;
    }
  });
  return `${result}\``;
}
```

Actually, the better approach is to handle this at the runtime level when the template literal is evaluated, or ensure that array values are stringified before interpolation.

---

## Evaluation of `with { parallel: 3, ordered: false }` Modifier

### Proposal Syntax
```sam
let summaries = for part in chunks with { parallel: 3 } {
  let res = use Summarizer<Summary>(part)
  if (!res.ok) { return res }
  yield res.value
}
```

### Advantages
1. **Aesthetic Consistency**: The `with` keyword fits Sam's minimalist style - it's used elsewhere in the language (would need to check)
2. **Clear Separation**: Concurrency settings are separated from loop logic
3. **Discoverable**: `with { ... }` is a clear modifier block
4. **Backward Compatible**: Existing `for ... in ... { }` works without the modifier (defaults to sequential, ordered)

### Disadvantages / Alternatives Considered

1. **Alternative: `parallel N` keyword**
   ```sam
   let summaries = for part in chunks parallel 3 { ... }
   ```
   - More concise but harder to extend with options like `ordered`
   - Conflicts with potential future `parallel` keyword usage

2. **Alternative: Separate `parallel` block**
   ```sam
   let summaries = parallel for part in chunks { ... }
   ```
   - Doesn't fit Sam's expression/sentence syntax as well
   - Loses the `for ... in` natural reading order

3. **Chosen: `with { parallel: N, ordered: boolean }`**
   - Most flexible - allows future options ( `maxTime`, `rateLimit`, etc.)
   - Fits the `with` pattern if Sam uses it elsewhere
   - Explicit and discoverable
   - Can be parsed as a block modifier after the iterable expression

### Parsing Considerations

The parser would need to recognize:
```
FOR IDENTIFIER IN expression WITH LBRACE ... RBRACE block
```

Or alternatively:
```
FOR IDENTIFIER IN expression block_with_options
```

Looking at the current parser (`parseStatement.ts:34-51`), the `for` statement is parsed as:
```
FOR IDENTIFIER IN expression { body }
```

The `with { ... }` modifier would need to be parsed after the iterable expression but before the body block. This is feasible by modifying `parseForStatement` to optionally consume a `with` block.

---

## Implementation Roadmap

### Phase 1: AST Changes (`packages/compiler/src/parser/ast.ts`)
1. Add `parallel` and `ordered` optional fields to `ForStatementNode`
2. Add `YieldExpression` type to `ExpressionNode` 
3. Add type for `ForStatement` body that supports `yield`, `return`, `break`, `continue`

### Phase 2: Parser Changes (`packages/compiler/src/parser/parsers/flow/parseStatement.ts`)
1. Modify `parseForStatement` to optionally parse `with { parallel: N, ordered: boolean }` block
2. Add parsing for `yield <expr>` as an expression statement
3. Handle `return`/`break`/`continue` semantics based on `parallel`/`ordered` flags

### Phase 3: Validator Changes (`packages/compiler/src/parser/validator.ts`)
1. Validate `parallel` is a positive integer
2. Enforce `break` is error in parallel for-loops (with good error message)
3. Track `return` to cancel pending parallel tasks (runtime concern, but validate structure)
4. Validate `ordered` is boolean

### Phase 4: Codegen Changes (`packages/compiler/src/codegen/generators/flow/generateFlow.ts`)
1. Generate async IIFE with concurrent execution control
2. Implement ordered result preservation (fill-by-index strategy)
3. Handle `yield` compilation - collect results into array
4. Generate proper `return`/`break`/`continue` behavior

### Phase 5: Runtime Changes (`packages/runtime/src/`)
1. Add concurrent execution engine with semaphore-based concurrency limiting
2. Implement ordered vs unordered result collection
3. Add task cancellation on `return` from within parallel for
4. Ensure template literal interpolation safely handles arrays

### Phase 6: Testing
1. Test `let results = for ... with { parallel: 3 } { yield ... }` patterns
2. Test `ordered: false` produces unordered but faster results
3. Test `break`/`continue`/`return` in both sequential and parallel modes
4. Test template literal interpolation with array results
5. Test heterogeneous `parallel { ... }` destructuring

---

## Open Questions

1. **`with` keyword conflict**: Does Sam use `with` as a keyword elsewhere? Need to check.
2. **`yield` as statement vs expression**: Should `yield res.value` be a statement or expression? A statement makes more sense since it has an effect (adding to results).
3. **Empty vs default `with` block**: Should `for ... with { }` be valid (defaults to sequential, ordered)? Or require at least one option?
4. **How `return` cancels tasks**: At codegen level? Runtime level? Both?
5. **Array indexing for ordered results**: How to handle when iterable is not indexable (e.g., generator)?