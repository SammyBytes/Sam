import type {
  ExpressionNode,
  FlowNode,
  ForStatementNode,
  StatementNode,
  TypeAnnotation,
} from "../../../parser/ast";

const MAPPING_BINARY_OPERATOR: Record<string, string> = {
  "==": "===",
  "!=": "!==",
  "<": "<",
  ">": ">",
};

function emitTsType(type: TypeAnnotation): string {
  if (type.kind === "ArrayType") {
    return `${emitTsType(type.elementType)}[]`;
  }

  return type.name;
}

function escapeTemplateChunk(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${");
}

export function generateFlow(
  flowNode: FlowNode,
  flowNames: Set<string> = new Set(),
): string {
  const functionName = flowNode.name;
  const functionIsPrivate = flowNode.isPrivate;

  const functionParams = flowNode.params
    .map((param) => {
      const paramType = param.type ? `: ${emitTsType(param.type)}` : "";
      return `${param.name}${paramType}`;
    })
    .join(", ");

  const functionBody =
    flowNode.body.length === 0
      ? ""
      : flowNode.body
          .map((statement) => generateStatement(statement, 1, flowNames))
          .join("\n");

  return `${!functionIsPrivate ? "export " : ""}async function ${functionName}(${functionParams}) {\n${functionBody}\n}`;
}

function generateStatement(
  statement: StatementNode,
  indentLevel: number = 1,
  flowNames: Set<string> = new Set(),
  isInForExpression: boolean = false,
): string {
  const indent = "  ".repeat(indentLevel);

  switch (statement.type) {
    case "LetStatement": {
      const varName = statement.name;
      if (statement.value.type === "ForStatement") {
        return generateForExpressionLet(
          String(varName),
          statement.value,
          indentLevel,
          flowNames,
          isInForExpression,
        );
      }

      const varValue = generateExpression(statement.value, flowNames);
      return `${indent}const ${varName} = ${varValue};`;
    }
    case "ExpressionStatement": {
      const exprValue = generateExpression(statement.expression, flowNames);
      return `${indent}${exprValue};`;
    }
    case "ReturnStatement": {
      const returnValue = statement.value
        ? generateExpression(statement.value, flowNames)
        : "";
      if (isInForExpression) {
        const retVal = returnValue || "undefined";
        return `${indent}return { __samReturn: true, value: ${retVal} };`;
      }
      const isEarlyReturn = returnValue ? `return ${returnValue};` : "return;";
      return `${indent}${isEarlyReturn}`;
    }
    case "YieldStatement": {
      const yieldValue = generateExpression(statement.value, flowNames);
      return `${indent}_acc.push(${yieldValue});`;
    }
    case "IfStatement": {
      const condition = generateExpression(statement.condition, flowNames);
      const thenBlock = statement.thenBranch
        .map((stmt) =>
          generateStatement(
            stmt,
            indentLevel + 1,
            flowNames,
            isInForExpression,
          ),
        )
        .join("\n");

      const elseBlock = statement.elseBranch
        ? statement.elseBranch
            .map((stmt) =>
              generateStatement(
                stmt,
                indentLevel + 1,
                flowNames,
                isInForExpression,
              ),
            )
            .join("\n")
        : null;

      let ifStatementCode = `${indent}if (${condition}) {\n${thenBlock}\n${indent}}`;
      if (elseBlock) {
        ifStatementCode += ` else {\n${elseBlock}\n${indent}}`;
      }
      return ifStatementCode;
    }
    case "ForStatement": {
      return generateForStatement(
        statement,
        indentLevel,
        flowNames,
        isInForExpression,
      );
    }
    case "BreakStatement":
      return generateBreakStatement(statement, indentLevel);
    case "ContinueStatement":
      return generateContinueStatement(statement, indentLevel);
    default:
      throw new Error(`Unsupported statement type: ${statement}`);
  }
}

function generateExpression(
  expression: ExpressionNode,
  flowNames: Set<string> = new Set(),
): string {
  switch (expression.type) {
    case "Literal":
      return JSON.stringify(expression.value);
    case "Identifier":
      return expression.name;
    case "TemplateLiteral": {
      let result = "`";
      expression.quasis.forEach((quasi, index) => {
        result += escapeTemplateChunk(quasi.value);
        const interpolated = expression.expressions[index];
        if (interpolated !== undefined) {
          const exprCode = generateExpression(interpolated, flowNames);
          result += `\${typeof (${exprCode}) === "object" && (${exprCode}) !== null ? JSON.stringify(${exprCode}) : (${exprCode})}`;
        }
      });
      return `${result}\``;
    }
    case "MemberExpression": {
      const object = generateExpression(expression.object, flowNames);
      return `${object}.${expression.property}`;
    }
    case "BinaryExpression": {
      const left = generateExpression(expression.left, flowNames);
      const right = generateExpression(expression.right, flowNames);
      const operator =
        MAPPING_BINARY_OPERATOR[expression.operator] || expression.operator;
      return `${left} ${operator} ${right}`;
    }
    case "UnaryExpression": {
      const argument = generateExpression(expression.argument, flowNames);
      return `${expression.operator}${argument}`;
    }
    case "UseExpression": {
      const inputPrompt = generateExpression(expression.inputPrompt, flowNames);
      const name = JSON.stringify(expression.agentName);
      const isSafe = expression.variant === "safe";
      if (!isSafe) {
        return `await sam.useUnsafe(${name}, ${inputPrompt})`;
      }
      const schema = `${expression.schema}Schema`;
      return `await sam.use(${name}, ${inputPrompt}, ${schema})`;
    }
    case "CallExpression": {
      const callee = generateExpression(expression.callee, flowNames);

      return generateFlowFunctionCall(callee, expression.arguments, flowNames);
    }

    case "ArrayExpression": {
      const elements = expression.elements
        .map((el) => generateExpression(el, flowNames))
        .join(", ");
      return `[${elements}]`;
    }
    default:
      throw new Error(`Unsupported expression type: ${expression}`);
  }
}

function generateForExpressionLet(
  varName: string,
  forNode: Extract<StatementNode, { type: "ForStatement" }>,
  indentLevel: number,
  flowNames: Set<string>,
  isInForExpression: boolean = false,
): string {
  const indent = "  ".repeat(indentLevel);
  const loopVar = `_loop_${varName}`;
  const iterable = generateExpression(forNode.iterable, flowNames);
  const body = forNode.body
    .map((stmt) => generateStatement(stmt, indentLevel + 2, flowNames, true))
    .join("\n");
  // When this for-expression is nested inside another one, an early return
  // must keep the __samReturn envelope so the enclosing loop can propagate it.
  const earlyReturn = isInForExpression
    ? `return { __samReturn: true as const, value: ${loopVar}.value };`
    : `return ${loopVar}.value;`;

  return [
    `${indent}const ${loopVar} = await (async () => {`,
    `${indent}  const _acc: any[] = [];`,
    `${indent}  for (const ${forNode.iterator} of ${iterable}) {`,
    body,
    `${indent}  }`,
    `${indent}  return { __samReturn: false as const, value: _acc };`,
    `${indent}})();`,
    `${indent}if (${loopVar}.__samReturn) ${earlyReturn}`,
    `${indent}const ${varName} = ${loopVar}.value;`,
  ].join("\n");
}
function generateForStatement(
  statement: StatementNode,
  indentLevel: number,
  flowNames: Set<string>,
  isInForExpression: boolean = false,
): string {
  if (statement.type !== "ForStatement") {
    throw new Error("Expected a ForStatement node");
  }

  const indent = "  ".repeat(indentLevel);
  const iterator = statement.iterator;
  const iterable = generateExpression(statement.iterable, flowNames);
  const body = statement.body
    .map((stmt) =>
      generateStatement(stmt, indentLevel + 1, flowNames, isInForExpression),
    )
    .join("\n");

  return `${indent}for (const ${iterator} of ${iterable}) {\n${body}\n${indent}}`;
}

function generateBreakStatement(
  statement: StatementNode,
  indentLevel: number,
): string {
  if (statement.type !== "BreakStatement") {
    throw new Error("Expected a BreakStatement node");
  }

  const indent = "  ".repeat(indentLevel);
  return `${indent}break;`;
}

function generateContinueStatement(
  statement: StatementNode,
  indentLevel: number,
): string {
  if (statement.type !== "ContinueStatement") {
    throw new Error("Expected a ContinueStatement node");
  }

  const indent = "  ".repeat(indentLevel);
  return `${indent}continue;`;
}

function generateFlowFunctionCall(
  flowName: string,
  args: ExpressionNode[],
  flowNames: Set<string> = new Set(),
): string {
  const argsCode = args
    .map((arg) => generateExpression(arg, flowNames))
    .join(", ");

  const isFlowCall = flowNames.has(flowName);
  return isFlowCall
    ? `(await ${flowName}(${argsCode}))`
    : `${flowName}(${argsCode})`;
}
