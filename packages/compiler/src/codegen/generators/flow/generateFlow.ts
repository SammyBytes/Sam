import type { FlowNode } from "../../../parser/ast";

export function generateFlow(flowNode: FlowNode): string {
  const functionName = flowNode.name;
  const functionIsPrivate = flowNode.isPrivate;

  const functionParams = flowNode.params
    .map((param) => {
      const paramType = param.type ? `: ${param.type}` : "";
      return `${param.name}${paramType}`;
    })
    .join(", ");

  return `${!functionIsPrivate ? "export " : ""}async function ${functionName}(${functionParams}) {\n  // TODO: Implement flow logic\n}`;
}
