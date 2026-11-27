import type {
  AgentNode,
  ExpressionNode,
  FlowNode,
  ForStatementNode,
  ProgramNode,
  SchemaNode,
  StatementNode,
  TypeAnnotation,
} from "../ast";
import type { LoopContext, ValidationContext } from "./context";

const PRIMITIVE_TYPES = new Set(["string", "number", "boolean"]);

function validateTypeAnnotation(
  type: TypeAnnotation,
  schemas: Set<string>,
  contextLabel: string,
): void {
  if (type.kind === "ArrayType") {
    validateTypeAnnotation(type.elementType, schemas, contextLabel);
    return;
  }

  if (!PRIMITIVE_TYPES.has(type.name) && !schemas.has(type.name)) {
    throw new Error(
      `SemanticError: ${contextLabel} uses an undeclared type '${type.name}'.`,
    );
  }
}
function validateForLoop(
  loopNode: ForStatementNode,
  isExpression: boolean,
  ctx: ValidationContext,
): void {
  if (ctx.declaredSymbols.has(loopNode.iterator)) {
    throw new Error(
      `SemanticError: Loop iterator '${loopNode.iterator}' in flow '${ctx.flowName}' conflicts with a reserved or declared identifier.`,
    );
  }

  validateExpression(loopNode.iterable, ctx);

  if (loopNode.parallel) {
    validateExpression(loopNode.parallel, ctx);
    if (loopNode.parallel.type === "Literal") {
      const val = loopNode.parallel.value;
      if (typeof val !== "number" || !Number.isInteger(val) || val <= 0) {
        throw new Error(
          `SemanticError: 'parallel' concurrency limit in flow '${ctx.flowName}' must be a positive integer.`,
        );
      }
    }
  }

  const loopSymbols = new Map(ctx.declaredSymbols);
  loopSymbols.set(loopNode.iterator, "LoopIterator");

  const loopContext: LoopContext = {
    isExpression,
    hasYield: false,
    parallel: loopNode.parallel,
    ordered: loopNode.ordered,
  };

  validateStatements(loopNode.body, {
    flowName: ctx.flowName,
    declaredSymbols: loopSymbols,
    loopStack: [...ctx.loopStack, loopContext],
  });

  if (loopContext.ordered !== undefined && loopContext.parallel === undefined) {
    throw new Error(
      `SemanticError: 'for' loop in flow '${ctx.flowName}' has 'ordered' option without 'parallel' option.`,
    );
  }

  if (isExpression && !loopContext.hasYield) {
    throw new Error(
      `SemanticError: 'for' expression in flow '${ctx.flowName}' must contain at least one 'yield' statement.`,
    );
  }
}

function validateStatements(
  statements: StatementNode[],
  ctx: ValidationContext,
): void {
  for (const stmt of statements) {
    switch (stmt.type) {
      case "LetStatement": {
        validateExpression(stmt.value, ctx);
        if (typeof stmt.name === "string") {
          ctx.declaredSymbols.set(stmt.name, "Variable");
        } else {
          for (const name of stmt.name) {
            ctx.declaredSymbols.set(name, "Variable");
          }
        }
        break;
      }
      case "ExpressionStatement":
        validateExpression(stmt.expression, ctx);
        break;
      case "ReturnStatement":
        if (stmt.value) validateExpression(stmt.value, ctx);
        break;
      case "ForStatement":
        validateForLoop(stmt, false, ctx);
        break;

      case "YieldStatement": {
        const currentLoop = ctx.loopStack[ctx.loopStack.length - 1];
        if (!currentLoop || !currentLoop.isExpression) {
          throw new Error(
            `SemanticError: 'yield' in flow '${ctx.flowName}' can only be used inside a 'for' expression (e.g. 'let x = for ...').`,
          );
        }
        currentLoop.hasYield = true;
        currentLoop.yieldCount = (currentLoop.yieldCount || 0) + 1;

        if (currentLoop.yieldCount > 1) {
          throw new Error(
            `SemanticError: 'for' expression in flow '${ctx.flowName}' can only contain one 'yield' statement.`,
          );
        }

        validateExpression(stmt.value, ctx);
        break;
      }

      case "BreakStatement":
        if (ctx.loopStack.length === 0) {
          throw new Error(
            `SemanticError: 'break' in flow '${ctx.flowName}' can only be used inside a 'for' loop.`,
          );
        }
        const currentLoop = ctx.loopStack[ctx.loopStack.length - 1];
        if (currentLoop?.parallel !== undefined) {
          throw new Error(
            `SemanticError: 'break' is not allowed inside a parallel 'for' loop in flow '${ctx.flowName}'.`,
          );
        }
        break;
      case "ContinueStatement":
        if (ctx.loopStack.length === 0) {
          throw new Error(
            `SemanticError: 'continue' in flow '${ctx.flowName}' can only be used inside a 'for' loop.`,
          );
        }
        break;
      case "IfStatement":
        validateExpression(stmt.condition, ctx);
        validateStatements(stmt.thenBranch, {
          flowName: ctx.flowName,
          declaredSymbols: ctx.declaredSymbols,
          loopStack: ctx.loopStack,
        });
        if (stmt.elseBranch) {
          validateStatements(stmt.elseBranch, {
            flowName: ctx.flowName,
            declaredSymbols: ctx.declaredSymbols,
            loopStack: ctx.loopStack,
          });
        }
        break;
    }
  }
}

