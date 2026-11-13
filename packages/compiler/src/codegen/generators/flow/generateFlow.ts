import type {
  ExpressionNode,
  FlowNode,
  StatementNode,
} from "../../../parser/ast";

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
  return "/* expr */";
}
