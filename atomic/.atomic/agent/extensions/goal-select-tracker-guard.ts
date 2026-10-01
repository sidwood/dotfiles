import type { ExtensionAPI } from "@bastani/atomic";
import { Type } from "typebox";

export const TRACKER_INTAKE_STAGES = ["goal-select-tracker-guard-check", "goal-select-tracker-intake", "goal-select-tracker-fetch"];
export const TRACKER_GUARD_TOOL = "goal_select_tracker_guard";
export const TRACKER_READ_TOOLS = ["getAccessibleAtlassianResources", "getJiraIssue", "searchJiraIssuesUsingJql", "get_workspace", "get_issue", "list_issues"];
export const TRACKER_GUARD_ENTRY = "goal-select-tracker-guard";

type GuardDecision = { allowed: true } | { allowed: false; reason: string };
type SessionContext = { sessionManager?: { getHeader?: () => { workflow?: { stageName?: string } } | null } };

const underscored = (name: string) => name.replace(/-/g, "_");

export function isTrackerReadTool(name: unknown): boolean {
  if (typeof name !== "string") return false;
  const tool = underscored(name);
  return TRACKER_READ_TOOLS.some((read) => tool === underscored(read) || tool.endsWith(`_${underscored(read)}`));
}

export function trackerGuardDecision(toolName: string, input: Record<string, unknown> | undefined, probed = true): GuardDecision {
  if (toolName === TRACKER_GUARD_TOOL || toolName === "structured_output") return { allowed: true };
  if (!probed) return { allowed: false, reason: `${TRACKER_GUARD_TOOL} must run before any other call` };
  if (toolName === "mcp") {
    if (input?.action !== undefined) return { allowed: false, reason: `mcp action "${String(input.action)}" is not a tracker read` };
    if (input?.tool === undefined) return { allowed: true };
    return isTrackerReadTool(input.tool) ? { allowed: true } : { allowed: false, reason: `MCP tool "${String(input.tool)}" is not an allow-listed tracker read tool` };
  }
  return isTrackerReadTool(toolName) ? { allowed: true } : { allowed: false, reason: `tool "${toolName}" is not an allow-listed tracker read tool` };
}

export function intakeStage(ctx: SessionContext): string | undefined {
  const stage = ctx.sessionManager?.getHeader?.()?.workflow?.stageName;
  return stage && TRACKER_INTAKE_STAGES.includes(stage) ? stage : undefined;
}

export default function goalSelectTrackerGuard(pi: ExtensionAPI) {
  let probed = false;
  pi.on("session_start", (_event, ctx) => {
    probed = false;
    const stage = intakeStage(ctx);
    if (!stage) return;
    pi.registerTool({
      name: TRACKER_GUARD_TOOL,
      label: "goal-select tracker guard",
      description: "Confirms that goal-select's read-only tracker guard is active in this session. Call it once, before any other tool.",
      parameters: Type.Object({}),
      async execute() {
        probed = true;
        return {
          content: [{ type: "text", text: `goal-select-tracker-guard is active in ${stage}: every tool call except allow-listed tracker reads is blocked before it runs.` }],
          details: { guard: "active", stage, read_tools: TRACKER_READ_TOOLS },
        };
      },
    });
    pi.appendEntry(TRACKER_GUARD_ENTRY, { event: "loaded", stage });
  });
  pi.on("tool_call", (event, ctx) => {
    if (!intakeStage(ctx)) return undefined;
    const decision = trackerGuardDecision(event.toolName, event.input as Record<string, unknown> | undefined, probed);
    pi.appendEntry(TRACKER_GUARD_ENTRY, { event: "decision", toolCallId: event.toolCallId, toolName: event.toolName, ...decision });
    return decision.allowed ? undefined : { block: true, reason: `goal-select tracker intake is read-only: ${decision.reason}.` };
  });
}