function validateExpression(
  expr: ExpressionNode,
  ctx: ValidationContext,
): void {
  switch (expr.type) {
    case "CallExpression": {
      if (expr.callee.type === "Identifier" && expr.callee.name === "chunk") {
        if (expr.arguments.length !== 2) {
          throw new Error(
            `SemanticError: Builtin 'chunk' in flow '${ctx.flowName}' expects 2 arguments (text, maxChars), got ${expr.arguments.length}.`,
          );
        }
        const maxCharsArg = expr.arguments[1];
        if (maxCharsArg?.type === "Literal") {
          if (
            typeof maxCharsArg.value !== "number" ||
            !Number.isInteger(maxCharsArg.value) ||
            maxCharsArg.value <= 0
          ) {
            throw new Error(
              `SemanticError: Builtin 'chunk' in flow '${ctx.flowName}' expects a positive integer for 'maxChars'.`,
            );
          }
        }
      }
      validateExpression(expr.callee, ctx);
      for (const arg of expr.arguments) validateExpression(arg, ctx);
      break;
    }
    case "ArrayExpression":
      for (const el of expr.elements) validateExpression(el, ctx);
      break;

    case "BinaryExpression":
      validateExpression(expr.left, ctx);
      validateExpression(expr.right, ctx);
      break;
    case "UnaryExpression":
      validateExpression(expr.argument, ctx);
      break;
    case "MemberExpression":
      validateExpression(expr.object, ctx);
      break;
    case "TemplateLiteral":
      for (const sub of expr.expressions) validateExpression(sub, ctx);
      break;

    case "UseExpression":
      validateExpression(expr.inputPrompt, ctx);
      break;

    case "ForStatement":
      validateForLoop(expr, true, ctx);
      break;

    case "ParallelExpression":
      for (const sub of expr.expressions) validateExpression(sub, ctx);
      break;
  }
}

export function validateProgram(program: ProgramNode): void {
  const declaredSymbols = new Map<string, string>([["chunk", "Builtin"]]);

  const providers = new Set<string>();
  const usedProviders = new Set<string>();
  const agents: AgentNode[] = [];
  const flows: FlowNode[] = [];
  const schemasNames = new Set<string>();
  const schemas: SchemaNode[] = [];

  for (const node of program.body) {
    const kind = node.type.replace("Declaration", "");
    if (declaredSymbols.has(node.name)) {
      const existingKind = declaredSymbols.get(node.name);
      throw new Error(
        `SemanticError: Duplicate identifier '${node.name}'. Already declared as ${existingKind}.`,
      );
    }
    declaredSymbols.set(node.name, kind);

    if (node.type === "ProviderDeclaration") providers.add(node.name);
    if (node.type === "AgentDeclaration") agents.push(node);
    if (node.type === "FlowDeclaration") flows.push(node);
    if (node.type === "SchemaDeclaration") {
      schemasNames.add(node.name);
      schemas.push(node);
    }
  }

  for (const agent of agents) {
    const providerProp = agent.properties.find(
      (prop) => prop.name === "provider",
    );
    if (!providerProp) continue;

    const providerName = String(providerProp.value.value);
    if (!providers.has(providerName)) {
      throw new Error(
        `SemanticError: Agent '${agent.name}' references an undeclared provider '${providerName}'.`,
      );
    }
    usedProviders.add(providerName);
  }

  for (const schema of schemas) {
    for (const field of schema.fields) {
      validateTypeAnnotation(
        field.fieldType,
        schemasNames,
        `Schema '${schema.name}' field '${field.name}'`,
      );
    }
  }
  for (const flow of flows) {
    const flowSymbols = new Map(declaredSymbols);
    for (const param of flow.params) {
      validateTypeAnnotation(
        param.type,
        schemasNames,
        `Flow '${flow.name}' parameter '${param.name}'`,
      );
      flowSymbols.set(param.name, "Parameter");
    }
    validateStatements(flow.body, {
      flowName: flow.name,
      declaredSymbols: flowSymbols,
      loopStack: [],
    });
  }

  for (const provider of providers) {
    if (!usedProviders.has(provider)) {
      throw new Error(
        `SemanticError: Provider '${provider}' declared but not used by any agent.`,
      );
    }
  }
}
