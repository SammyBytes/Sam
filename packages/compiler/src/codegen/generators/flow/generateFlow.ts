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
  workerSignalName?: string,
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
          workerSignalName,
        );
      }

      const varValue = generateExpression(
        statement.value,
        flowNames,
        workerSignalName,
      );
      return `${indent}const ${varName} = ${varValue};`;
    }
    case "ExpressionStatement": {
      const exprValue = generateExpression(
        statement.expression,
        flowNames,
        workerSignalName,
      );
      return `${indent}${exprValue};`;
    }
    case "ReturnStatement": {
      const returnValue = statement.value
        ? generateExpression(statement.value, flowNames, workerSignalName)
        : "";
      if (workerSignalName) {
        const retVal = returnValue || "undefined";
        return `${indent}return { kind: "return", value: ${retVal} };`;
      }
      if (isInForExpression) {
        const retVal = returnValue || "undefined";
        return `${indent}return { __samReturn: true, value: ${retVal} };`;
      }
      const isEarlyReturn = returnValue ? `return ${returnValue};` : "return;";
      return `${indent}${isEarlyReturn}`;
    }
    case "YieldStatement": {
      const yieldValue = generateExpression(
        statement.value,
        flowNames,
        workerSignalName,
      );
      if (workerSignalName) {
        return `${indent}return { kind: "yield", value: ${yieldValue} };`;
      }
      return `${indent}_acc.push(${yieldValue});`;
    }
    case "IfStatement": {
      const condition = generateExpression(
        statement.condition,
        flowNames,
        workerSignalName,
      );
      const thenBlock = statement.thenBranch
        .map((stmt) =>
          generateStatement(
            stmt,
            indentLevel + 1,
            flowNames,
            isInForExpression,
            workerSignalName,
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
                workerSignalName,
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
        workerSignalName,
      );
    }
    case "BreakStatement":
      return generateBreakStatement(statement, indentLevel);
    case "ContinueStatement":
      return generateContinueStatement(statement, indentLevel, workerSignalName);
    default:
      throw new Error(`Unsupported statement type: ${statement}`);
  }
}

function generateExpression(
  expression: ExpressionNode,
  flowNames: Set<string> = new Set(),
  workerSignalName?: string,
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
          const exprCode = generateExpression(
            interpolated,
            flowNames,
            workerSignalName,
          );
          result += `\${typeof (${exprCode}) === "object" && (${exprCode}) !== null ? JSON.stringify(${exprCode}) : (${exprCode})}`;
        }
      });
      return `${result}\``;
    }
    case "MemberExpression": {
      const object = generateExpression(
        expression.object,
        flowNames,
        workerSignalName,
      );
      return `${object}.${expression.property}`;
    }
    case "BinaryExpression": {
      const left = generateExpression(
        expression.left,
        flowNames,
        workerSignalName,
      );
      const right = generateExpression(
        expression.right,
        flowNames,
        workerSignalName,
      );
      const operator =
        MAPPING_BINARY_OPERATOR[expression.operator] || expression.operator;
      return `${left} ${operator} ${right}`;
    }
    case "UnaryExpression": {
      const argument = generateExpression(
        expression.argument,
        flowNames,
        workerSignalName,
      );
      return `${expression.operator}${argument}`;
    }
    case "UseExpression": {
      const inputPrompt = generateExpression(
        expression.inputPrompt,
        flowNames,
        workerSignalName,
      );
      const name = JSON.stringify(expression.agentName);
      const isSafe = expression.variant === "safe";
      const optionsArg = workerSignalName ? `, { signal: ${workerSignalName} }` : "";
      if (!isSafe) {
        return `await sam.useUnsafe(${name}, ${inputPrompt}${optionsArg})`;
      }
      const schema = `${expression.schema}Schema`;
      return `await sam.use(${name}, ${inputPrompt}, ${schema}${optionsArg})`;
    }
    case "CallExpression": {
      const callee = generateExpression(
        expression.callee,
        flowNames,
        workerSignalName,
      );

      return generateFlowFunctionCall(
        callee,
        expression.arguments,
        flowNames,
        workerSignalName,
      );
    }

    case "ArrayExpression": {
      const elements = expression.elements
        .map((el) => generateExpression(el, flowNames, workerSignalName))
        .join(", ");
      return `[${elements}]`;
    }
    default:
      throw new Error(`Unsupported expression type: ${expression}`);
  }
}

