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

export function generateFlow(flowNode: FlowNode): string {
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
          .map((statement) => generateStatement(statement, 1))
          .join("\n");

  return `${!functionIsPrivate ? "export " : ""}async function ${functionName}(${functionParams}) {\n${functionBody}\n}`;
}

function generateStatement(
  statement: StatementNode,
  indentLevel: number = 1,
): string {
  const indent = "  ".repeat(indentLevel);

  switch (statement.type) {
    case "LetStatement":
      const varName = statement.name;
      const varValue = generateExpression(statement.value);
      return `${indent}const ${varName} = ${varValue};`;
    case "ReturnStatement":
      const returnValue = statement.value
        ? generateExpression(statement.value)
        : "";
      const isEarlyReturn = returnValue ? `return ${returnValue};` : "return;";
      return `${indent}${isEarlyReturn}`;
    case "ExpressionStatement":
      const exprValue = generateExpression(statement.expression);
      return `${indent}${exprValue};`;

    case "IfStatement":
      const condition = generateExpression(statement.condition);
      const thenBlock = statement.thenBranch
        .map((stmt) => generateStatement(stmt, indentLevel + 1))
        .join("\n");

      const elseBlock = statement.elseBranch
        ? statement.elseBranch
            .map((stmt) => generateStatement(stmt, indentLevel + 1))
            .join("\n")
        : null;

      let ifStatementCode = `${indent}if (${condition}) {\n${thenBlock}\n${indent}}`;
      if (elseBlock) {
        ifStatementCode += ` else {\n${elseBlock}\n${indent}}`;
      }
      return ifStatementCode;
    default:
      throw new Error(`Unsupported statement type: ${statement}`);
  }
}

function generateExpression(expression: ExpressionNode): string {
  switch (expression.type) {
    case "Literal":
      return JSON.stringify(expression.value);
    case "Identifier":
      return expression.name;
    case "MemberExpression":
      const object = generateExpression(expression.object);
      return `${object}.${expression.property}`;
    case "BinaryExpression":
      const left = generateExpression(expression.left);
      const right = generateExpression(expression.right);
      const operator =
        MAPPING_BINARY_OPERATOR[expression.operator] || expression.operator;
      return `${left} ${operator} ${right}`;
    case "UnaryExpression":
      const argument = generateExpression(expression.argument);
      return `${expression.operator}${argument}`;
    case "UseExpression":
      const inputPrompt = generateExpression(expression.inputPrompt);
      const name = JSON.stringify(expression.agentName);
      const isSafe = expression.variant === "safe";
      if (!isSafe) {
        return `await sam.useUnsafe(${name}, ${inputPrompt})`;
      }
      const schema = `${expression.schema}Schema`;

      return `await sam.use(${name}, ${inputPrompt}, ${schema})`;
    case "CallExpression":
      const callee = generateExpression(expression.callee);
      const args = expression.arguments
        .map((arg) => generateExpression(arg))
        .join(", ");
      return `${callee}(${args})`;
    default:
      throw new Error(`Unsupported expression type: ${expression}`);
  }
}
