import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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

describe("goal-select's writer fallback gate in Atomic's own sessions (real SDK sessions and the real subagent tool, scripted local models; no workflow run, Intercom broker or model request)", () => {
  const fallbackAgentDir = join(root, "agent-fallback");
  const sessionsDir = join(root, "fallback-sessions");
  // The checkout the delegated agent works in: a repository that keeps
  // Atomic's own folder out of Git, as the projects goal-select runs on do.
  const checkout = join(root, "fallback-checkout");
  const PROVIDERS = ["fx-writer", "fx-chat", "fx-review", "fx-next"];
  // A provider Atomic knows but holds no credentials for.
  const LOCKED = "fx-locked";
  const usageLimit = "The usage limit has been reached";
  // The turn the gate is built for: fx-chat orchestrates, fx-review reviews.
  const turnModels = { roles: ["reviewer"], reviewer: { model: "fx-review/m:high" }, orchestrator: { model: "fx-chat/m:medium" }, writer: "fx-writer/m:max" };
  let cores;
  let writerFallback;
  let requests;
  let sessions = 0;

  before(async () => {
    mkdirSync(join(fallbackAgentDir, "agents"), { recursive: true });
    mkdirSync(join(checkout, "src"), { recursive: true });
    execFileSync("git", ["init", "--quiet", checkout], { env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" } });
    writeFileSync(join(checkout, ".gitignore"), ".atomic/\n");
    // Without same-model retries a failed model moves straight to its fallback.
    writeJson(join(fallbackAgentDir, "settings.json"), { retry: { enabled: false } });
    writeFileSync(
      join(fallbackAgentDir, "agents", "scribe.md"),
      ["---", "name: scribe", "description: Minimal implementation agent for the fallback tests.", "systemPromptMode: replace", "inheritProjectContext: false", "inheritSkills: false", "tools: read, write", "---", "", "You are scribe. Reply briefly.", ""].join("\n"),
    );
    cores = Object.fromEntries(PROVIDERS.map((provider) => [provider, piAi.createFauxCore({ provider, api: `${provider}-api`, models: [{ id: "m" }] })]));
    writerFallback = await import(new URL("./writer-fallback.js", import.meta.url).href);
  });

  after(() => {
    process.env.ATOMIC_CODING_AGENT_DIR = agentDir;
  });

  // Every provider answers each request with what the test scripted for it.
  function script(answers) {
    requests = [];
    for (const provider of PROVIDERS) {
      cores[provider].setResponses(
        Array.from({ length: 8 }, () => (context, _options, _state, model) => {
          requests.push(`${model.provider}/${model.id}`);
          return answers[provider](context);
        }),
      );
    }
  }
  const failing = () => piAi.fauxAssistantMessage("", { stopReason: "error", errorMessage: usageLimit });
  const saying = (text) => () => piAi.fauxAssistantMessage(text);
  const firstUserText = (context) => {
    const first = context.messages.find((message) => message.role === "user");
    return typeof first?.content === "string" ? first.content : (first?.content ?? []).map((part) => part.text ?? "").join("");
  };

  // A session as goal-select's orchestrator stage has it, without Intercom so
  // that delegating starts no broker process.
  async function fallbackSession({ model, fallbackModels, gate }) {
    process.env.ATOMIC_CODING_AGENT_DIR = fallbackAgentDir;
    const settingsManager = atomic.SettingsManager.create(checkout, fallbackAgentDir);
    const scriptedProviders = {
      name: "goal-select-fallback-providers",
      factory: (pi) => {
        for (const provider of PROVIDERS) {
          pi.registerProvider(provider, {
            name: `${provider} scripted test model`,
            baseUrl: "http://127.0.0.1:9",
            apiKey: "local-test-only",
            api: `${provider}-api`,
            models: [{ id: "m", name: provider, reasoning: false, input: ["text"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 100_000, maxTokens: 1_000 }],
            streamSimple: cores[provider].streamSimple,
          });
        }
        pi.registerProvider(LOCKED, {
          name: "scripted test model without credentials",
          baseUrl: "http://127.0.0.1:9",
          api: `${LOCKED}-api`,
          models: [{ id: "m", name: LOCKED, reasoning: false, input: ["text"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 100_000, maxTokens: 1_000 }],
          streamSimple: cores["fx-writer"].streamSimple,
        });
      },
    };
    const resourceLoader = new atomic.DefaultResourceLoader({
      cwd: checkout,
      agentDir: fallbackAgentDir,
      settingsManager,
      extensionFactories: [...builtInExtensions, scriptedProviders],
      builtinPackagePaths: atomic.getBuiltinPackagePaths({ intercom: false }),
    });
    await resourceLoader.reload();
    const modelRuntime = await atomic.ModelRuntime.create({ credentials: atomic.AuthStorage.inMemory(), modelsPath: null });
    sessions += 1;
    const runId = "goal-select-fallback-run";
    const sessionManager = atomic.SessionManager.create(checkout, sessionsDir, { internal: true, workflow: { runId, stageId: `stage-${sessions}`, stageName: "orchestrator-1" } });
    const { session } = await atomic.createAgentSession({
      cwd: checkout,
      agentDir: fallbackAgentDir,
      settingsManager,
      resourceLoader,
      modelRuntime,
      sessionManager,
      builtins: { intercom: false },
      fallbackModels,
      ...(gate ? { isFallbackModelAllowed: gate } : {}),
      subagentPolicy: STAGE_POLICY,
      orchestrationContext: { kind: "workflow-stage", workflowRunId: runId, workflowStageId: `stage-${sessions}`, workflowStageName: "orchestrator-1", constraints: { disableWorkflowTool: true } },
    });
    const [provider, id] = model.split("/");
    await session.setModel(modelRuntime.getModel(provider, id));
    return { session, sessionFile: sessionManager.getSessionFile() };
  }

  // The orchestrator, on fx-chat, delegates the change to scribe on fx-writer
  // and waits for it; fx-writer's provider is out of quota. Whatever model
  // the agent then runs on writes `files`, as given, and reports.
  async function delegate(gate, requested = "fx-writer/m", files = ["src/change.txt"]) {
    let orchestratorTurns = 0;
    script({
      "fx-writer": failing,
      "fx-review": saying("written by the reviewer's model"),
      "fx-next": saying("written by the next model"),
      "fx-chat": (context) => {
        if (!firstUserText(context).includes("Delegate the change.")) {
          if (context.messages.some((message) => message.role === "toolResult")) return piAi.fauxAssistantMessage("written by the orchestrator's model");
          return piAi.fauxAssistantMessage(files.map((path) => piAi.fauxToolCall("write", { path, content: "changed\n" })), { stopReason: "toolUse" });
        }
        orchestratorTurns += 1;
        if (orchestratorTurns > 1) return piAi.fauxAssistantMessage("receipt");
        return piAi.fauxAssistantMessage(piAi.fauxToolCall("subagent", { agent: "scribe", task: "Write the change.", model: requested, context: "fresh", wait: { kind: "foreground", budgetMs: 20_000 } }), { stopReason: "toolUse" });
      },
    });
    const { session, sessionFile } = await fallbackSession({ model: "fx-chat/m", fallbackModels: [], gate });
    // Under a test runner Atomic gives a delegated agent a stub session;
    // these tests are about the real one.
    const runner = { NODE_TEST_CONTEXT: process.env.NODE_TEST_CONTEXT, NODE_ENV: process.env.NODE_ENV };
    delete process.env.NODE_TEST_CONTEXT;
    delete process.env.NODE_ENV;
    try {
      await session.prompt("Delegate the change.");
    } finally {
      for (const [key, value] of Object.entries(runner)) {
        if (value !== undefined) process.env[key] = value;
      }
    }
    await session.dispose();
    const [result] = toolResults(sessionFile).filter((message) => message.toolName === "subagent");
    assert.equal(result.isError, false, JSON.stringify(result.content));
    return { sessionFile, text: result.content.map((block) => block.text ?? "").join("\n"), tasks: writerFallback.delegatedTasks(sessionFile, checkout) };
  }

  it("skips a fallback the gate refuses without running it, and runs the next one it allows", async () => {
    const refusals = [];
    const allow = writerFallback.delegatedFallbackGate(turnModels);
    const gate = (model, effort) => {
      const allowed = allow(model, effort);
      if (!allowed) refusals.push(`${model.provider}/${model.id}`);
      return allowed;
    };
    script({ "fx-writer": failing, "fx-review": saying("reviewer"), "fx-chat": saying("orchestrator"), "fx-next": saying("next") });
    const { session } = await fallbackSession({ model: "fx-writer/m", fallbackModels: ["fx-review/m:high", "fx-chat/m", "fx-next/m"], gate });
    await session.prompt("Write the change.");
    assert.equal(`${session.model.provider}/${session.model.id}`, "fx-next/m");
    await session.dispose();
    assert.deepEqual(refusals, ["fx-review/m", "fx-chat/m"], "Atomic asked the gate about each candidate in order");
    assert.deepEqual(requests, ["fx-writer/m", "fx-next/m"], "no request reached the reviewer's or the orchestrator's model");
  });

  it("left alone, Atomic moves a delegated agent whose provider fails onto the orchestrator's model and reports it as completed", async () => {
    const { text, tasks } = await delegate(undefined);
    assert.match(text, /written by the orchestrator's model/);
    assert.deepEqual(requests.filter((model) => model === "fx-writer/m").length, 1);
    assert.equal(tasks.length, 1);
    const [task] = tasks;
    assert.deepEqual([task.agent, task.requested, task.started, task.resolved, task.models, task.wrote, task.error, task.unread], ["scribe", "fx-writer/m", "fx-writer/m", "fx-chat/m", ["fx-chat/m"], ["fx-chat/m"], undefined, undefined], "the transcript audit names the model that wrote, which the request did not");
    assert.equal(readFileSync(join(checkout, "src", "change.txt"), "utf8"), "changed\n", "Atomic's own write tool wrote the file the audit read from the transcript");
  });

  it("with goal-select's gate on the orchestrator's session, the delegated agent inherits it and stays off the orchestrator's model", async () => {
    const { text, tasks } = await delegate(writerFallback.delegatedFallbackGate(turnModels));
    assert.deepEqual(requests, ["fx-chat/m", "fx-writer/m", "fx-chat/m"], "the orchestrator, the agent's one failed request, the orchestrator again: the agent never ran on fx-chat");
    assert.match(text, /"kind":"completed"/, "Atomic still reports the stopped agent as completed");
    assert.doesNotMatch(text, /written by/);
    const [task] = tasks;
    assert.deepEqual([task.agent, task.requested, task.resolved, task.models, task.wrote, task.error, task.unread], ["scribe", "fx-writer/m", "fx-writer/m", [], [], usageLimit, undefined], "only the agent's transcript shows that its model failed");
    assert.equal(writerFallback.describeDelegatedTask(task), `scribe ${task.task.split(":")[0]} asked for fx-writer/m, produced no turn, wrote no file, ended on fx-writer/m with a model error (${usageLimit})`);
    assert.equal(existsSync(join(fallbackAgentDir, "intercom", "broker.sock")), false, "no Intercom broker was started");
  });

  it("cannot stop Atomic starting an agent on the orchestrator's model when the requested model's provider has no credentials; the audit shows it", async () => {
    const { text, tasks } = await delegate(writerFallback.delegatedFallbackGate(turnModels), `${LOCKED}/m`, ["src/started-elsewhere.txt"]);
    assert.match(text, /written by the orchestrator's model/, "the agent's first and only model was the orchestrator's: a start, not a fallback");
    assert.equal(requests.includes("fx-writer/m"), false, "the locked provider was never asked");
    const [task] = tasks;
    assert.deepEqual([task.requested, task.started, task.resolved, task.models, task.wrote, task.error], [`${LOCKED}/m`, "fx-chat/m", "fx-chat/m", ["fx-chat/m"], ["fx-chat/m"], undefined]);
  });

  it("reads from a real transcript which files an agent wrote: those of the checkout that Git keeps, not its notes or scratch", async () => {
    const outside = join(root, "evidence", "review.md");
    mkdirSync(join(root, "evidence"), { recursive: true });
    mkdirSync(join(checkout, ".atomic"), { recursive: true });
    const notes = await delegate(undefined, "fx-writer/m", [join(checkout, ".atomic", "progress.md"), outside]);
    assert.match(notes.text, /written by the orchestrator's model/);
    assert.equal(readFileSync(outside, "utf8"), "changed\n");
    assert.deepEqual([notes.tasks[0].models, notes.tasks[0].wrote], [["fx-chat/m"], []], "it ran on the orchestrator's model and wrote nothing a reviewer reads");
    const both = await delegate(undefined, "fx-writer/m", [join(checkout, ".atomic", "second-progress.md"), join(checkout, "src", "second.txt")]);
    assert.deepEqual(both.tasks[0].wrote, ["fx-chat/m"], "one file of the checkout among its notes is enough");
    // Atomic refuses to overwrite a file the session has not read; a refused write wrote nothing.
    const refused = await delegate(undefined, "fx-writer/m", [join(checkout, "src", "second.txt")]);
    assert.deepEqual([refused.tasks[0].models, refused.tasks[0].wrote], [["fx-chat/m"], []]);
  });
});
