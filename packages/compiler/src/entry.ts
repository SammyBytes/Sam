import type { FlowNode, ProgramNode } from "./parser/ast";

export function resolveEntryFlow(
  ast: ProgramNode,
  requestedFlow?: string
): FlowNode {
  const flows = ast.body.filter(
    (node): node is FlowNode => node.type === "FlowDeclaration"
  );
  const publicFlows = flows.filter((f) => !f.isPrivate);

  if (requestedFlow) {
    const match = flows.find((f) => f.name === requestedFlow);
    if (!match) {
      throw new Error(`Public flow '${requestedFlow}' not found.`);
    }
    if (match.isPrivate) {
      throw new Error(
        `Flow '${requestedFlow}' is private and cannot be invoked directly.`
      );
    }
    return match;
  }

  const mainFlow = publicFlows.find((f) => f.name === "main");
  if (mainFlow) {
    return mainFlow;
  }

  if (publicFlows.length === 1) {
    return publicFlows[0]!;
  }

  if (publicFlows.length === 0) {
    throw new Error("No executable public flow found.");
  }

  const names = publicFlows.map((f) => f.name).join(", ");
  throw new Error(
    `Ambiguous entry point: found multiple public flows (${names}). Define 'flow main()' or specify one with '--flow <name>'.`
  );
}

export function coerceCliArgs(
  flow: FlowNode,
  rawArgs: string[],
  stdinText?: string
): unknown[] {
  if (
    rawArgs.length === 0 &&
    flow.params.length === 1 &&
    flow.params[0]?.type === "string" &&
    stdinText !== undefined &&
    stdinText.length > 0
  ) {
    return [stdinText];
  }

  if (rawArgs.length !== flow.params.length) {
    throw new Error(
      `Flow '${flow.name}' expects ${flow.params.length} argument(s), got ${rawArgs.length}.`
    );
  }

  return flow.params.map((param, index) => {
    const raw = rawArgs[index]!;

    switch (param.type) {
      case "string":
        return raw;
      case "number": {
        const parsed = Number(raw);
        if (Number.isNaN(parsed)) {
          throw new Error(
            `Invalid number for parameter '${param.name}': "${raw}".`
          );
        }
        return parsed;
      }
      case "boolean": {
        const lower = raw.toLowerCase();
        if (lower === "true") return true;
        if (lower === "false") return false;
        throw new Error(
          `Invalid boolean for parameter '${param.name}': "${raw}" (expected 'true' or 'false').`
        );
      }
    }
  });
}