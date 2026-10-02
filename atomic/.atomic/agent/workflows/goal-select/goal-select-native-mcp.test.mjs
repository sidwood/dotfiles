import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { after, before, describe, it } from "node:test";

const ATOMIC_ROOT = "/Users/sidwood/.local/share/atomic/node_modules";
const ATOMIC_PACKAGE_JSON = `${ATOMIC_ROOT}/@bastani/atomic/package.json`;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@bastani/atomic/workflows" || specifier === "typebox" || specifier.startsWith("typebox/")) {
      return nextResolve(specifier, { ...context, parentURL: pathToFileURL(ATOMIC_PACKAGE_JSON).href });
    }
    return nextResolve(specifier, context);
  },
});

const EXTENSIONS = fileURLToPath(new URL("../../extensions/", import.meta.url));
const root = realpathSync(mkdtempSync(join(tmpdir(), "goal-select-native-mcp-")));
const home = join(root, "home");
const agentDir = join(root, "agent");
const bareAgentDir = join(root, "agent-without-extensions");
const cwd = join(root, "project");
const callLog = join(root, "fixture-calls.jsonl");
const fixture = join(root, "tracker-mcp-fixture.mjs");
const saved = { HOME: process.env.HOME, ATOMIC_CODING_AGENT_DIR: process.env.ATOMIC_CODING_AGENT_DIR, PI_CODING_AGENT_DIR: process.env.PI_CODING_AGENT_DIR };
const BIG = 30_000;

const FIXTURE_SOURCE = String.raw`
import { appendFileSync } from "node:fs";
import { createInterface } from "node:readline";
const kind = process.env.FIXTURE_KIND;
const object = (properties = {}, required) => ({ type: "object", properties, ...(required ? { required } : {}) });
const tools = kind === "jira" ? [
  { name: "getAccessibleAtlassianResources", description: "List Atlassian sites", inputSchema: object() },
  { name: "getJiraIssue", description: "Get a Jira issue", inputSchema: object({ cloudId: { type: "string" }, issueIdOrKey: { type: "string" } }, ["cloudId", "issueIdOrKey"]) },
  { name: "searchJiraIssuesUsingJql", description: "Search Jira issues with JQL", inputSchema: object({ cloudId: { type: "string" }, jql: { type: "string" } }, ["cloudId", "jql"]) },
  { name: "editJiraIssue", description: "Edit a Jira issue", inputSchema: object({ issueIdOrKey: { type: "string" } }) },
] : [
  { name: "get_workspace", description: "Get the workspace", inputSchema: object() },
  { name: "get_issue", description: "Get a Linear issue", inputSchema: object({ id: { type: "string" } }, ["id"]) },
  { name: "list_issues", description: "List Linear issues", inputSchema: object({ query: { type: "string" } }) },
  { name: "save_issue", description: "Create or update a Linear issue", inputSchema: object({ id: { type: "string" } }) },
];
const text = (value) => ({ content: [{ type: "text", text: JSON.stringify(value, null, 2) }] });
const answers = {
  getAccessibleAtlassianResources: () => text([{ id: "cloud-1", url: "https://example.atlassian.net" }]),
  getJiraIssue: (args) => text({ key: args.issueIdOrKey, fields: { summary: "Fix the login redirect", description: "Users loop.\n\n## Acceptance criteria\n- Lands on the dashboard\n\n" + "Long field. ".repeat(Number(process.env.FIXTURE_BIG ?? 0) / 12) } }),
  get_workspace: () => text({ name: "Acme" }),
  get_issue: (args) => text({ id: args.id, title: "Token layer", description: "Bring tokens.", url: "https://linear.app/acme/issue/" + args.id }),
};
const reply = (id, result) => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
createInterface({ input: process.stdin }).on("line", (line) => {
  if (!line.trim()) return;
  const message = JSON.parse(line);
  if (message.id === undefined) return;
  if (message.method === "initialize") return reply(message.id, { protocolVersion: message.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: "fixture-" + kind, version: "1.0.0" } });
  if (message.method === "tools/list") return reply(message.id, { tools });
  if (message.method === "ping") return reply(message.id, {});
  if (message.method === "tools/call") {
    const { name, arguments: args = {} } = message.params;
    appendFileSync(process.env.FIXTURE_LOG, JSON.stringify({ kind, name, args }) + "\n");
    return reply(message.id, (answers[name] ?? (() => ({ content: [{ type: "text", text: "changed " + name }] })))(args));
  }
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: message.id, error: { code: -32601, message: "Method not found" } }) + "\n");
});
`;