function generateForExpressionLet(
  varName: string,
  forNode: ForStatementNode,
  indentLevel: number,
  flowNames: Set<string>,
  isInForExpression: boolean = false,
  workerSignalName?: string,
): string {
  const indent = "  ".repeat(indentLevel);
  const iterable = generateExpression(
    forNode.iterable,
    flowNames,
    workerSignalName,
  );

  if (forNode.parallel !== undefined) {
    const parallel = generateExpression(
      forNode.parallel,
      flowNames,
      workerSignalName,
    );
    const ordered = (forNode.ordered ?? true) ? "true" : "false";
    const signalProp = workerSignalName
      ? `, signal: ${workerSignalName}`
      : "";
    const workerBody = forNode.body
      .map((stmt) =>
        generateStatement(stmt, indentLevel + 1, flowNames, true, "signal"),
      )
      .join("\n");
    const earlyReturn = workerSignalName
      ? `return { kind: "return", value: _res_${varName}.value };`
      : isInForExpression
        ? `return { __samReturn: true as const, value: _res_${varName}.value };`
        : `return _res_${varName}.value;`;

    return [
      `${indent}const _res_${varName} = await sam.mapParallel(${iterable}, { parallel: ${parallel}, ordered: ${ordered}${signalProp} }, async (${forNode.iterator}, signal) => {`,
      workerBody,
      `${indent}  return { kind: "continue" };`,
      `${indent}});`,
      `${indent}if (_res_${varName}.kind === "return") ${earlyReturn}`,
      `${indent}const ${varName} = _res_${varName}.values;`,
    ].join("\n");
  }

  const loopVar = `_loop_${varName}`;
  const body = forNode.body
    .map((stmt) =>
      generateStatement(
        stmt,
        indentLevel + 2,
        flowNames,
        true,
        workerSignalName,
      ),
    )
    .join("\n");
  const earlyReturn = workerSignalName
    ? `return { kind: "return", value: ${loopVar}.value };`
    : isInForExpression
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
  workerSignalName?: string,
): string {
  if (statement.type !== "ForStatement") {
    throw new Error("Expected a ForStatement node");
  }

  const indent = "  ".repeat(indentLevel);
  const iterator = statement.iterator;
  const iterable = generateExpression(
    statement.iterable,
    flowNames,
    workerSignalName,
  );

  if (statement.parallel === undefined) {
    const body = statement.body
      .map((stmt) =>
        generateStatement(
          stmt,
          indentLevel + 1,
          flowNames,
          isInForExpression,
          workerSignalName,
        ),
      )
      .join("\n");

    return `${indent}for (const ${iterator} of ${iterable}) {\n${body}\n${indent}}`;
  }

  const parallel = generateExpression(
    statement.parallel,
    flowNames,
    workerSignalName,
  );
  const ordered = (statement.ordered ?? true) ? "true" : "false";
  const signalProp = workerSignalName ? `, signal: ${workerSignalName}` : "";
  const workerBody = statement.body
    .map((stmt) =>
      generateStatement(stmt, indentLevel + 1, flowNames, isInForExpression, "signal"),
    )
    .join("\n");

  const earlyReturn = workerSignalName
    ? `${indent}  return { kind: "return", value: _res.value };`
    : isInForExpression
      ? `${indent}  return { __samReturn: true as const, value: _res.value };`
      : `${indent}  return _res.value;`;

  return [
    `${indent}const _res = await sam.mapParallel(${iterable}, { parallel: ${parallel}, ordered: ${ordered}${signalProp} }, async (${iterator}, signal) => {`,
    workerBody,
    `${indent}  return { kind: "continue" };`,
    `${indent}});`,
    `${indent}if (_res.kind === "return") {`,
    earlyReturn,
    `${indent}}`,
  ].join("\n");
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
  workerSignalName?: string,
): string {
  if (statement.type !== "ContinueStatement") {
    throw new Error("Expected a ContinueStatement node");
  }

  const indent = "  ".repeat(indentLevel);
  if (workerSignalName) {
    return `${indent}return { kind: "continue" };`;
  }
  return `${indent}continue;`;
}

function generateFlowFunctionCall(
  flowName: string,
  args: ExpressionNode[],
  flowNames: Set<string> = new Set(),
  workerSignalName?: string,
): string {
  const argsCode = args
    .map((arg) => generateExpression(arg, flowNames, workerSignalName))
    .join(", ");

  const isFlowCall = flowNames.has(flowName);
  return isFlowCall
    ? `(await ${flowName}(${argsCode}))`
    : `${flowName}(${argsCode})`;
}