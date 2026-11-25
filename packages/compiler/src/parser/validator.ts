import type {
  AgentNode,
  ExpressionNode,
  FlowNode,
  ProgramNode,
  SchemaNode,
  StatementNode,
  TypeAnnotation,
} from "./ast";

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

function validateStatements(
  statements: StatementNode[],
  flowName: string,
  declaredSymbols: Map<string, string>,
  loopDepth: number = 0,
): void {
  for (const stmt of statements) {
    switch (stmt.type) {
      case "LetStatement":
        validateExpression(stmt.value, flowName);
        break;
      case "ExpressionStatement":
        validateExpression(stmt.expression, flowName);
        break;
      case "ReturnStatement":
        if (stmt.value) validateExpression(stmt.value, flowName);
        break;
      case "ForStatement": {
        if (declaredSymbols.has(stmt.iterator)) {
          throw new Error(
            `SemanticError: Loop iterator '${stmt.iterator}' in flow '${flowName}' conflicts with a reserved or declared identifier.`,
          );
        }
        validateExpression(stmt.iterable, flowName);
        validateStatements(stmt.body, flowName, declaredSymbols, loopDepth + 1);
        break;
      }
      case "BreakStatement":
        if (loopDepth === 0) {
          throw new Error(
            `SemanticError: 'break' in flow '${flowName}' can only be used inside a 'for' loop.`,
          );
        }
        break;
      case "ContinueStatement":
        if (loopDepth === 0) {
          throw new Error(
            `SemanticError: 'continue' in flow '${flowName}' can only be used inside a 'for' loop.`,
          );
        }
        break;
      case "IfStatement":
        validateExpression(stmt.condition, flowName);
        validateStatements(
          stmt.thenBranch,
          flowName,
          declaredSymbols,
          loopDepth,
        );
        if (stmt.elseBranch) {
          validateStatements(
            stmt.elseBranch,
            flowName,
            declaredSymbols,
            loopDepth,
          );
        }
        break;
    }
  }
}

function validateExpression(expr: ExpressionNode, flowName: string): void {
  switch (expr.type) {
    case "CallExpression": {
      if (expr.callee.type === "Identifier" && expr.callee.name === "chunk") {
        if (expr.arguments.length !== 2) {
          throw new Error(
            `SemanticError: Builtin 'chunk' in flow '${flowName}' expects 2 arguments (text, maxChars), got ${expr.arguments.length}.`,
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
              `SemanticError: Builtin 'chunk' in flow '${flowName}' expects a positive integer for 'maxChars'.`,
            );
          }
        }
      }
      validateExpression(expr.callee, flowName);
      for (const arg of expr.arguments) validateExpression(arg, flowName);
      break;
    }
    case "ArrayExpression":
      for (const el of expr.elements) validateExpression(el, flowName);
      break;

    case "BinaryExpression":
      validateExpression(expr.left, flowName);
      validateExpression(expr.right, flowName);
      break;
    case "UnaryExpression":
      validateExpression(expr.argument, flowName);
      break;
    case "MemberExpression":
      validateExpression(expr.object, flowName);
      break;
    case "TemplateLiteral":
      for (const sub of expr.expressions) validateExpression(sub, flowName);
      break;

    case "UseExpression":
      validateExpression(expr.inputPrompt, flowName);
      break;
    case "ParallelExpression":
      for (const sub of expr.expressions) validateExpression(sub, flowName);
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
    for (const param of flow.params) {
      validateTypeAnnotation(
        param.type,
        schemasNames,
        `Flow '${flow.name}' parameter '${param.name}'`,
      );
    }
    validateStatements(flow.body, flow.name, declaredSymbols);
  }

  for (const provider of providers) {
    if (!usedProviders.has(provider)) {
      throw new Error(
        `SemanticError: Provider '${provider}' declared but not used by any agent.`,
      );
    }
  }
}
