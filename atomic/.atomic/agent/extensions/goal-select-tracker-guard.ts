import { createHash } from "node:crypto";
import type { ExtensionAPI } from "@bastani/atomic";
import { Type } from "typebox";

export const TRACKER_GUARD_CHECK_STAGE = "goal-select-tracker-guard-check";
export const TRACKER_INTAKE_STAGE = "goal-select-tracker-intake";
export const TRACKER_FETCH_STAGE = "goal-select-tracker-fetch";
export const TRACKER_INTAKE_STAGES = [TRACKER_GUARD_CHECK_STAGE, TRACKER_INTAKE_STAGE, TRACKER_FETCH_STAGE];
export const TRACKER_GUARD_TOOL = "goal_select_tracker_guard";
export const TRACKER_GUARD_ENTRY = "goal-select-tracker-guard";
export const TOOL_SEARCH_TOOL = "tool_search";
export const TRACKER_READS = {
  jira: { check: "getAccessibleAtlassianResources", fetch: "getJiraIssue", search: "searchJiraIssuesUsingJql" },
  linear: { check: "get_workspace", fetch: "get_issue", search: "list_issues" },
} as const;

type Tracker = keyof typeof TRACKER_READS;
export type TrackerScope = { tracker: Tracker; server: string };
type IntakeStage = { stage: string; scope?: TrackerScope };
type GuardDecision = { allowed: true } | { allowed: false; reason: string };
type SessionContext = { sessionManager?: { getHeader?: () => { workflow?: { stageName?: string } } | null } };

const SCOPE = /^(jira|linear)-([A-Za-z0-9_-]+)$/;
const MAX_TOOL_NAME_LENGTH = 64;

export function mcpToolName(server: string, tool: string): string {
  const name = `mcp__${server}__${tool}`.replace(/[^A-Za-z0-9_]/g, "_");
  if (name.length <= MAX_TOOL_NAME_LENGTH) return name;
  const hash = createHash("sha256").update(`${server}\0${tool}`).digest("hex").slice(0, 8);
  return `${name.slice(0, MAX_TOOL_NAME_LENGTH - hash.length - 1)}_${hash}`;
}

export function trackerReadTools(scope: TrackerScope): string[] {
  return Object.values(TRACKER_READS[scope.tracker]).map((tool) => mcpToolName(scope.server, tool));
}

export function trackerStageName(stage: string, scope: TrackerScope): string {
  return `${stage}-${scope.tracker}-${scope.server}`;
}

export function parseTrackerStage(name: unknown): IntakeStage | undefined {
  if (typeof name !== "string") return undefined;
  if (name === TRACKER_GUARD_CHECK_STAGE) return { stage: name };
  for (const stage of [TRACKER_INTAKE_STAGE, TRACKER_FETCH_STAGE]) {
    if (name === stage) return { stage };
    if (!name.startsWith(`${stage}-`)) continue;
    const match = SCOPE.exec(name.slice(stage.length + 1));
    return match ? { stage, scope: { tracker: match[1] as Tracker, server: match[2] } } : { stage };
  }
  return undefined;
}

export function trackerGuardDecision(toolName: string, scope: TrackerScope | undefined, probed = true): GuardDecision {
  if (toolName === TRACKER_GUARD_TOOL || toolName === "structured_output") return { allowed: true };
  if (!probed) return { allowed: false, reason: `${TRACKER_GUARD_TOOL} must run before any other call` };
  if (!scope) return { allowed: false, reason: "this stage has no tracker scope, so it may call no MCP tool" };
  if (toolName === TOOL_SEARCH_TOOL || trackerReadTools(scope).includes(toolName)) return { allowed: true };
  return { allowed: false, reason: `tool "${toolName}" is not an allow-listed ${scope.tracker} read tool of MCP server "${scope.server}"` };
}

export function intakeStage(ctx: SessionContext): IntakeStage | undefined {
  return parseTrackerStage(ctx.sessionManager?.getHeader?.()?.workflow?.stageName);
}

export default function goalSelectTrackerGuard(pi: ExtensionAPI) {
  let probed = false;
  pi.on("session_start", (_event, ctx) => {
    probed = false;
    const intake = intakeStage(ctx);
    if (!intake) return;
    const { stage, scope } = intake;
    const readTools = scope ? trackerReadTools(scope) : [];
    pi.registerTool({
      name: TRACKER_GUARD_TOOL,
      label: "goal-select tracker guard",
      description: "Confirms that goal-select's read-only tracker guard is active in this session. Call it once, before any other tool.",
      parameters: Type.Object({}),
      async execute() {
        probed = true;
        const allowed = scope ? `only ${readTools.join(", ")} and ${TOOL_SEARCH_TOOL} may run` : "no MCP tool may run";
        return {
          content: [{ type: "text", text: `goal-select-tracker-guard is active in ${stage}: ${allowed}; every other call is blocked before it runs.` }],
          details: { guard: "active", stage, ...(scope ? { tracker: scope.tracker, server: scope.server } : {}), read_tools: readTools },
        };
      },
    });
    pi.appendEntry(TRACKER_GUARD_ENTRY, { event: "loaded", stage, ...(scope ?? {}) });
  });
  pi.on("tool_call", (event, ctx) => {
    const intake = intakeStage(ctx);
    if (!intake) return undefined;
    const decision = trackerGuardDecision(event.toolName, intake.scope, probed);
    pi.appendEntry(TRACKER_GUARD_ENTRY, { event: "decision", toolCallId: event.toolCallId, toolName: event.toolName, ...decision });
    return decision.allowed ? undefined : { block: true, reason: `goal-select tracker intake is read-only: ${decision.reason}.` };
  });
  pi.on("tool_result", (event, ctx) => {
    const scope = intakeStage(ctx)?.scope;
    if (!scope || event.isError || event.structuredContent === undefined || !trackerReadTools(scope).includes(event.toolName)) return undefined;
    pi.appendEntry(TRACKER_GUARD_ENTRY, { event: "result", toolCallId: event.toolCallId, toolName: event.toolName, result: event.structuredContent });
    return undefined;
  });
}
