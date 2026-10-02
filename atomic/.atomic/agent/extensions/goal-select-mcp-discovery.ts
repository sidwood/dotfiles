import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type { ExtensionAPI } from "@bastani/atomic";

export const CODEMODE_TOOL = "codemode";
const CODEMODE_SOURCE = "builtin:codemode";
const RUNS = Symbol.for("dotfiles.goal-select.runs");
const SERVER_NAME = /^[A-Za-z0-9_-]+$/;
const EXPOSURES = ["codemode", "deferred", "direct", "hidden"];

type Env = Record<string, string | undefined>;
type ServerEntry = { name: string; config: Record<string, unknown>; source: string; scope: "global" | "project" };
export type NativeMcpConfig = { servers: ServerEntry[]; autoEnableCodemode?: boolean; errors: string[]; files: string[] };
type ToolInfo = { name: string; sourceInfo?: { path?: string } };
type SessionContext = {
  cwd: string;
  isProjectTrusted?: () => boolean;
  orchestrationContext?: { kind?: string; workflowRunId?: string };
  subagentPolicy?: { tools?: readonly string[]; mcpDirectTools?: readonly string[] };
};

function runs(): Set<string> {
  const store = globalThis as { [RUNS]?: Set<string> };
  store[RUNS] ??= new Set();
  return store[RUNS];
}

export function markGoalSelectRun(runId: string | undefined): void {
  if (runId) runs().add(runId);
}

export function isGoalSelectRun(runId: string | undefined): boolean {
  return runId !== undefined && runs().has(runId);
}

export function atomicAgentDir(env: Env = process.env, home = homedir()): string {
  const configured = env.ATOMIC_CODING_AGENT_DIR ?? env.PI_CODING_AGENT_DIR;
  if (!configured) return join(home, ".atomic", "agent");
  if (configured === "~") return home;
  return configured.startsWith("~/") ? join(home, configured.slice(2)) : resolve(configured);
}

export function mcpNamespace(server: string): string {
  return `mcp__${server.replace(/-/g, "_")}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exposure(value: unknown): unknown {
  return value === "codemode-deferred" ? "codemode" : value;
}

function entryError(name: string, raw: unknown): string | undefined {
  if (!SERVER_NAME.test(name)) return `invalid server name "${name}"`;
  if (!isRecord(raw)) return `server "${name}" must be an object`;
  if (raw.exposure !== undefined && !EXPOSURES.includes(exposure(raw.exposure) as string)) return `server "${name}": invalid exposure`;
  if (raw.enabled !== undefined && typeof raw.enabled !== "boolean") return `server "${name}": enabled must be a boolean`;
  if (typeof raw.url !== "string" && typeof raw.command !== "string") return `server "${name}" needs a command or url`;
  return undefined;
}

function readConfigFile(path: string, scope: ServerEntry["scope"], state: NativeMcpConfig, servers: Map<string, ServerEntry>) {
  if (!existsSync(path)) return;
  state.files.push(path);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    state.errors.push(`${path}: failed to read or parse MCP configuration`);
    return;
  }
  if (!isRecord(parsed) || (parsed.mcpServers !== undefined && !isRecord(parsed.mcpServers))) {
    state.errors.push(`${path}: expected an object with an "mcpServers" object`);
    return;
  }
  if (typeof parsed.autoEnableCodemode === "boolean") state.autoEnableCodemode = parsed.autoEnableCodemode;
  for (const [name, raw] of Object.entries(isRecord(parsed.mcpServers) ? parsed.mcpServers : {})) {
    const error = entryError(name, raw);
    if (error) {
      state.errors.push(`${path}: ${error}`);
      continue;
    }
    const clash = [...servers.keys()].find((other) => other !== name && mcpNamespace(other) === mcpNamespace(name));
    if (clash) {
      state.errors.push(`${path}: server "${name}" conflicts with "${clash}"`);
      continue;
    }
    const config = raw as Record<string, unknown>;
    if (scope === "project" && typeof config.url === "string" && config.auth) {
      state.errors.push(`${path}: server "${name}": auth is only allowed in the global mcp.json`);
      continue;
    }
    servers.set(name, { name, config: { ...config, exposure: exposure(config.exposure) }, source: path, scope });
  }
}

export function nativeMcpConfig({ agentDir, cwd, projectTrusted }: { agentDir: string; cwd: string; projectTrusted: boolean }): NativeMcpConfig {
  const state: NativeMcpConfig = { servers: [], errors: [], files: [] };
  const servers = new Map<string, ServerEntry>();
  readConfigFile(join(agentDir, "mcp.json"), "global", state, servers);
  if (projectTrusted) readConfigFile(join(cwd, ".atomic", "mcp.json"), "project", state, servers);
  state.servers = [...servers.values()];
  return state;
}

function usesCodemode(config: Record<string, unknown>): boolean {
  if (config.enabled === false) return false;
  const overrides = isRecord(config.toolExposure) ? Object.values(config.toolExposure).map(exposure) : [];
  return [config.exposure ?? "codemode", ...overrides].includes("codemode");
}

export function needsCodemode(ctx: SessionContext, tools: ToolInfo[], active: string[], config: NativeMcpConfig, contributions: { config: Record<string, unknown> }[]): boolean {
  if (ctx.orchestrationContext?.kind !== "workflow-stage" || !isGoalSelectRun(ctx.orchestrationContext.workflowRunId)) return false;
  if (ctx.subagentPolicy?.tools !== undefined || ctx.subagentPolicy?.mcpDirectTools !== undefined) return false;
  if (config.autoEnableCodemode === false || active.includes(CODEMODE_TOOL)) return false;
  if (!tools.some((tool) => tool.name === CODEMODE_TOOL && tool.sourceInfo?.path === CODEMODE_SOURCE)) return false;
  return [...config.servers.map((server) => server.config), ...contributions.map((contribution) => contribution.config)].some(usesCodemode);
}

export default function goalSelectMcpDiscovery(pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    const session = ctx as unknown as SessionContext;
    if (session.orchestrationContext?.kind !== "workflow-stage" || !isGoalSelectRun(session.orchestrationContext.workflowRunId)) return;
    const config = nativeMcpConfig({ agentDir: atomicAgentDir(), cwd: session.cwd, projectTrusted: session.isProjectTrusted?.() ?? false });
    const contributions = (pi as unknown as { getMcpServerContributions?: () => { config: Record<string, unknown> }[] }).getMcpServerContributions?.() ?? [];
    const active = pi.getActiveTools();
    if (needsCodemode(session, pi.getAllTools() as ToolInfo[], active, config, contributions)) pi.setActiveTools([...active, CODEMODE_TOOL]);
  });
}