const server = (kind, extra = {}) => ({ command: process.execPath, args: [fixture], env: { FIXTURE_KIND: kind, FIXTURE_LOG: callLog, FIXTURE_BIG: String(BIG) }, ...extra });
const globalConfig = { mcpServers: { atlassian: server("jira"), "work-linear": server("linear") } };
const STAGE_POLICY = { managementActions: "full", fanoutAuthorized: true, inheritProjectContext: true, inheritSkills: true };
const DEFAULT_TOOLS = ["read", "bash", "edit", "write"];

let atomic;
let builtInExtensions;
let piAi;
let faux;
let discovery;
let guard;
let intake;
const goalSelectRun = "goal-select-native-run";
let runs = 0;

function writeJson(path, value) {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function fixtureCalls() {
  return existsSync(callLog) ? readFileSync(callLog, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line)) : [];
}

async function waitFor(check, what, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = check();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`timed out waiting for ${what}`);
}

async function stageSession({ stageName = "orchestrator-1", runId = goalSelectRun, tools, excludedTools, policy = {}, dir = agentDir }) {
  process.env.ATOMIC_CODING_AGENT_DIR = dir;
  const settingsManager = atomic.SettingsManager.create(cwd, dir);
  const scriptedProvider = {
    name: "goal-select-scripted-provider",
    factory: (pi) =>
      pi.registerProvider("goal-select-scripted", {
        name: "goal-select scripted test model",
        baseUrl: "http://127.0.0.1:9",
        apiKey: "local-test-only",
        api: "goal-select-scripted-api",
        models: [{ id: "scripted", name: "Scripted", reasoning: false, input: ["text"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 100_000, maxTokens: 1_000 }],
        streamSimple: faux.streamSimple,
      }),
  };
  const resourceLoader = new atomic.DefaultResourceLoader({
    cwd,
    agentDir: dir,
    settingsManager,
    extensionFactories: [...builtInExtensions, scriptedProvider],
    builtinPackagePaths: atomic.getBuiltinPackagePaths(),
  });
  await resourceLoader.reload();
  const modelRuntime = await atomic.ModelRuntime.create({ credentials: atomic.AuthStorage.inMemory(), modelsPath: null });
  runs += 1;
  const sessionManager = atomic.SessionManager.create(cwd, join(root, "sessions"), { internal: true, workflow: { runId, stageId: `stage-${runs}`, stageName } });
  const { session } = await atomic.createAgentSession({
    cwd,
    agentDir: dir,
    settingsManager,
    resourceLoader,
    modelRuntime,
    sessionManager,
    ...(tools ? { tools } : {}),
    ...(excludedTools ? { excludedTools } : {}),
    subagentPolicy: { ...STAGE_POLICY, ...policy },
    orchestrationContext: { kind: "workflow-stage", workflowRunId: runId, workflowStageId: `stage-${runs}`, workflowStageName: stageName, constraints: { disableWorkflowTool: true } },
  });
  const model = modelRuntime.getModel("goal-select-scripted", "scripted");
  assert.ok(model, "the scripted local model is registered");
  await session.setModel(model);
  return { session, sessionFile: sessionManager.getSessionFile() };
}

async function drive(session, calls) {
  const declared = [];
  const step = (respond) => (context) => {
    declared.push((piAi.getCurrentTools(context.messages) ?? []).map((tool) => tool.name));
    return respond();
  };
  faux.setResponses([
    ...calls.map(([name, args]) => step(() => piAi.fauxAssistantMessage(piAi.fauxToolCall(name, args), { stopReason: "toolUse" }))),
    step(() => piAi.fauxAssistantMessage("done")),
  ]);
  await session.prompt("Run the scripted calls.");
  return declared;
}

function toolResults(sessionFile) {
  return readFileSync(sessionFile, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((entry) => entry.type === "message" && entry.message.role === "toolResult")
    .map((entry) => entry.message);
}

before(async () => {
  for (const dir of [home, join(agentDir, "extensions"), join(bareAgentDir, "extensions"), cwd]) mkdirSync(dir, { recursive: true });
  for (const file of ["goal-select-tracker-guard.ts", "goal-select-mcp-discovery.ts"]) symlinkSync(join(EXTENSIONS, file), join(agentDir, "extensions", file));
  writeFileSync(fixture, FIXTURE_SOURCE);
  writeJson(join(agentDir, "mcp.json"), globalConfig);
  writeJson(join(bareAgentDir, "mcp.json"), globalConfig);
  process.env.HOME = home;
  process.env.ATOMIC_CODING_AGENT_DIR = agentDir;
  delete process.env.PI_CODING_AGENT_DIR;
  atomic = await import(`${ATOMIC_ROOT}/@bastani/atomic/dist/index.js`);
  ({ builtInExtensions } = await import(`${ATOMIC_ROOT}/@bastani/atomic/dist/extensions/index.js`));
  piAi = await import(`${ATOMIC_ROOT}/@bastani/pi-ai/dist/index.js`);
  faux = piAi.createFauxCore({ provider: "goal-select-scripted", api: "goal-select-scripted-api", models: [{ id: "scripted" }] });
  discovery = await import(new URL("../../extensions/goal-select-mcp-discovery.ts", import.meta.url).href);
  guard = await import(new URL("../../extensions/goal-select-tracker-guard.ts", import.meta.url).href);
  intake = await import(new URL("./tracker-intake.js", import.meta.url).href);
  discovery.markGoalSelectRun(goalSelectRun);
});

after(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(root, { recursive: true, force: true });
});

describe("goal-select with Atomic's native MCP client (real SDK sessions, local stdio MCP fixture, scripted local model; no workflow run, tracker or model request)", () => {
  it("gives goal-select's Goal stages and unrestricted delegated children codemode, without touching other runs, exclusions or allowlists", async () => {
    const active = async (options) => {
      const { session } = await stageSession(options);
      const names = session.getActiveToolNames();
      await session.dispose();
      return names;
    };
    const goalStage = await active({});
    assert.ok(goalStage.includes("codemode"), goalStage.join(", "));
    for (const tool of DEFAULT_TOOLS) assert.ok(goalStage.includes(tool), `${tool} stays active`);
    const child = await active({ stageName: "orchestrator-1", policy: { depth: 1 } });
    assert.ok(child.includes("codemode"), "a delegated child without a tool allowlist can discover MCP tools");
    assert.equal((await active({ runId: "another-workflow-run" })).includes("codemode"), false, "other workflows keep Atomic's stage behaviour");
    const excluded = await active({ excludedTools: ["codemode"] });
    assert.equal(excluded.includes("codemode"), false, "an explicit exclusion wins");
    for (const tool of DEFAULT_TOOLS) assert.ok(excluded.includes(tool));
    assert.deepEqual(await active({ policy: { depth: 1 }, tools: ["read", "bash"] }), ["read", "bash"], "a child's allowlist is its ceiling");

    writeJson(join(agentDir, "mcp.json"), { ...globalConfig, autoEnableCodemode: false });
    try {
      assert.equal((await active({})).includes("codemode"), false, "autoEnableCodemode false is honoured");
    } finally {
      writeJson(join(agentDir, "mcp.json"), globalConfig);
    }
  });

  it("lets an ordinary Goal stage discover and call a native MCP tool through codemode", async () => {
    const { session, sessionFile } = await stageSession({});
    const code = "const found = await searchTools('jira issue', { namespace: 'mcp__atlassian' }); const issue = await tools.mcp__atlassian__getJiraIssue({ cloudId: 'cloud-1', issueIdOrKey: 'PROJ-3' }); return JSON.stringify({ found, text: issue.content[0].text.slice(0, 200) });";
    await drive(session, [["codemode", { code }]]);
    await session.dispose();
    const [result] = toolResults(sessionFile);
    assert.equal(result.toolName, "codemode");
    assert.equal(result.isError, false, JSON.stringify(result.content));
    const text = result.content.map((block) => block.text ?? "").join("\n");
    assert.match(text, /mcp__atlassian__getJiraIssue/);
    assert.match(text, /Fix the login redirect/);
    assert.ok(fixtureCalls().some((entry) => entry.name === "getJiraIssue" && entry.args.issueIdOrKey === "PROJ-3"));
  });

  it("registers exactly the native read names the tracker allowlist expects, for default and punctuated server names", async () => {
    for (const [tracker, server] of [["jira", "atlassian"], ["linear", "work-linear"]]) {
      const spec = intake.trackerIntake({ tracker, tracker_mcp_server: server }, cwd);
      const options = intake.trackerStageOptions(spec, "unused");
      const { session } = await stageSession({ stageName: intake.trackerStage(spec, guard.TRACKER_INTAKE_STAGE), tools: options.tools });
      const registered = await waitFor(() => {
        const names = session.getAllTools().map((tool) => tool.name).filter((name) => name.startsWith("mcp__"));
        return names.length === 3 && names;
      }, `${server} read tools`);
      assert.deepEqual(registered.sort(), options.tools.filter((name) => name.startsWith("mcp__")).sort());
      assert.deepEqual(session.getAllTools().map((tool) => tool.name).sort(), [...options.tools].sort(), "nothing outside the allowlist is reachable");
      await session.dispose();
    }
  });

  it("proves the guard at startup, then fetches through tool_search and native reads, and snapshots the complete large response", async () => {
    const spec = intake.trackerIntake({ tracker: "jira", tracker_issue: "PROJ-7" }, cwd);
    const check = await stageSession({ stageName: guard.TRACKER_GUARD_CHECK_STAGE, tools: intake.guardCheckStageOptions(spec).tools });
    await drive(check.session, [[guard.TRACKER_GUARD_TOOL, {}]]);
    await check.session.dispose();
    assert.deepEqual(intake.auditGuardCheck(check.sessionFile), { transcript: true, active: true });

    const before = fixtureCalls().length;
    const stageName = intake.trackerStage(spec, guard.TRACKER_INTAKE_STAGE);
    const { session, sessionFile } = await stageSession({ stageName, tools: intake.trackerStageOptions(spec, "unused").tools });
    const declared = await drive(session, [
      [guard.TRACKER_GUARD_TOOL, {}],
      [guard.TOOL_SEARCH_TOOL, { query: "atlassian getAccessibleAtlassianResources getJiraIssue searchJiraIssuesUsingJql" }],
      ["mcp__atlassian__getAccessibleAtlassianResources", {}],
      ["mcp__atlassian__getJiraIssue", { cloudId: "cloud-1", issueIdOrKey: "PROJ-7" }],
    ]);
    await session.dispose();
    assert.ok(declared.at(-1).includes("mcp__atlassian__getJiraIssue"), "the read tools are declared to the model once the server connects");
    const results = toolResults(sessionFile);
    const fetchResult = results.find((message) => message.toolName === "mcp__atlassian__getJiraIssue");
    assert.equal(fetchResult.isError, false);
    assert.match(fetchResult.content[0].text, /^Warning: truncated output/, "the model saw Atomic's shortened copy");
    assert.equal(typeof fetchResult.details.fullOutputPath, "string");

    const audit = intake.auditTrackerStage(sessionFile, spec);
    assert.deepEqual({ probed: audit.probed, unguarded: audit.unguarded, blocked: audit.blocked, disallowed: audit.disallowed, checked: audit.checked, reads: audit.reads }, {
      probed: true,
      unguarded: [],
      blocked: [],
      disallowed: [],
      checked: true,
      reads: ["getAccessibleAtlassianResources", "getJiraIssue"],
    });
    const structured = { outcome: "fetched", issue_key: "PROJ-7", title: "Fix the login redirect", url: "https://example.atlassian.net/browse/PROJ-7", acceptance_criteria: "- Lands on the dashboard", acceptance_criteria_source: "description section 'Acceptance criteria'", candidates: [], detail: "Fetched." };
    rmSync(fetchResult.details.fullOutputPath, { force: true });
    const outcome = intake.trackerStageOutcome({ name: stageName, structured, sessionFile }, intake.auditTrackerStage(sessionFile, spec), spec, "PROJ-7");
    assert.equal(outcome.kind, "fetched");
    const raw = JSON.parse(outcome.issue.raw);
    assert.equal(raw.key, "PROJ-7");
    assert.ok(outcome.issue.raw.length > BIG, "the guard's record keeps the whole response after Atomic's temporary file is gone");
    const snapshot = intake.trackerSnapshot({ intake: spec, preflight: { config_source: join(agentDir, "mcp.json"), guard: "guard" }, issue: outcome.issue, path: join(cwd, "snapshot.md"), runId: "run", savedAt: "now" });
    assert.ok(snapshot.markdown.includes(`~~~\n${outcome.issue.raw}\n~~~`));
    assert.deepEqual(fixtureCalls().slice(before).map((entry) => entry.name), ["getAccessibleAtlassianResources", "getJiraIssue"]);
  });

  it("blocks discovery and reads before the probe, and writes and other servers' reads after it, even when the allowlist is too wide", async () => {
    const spec = intake.trackerIntake({ tracker: "jira", tracker_issue: "PROJ-7" }, cwd);
    const stageName = intake.trackerStage(spec, guard.TRACKER_INTAKE_STAGE);
    const tools = [...intake.trackerStageOptions(spec, "unused").tools, "mcp__atlassian__editJiraIssue", "mcp__work_linear__get_issue", "bash"];
    const { session, sessionFile } = await stageSession({ stageName, tools });
    await waitFor(() => session.getAllTools().some((tool) => tool.name === "mcp__work_linear__get_issue") && session.getAllTools().some((tool) => tool.name === "mcp__atlassian__getJiraIssue"), "both servers' tools");
    const before = fixtureCalls().length;
    await drive(session, [
      ["mcp__atlassian__getJiraIssue", { cloudId: "cloud-1", issueIdOrKey: "PROJ-7" }],
      [guard.TOOL_SEARCH_TOOL, { query: "jira" }],
      [guard.TRACKER_GUARD_TOOL, {}],
      ["mcp__atlassian__editJiraIssue", { issueIdOrKey: "PROJ-7" }],
      ["mcp__work_linear__get_issue", { id: "PROJ-7" }],
      ["bash", { command: "echo escaped" }],
      ["mcp__atlassian__getAccessibleAtlassianResources", {}],
    ]);
    await session.dispose();
    const results = toolResults(sessionFile);
    const byName = (name) => results.filter((message) => message.toolName === name);
    assert.match(byName("mcp__atlassian__getJiraIssue")[0].content[0].text, /goal_select_tracker_guard must run before any other call/);
    assert.match(byName(guard.TOOL_SEARCH_TOOL)[0].content[0].text, /goal_select_tracker_guard must run before any other call/);
    for (const name of ["mcp__atlassian__editJiraIssue", "mcp__work_linear__get_issue", "bash"]) {
      assert.equal(byName(name)[0].isError, true, name);
      assert.match(byName(name)[0].content[0].text, /is not an allow-listed jira read tool of MCP server "atlassian"/, name);
    }
    assert.deepEqual(fixtureCalls().slice(before).map((entry) => entry.name), ["getAccessibleAtlassianResources"], "only the allowed read reached a server");
    const audit = intake.auditTrackerStage(sessionFile, spec);
    assert.throws(
      () => intake.trackerStageOutcome({ name: stageName, structured: { outcome: "unavailable", detail: "" }, sessionFile }, audit, spec, "PROJ-7"),
      /goal-select-tracker-guard blocked them before they ran: tool "mcp__atlassian__editJiraIssue"/,
    );
  });

  it("fails the guard check when the guard extension is not loaded", async () => {
    const spec = intake.trackerIntake({ tracker: "jira" }, cwd);
    const { session, sessionFile } = await stageSession({ stageName: guard.TRACKER_GUARD_CHECK_STAGE, tools: intake.guardCheckStageOptions(spec).tools, dir: bareAgentDir });
    await drive(session, [[guard.TRACKER_GUARD_TOOL, {}]]);
    await session.dispose();
    process.env.ATOMIC_CODING_AGENT_DIR = agentDir;
    assert.match(toolResults(sessionFile)[0].content[0].text, /not found/);
    const audit = intake.auditGuardCheck(sessionFile);
    assert.deepEqual(audit, { transcript: true, active: false });
    assert.throws(() => intake.guardCheckOutcome(audit, spec), /goal-select-tracker-guard did not run/);
  });

  it("agrees with the native client on enabled false, trusted project precedence and ignored legacy files", async () => {
    const spec = intake.trackerIntake({ tracker: "jira" }, cwd);
    writeJson(join(cwd, ".atomic", "mcp.json"), { mcpServers: { atlassian: server("jira", { enabled: false }) } });
    writeJson(join(cwd, ".mcp.json"), { mcpServers: { "work-linear": server("linear", { enabled: false }) } });
    writeJson(join(agentDir, "trust.json"), { [cwd]: true });
    try {
      const { session } = await stageSession({});
      await waitFor(() => session.getAllTools().some((tool) => tool.name.startsWith("mcp__work_linear__")), "the linear fixture");
      assert.equal(session.getAllTools().some((tool) => tool.name.startsWith("mcp__atlassian__")), false, "the native client skips the disabled project entry");
      await session.dispose();
      assert.throws(() => intake.trackerPreflight(spec, process.env, home), /"enabled": false in .*\.atomic\/mcp\.json/);
      const linear = intake.trackerPreflight(intake.trackerIntake({ tracker: "linear", tracker_mcp_server: "work-linear" }, cwd), process.env, home);
      assert.equal(linear.config_source, join(agentDir, "mcp.json"), "the legacy .mcp.json is ignored, as the native client ignores it");
    } finally {
      for (const path of [join(cwd, ".atomic"), join(cwd, ".mcp.json"), join(agentDir, "trust.json")]) rmSync(path, { recursive: true, force: true });
    }
  });
});
