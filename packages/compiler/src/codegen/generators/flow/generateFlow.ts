import type {
  ExpressionNode,
  FlowNode,
  StatementNode,
} from "../../../parser/ast";

const MAPPING_BINARY_OPERATOR: Record<string, string> = {
  "==": "===",
  "!=": "!==",
  "<": "<",
  ">": ">",
};

export function generateFlow(
  flowNode: FlowNode,
  flowNames: Set<string> = new Set(),
): string {
  const functionName = flowNode.name;
  const functionIsPrivate = flowNode.isPrivate;

  const functionParams = flowNode.params
    .map((param) => {
      const paramType = param.type ? `: ${param.type}` : "";
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
): string {
  const indent = "  ".repeat(indentLevel);

  switch (statement.type) {
    case "LetStatement": {
      const varName = statement.name;
      const varValue = generateExpression(statement.value, flowNames);
      return `${indent}const ${varName} = ${varValue};`;
    }
    case "ReturnStatement": {
      const returnValue = statement.value
        ? generateExpression(statement.value, flowNames)
        : "";
      const isEarlyReturn = returnValue ? `return ${returnValue};` : "return;";
      return `${indent}${isEarlyReturn}`;
    }
    case "ExpressionStatement": {
      const exprValue = generateExpression(statement.expression, flowNames);
      return `${indent}${exprValue};`;
    }
    case "IfStatement": {
      const condition = generateExpression(statement.condition, flowNames);
      const thenBlock = statement.thenBranch
        .map((stmt) => generateStatement(stmt, indentLevel + 1, flowNames))
        .join("\n");

      const elseBlock = statement.elseBranch
        ? statement.elseBranch
            .map((stmt) => generateStatement(stmt, indentLevel + 1, flowNames))
            .join("\n")
        : null;

      let ifStatementCode = `${indent}if (${condition}) {\n${thenBlock}\n${indent}}`;
      if (elseBlock) {
        ifStatementCode += ` else {\n${elseBlock}\n${indent}}`;
      }
      return ifStatementCode;
    }
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
      const args = expression.arguments
        .map((arg) => generateExpression(arg, flowNames))
        .join(", ");
      const isFlowCall =
        expression.callee.type === "Identifier" &&
        flowNames.has(expression.callee.name);
      return isFlowCall ? `(await ${callee}(${args}))` : `${callee}(${args})`;
    }
    default:
      throw new Error(`Unsupported expression type: ${expression}`);
  }
}
