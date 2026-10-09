import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { after, before, beforeEach, describe, it } from "node:test";

const ATOMIC_PACKAGE_JSON = "/Users/sidwood/.local/share/atomic/node_modules/@bastani/atomic/package.json";
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@bastani/atomic/workflows" || specifier === "typebox" || specifier.startsWith("typebox/")) {
      return nextResolve(specifier, { ...context, parentURL: pathToFileURL(ATOMIC_PACKAGE_JSON).href });
    }
    return nextResolve(specifier, context);
  },
});

const root = realpathSync(mkdtempSync(join(tmpdir(), "goal-select-test-")));
process.env.ATOMIC_WORKFLOW_ARTIFACT_DIR = join(root, "artifacts");

const home = realpathSync(mkdtempSync(join(tmpdir(), "goal-select-home-")));
const sharedDir = join(home, ".config", "atomic");
const sharedDefaultPath = join(sharedDir, "goal-select.jsonc");
const presetLibrary = join(sharedDir, "goal-select-models");
// The shared policy's dials as these tests use them: launch-form defaults
// and the three review tiers, with no top-level override. The complex tier
// keeps three seats here so the three-role panel stays tested; the shipped
// file gives it two, which the test of the shipped file pins.
const sharedPolicy = {
  defaults: { orchestrator_model: "openai/gpt-6.1-sol:medium", reverify_model: "openai/gpt-6-astra:high", review_tier: "complex" },
  review_tiers: {
    simple: { panel: 1, reviewer_model: "openai/gpt-6.1-sol:xhigh", max_turns: 3 },
    standard: { panel: 2, reviewer_model: "openai/gpt-6.1-sol:xhigh", risk_reviewer_model: "openai/gpt-6-astra:xhigh", max_turns: 3 },
    complex: { panel: 3, reviewer_model: "openai/gpt-6-astra:high", risk_reviewer_model: "openai/gpt-6-astra:xhigh", max_turns: 3 },
  },
};
// Atomic's builtin Goal models: what a stage runs on when nothing assigns one.
const builtinModels = { orchestrator: "openai/gpt-6-astra:medium", reviewer: "openai/gpt-6-astra:high" };
const solAstra = {
  orchestrator_model: "openai/gpt-6.1-sol:medium",
  reviewer_model: "openai/gpt-6-astra:high",
  completion_reviewer_model: "openai/gpt-6-astra:high",
  evidence_reviewer_model: "openai/gpt-6-astra:high",
  risk_reviewer_model: "openai/gpt-6-astra:xhigh",
  writer_model: "openai/gpt-6.1-sol:high",
  max_turns: 10,
};
const kimiAstra = {
  orchestrator_model: "kimi-coding/k3:high",
  reviewer_model: "openai/gpt-6-astra:high",
  completion_reviewer_model: "openai/gpt-6-astra:high",
  evidence_reviewer_model: "openai/gpt-6-astra:high",
  risk_reviewer_model: "openai/gpt-6-astra:xhigh",
  writer_model: "kimi-coding/k3:max",
  max_turns: 10,
};
const grokOpus = {
  orchestrator_model: "xai/grok-4.7:high",
  reviewer_model: "anthropic/claude-opus-5-5:high",
  completion_reviewer_model: "anthropic/claude-opus-5-5:high",
  evidence_reviewer_model: "anthropic/claude-opus-5-5:high",
  risk_reviewer_model: "anthropic/claude-opus-5-5:xhigh",
  writer_model: "xai/grok-4.7:xhigh",
  max_turns: 10,
};
const glmGrock = {
  orchestrator_model: "zai/glm-5.3:high",
  reviewer_model: "xai/grok-4.7-fast:high",
  completion_reviewer_model: "xai/grok-4.7-fast:high",
  evidence_reviewer_model: "xai/grok-4.7-fast:high",
  risk_reviewer_model: "xai/grok-4.7-fast:xhigh",
  writer_model: "zai/glm-5.3:max",
  max_turns: 10,
};
const glmSol = {
  orchestrator_model: "zai/glm-5.3:high",
  reviewer_model: "openai/gpt-6.1-sol:high",
  completion_reviewer_model: "openai/gpt-6.1-sol:high",
  evidence_reviewer_model: "openai/gpt-6.1-sol:high",
  risk_reviewer_model: "openai/gpt-6.1-sol:xhigh",
  writer_model: "zai/glm-5.3:max",
  max_turns: 10,
};
const glmAstra = {
  orchestrator_model: "zai/glm-5.3:high",
  reviewer_model: "openai/gpt-6-astra:high",
  completion_reviewer_model: "openai/gpt-6-astra:high",
  evidence_reviewer_model: "openai/gpt-6-astra:high",
  risk_reviewer_model: "openai/gpt-6-astra:xhigh",
  writer_model: "zai/glm-5.3:max",
  max_turns: 10,
};
const grokAstra = {
  orchestrator_model: "xai/grok-4.7:high",
  reviewer_model: "openai/gpt-6-astra:high",
  completion_reviewer_model: "openai/gpt-6-astra:high",
  evidence_reviewer_model: "openai/gpt-6-astra:high",
  risk_reviewer_model: "openai/gpt-6-astra:xhigh",
  writer_model: "xai/grok-4.7:xhigh",
  max_turns: 10,
};
const kimiOpus = {
  orchestrator_model: "kimi-coding/k3:high",
  reviewer_model: "anthropic/claude-opus-5-5:high",
  completion_reviewer_model: "anthropic/claude-opus-5-5:high",
  evidence_reviewer_model: "anthropic/claude-opus-5-5:high",
  risk_reviewer_model: "anthropic/claude-opus-5-5:xhigh",
  writer_model: "kimi-coding/k3:max",
  max_turns: 10,
};
const grokSol = {
  orchestrator_model: "xai/grok-4.7:high",
  reviewer_model: "openai/gpt-6.1-sol:high",
  completion_reviewer_model: "openai/gpt-6.1-sol:high",
  evidence_reviewer_model: "openai/gpt-6.1-sol:high",
  risk_reviewer_model: "openai/gpt-6.1-sol:xhigh",
  writer_model: "xai/grok-4.7:xhigh",
  max_turns: 10,
};
const kimiSol = {
  orchestrator_model: "kimi-coding/k3:high",
  reviewer_model: "openai/gpt-6.1-sol:high",
  completion_reviewer_model: "openai/gpt-6.1-sol:high",
  evidence_reviewer_model: "openai/gpt-6.1-sol:high",
  risk_reviewer_model: "openai/gpt-6.1-sol:xhigh",
  writer_model: "kimi-coding/k3:max",
  max_turns: 10,
};
const opusSol = {
  orchestrator_model: "anthropic/claude-opus-5-5:high",
  reviewer_model: "openai/gpt-6.1-sol:high",
  completion_reviewer_model: "openai/gpt-6.1-sol:high",
  evidence_reviewer_model: "openai/gpt-6.1-sol:high",
  risk_reviewer_model: "openai/gpt-6.1-sol:xhigh",
  writer_model: "anthropic/claude-opus-5-5:xhigh",
  max_turns: 10,
};
const solOpusAstra = {
  orchestrator_model: "openai/gpt-6.1-sol:high",
  reviewer_model: "openai/gpt-6-astra:high",
  completion_reviewer_model: "openai/gpt-6-astra:xhigh",
  evidence_reviewer_model: "openai/gpt-6-astra:high",
  risk_reviewer_model: "openai/gpt-6-astra:xhigh",
  writer_model: "anthropic/claude-opus-5-5:xhigh",
  max_turns: 10,
};
const opusFable = {
  orchestrator_model: "anthropic/claude-opus-5-5:high",
  reviewer_model: "anthropic/claude-fable-5-1:high",
  completion_reviewer_model: "anthropic/claude-fable-5-1:xhigh",
  evidence_reviewer_model: "anthropic/claude-fable-5-1:high",
  risk_reviewer_model: "anthropic/claude-fable-5-1:xhigh",
  writer_model: "anthropic/claude-opus-5-5:xhigh",
  max_turns: 10,
};
const solFable = {
  orchestrator_model: "openai/gpt-6.1-sol:high",
  reviewer_model: "anthropic/claude-fable-5-1:high",
  completion_reviewer_model: "anthropic/claude-fable-5-1:xhigh",
  evidence_reviewer_model: "anthropic/claude-fable-5-1:high",
  risk_reviewer_model: "anthropic/claude-fable-5-1:xhigh",
  writer_model: "openai/gpt-6.1-sol:high",
  max_turns: 10,
};
const opusAstra = {
  orchestrator_model: "anthropic/claude-opus-5-5:high",
  reviewer_model: "openai/gpt-6-astra:high",
  completion_reviewer_model: "openai/gpt-6-astra:xhigh",
  evidence_reviewer_model: "openai/gpt-6-astra:high",
  risk_reviewer_model: "openai/gpt-6-astra:xhigh",
  writer_model: "anthropic/claude-opus-5-5:xhigh",
  max_turns: 10,
};
const presets = { "sol-astra.json": solAstra, "kimi-astra.json": kimiAstra, "grok-opus.json": grokOpus, "glm-grock.json": glmGrock, "glm-sol.json": glmSol, "sol-opus-astra.json": solOpusAstra, "opus-fable.json": opusFable, "sol-fable.json": solFable, "opus-astra.json": opusAstra, "glm-astra.json": glmAstra, "grok-astra.json": grokAstra, "kimi-opus.json": kimiOpus, "grok-sol.json": grokSol, "kimi-sol.json": kimiSol, "opus-sol.json": opusSol };
const savedHome = process.env.HOME;
process.env.HOME = home;
after(() => {
  if (savedHome === undefined) delete process.env.HOME;
  else process.env.HOME = savedHome;
  rmSync(home, { recursive: true, force: true });
});
writeJson(sharedDefaultPath, sharedPolicy);
for (const [name, preset] of Object.entries(presets)) writeJson(join(presetLibrary, name), preset);
const { resolveInputs, run, workflow } = await import("@bastani/atomic/workflows");
const originalChdir = process.chdir;
const startCwd = process.cwd();
const goalSelectUrl = new URL("../goal-select.ts", import.meta.url).href;
let goalSelectLoads = 0;
async function loadGoalSelectFrom(dir) {
  originalChdir.call(process, dir);
  try {
    goalSelectLoads += 1;
    return (await import(`${goalSelectUrl}?from=${goalSelectLoads}`)).default;
  } finally {
    originalChdir.call(process, startCwd);
  }
}
const goalSelect = await loadGoalSelectFrom(root);
const { branchCloneName, createBranchClone, objectiveSlug, planBranchClone } = await import(new URL("./branch-clone.js", import.meta.url).href);
const { defaultPolicyPath, modelLine, modelPolicyPaths, parseModelPolicy, policyReviewTier, policyWriterFallbacks, sharedPolicyDir } = await import(new URL("./model-policy.js", import.meta.url).href);
const writerFallback = await import(new URL("./writer-fallback.js", import.meta.url).href);
const { Type } = await import("typebox");
const guard = await import(new URL("../../extensions/goal-select-tracker-guard.ts", import.meta.url).href);
const { STOP_CHOICE: STOP_CHOICE_TEXT } = await import(new URL("./tracker-intake.js", import.meta.url).href);
const discovery = await import(new URL("../../extensions/goal-select-mcp-discovery.ts", import.meta.url).href);

const server = join(root, "server.git");
const seed = join(root, "seed");
const clone = join(root, "seed feature");
const plainDir = join(root, "plain dir");
const plainFile = join(root, "a file.txt");
const missing = join(root, "missing clone");
const absolutePolicy = join(root, "policies dir", "absolute policy.json");
const cloneBranch = "feature/checkout";
const gitEnv = {
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "goal-select test",
  GIT_AUTHOR_EMAIL: "goal-select@example.invalid",
  GIT_COMMITTER_NAME: "goal-select test",
  GIT_COMMITTER_EMAIL: "goal-select@example.invalid",
};

function git(...args) {
  return execFileSync("git", args, { env: gitEnv, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function writeJson(path, value) {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value)}\n`);
}

function writeJsonText(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

// A JSONC policy as Sid keeps it: alternatives commented out, trailing
// commas, and comment markers inside model strings that must survive.
const jsoncPolicyText = `{
  // Live choice; the alternatives stay in the file, commented out.
  "orchestrator_model": "test/jsonc-orchestrator//not-a-comment",
  // "orchestrator_model": "test/commented-line-orchestrator",
  /* "orchestrator_model": "test/commented-block-orchestrator",
     "reviewer_model": "test/commented-block-reviewer", */
  "reviewer_model": "test/jsonc-reviewer /* not a comment */",
  "max_turns": 3,
}
`;
const jsoncPolicy = { orchestrator_model: "test/jsonc-orchestrator//not-a-comment", reviewer_model: "test/jsonc-reviewer /* not a comment */", max_turns: 3 };
const malformedPolicyText = `{ "orchestrator_model": "test/malformed", /* unterminated\n`;
const defaultJson = ".atomic/goal-select-models.json";
const defaultJsonc = ".atomic/goal-select-models.jsonc";
const jsonPolicyText = `${JSON.stringify({ orchestrator_model: "test/json-orchestrator" })}\n`;

function launchInputs(overrides, definition = goalSelect) {
  const inputs = { objective: "Prove branch checkout routing." };
  for (const [key, schema] of Object.entries(definition.inputs)) {
    if (schema.default !== undefined) inputs[key] = schema.default;
  }
  return { ...inputs, ...overrides };
}

const approve = {
  findings: [],
  overall_correctness: "patch is correct",
  overall_explanation: "Verified in the selected checkout.",
  overall_confidence_score: 0.9,
  goal_oracle_satisfied: true,
  requirements_traceability: [{ requirement: "Stages run in the selected checkout.", status: "proven", evidence: "Adapter test." }],
  receipt_assessment: "Receipt checked.",
  verification_remaining: "",
  stop_review_loop: true,
  reviewer_error: null,
};
const keepGoing = { ...approve, overall_correctness: "patch is incorrect", goal_oracle_satisfied: false, verification_remaining: "More proof needed.", stop_review_loop: false };
function blocking(file) {
  return {
    ...keepGoing,
    findings: [
      {
        title: "Routing is unproven",
        body: "A single low-confidence reviewer finding that must be re-verified.",
        confidence_score: 0.4,
        objective_alignment: "required_by_objective",
        priority: 1,
        code_location: { absolute_file_path: file, line_range: { start: 1, end: 1 } },
      },
    ],
  };
}
// The same open finding at priority 2: not serious enough for an extra round.
function minor(file) {
  const review = blocking(file);
  return { ...review, findings: [{ ...review.findings[0], priority: 2 }] };
}

function fakeContext({ cwd, inputs, onTask = () => ({}), review = () => approve, signal = new AbortController().signal, runId = `goal-select-test-${randomUUID()}`, definition = goalSelect, ui }) {
  const calls = [];
  const ctx = {
    runId,
    cwd,
    inputs: launchInputs(inputs, definition),
    ui,
    async tool(name, args, fn) {
      const call = { kind: "tool", name, args };
      calls.push(call);
      call.result = await fn({ signal });
      return call.result;
    },
    async task(name, options) {
      calls.push({ kind: "task", name, options });
      return { name, text: `${name} done`, ...(await onTask(name, options)) };
    },
    async parallel(steps, options) {
      calls.push({ kind: "parallel", steps, options });
      return steps.map((step) => ({ name: step.name, text: "{}", structured: review(step.name) }));
    },
    async chain() {
      throw new Error("goal-select does not chain stages");
    },
  };
  return { ctx, calls };
}

function modelStages(calls) {
  return calls.flatMap((call) => {
    if (call.kind === "task") return [{ name: call.name, options: call.options }];
    if (call.kind === "parallel") return call.steps.map((step) => ({ name: step.name, options: step }));
    return [];
  });
}

function toolArgs(calls, name) {
  return calls.find((call) => call.kind === "tool" && call.name === name)?.args;
}

async function resolveOnly(cwd, inputs) {
  const { ctx, calls } = fakeContext({ cwd, inputs: { ...inputs, resolve_only: true } });
  const result = await goalSelect.run(ctx);
  assert.deepEqual(modelStages(calls), [], "resolve_only starts no model stage");
  return JSON.parse(result.models);
}


describe("goal-select branch_checkout_dir (adapter tests: fake workflow context and Atomic prompt adapter, no model or TUI)", () => {
  before(() => {
    process.chdir = () => {
      throw new Error("goal-select must not call process.chdir");
    };
    git("init", "--quiet", "--bare", server);
    git("init", "--quiet", "-b", "main", seed);
    git("-C", seed, "commit", "--quiet", "--allow-empty", "-m", "Seed commit");
    git("-C", seed, "remote", "add", "origin", server);
    git("-C", seed, "push", "--quiet", "origin", "main");
    git("bc-add", "--offline", seed, cloneBranch, clone);
    writeJson(join(seed, ".atomic", "goal-select-models.json"), { orchestrator_model: "test/seed-orchestrator" });
    writeJson(join(clone, ".atomic", "goal-select-models.json"), { orchestrator_model: "test/clone-orchestrator", reviewer_model: "test/clone-reviewer" });
    writeJson(absolutePolicy, { orchestrator_model: "test/absolute-orchestrator" });
    mkdirSync(plainDir);
    writeFileSync(plainFile, "not a checkout\n");
  });

  after(() => {
    process.chdir = originalChdir;
    rmSync(root, { recursive: true, force: true });
  });

  it("declares branch_checkout_dir and no worktree input or binding", () => {
    const input = goalSelect.inputs.branch_checkout_dir;
    assert.equal(input.type, "string");
    assert.equal(input.default, "auto");
    assert.match(input.description, /git bc-add/);
    assert.match(input.description, /parent of the invoking directory/);
    assert.equal("git_worktree_dir" in goalSelect.inputs, false);
    assert.deepEqual(Object.keys(goalSelect.inputs).filter((key) => /worktree/i.test(key)), []);
    assert.equal(goalSelect.inputBindings, undefined);
  });

  it("uses the invoking checkout when branch_checkout_dir is blank, reading an explicit legacy project-local policy there", async () => {
    for (const blank of ["", "   "]) {
      const models = await resolveOnly(seed, { branch_checkout_dir: blank, model_policy_path: defaultJson });
      assert.equal(models.checkout, seed);
      assert.equal(models.launch.policyPath, join(seed, ".atomic", "goal-select-models.json"));
      assert.equal(models.policy.orchestrator_model, "test/seed-orchestrator");
    }
  });

  it("accepts the invoking checkout named explicitly, absolute or by its relative basename", async () => {
    assert.equal((await resolveOnly(seed, { branch_checkout_dir: seed })).checkout, seed);
    assert.equal((await resolveOnly(seed, { branch_checkout_dir: "seed" })).checkout, seed);
    assert.equal((await resolveOnly(clone, { branch_checkout_dir: "seed" })).checkout, seed);
  });

  it("accepts a git bc-add branch clone by absolute path containing spaces, reading an explicit legacy project-local policy there", async () => {
    const models = await resolveOnly(seed, { branch_checkout_dir: clone, model_policy_path: defaultJson });
    assert.equal(models.checkout, clone);
    assert.equal(models.policy.orchestrator_model, "test/clone-orchestrator");
  });

  it("resolves a relative sibling name from the parent of the invoking directory", async () => {
    assert.equal(dirname(clone), dirname(seed), "fixture clone is a true sibling of the seed");
    assert.equal((await resolveOnly(seed, { branch_checkout_dir: "seed feature" })).checkout, clone);
    assert.equal((await resolveOnly(seed, { branch_checkout_dir: "./seed feature" })).checkout, clone);
    assert.equal(existsSync(join(seed, "seed feature")), false, "sibling name is not nested in the seed");
  });

  it("treats '.' as the parent of the invoking directory, not the seed", async () => {
    const { ctx, calls } = fakeContext({ cwd: seed, inputs: { branch_checkout_dir: ".", resolve_only: true } });
    await assert.rejects(goalSelect.run(ctx), (error) => {
      assert.ok(error.message.includes(`branch_checkout_dir "." resolved to ${root}, which is not inside a Git checkout`), error.message);
      return true;
    });
    assert.deepEqual(modelStages(calls), []);
  });

  it("reads a relative policy path from the selected checkout and keeps an absolute one", async () => {
    const relativePolicy = await resolveOnly(seed, { branch_checkout_dir: clone, model_policy_path: ".atomic/goal-select-models.json" });
    assert.equal(relativePolicy.launch.policyPath, join(clone, ".atomic", "goal-select-models.json"));
    assert.equal(relativePolicy.policy.reviewer_model, "test/clone-reviewer");
    const absolute = await resolveOnly(seed, { branch_checkout_dir: clone, model_policy_path: absolutePolicy });
    assert.equal(absolute.launch.policyPath, absolutePolicy);
    assert.equal(absolute.policy.orchestrator_model, "test/absolute-orchestrator");
  });

  it("resolves a JSONC policy for an explicit checkout under resolve_only, and still returns an empty policy for a malformed one", async () => {
    writeFileSync(join(clone, ".atomic", "jsonc-resolve.json"), jsoncPolicyText);
    writeFileSync(join(clone, ".atomic", "malformed-resolve.json"), malformedPolicyText);
    const jsonc = await resolveOnly(seed, { branch_checkout_dir: clone, model_policy_path: ".atomic/jsonc-resolve.json" });
    assert.equal(jsonc.launch.policyPath, join(clone, ".atomic", "jsonc-resolve.json"));
    assert.deepEqual(jsonc.policy, jsoncPolicy);
    const malformed = await resolveOnly(seed, { branch_checkout_dir: clone, model_policy_path: ".atomic/malformed-resolve.json" });
    assert.deepEqual(malformed.policy, {});
  });

  it("reads a JSONC policy before every turn, and falls back to the launch inputs on a turn whose policy is malformed", async () => {
    const policyPath = join(clone, ".atomic", "jsonc-turns.json");
    writeFileSync(policyPath, jsoncPolicyText);
    const launch = { reviewer_model: "test/launch-reviewer", risk_reviewer_model: "test/launch-risk" };
    const { ctx, calls } = fakeContext({
      cwd: seed,
      inputs: { branch_checkout_dir: clone, model_policy_path: ".atomic/jsonc-turns.json", ...launch },
      onTask: (name) => {
        if (name === "orchestrator-1") writeFileSync(policyPath, malformedPolicyText);
        return {};
      },
      review: (name) => (name.endsWith("-1") ? keepGoing : approve),
    });
    const result = await goalSelect.run(ctx);
    assert.equal(result.status, "complete");
    const byName = Object.fromEntries(modelStages(calls).map((stage) => [stage.name, stage.options]));
    assert.equal(byName["orchestrator-1"].model, jsoncPolicy.orchestrator_model);
    for (const role of ["completion", "evidence", "risk"]) assert.equal(byName[`${role}-reviewer-1`].model, jsoncPolicy.reviewer_model, `${role}: the file's top-level reviewer_model beats the launch inputs`);
    assert.equal(byName["orchestrator-2"].model, goalSelect.inputs.orchestrator_model.default);
    for (const role of ["completion", "evidence"]) assert.equal(byName[`${role}-reviewer-2`].model, launch.reviewer_model, role);
    assert.equal(byName["risk-reviewer-2"].model, launch.risk_reviewer_model, "a malformed turn falls back to the launch risk reviewer, not the generic reviewer_model");
    const turnPolicy = (turn) => calls.find((call) => call.name === `resolve-models-${turn}`).result;
    assert.equal(turnPolicy(1).maxTurns, 3);
    assert.equal(turnPolicy(2).orchestrator, undefined, "a malformed turn has no override of its own");
    assert.deepEqual(turnPolicy(2).reviewTiers, sharedPolicy.review_tiers, "a malformed turn still inherits the shared tiers");
    assert.equal(turnPolicy(2).defaults.orchestrator, sharedPolicy.defaults.orchestrator_model);
  });

  function policyCheckout(name, files) {
    const dir = join(root, name);
    git("init", "--quiet", "-b", "main", dir);
    mkdirSync(join(dir, ".atomic"), { recursive: true });
    for (const [path, text] of Object.entries(files)) writeFileSync(join(dir, path), text);
    return dir;
  }
  const launchOrchestrator = () => goalSelect.inputs.orchestrator_model.default;

  it("defaults model_policy_path to the shared goal-select.jsonc, so an omitted path selects the shared policy", () => {
    const input = goalSelect.inputs.model_policy_path;
    assert.equal(input.default, sharedDefaultPath);
    assert.equal(launchInputs({}).model_policy_path, sharedDefaultPath);
    assert.deepEqual(modelPolicyPaths(undefined), [sharedDefaultPath]);
    assert.deepEqual(modelPolicyPaths(defaultJson), [defaultJson]);
    assert.equal(defaultPolicyPath(), sharedDefaultPath);
    assert.equal(sharedPolicyDir(), sharedDir);
    assert.match(input.description, /~\/\.config\/atomic\/goal-select\.jsonc/);
    assert.match(input.description, /defaults block seeds the launch form/);
    assert.match(input.description, /review_tiers block defines the tiers/);
    assert.match(input.description, /relative path is read inside the checkout/);
    assert.doesNotMatch(input.description, /goal-select-models\/|sol-astra/);
    assert.doesNotMatch(goalSelect.description, /goal-select-models\/|sol-astra/);
  });

  it("ships the shared goal-select.jsonc with its defaults and three review tiers, the complex one with two seats", () => {
    const shipped = fileURLToPath(new URL("../../../../.config/atomic/goal-select.jsonc", import.meta.url));
    const text = readFileSync(shipped, "utf8");
    assert.match(text, /^\s*\/\//m, "the shipped file keeps its comments");
    // Its writer_fallbacks block is checked with the writer fallback chain.
    const { writer_fallbacks: _chains, ...dials } = parseModelPolicy(text);
    const complex = { ...sharedPolicy.review_tiers.complex, panel: 2 };
    assert.deepEqual(dials, { ...sharedPolicy, review_tiers: { ...sharedPolicy.review_tiers, complex } });
    const seats = (tier) => policyReviewTier(dials, tier);
    assert.deepEqual(seats("complex").roles, seats("standard").roles, "the complex tier has the standard tier's two seats");
    assert.equal(seats("complex").quorum, 2, "and both must approve");
  });

  it("resolves an omitted model_policy_path to the shared goal-select.jsonc under resolve_only and on a real turn 1, reading no project file", async () => {
    for (const [label, files] of [
      ["no project policy", {}],
      ["project .atomic policies present", { [defaultJson]: jsonPolicyText, [defaultJsonc]: jsoncPolicyText }],
    ]) {
      const dir = policyCheckout(`omitted policy ${label}`, files);
      const resolved = await resolveOnly(seed, { branch_checkout_dir: dir, model_policy_path: undefined });
      assert.equal(resolved.checkout, dir, label);
      assert.equal(resolved.launch.policyPath, sharedDefaultPath, label);
      assert.equal("policyFallbackPath" in resolved.launch, false, label);
      assert.deepEqual(resolved.policy, sharedPolicy, label);
      assert.equal(resolved.policy_source, sharedDefaultPath, label);

      const { ctx, calls } = fakeContext({ cwd: seed, inputs: { branch_checkout_dir: dir, model_policy_path: undefined } });
      assert.equal((await goalSelect.run(ctx)).status, "complete", label);
      const byName = Object.fromEntries(modelStages(calls).map((stage) => [stage.name, stage.options]));
      const complex = sharedPolicy.review_tiers.complex;
      assert.equal(byName["orchestrator-1"].model, sharedPolicy.defaults.orchestrator_model, `${label}: turn 1 matches resolve_only`);
      for (const role of ["completion", "evidence"]) assert.equal(byName[`${role}-reviewer-1`].model, complex.reviewer_model, `${label} ${role}`);
      assert.equal(byName["risk-reviewer-1"].model, complex.risk_reviewer_model, `${label} risk`);
      assert.deepEqual(toolArgs(calls, "resolve-models-1"), { path: sharedDefaultPath, turn: 1 }, label);
      assert.deepEqual(readdirSync(join(dir, ".atomic")).sort(), Object.keys(files).map((path) => basename(path)).sort(), `${label}: nothing written`);
    }
  });

  it("falls back to the launch inputs on a turn whose shared policy is missing or malformed, with no substitute file", async () => {
    const dir = policyCheckout("omitted policy shared unreadable", {});
    for (const [label, setup] of [
      ["missing", (shared) => mkdirSync(dirname(shared), { recursive: true })],
      ["malformed", (shared) => writeJsonText(shared, malformedPolicyText)],
    ]) {
      const altShared = join(root, `home ${label}`, ".config", "atomic", "goal-select.jsonc");
      writeJson(join(dirname(altShared), "goal-select-models", "sol-astra.json"), solAstra);
      setup(altShared);
      process.env.HOME = join(root, `home ${label}`);
      try {
        const resolved = await resolveOnly(seed, { branch_checkout_dir: dir, model_policy_path: undefined });
        assert.equal(resolved.launch.policyPath, altShared, label);
        assert.equal("policyFallbackPath" in resolved.launch, false, label);
        assert.deepEqual(resolved.policy, {}, label);
        assert.equal(resolved.policy_source, label === "missing" ? null : altShared, label);

        const { ctx, calls } = fakeContext({ cwd: seed, inputs: { branch_checkout_dir: dir, model_policy_path: undefined } });
        assert.equal((await goalSelect.run(ctx)).status, "complete", label);
        const byName = Object.fromEntries(modelStages(calls).map((stage) => [stage.name, stage.options]));
        assert.equal(byName["orchestrator-1"].model, launchOrchestrator(), `${label}: the prefilled launch input applies`);
        for (const role of ["completion", "evidence", "risk"]) assert.equal(byName[`${role}-reviewer-1`].model, builtinModels.reviewer, `${label} ${role}: no tier models, not the old preset's`);
        assert.deepEqual(toolArgs(calls, "resolve-models-1"), { path: altShared, turn: 1 }, label);
        assert.deepEqual(readdirSync(join(dir, ".atomic")), [], `${label}: nothing written`);
      } finally {
        process.env.HOME = home;
      }
    }
  });

  it("re-resolves the shared goal-select.jsonc before every turn: shipped, then an edited copy, then shipped again", async () => {
    const dir = policyCheckout("shared policy turns", {});
    // An edit made mid-run: a top-level orchestrator override and a complex
    // tier with only a generic reviewer.
    const edited = { orchestrator_model: "kimi-coding/k3:high", review_tiers: { complex: { reviewer_model: "anthropic/claude-opus-5-5:high", max_turns: 3 } } };
    const { ctx, calls } = fakeContext({
      cwd: seed,
      inputs: { branch_checkout_dir: dir, model_policy_path: undefined },
      onTask: (name) => {
        if (name === "orchestrator-1") writeJson(sharedDefaultPath, edited);
        if (name === "orchestrator-2") writeJson(sharedDefaultPath, sharedPolicy);
        return {};
      },
      review: (name) => (name.endsWith("-3") ? approve : keepGoing),
    });
    try {
      const result = await goalSelect.run(ctx);
      assert.equal(result.status, "complete");
      const byName = Object.fromEntries(modelStages(calls).map((stage) => [stage.name, stage.options]));
      const complex = sharedPolicy.review_tiers.complex;
      assert.equal(byName["orchestrator-1"].model, sharedPolicy.defaults.orchestrator_model);
      assert.equal(byName["completion-reviewer-1"].model, complex.reviewer_model);
      assert.equal(byName["risk-reviewer-1"].model, complex.risk_reviewer_model);
      assert.equal(byName["orchestrator-2"].model, edited.orchestrator_model, "a top-level key overrides the running launch input");
      assert.equal(byName["completion-reviewer-2"].model, edited.review_tiers.complex.reviewer_model);
      assert.equal(byName["risk-reviewer-2"].model, edited.review_tiers.complex.reviewer_model, "the whole file is replaced, without merging the shipped risk model");
      assert.equal(byName["orchestrator-3"].model, sharedPolicy.defaults.orchestrator_model, "the launch input returns once the override is gone");
      assert.equal(byName["completion-reviewer-3"].model, complex.reviewer_model);
      assert.equal(byName["risk-reviewer-3"].model, complex.risk_reviewer_model);
      const turnPolicy = (turn) => calls.find((call) => call.name === `resolve-models-${turn}`).result;
      assert.equal(turnPolicy(1).maxTurns, undefined, "the shipped file sets no top-level max_turns");
      assert.deepEqual(turnPolicy(1).reviewTiers, sharedPolicy.review_tiers, "the tiers come from the shared file on turn 1");
      for (const turn of [1, 2, 3]) assert.deepEqual(toolArgs(calls, `resolve-models-${turn}`), { path: sharedDefaultPath, turn });
    } finally {
      writeJson(sharedDefaultPath, sharedPolicy);
    }
  });

  it("keeps explicit policy paths exact, including the default .json name, with no .jsonc fallback", async () => {
    const dir = policyCheckout("explicit policy paths", { [defaultJsonc]: jsoncPolicyText });
    const explicitJson = await resolveOnly(seed, { branch_checkout_dir: dir, model_policy_path: defaultJson });
    assert.equal(explicitJson.launch.policyPath, join(dir, defaultJson));
    assert.equal("policyFallbackPath" in explicitJson.launch, false);
    assert.deepEqual(explicitJson.policy, {});
    assert.equal(explicitJson.policy_source, null);
    const { ctx, calls } = fakeContext({ cwd: seed, inputs: { branch_checkout_dir: dir, model_policy_path: defaultJson } });
    await goalSelect.run(ctx);
    assert.equal(modelStages(calls)[0].options.model, launchOrchestrator());
    assert.deepEqual(toolArgs(calls, "resolve-models-1"), { path: join(dir, defaultJson), turn: 1 });

    writeFileSync(join(dir, defaultJson), jsonPolicyText);
    for (const path of [defaultJsonc, join(dir, defaultJsonc)]) {
      const explicitJsonc = await resolveOnly(seed, { branch_checkout_dir: dir, model_policy_path: path });
      assert.equal(explicitJsonc.launch.policyPath, join(dir, defaultJsonc), path);
      assert.deepEqual(explicitJsonc.policy, jsoncPolicy, `${path}: an explicit .jsonc is read even beside a .json`);
      assert.equal(explicitJsonc.policy_source, join(dir, defaultJsonc), path);
    }
  });

  it("keeps an explicitly supplied empty or whitespace model_policy_path as a literal relative path, with no default policy", async () => {
    const spaces = "  ";
    const dir = policyCheckout("explicit blank policy paths", { [defaultJson]: jsonPolicyText, [defaultJsonc]: jsoncPolicyText, [spaces]: jsoncPolicyText });

    const empty = await resolveOnly(seed, { branch_checkout_dir: dir, model_policy_path: "" });
    assert.equal(empty.launch.policyPath, dir);
    assert.equal("policyFallbackPath" in empty.launch, false);
    assert.deepEqual(empty.policy, {});
    const emptyRun = fakeContext({ cwd: seed, inputs: { branch_checkout_dir: dir, model_policy_path: "" } });
    await goalSelect.run(emptyRun.ctx);
    assert.equal(modelStages(emptyRun.calls)[0].options.model, launchOrchestrator());
    assert.deepEqual(toolArgs(emptyRun.calls, "resolve-models-1"), { path: dir, turn: 1 });

    const named = await resolveOnly(seed, { branch_checkout_dir: dir, model_policy_path: spaces });
    assert.equal(named.launch.policyPath, join(dir, spaces));
    assert.equal("policyFallbackPath" in named.launch, false);
    assert.deepEqual(named.policy, jsoncPolicy);
    assert.equal(named.policy_source, join(dir, spaces));
    const namedRun = fakeContext({ cwd: seed, inputs: { branch_checkout_dir: dir, model_policy_path: spaces } });
    await goalSelect.run(namedRun.ctx);
    assert.equal(modelStages(namedRun.calls)[0].options.model, jsoncPolicy.orchestrator_model);
    assert.deepEqual(toolArgs(namedRun.calls, "resolve-models-1"), { path: join(dir, spaces), turn: 1 });
  });

  it("Atomic's runtime accepts an omitted model_policy_path and resolves the shared goal-select.jsonc, under resolve_only and on turn 1", async () => {
    const dir = policyCheckout("runtime omitted policy", { [defaultJsonc]: jsoncPolicyText });
    const seen = [];
    const adapters = { prompt: { prompt: async (_text, meta) => (seen.push([meta.stageName, meta.stageOptions?.cwd, meta.stageOptions?.model]), "done") } };
    const options = { durability: { mode: "memory" }, cwd: seed, adapters };
    const resolved = await run(goalSelect, { objective: "probe", branch_checkout_dir: dir, resolve_only: true }, options);
    assert.equal(resolved.status, "completed");
    const models = JSON.parse(resolved.result.models);
    assert.deepEqual(models.policy, sharedPolicy);
    assert.equal(models.policy_source, sharedDefaultPath);
    assert.equal(models.launch.reviewTier, sharedPolicy.defaults.review_tier, "Atomic applies the prefilled review tier");
    assert.deepEqual(seen, []);
    await run(goalSelect, { objective: "probe", branch_checkout_dir: dir }, options);
    assert.deepEqual(seen[0], ["orchestrator-1", dir, sharedPolicy.defaults.orchestrator_model]);
  });



  it("selects a preset dropped into the library directory by editing only the filename, with no registration", async () => {
    const dropped = join(presetLibrary, "ora-tempo.json");
    writeJson(dropped, { orchestrator_model: "test/dropped-preset", max_turns: 7 });
    try {
      const resolved = await resolveOnly(seed, { branch_checkout_dir: clone, model_policy_path: dropped });
      assert.deepEqual(resolved.policy, { orchestrator_model: "test/dropped-preset", max_turns: 7 });
      const { ctx, calls } = fakeContext({ cwd: seed, inputs: { branch_checkout_dir: clone, model_policy_path: dropped } });
      assert.equal((await goalSelect.run(ctx)).status, "complete");
      assert.equal(modelStages(calls)[0].options.model, "test/dropped-preset");
    } finally {
      rmSync(dropped, { force: true });
    }
  });

  for (const [label, input, reason] of [
    ["a missing path", missing, /does not exist/],
    ["a file", plainFile, /is not a directory/],
    ["a directory outside Git", plainDir, /is not inside a Git checkout/],
  ]) {
    it(`fails on ${label} before any model stage`, async () => {
      for (const resolve_only of [false, true]) {
        const { ctx, calls } = fakeContext({ cwd: seed, inputs: { branch_checkout_dir: input, resolve_only } });
        await assert.rejects(goalSelect.run(ctx), (error) => {
          assert.match(error.message, reason);
          assert.ok(error.message.includes(`branch_checkout_dir "${input}" resolved to ${input}`), error.message);
          return true;
        });
        assert.deepEqual(modelStages(calls), []);
        assert.deepEqual(calls.map((call) => call.name), ["resolve-branch-checkout"]);
      }
    });
  }

  it("does not create a missing checkout", async () => {
    const { ctx } = fakeContext({ cwd: seed, inputs: { branch_checkout_dir: "missing clone" } });
    await assert.rejects(goalSelect.run(ctx), (error) => error.message.includes(`resolved to ${missing}, which does not exist`));
    assert.equal(existsSync(missing), false);
  });

  it("cancels checkout resolution before starting any model stage", async () => {
    const controller = new AbortController();
    controller.abort();
    const { ctx, calls } = fakeContext({ cwd: seed, inputs: { branch_checkout_dir: clone }, signal: controller.signal });
    await assert.rejects(goalSelect.run(ctx), { name: "AbortError" });
    assert.deepEqual(calls.map((call) => call.name), ["resolve-branch-checkout"]);
    assert.deepEqual(modelStages(calls), []);
  });

  it("runs the orchestrator, every reviewer, re-verifiers and the pull-request stage in the selected clone", async () => {
    const policyPath = join(clone, ".atomic", "routing-policy.json");
    const sessionFile = join(root, "orchestrator-1.jsonl");
    // A stage's transcript is there to be read: one that is named and missing closes the run.
    writeJson(sessionFile, { type: "session", version: 3, id: "orchestrator-1", cwd: clone });
    writeJson(policyPath, { orchestrator_model: "test/routing-orchestrator" });
    const { ctx, calls } = fakeContext({
      cwd: seed,
      inputs: { branch_checkout_dir: "seed feature", model_policy_path: ".atomic/routing-policy.json", create_pr: true },
      onTask: (name) => {
        if (name === "orchestrator-1") {
          writeJson(policyPath, { orchestrator_model: "test/turn-2-orchestrator" });
          return { sessionFile };
        }
        if (name.startsWith("reverify-")) return { structured: { score: 15, evidence: ["Confirmed."] } };
        return {};
      },
      review: (name) => {
        if (name === "risk-reviewer-1") return blocking(join(clone, "README.md"));
        return name.endsWith("-1") ? keepGoing : approve;
      },
    });
    const result = await goalSelect.run(ctx);
    assert.equal(result.status, "complete");
    assert.equal(result.pr_report, "pull-request done");
    assert.ok(result.ledger_path.startsWith(join(root, "artifacts")), result.ledger_path);

    const stages = modelStages(calls);
    assert.deepEqual(
      stages.map((stage) => stage.name),
      [
        "orchestrator-1",
        "completion-reviewer-1",
        "evidence-reviewer-1",
        "risk-reviewer-1",
        "reverify-1",
        "reverify-2",
        "reverify-3",
        "orchestrator-2",
        "completion-reviewer-2",
        "evidence-reviewer-2",
        "risk-reviewer-2",
        "pull-request",
      ],
    );
    for (const stage of stages) {
      assert.equal(stage.options.cwd, clone, `${stage.name} cwd`);
      for (const key of ["worktree", "gitWorktreeDir", "baseBranch"]) assert.equal(key in stage.options, false, `${stage.name} ${key}`);
    }

    const byName = Object.fromEntries(stages.map((stage) => [stage.name, stage.options]));
    assert.ok(byName["orchestrator-1"].prompt.includes(`Current working directory: ${clone}`));
    assert.ok(byName["orchestrator-1"].prompt.includes("pass it to delegated agents"));
    assert.ok(byName["pull-request"].prompt.includes(`Current working directory: ${clone}`));
    assert.equal(byName["orchestrator-1"].model, "test/routing-orchestrator");
    assert.equal(byName["orchestrator-2"].model, "test/turn-2-orchestrator");
    assert.equal(byName["orchestrator-2"].context, "fork");
    assert.equal(byName["orchestrator-2"].forkFromSessionFile, sessionFile);
    assert.equal(byName["pull-request"].model, "test/turn-2-orchestrator");
    assert.equal(toolArgs(calls, "resolve-models-1").path, policyPath);
    assert.equal(toolArgs(calls, "resolve-models-2").path, policyPath);
    assert.deepEqual(toolArgs(calls, "resolve-branch-checkout"), { branch_checkout_dir: "seed feature", invocation_cwd: seed });
    assert.equal(calls[0].name, "resolve-branch-checkout");
  });

  it("keeps the pull-request stage behind create_pr", async () => {
    const { ctx, calls } = fakeContext({ cwd: seed, inputs: { branch_checkout_dir: clone } });
    const result = await goalSelect.run(ctx);
    assert.equal(result.status, "complete");
    const stages = modelStages(calls);
    assert.deepEqual(stages.map((stage) => stage.name), ["orchestrator-1", "completion-reviewer-1", "evidence-reviewer-1", "risk-reviewer-1"]);
    assert.ok(stages.every((stage) => stage.options.cwd === clone));
  });

  describe("review tiers, round cap and lineage guard", () => {
    // Test models in every tier, so each stage shows which layer chose its model.
    const tierPolicy = {
      review_tiers: {
        simple: { panel: 1, reviewer_model: "test/simple-reviewer", max_turns: 2 },
        standard: { panel: 2, reviewer_model: "test/standard-reviewer", risk_reviewer_model: "test/standard-risk", max_turns: 3 },
        complex: { panel: 3, reviewer_model: "test/complex-reviewer", completion_reviewer_model: "test/complex-completion", risk_reviewer_model: "test/complex-risk", max_turns: 4 },
      },
    };
    const readme = join(clone, "README.md");
    function tierRun(name, { policy = tierPolicy, inputs = {}, onTask, ...rest } = {}) {
      const path = join(clone, ".atomic", `tiers ${name}.jsonc`);
      writeJson(path, policy);
      return fakeContext({
        cwd: seed,
        inputs: { branch_checkout_dir: clone, model_policy_path: path, ...inputs },
        onTask: (stage, options) => (stage.startsWith("reverify-") ? { structured: { score: 15, evidence: ["Confirmed."] } } : (onTask?.(stage, options) ?? {})),
        ...rest,
      });
    }
    // Orchestrator and reviewer stages; re-verifiers run only when findings need them.
    const goalStages = (calls) => modelStages(calls).filter((stage) => !stage.name.startsWith("reverify-"));
    const stageNames = (calls) => goalStages(calls).map((stage) => stage.name);
    const reviewerModels = (calls) => Object.fromEntries(goalStages(calls).filter((stage) => !stage.name.startsWith("orchestrator-")).map((stage) => [stage.name, stage.options.model]));
    const ledgerOf = (result) => JSON.parse(readFileSync(join(dirname(result.ledger_path), "goal-ledger-state.json"), "utf8"));
    const votes = (result) => ledgerOf(result).decisions.map((decision) => [decision.turn, decision.decision, decision.complete_votes, decision.review_quorum]);
    const findingLine = (priority, reviewer) => `- [P${priority}] Routing is unproven (${reviewer}): A single low-confidence reviewer finding that must be re-verified.`;

    it("runs the simple tier as one reviewer whose approval alone completes the round", async () => {
      const { ctx, calls } = tierRun("simple panel", { inputs: { review_tier: "simple" } });
      const result = await goalSelect.run(ctx);
      assert.equal(result.status, "complete");
      assert.deepEqual(stageNames(calls), ["orchestrator-1", "reviewer-1"]);
      assert.deepEqual(votes(result), [[1, "complete", 1, 1]]);
    });

    it("runs the standard tier as completion and risk reviewers that must both approve, the completion reviewer also owning evidence", async () => {
      const { ctx, calls } = tierRun("standard panel", { inputs: { review_tier: "standard" }, review: (name) => (name === "risk-reviewer-1" ? keepGoing : approve) });
      const result = await goalSelect.run(ctx);
      assert.equal(result.status, "complete");
      assert.deepEqual(stageNames(calls), ["orchestrator-1", "completion-reviewer-1", "risk-reviewer-1", "orchestrator-2", "completion-reviewer-2", "risk-reviewer-2"]);
      assert.deepEqual(votes(result), [[1, "continue", 1, 2], [2, "complete", 2, 2]]);
      const byName = Object.fromEntries(goalStages(calls).map((stage) => [stage.name, stage.options]));
      assert.ok(byName["completion-reviewer-1"].task.includes("Also owns evidence validity for the current checkout"), byName["completion-reviewer-1"].task);
      assert.equal(byName["risk-reviewer-1"].task.includes("owns evidence validity"), false);
    });

    it("runs the complex tier as completion, evidence and risk reviewers, two of three completing the round", async () => {
      const { ctx, calls } = tierRun("complex panel", {
        inputs: { review_tier: "complex" },
        review: (name) => (name === "completion-reviewer-1" || name === "risk-reviewer-2" || name === "completion-reviewer-2" ? approve : keepGoing),
      });
      const result = await goalSelect.run(ctx);
      assert.equal(result.status, "complete");
      assert.deepEqual(stageNames(calls), [
        "orchestrator-1",
        "completion-reviewer-1",
        "evidence-reviewer-1",
        "risk-reviewer-1",
        "orchestrator-2",
        "completion-reviewer-2",
        "evidence-reviewer-2",
        "risk-reviewer-2",
      ]);
      assert.deepEqual(votes(result), [[1, "continue", 1, 2], [2, "complete", 2, 2]]);
    });

    it("lets a tier entry set its panel size and quorum", async () => {
      const policy = { review_tiers: { standard: { panel: 3, reviewer_model: "test/standard-reviewer" }, complex: { quorum: 3, reviewer_model: "test/complex-reviewer" } } };
      const widened = tierRun("panel override", { policy, inputs: { review_tier: "standard" } });
      const widenedResult = await goalSelect.run(widened.ctx);
      assert.deepEqual(stageNames(widened.calls), ["orchestrator-1", "completion-reviewer-1", "evidence-reviewer-1", "risk-reviewer-1"]);
      assert.deepEqual(votes(widenedResult), [[1, "complete", 3, 2]], "the standard tier's quorum of two stays");

      const strict = tierRun("quorum override", { policy, inputs: { review_tier: "complex" }, review: (name) => (name === "evidence-reviewer-1" ? keepGoing : approve) });
      const strictResult = await goalSelect.run(strict.ctx);
      assert.equal(strictResult.status, "complete");
      assert.deepEqual(votes(strictResult), [[1, "continue", 2, 3], [2, "complete", 3, 3]]);
    });

    it("takes each tier's reviewer models from the shared goal-select.jsonc", async () => {
      const { simple, standard, complex } = sharedPolicy.review_tiers;
      for (const [tier, expected] of [
        ["simple", { "reviewer-1": simple.reviewer_model }],
        ["standard", { "completion-reviewer-1": standard.reviewer_model, "risk-reviewer-1": standard.risk_reviewer_model }],
        ["complex", { "completion-reviewer-1": complex.reviewer_model, "evidence-reviewer-1": complex.reviewer_model, "risk-reviewer-1": complex.risk_reviewer_model }],
      ]) {
        const { ctx, calls } = fakeContext({ cwd: seed, inputs: { branch_checkout_dir: clone, review_tier: tier } });
        assert.equal((await goalSelect.run(ctx)).status, "complete", tier);
        assert.deepEqual(reviewerModels(calls), expected, tier);
        assert.equal(toolArgs(calls, "resolve-models-1").path, sharedDefaultPath, tier);
      }
    });

    it("ranks reviewer models: a policy file's top-level key, then a launch per-role input, then launch reviewer_model, then the tier's per-role model, then its reviewer_model", async () => {
      const launch = { reviewer_model: "test/launch-reviewer" };
      for (const [label, tier, policy, inputs, expected] of [
        ["tier per-role over tier reviewer_model", "complex", tierPolicy, {}, { "completion-reviewer-1": "test/complex-completion", "evidence-reviewer-1": "test/complex-reviewer", "risk-reviewer-1": "test/complex-risk" }],
        ["tier models for standard", "standard", tierPolicy, {}, { "completion-reviewer-1": "test/standard-reviewer", "risk-reviewer-1": "test/standard-risk" }],
        ["tier model for simple", "simple", tierPolicy, {}, { "reviewer-1": "test/simple-reviewer" }],
        ["launch reviewer_model over every tier model", "complex", tierPolicy, launch, { "completion-reviewer-1": "test/launch-reviewer", "evidence-reviewer-1": "test/launch-reviewer", "risk-reviewer-1": "test/launch-reviewer" }],
        ["launch reviewer_model over the simple tier", "simple", tierPolicy, launch, { "reviewer-1": "test/launch-reviewer" }],
        ["launch per-role over launch reviewer_model", "complex", tierPolicy, { ...launch, risk_reviewer_model: "test/launch-risk" }, { "completion-reviewer-1": "test/launch-reviewer", "evidence-reviewer-1": "test/launch-reviewer", "risk-reviewer-1": "test/launch-risk" }],
        ["launch per-role over the tier", "standard", tierPolicy, { completion_reviewer_model: "test/launch-completion" }, { "completion-reviewer-1": "test/launch-completion", "risk-reviewer-1": "test/standard-risk" }],
        [
          "file per-role over launch per-role",
          "complex",
          { ...tierPolicy, risk_reviewer_model: "test/file-risk" },
          { ...launch, risk_reviewer_model: "test/launch-risk" },
          { "completion-reviewer-1": "test/launch-reviewer", "evidence-reviewer-1": "test/launch-reviewer", "risk-reviewer-1": "test/file-risk" },
        ],
        [
          "file reviewer_model over launch per-role",
          "complex",
          { ...tierPolicy, reviewer_model: "test/file-reviewer" },
          { ...launch, completion_reviewer_model: "test/launch-completion" },
          { "completion-reviewer-1": "test/file-reviewer", "evidence-reviewer-1": "test/file-reviewer", "risk-reviewer-1": "test/file-reviewer" },
        ],
        ["file reviewer_model over launch for the simple tier", "simple", { ...tierPolicy, reviewer_model: "test/file-reviewer" }, launch, { "reviewer-1": "test/file-reviewer" }],
        ["file review_tier over the launch tier", "simple", { ...tierPolicy, review_tier: "standard" }, {}, { "completion-reviewer-1": "test/standard-reviewer", "risk-reviewer-1": "test/standard-risk" }],
      ]) {
        const { ctx, calls } = tierRun(label, { policy, inputs: { review_tier: tier, ...inputs } });
        assert.equal((await goalSelect.run(ctx)).status, "complete", label);
        assert.deepEqual(reviewerModels(calls), expected, label);
      }
    });

    it("caps rounds at the tier's max_turns when max_turns is empty, lets an explicit max_turns win, and a policy file's top-level max_turns win over both", async () => {
      const uncapped = { review_tiers: { simple: { reviewer_model: "test/simple-reviewer" } } };
      for (const [label, policy, inputs, rounds] of [
        ["empty: the tier's cap", tierPolicy, {}, 2],
        ["explicit lower", tierPolicy, { max_turns: 1 }, 1],
        ["explicit higher", tierPolicy, { max_turns: 3 }, 3],
        ["empty with no tier cap: 3", uncapped, {}, 3],
        ["file top-level over explicit", { ...tierPolicy, max_turns: 1 }, { max_turns: 3 }, 1],
      ]) {
        const { ctx, calls } = tierRun(label, { policy, inputs: { review_tier: "simple", ...inputs }, review: () => keepGoing });
        const result = await goalSelect.run(ctx);
        assert.equal(result.status, "handover", label);
        assert.equal(result.turns_completed, rounds, label);
        assert.deepEqual(stageNames(calls), Array.from({ length: rounds }, (_, index) => [`orchestrator-${index + 1}`, `reviewer-${index + 1}`]).flat(), label);
        assert.ok(result.result.includes("## Open findings at handover\n- none recorded"), `${label}: ${result.result}`);
      }
    });

    it("hands over at the round cap with the last round's open findings in the decision and the final report", async () => {
      const { ctx, calls } = tierRun("handover", {
        inputs: { review_tier: "complex", max_turns: 1 },
        review: (name) => (name === "risk-reviewer-1" ? minor(readme) : keepGoing),
      });
      const result = await goalSelect.run(ctx);
      assert.equal(result.status, "handover");
      assert.equal(result.approved, false);
      assert.deepEqual(stageNames(calls), ["orchestrator-1", "completion-reviewer-1", "evidence-reviewer-1", "risk-reviewer-1"]);
      const ledger = ledgerOf(result);
      assert.equal(ledger.status, "handover");
      const [decision] = ledger.decisions;
      assert.equal(decision.decision, "handover");
      assert.equal(decision.extra_round, undefined);
      assert.deepEqual(decision.open_findings, [findingLine(2, "risk-reviewer")]);
      assert.match(decision.reason, /^Review rounds used \(1\) without reviewer quorum; handed over with open findings\./);
      assert.ok(result.result.includes("## Final status\nhandover"), result.result);
      assert.ok(result.result.endsWith(`## Open findings at handover\n${findingLine(2, "risk-reviewer")}`), result.result);
    });

    it("grants one extra round when the capped round left a P1 open, then hands over with it still open", async () => {
      const { ctx, calls } = tierRun("extra round", { inputs: { review_tier: "simple", max_turns: 1 }, review: () => blocking(readme) });
      const result = await goalSelect.run(ctx);
      assert.equal(result.status, "handover");
      assert.deepEqual(stageNames(calls), ["orchestrator-1", "reviewer-1", "orchestrator-2", "reviewer-2"]);
      const [extra, handover] = ledgerOf(result).decisions;
      assert.deepEqual([extra.turn, extra.decision, extra.extra_round], [1, "continue", true]);
      assert.match(extra.reason, /one extra round granted for open serious findings: Routing is unproven$/);
      assert.deepEqual([handover.turn, handover.decision, handover.extra_round], [2, "handover", undefined], "only one extra round, however serious the finding");
      assert.deepEqual(handover.open_findings, [findingLine(1, "reviewer")]);

      const recovered = tierRun("extra round approves", { inputs: { review_tier: "simple", max_turns: 1 }, review: (name) => (name === "reviewer-1" ? blocking(readme) : approve) });
      const recoveredResult = await goalSelect.run(recovered.ctx);
      assert.equal(recoveredResult.status, "complete", "the extra round is a full round that can complete the goal");
      assert.deepEqual(votes(recoveredResult), [[1, "continue", 0, 1], [2, "complete", 1, 1]]);
    });

    it("grants no extra round for a P2, or for a P1 beyond or contradicting the objective", async () => {
      const aligned = (alignment) => {
        const review = blocking(readme);
        return { ...review, findings: [{ ...review.findings[0], objective_alignment: alignment }] };
      };
      for (const [label, review, priority] of [
        ["P2", minor(readme), 2],
        ["P1 beyond the objective", aligned("beyond_objective"), 1],
        ["P1 contradicting the objective", aligned("contradicts_objective"), 1],
      ]) {
        const { ctx, calls } = tierRun(label, { inputs: { review_tier: "simple", max_turns: 1 }, review: () => review });
        const result = await goalSelect.run(ctx);
        assert.equal(result.status, "handover", label);
        assert.deepEqual(stageNames(calls), ["orchestrator-1", "reviewer-1"], label);
        const decisions = ledgerOf(result).decisions;
        assert.deepEqual(decisions.map((decision) => [decision.turn, decision.decision, decision.extra_round]), [[1, "handover", undefined]], label);
        assert.deepEqual(decisions[0].open_findings, [findingLine(priority, "reviewer")], label);
      }
    });

    it("refuses a review panel that holds the writer's model, whatever its effort, before any stage of that turn", async () => {
      const sol = sharedPolicy.review_tiers.simple.reviewer_model;
      const refused = fakeContext({ cwd: seed, inputs: { branch_checkout_dir: clone, review_tier: "simple", writer_model: "openai/gpt-6.1-sol:xhigh" } });
      await assert.rejects(goalSelect.run(refused.ctx), (error) => {
        assert.equal(error.message, `Review tier simple puts the writer's model (${sol}) on the review panel as reviewer; choose another tier, writer or reviewer model.`);
        return true;
      });
      assert.deepEqual(modelStages(refused.calls), [], "no stage of turn 1 ran");

      const allowed = fakeContext({ cwd: seed, inputs: { branch_checkout_dir: clone, review_tier: "simple", writer_model: "openai/another-model:xhigh" } });
      assert.equal((await goalSelect.run(allowed.ctx)).status, "complete", "another model from the same provider may review");

      // The shared defaults re-verify on Astra, so Astra cannot write on any tier.
      const astra = sharedPolicy.defaults.reverify_model;
      const reverifier = fakeContext({ cwd: seed, inputs: { branch_checkout_dir: clone, review_tier: "simple", writer_model: "openai/gpt-6-astra:xhigh" } });
      await assert.rejects(goalSelect.run(reverifier.ctx), (error) => {
        assert.equal(error.message, `Review tier simple re-verifies findings on the writer's model (${astra}); choose another reverify_model or writer.`);
        return true;
      });
      assert.deepEqual(modelStages(reverifier.calls), [], "no stage of turn 1 ran");

      const policyPath = join(clone, ".atomic", "tiers lineage.jsonc");
      const midRun = tierRun("lineage", {
        inputs: { review_tier: "complex", writer_model: "test/writer:high" },
        onTask: (name) => {
          if (name === "orchestrator-1") writeJson(policyPath, { ...tierPolicy, risk_reviewer_model: "test/writer:low" });
        },
        review: () => keepGoing,
      });
      await assert.rejects(goalSelect.run(midRun.ctx), /^Error: Review tier complex puts the writer's model \(test\/writer:low\) on the review panel as risk;/);
      assert.deepEqual(stageNames(midRun.calls), ["orchestrator-1", "completion-reviewer-1", "evidence-reviewer-1", "risk-reviewer-1"], "a policy edit that breaks the lineage stops the run before turn 2");
    });

    it("runs re-verifiers on reverify_model from the policy, the session's model without one, and never on the writer's model", async () => {
      const blockingFirst = (name) => (name === "reviewer-1" ? blocking(readme) : approve);
      const reverifyModels = (calls) => modelStages(calls).filter((stage) => stage.name.startsWith("reverify-")).map((stage) => [stage.options.model, stage.options.fallbackModels]);

      // A policy with a defaults block of its own does not inherit the shared pin.
      const unpinned = tierRun("reverify unpinned", { policy: { ...tierPolicy, defaults: {} }, inputs: { review_tier: "simple", writer_model: "test/writer:high" }, review: blockingFirst });
      await goalSelect.run(unpinned.ctx);
      assert.ok(reverifyModels(unpinned.calls).length > 0, "the blocking finding was re-verified");
      for (const [model, fallbacks] of reverifyModels(unpinned.calls)) {
        assert.equal(model, undefined);
        assert.equal(fallbacks, undefined);
      }

      const tierPinned = { review_tiers: { ...tierPolicy.review_tiers, simple: { ...tierPolicy.review_tiers.simple, reverify_model: "test/tier-reverify:medium" } } };
      for (const [label, policy, expected] of [
        ["shared defaults", tierPolicy, sharedPolicy.defaults.reverify_model],
        ["tier", tierPinned, "test/tier-reverify:medium"],
        ["defaults", { ...tierPolicy, defaults: { reverify_model: "test/default-reverify" } }, "test/default-reverify"],
        ["top level over tier", { ...tierPinned, reverify_model: "test/override-reverify" }, "test/override-reverify"],
      ]) {
        const pinned = tierRun(`reverify ${label}`, { policy, inputs: { review_tier: "simple", writer_model: "test/writer:high" }, review: blockingFirst });
        await goalSelect.run(pinned.ctx);
        assert.ok(reverifyModels(pinned.calls).length > 0, label);
        for (const pair of reverifyModels(pinned.calls)) assert.deepEqual(pair, [expected, []], label);
      }

      const refused = tierRun("reverify writer", { policy: { ...tierPolicy, reverify_model: "test/writer:low" }, inputs: { review_tier: "simple", writer_model: "test/writer:high" } });
      await assert.rejects(goalSelect.run(refused.ctx), /^Error: Review tier simple re-verifies findings on the writer's model \(test\/writer:low\);/);
      assert.deepEqual(modelStages(refused.calls), [], "no stage of turn 1 ran");
    });

    it("tells a single reviewer it has no siblings, and every panel its size and quorum", async () => {
      const panel = (calls, name) => goalStages(calls).find((stage) => stage.name === name).options.task.match(/<review_panel>\n([^]*?)\n<\/review_panel>/)?.[1];
      const simple = tierRun("simple prompt", { inputs: { review_tier: "simple" } });
      await goalSelect.run(simple.ctx);
      assert.equal(
        panel(simple.calls, "reviewer-1"),
        "You are the only reviewer this round: there are no sibling reviewers to discover, so skip the evidence exchange and cover contract fidelity, evidence validity and adversarial risk yourself. Your verdict alone decides the round.",
      );
      for (const [tier, policy, names, text] of [
        ["standard", tierPolicy, ["completion-reviewer-1", "risk-reviewer-1"], "This round's panel has 2 reviewers and needs 2 to approve."],
        ["complex", tierPolicy, ["completion-reviewer-1", "evidence-reviewer-1", "risk-reviewer-1"], "This round's panel has 3 reviewers and needs 2 to approve."],
        ["complex", { review_tiers: { complex: { quorum: 3 } } }, ["completion-reviewer-1", "evidence-reviewer-1", "risk-reviewer-1"], "This round's panel has 3 reviewers and needs 3 to approve."],
      ]) {
        const { ctx, calls } = tierRun(`${tier} prompt ${text}`, { policy, inputs: { review_tier: tier } });
        await goalSelect.run(ctx);
        for (const name of names) assert.equal(panel(calls, name), text, `${tier} ${name}`);
      }
    });
  });

  describe("resume after an infrastructure failure", () => {
    const checkpointTimeout = "Workflow database checkpoint timed out. Restore PostgreSQL and inspect the run before resuming; external outcomes may be unknown.";
    const resumable = (overrides) => fakeContext({ cwd: seed, inputs: { branch_checkout_dir: clone }, ...overrides });
    const ledgerState = (calls) => {
      const artifactDir = calls.find((call) => call.kind === "tool" && call.name === "artifact-root").result;
      const path = join(artifactDir, "goal-ledger-state.json");
      return { path, read: () => JSON.parse(readFileSync(path, "utf8")) };
    };
    const failReviewersOn = (ctx, turn, message) => {
      const parallel = ctx.parallel;
      ctx.parallel = async (steps, options) => {
        if (steps[0].name.endsWith(`-${turn}`)) throw new Error(message);
        return parallel(steps, options);
      };
    };
    const secondTurnApproves = (name) => (name.endsWith("-1") ? keepGoing : approve);
    const stageNames = (calls) => modelStages(calls).map((stage) => stage.name);
    // Atomic replays a resumed run's recorded tool results, so the resumed
    // body is handed the artifact directory of the interrupted run.
    const resumeOf = (interrupted, overrides) => {
      const resumed = resumable(overrides);
      const artifactDir = interrupted.calls.find((call) => call.kind === "tool" && call.name === "artifact-root").result;
      const tool = resumed.ctx.tool;
      resumed.ctx.tool = (name, args, fn) => tool(name, args, name === "artifact-root" ? async () => artifactDir : fn);
      return resumed;
    };

    it("leaves the ledger active when reviewers die on a database timeout, and a resume under the same run id finishes that turn", async () => {
      const first = resumable({});
      failReviewersOn(first.ctx, 1, checkpointTimeout);
      await assert.rejects(goalSelect.run(first.ctx), /checkpoint timed out/);
      const state = ledgerState(first.calls);
      const interrupted = state.read();
      assert.equal(interrupted.status, "active");
      assert.deepEqual(interrupted.decisions, []);
      assert.equal(interrupted.receipts.length, 1);

      const second = resumeOf(first, {});
      const result = await goalSelect.run(second.ctx);
      assert.equal(result.status, "complete");
      const finished = state.read();
      assert.deepEqual(finished.decisions.map((decision) => [decision.turn, decision.decision]), [[1, "complete"]]);
      assert.equal(finished.receipts.length, 1);
      assert.equal(finished.reviews.length, 3);
      assert.equal(finished.lifecycle.filter((event) => event.event === "work_turn_started").length, 1);
    });

    it("rethrows an orchestrator that hits the provider usage limit without recording a decision", async () => {
      const { ctx, calls } = resumable({
        onTask: () => {
          throw new Error("Codex error: The usage limit has been reached");
        },
      });
      await assert.rejects(goalSelect.run(ctx), /usage limit/);
      const interrupted = ledgerState(calls).read();
      assert.equal(interrupted.status, "active");
      assert.deepEqual(interrupted.decisions, []);
      assert.equal(interrupted.turns, 0);
    });

    const healthCheckTimeout = "Managed PostgreSQL did not answer a health check in time. Provider: managed; endpoint: postgresql://127.0.0.1:5439/atomic_workflows_dbos_sys.";
    const brokerUnreachable = 'atomic-workflows: stage "orchestrator-1" (7da4e207) did not start because its queued Intercom instructions could not be delivered: Intercom could not reach the broker after 5 warm-up attempts.';
    const providerOutage = "Service temporarily unavailable. The model's availability is currently degraded.";

    for (const [what, message] of [["a database health-check timeout", healthCheckTimeout], ["an unreachable message broker", brokerUnreachable], ["a provider outage", providerOutage]]) {
      it(`rethrows an orchestrator stopped by ${what} without recording a decision`, async () => {
        const { ctx, calls } = resumable({
          onTask: () => {
            throw new Error(message);
          },
        });
        await assert.rejects(goalSelect.run(ctx));
        const interrupted = ledgerState(calls).read();
        assert.equal(interrupted.status, "active");
        assert.deepEqual(interrupted.decisions, []);
      });
    }

    it("reopens a ledger closed twice by infrastructure failures, once by the failure and once by a resume that could not start", async () => {
      const first = resumable({ review: secondTurnApproves });
      failReviewersOn(first.ctx, 2, checkpointTimeout);
      await assert.rejects(goalSelect.run(first.ctx), /checkpoint timed out/);
      const state = ledgerState(first.calls);
      const closed = state.read();
      closed.status = "needs_human";
      for (const message of [healthCheckTimeout, brokerUnreachable]) {
        const reason = `Orchestrator failed before producing a receipt: ${message}`;
        closed.decisions.push({ turn: 2, decision: "needs_human", reason, diagnostics: [reason] });
      }
      writeJson(state.path, closed);

      const second = resumeOf(first, { review: secondTurnApproves });
      const result = await goalSelect.run(second.ctx);
      assert.equal(result.status, "complete");
      const finished = state.read();
      assert.deepEqual(finished.decisions.map((decision) => [decision.turn, decision.decision]), [[1, "continue"], [2, "complete"]]);
      assert.equal(finished.reviews.length, 6);
    });

    it("keeps a ledger closed when a work failure sits under a later infrastructure failure", async () => {
      const first = resumable({ review: secondTurnApproves });
      failReviewersOn(first.ctx, 2, checkpointTimeout);
      await assert.rejects(goalSelect.run(first.ctx), /checkpoint timed out/);
      const state = ledgerState(first.calls);
      const closed = state.read();
      closed.status = "needs_human";
      closed.decisions.push({ turn: 2, decision: "needs_human", reason: "Orchestrator failed before producing a receipt: the model refused the task", diagnostics: [] });
      closed.decisions.push({ turn: 2, decision: "needs_human", reason: `Orchestrator failed before producing a receipt: ${brokerUnreachable}`, diagnostics: [] });
      writeJson(state.path, closed);

      const second = resumeOf(first, { review: secondTurnApproves });
      assert.equal((await goalSelect.run(second.ctx)).status, "needs_human");
      assert.equal(state.read().decisions.length, closed.decisions.length);
    });

    it("still records needs_human when the work itself fails", async () => {
      const orchestratorFails = resumable({
        onTask: () => {
          throw new Error("the model refused the task");
        },
      });
      assert.equal((await goalSelect.run(orchestratorFails.ctx)).status, "needs_human");

      const reviewersFail = resumable({});
      failReviewersOn(reviewersFail.ctx, 1, "reviewer returned no decision");
      assert.equal((await goalSelect.run(reviewersFail.ctx)).status, "needs_human");
      assert.equal(ledgerState(reviewersFail.calls).read().decisions.at(-1).decision, "needs_human");
    });

    it("reopens a ledger an earlier engine closed on a database timeout, replays the decided turn once and finishes the interrupted one", async () => {
      const first = resumable({ review: secondTurnApproves });
      failReviewersOn(first.ctx, 2, checkpointTimeout);
      await assert.rejects(goalSelect.run(first.ctx), /checkpoint timed out/);
      const state = ledgerState(first.calls);
      const closed = state.read();
      assert.deepEqual(closed.decisions.map((decision) => decision.turn), [1]);
      closed.status = "needs_human";
      closed.reviews.push({ turn: 2, reviewer: "reviewer-error", parsed: false, parse_diagnostics: [`Reviewer execution failed before producing a decision: ${checkpointTimeout}`] });
      closed.decisions.push({ turn: 2, decision: "needs_human", reason: "Reviewer execution failed before quorum could be established. Remaining work: unknown", diagnostics: [] });
      writeJson(state.path, closed);

      const second = resumeOf(first, { review: secondTurnApproves });
      const result = await goalSelect.run(second.ctx);
      assert.equal(result.status, "complete");
      assert.deepEqual(stageNames(second.calls), [
        "orchestrator-1",
        "completion-reviewer-1",
        "evidence-reviewer-1",
        "risk-reviewer-1",
        "orchestrator-2",
        "completion-reviewer-2",
        "evidence-reviewer-2",
        "risk-reviewer-2",
      ]);
      const finished = state.read();
      assert.deepEqual(finished.decisions.map((decision) => [decision.turn, decision.decision]), [[1, "continue"], [2, "complete"]]);
      assert.equal(finished.reviews.some((review) => review.reviewer === "reviewer-error"), false);
      assert.equal(finished.reviews.length, 6);
      assert.equal(finished.receipts.length, 2);
      assert.equal(finished.convergence.length, 2);
      assert.ok(finished.lifecycle.some((event) => event.event === "reopened" && event.turn === 2));
    });

    it("keeps a ledger closed for a reason of the work closed, starting no new turn", async () => {
      const first = resumable({ review: () => keepGoing });
      failReviewersOn(first.ctx, 2, checkpointTimeout);
      await assert.rejects(goalSelect.run(first.ctx), /checkpoint timed out/);
      const state = ledgerState(first.calls);
      const closed = state.read();
      closed.status = "needs_human";
      closed.decisions.push({ turn: 2, decision: "needs_human", reason: "Orchestrator attempt budget reached (1) before turn 2. Remaining work: More proof needed.", diagnostics: [] });
      writeJson(state.path, closed);

      const second = resumeOf(first, { review: () => keepGoing });
      const result = await goalSelect.run(second.ctx);
      assert.equal(result.status, "needs_human");
      assert.equal(stageNames(second.calls).includes("orchestrator-3"), false);
      assert.deepEqual(state.read().decisions, closed.decisions);
    });
  });

  describe("writer fallback chain", () => {
    const SOL = "openai/gpt-6.1-sol";
    const ASTRA = "openai/gpt-6-astra";
    const GROK = "xai/grok-4.7:xhigh";
    const KIMI = "kimi-coding/k3:max";
    const GLM = "zai/glm-5.3:max";
    const SONNET = "anthropic/claude-sonnet-5-5:max";
    const OPUS = "anthropic/claude-opus-5-5:xhigh";
    // The standing order, as the shared policy carries it.
    const standingOrder = {
      "xai/grok-4.7": [KIMI, GLM, SONNET],
      "kimi-coding/k3": [GLM, GROK, SONNET],
      "zai/glm-5.3": [SONNET],
      "anthropic/claude-opus-5-5": [`${SOL}:xhigh`],
    };
    const chainPolicy = { ...sharedPolicy, writer_fallbacks: standingOrder };
    // The standard tier's Sol reviewer as the shared policy names it, effort and all.
    const SOL_REVIEWER = sharedPolicy.review_tiers.standard.reviewer_model;
    const usageLimit = "403 You've reached your 5-hour usage limit.";
    const noCredit = "403 Your team has run out of credits.";
    const line = (model) => model.replace(/:[a-z]+$/u, "");
    // One assistant turn of a delegated agent: [model line, error, what it did].
    // A healthy writer's turn edits a file of the checkout.
    const ok = (model) => [line(model), undefined, { edit: ["src/feature.ts"] }];
    const reading = (model) => [line(model), undefined, { read: ["README.md"] }];
    const did = (model, actions) => [line(model), undefined, actions];
    const failed = (model, error) => [line(model), error];
    const model = (id) => ({ provider: id.split("/")[0], id: line(id).split("/").slice(1).join("/") });
    const ledgerOf = (run) => JSON.parse(readFileSync(join(JSON.parse(run.record.get("tool:artifact-root:1")), "goal-ledger-state.json"), "utf8"));
    const orchestrators = (run) => run.stages.filter((stage) => stage.name.startsWith("orchestrator-"));
    const stageNames = (run) => run.stages.map((stage) => stage.name);
    const freshStages = (run) => run.fresh.filter((key) => key.startsWith("stage:")).map((key) => key.split(":")[1]);
    const writerNamed = (stage) => stage.options.prompt.match(/Writer model for this turn: (\S+)\n/)?.[1];

    before(() => {
      // As in a project that keeps Atomic's own files out of Git.
      writeFileSync(join(git("-C", clone, "rev-parse", "--absolute-git-dir"), "info", "exclude"), ".atomic/\n*.log\n", { flag: "a" });
    });

    // What a stage and the agents it delegated to leave on disk under Atomic
    // 0.9.27: the stage's transcript with each subagent launch and its task
    // records, a delivery record per agent, and the agent's own transcript
    // with its tool calls and their results.
    function transcripts() {
      const dir = mkdtempSync(join(root, "sessions-"));
      const history = [];
      let launched = 0;
      let called = 0;
      const lines = (path, entries) => {
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`);
      };
      const message = (content, timestamp = "2026-10-09T01:00:02.000Z") => ({ type: "message", id: randomUUID().slice(0, 8), timestamp, message: content });
      function turnEntries([ran, error, actions = {}], timestamp) {
        const calls = [
          ...(actions.read ?? []).map((path) => ({ name: "read", arguments: { path } })),
          ...(actions.write ?? []).map((path) => ({ name: "write", arguments: { path, content: "text\n" } })),
          ...(actions.refusedWrite ?? []).map((path) => ({ name: "write", arguments: { path, content: "text\n" }, refused: true })),
          ...((actions.edit ?? []).length > 0 ? [{ name: "edit", arguments: { input: actions.edit.map((path) => `[${path}#A1B2]\nreplace 1..1:\n+changed`).join("\n") } }] : []),
          ...((actions.failedEdit ?? []).length > 0 ? [{ name: "edit", arguments: { input: actions.failedEdit.map((path) => `[${path}#A1B2]\nreplace 1..1:\n+changed`).join("\n") }, refused: true }] : []),
          ...(actions.bash ?? []).map((command) => ({ name: "bash", arguments: { command } })),
        ].map((call) => ({ ...call, id: `call_${(called += 1)}` }));
        return [
          message({ role: "assistant", provider: ran.split("/")[0], model: ran.split("/").slice(1).join("/"), content: calls.map(({ id, name, arguments: args }) => ({ type: "toolCall", id, name, arguments: args })), stopReason: error ? "error" : calls.length > 0 ? "toolUse" : "stop", ...(error ? { errorMessage: error } : {}) }, timestamp),
          ...calls.map((call) => message({ role: "toolResult", toolCallId: call.id, toolName: call.name, isError: call.refused === true, content: [] }, timestamp)),
        ];
      }
      // `delivered` false leaves no delivery record, as for an agent that has
      // not ended; a string is written as the record, unreadable as JSON.
      // `transcript` false leaves the record naming a file that is not there.
      function agent(id, index, stageFile, { agent: name = "worker", turns, thinking = "max", forkedFrom, delivered = true, transcript = true, inStageFolder = false }) {
        const file = inStageFolder ? join(stageFile.replace(/\.jsonl$/u, ""), id, `run-${index}`, "session.jsonl") : join(dir, "agents", `${id}-${index}.jsonl`);
        if (transcript) {
          lines(file, [
            { type: "session", version: 3, id: `${id}-${index}`, timestamp: "2026-10-09T01:00:00.000Z", cwd: clone, ...(forkedFrom ? { parentSession: join(dir, "parent.jsonl") } : {}) },
            ...(forkedFrom ? turnEntries(ok(forkedFrom), "2026-10-09T00:59:00.000Z") : []),
            { type: "session_info", timestamp: "2026-10-09T01:00:00.100Z", name: `subagent-${name}-${id}-${index + 1}` },
            ...turns.flatMap((turn) => turnEntries(turn, "2026-10-09T01:00:01.000Z")),
          ]);
        }
        const record = join(dir, "subagent-artifacts", `${id}_${name}_${index}_meta.json`);
        if (delivered === true) writeJson(record, { path: `${id}/${name}_${index + 1}`, status: "ok", model: turns.at(-1)?.[0], thinking, sessionFile: file });
        else if (typeof delivered === "string") writeJsonText(record, delivered);
        return file;
      }
      // One subagent call: a single agent, or `parallel` agents that share
      // the launch.
      function launch(spec, stageFile) {
        launched += 1;
        const id = `task${String(launched).padStart(4, "0")}`;
        const specs = spec.parallel ?? [spec];
        for (const [index, each] of specs.entries()) agent(id, index, stageFile, each);
        const request = ({ agent: name = "worker", requested }) => ({ agent: name, task: "Do the work.", ...(requested ? { model: requested } : {}) });
        const records = (kind) => specs.map((each, index) => ({ launchOperationId: `${id}:${index}`, agentName: each.agent ?? "worker", model: (kind === "running" ? each.turns[0] : each.turns.at(-1))?.[0] ?? line(each.requested ?? "auto/auto"), thinking: each.thinking ?? "max", execution: { kind } }));
        return {
          id,
          entries: [
            message({ role: "assistant", content: [{ type: "toolCall", id: `launch-${id}`, name: "subagent", arguments: spec.parallel ? { tasks: specs.map(request) } : request(spec) }] }),
            message({ role: "toolResult", toolCallId: `launch-${id}`, toolName: "subagent", details: { mode: spec.parallel ? "parallel" : "single", results: [], taskRecords: records("running") } }),
            message({ role: "assistant", content: [{ type: "toolCall", id: `wait-${id}`, name: "subagent", arguments: { action: "wait", id: "task-1" } }] }),
            message({ role: "toolResult", toolCallId: `wait-${id}`, toolName: "subagent", details: { mode: "management", results: [], taskRecords: records("settled") } }),
          ],
        };
      }
      // Each stage forks from the last, so its transcript opens with theirs.
      function stage(name, launches) {
        const file = join(dir, `${name}.jsonl`);
        const made = launches.map((spec) => launch(spec, file));
        history.push(...made.flatMap((entry) => entry.entries));
        lines(file, [{ type: "session", version: 3, id: name, timestamp: "2026-10-09T01:00:00.000Z", cwd: clone }, ...history]);
        return { file, ids: made.map((entry) => entry.id) };
      }
      return { dir, stage, agent };
    }

    // A run whose orchestrator stages leave the scripted transcripts behind;
    // a stage the script does not name delegates one healthy writer on the
    // model its prompt names. The context replays as Atomic does: it keys
    // what a run recorded by kind, name and how many times that name has
    // run, and on resume returns the record instead of running the tool or
    // stage again. `fresh` lists what a pass really ran, `stages` every
    // stage it asked for.
    function chainRun(name, { policy = chainPolicy, inputs = {}, script = {}, exit = false, review = () => approve, sessionModel, record = new Map(), made = transcripts(), runId = `goal-select-test-${randomUUID()}` } = {}) {
      const path = join(clone, ".atomic", `chain ${name}.jsonc`);
      // null leaves the policy file as an earlier pass or the test wrote it.
      if (policy !== null) writeJson(path, policy);
      const exits = [];
      const fresh = [];
      const stages = [];
      const counts = new Map();
      const keyOf = (kind, node) => {
        const count = (counts.get(`${kind}:${node}`) ?? 0) + 1;
        counts.set(`${kind}:${node}`, count);
        return `${kind}:${node}:${count}`;
      };
      const recorded = async (key, runIt) => {
        if (!record.has(key)) {
          record.set(key, JSON.stringify((await runIt()) ?? null));
          fresh.push(key);
        }
        return JSON.parse(record.get(key)) ?? undefined;
      };
      const signal = new AbortController().signal;
      const ctx = {
        runId,
        cwd: seed,
        inputs: launchInputs({ branch_checkout_dir: clone, model_policy_path: path, ...inputs }),
        ...(sessionModel ? { models: { currentModel: model(sessionModel) } } : {}),
        tool: (toolName, _args, fn) => recorded(keyOf("tool", toolName), () => fn({ signal })),
        task(stage, options) {
          stages.push({ name: stage, options });
          return recorded(keyOf("stage", stage), async () => {
            if (stage.startsWith("reverify-")) return { name: stage, text: `${stage} done`, structured: { score: 15, evidence: ["Confirmed."] } };
            if (!stage.startsWith("orchestrator-")) return { name: stage, text: `${stage} done` };
            const named = options.prompt.match(/Writer model for this turn: (\S+)\n/)?.[1];
            const launches = typeof script[stage] === "function" ? script[stage](named) : (script[stage] ?? (named === undefined ? [] : [{ requested: named, turns: [ok(named)] }]));
            return { name: stage, text: `${stage} done`, sessionFile: Array.isArray(launches) ? made.stage(stage, launches).file : launches.sessionFile };
          });
        },
        parallel(steps) {
          return Promise.all(
            steps.map((step) => {
              stages.push({ name: step.name, options: step });
              return recorded(keyOf("stage", step.name), async () => ({ name: step.name, text: "{}", structured: review(step.name) }));
            }),
          );
        },
        async chain() {
          throw new Error("goal-select does not chain stages");
        },
      };
      if (exit) {
        ctx.exit = (options) => {
          exits.push(options);
          throw Object.assign(new Error("workflow exit"), { exit: options });
        };
      }
      return { ctx, stages, fresh, exits, record, made, runId, policyPath: path };
    }
    // The same run id again, with everything the interrupted pass recorded.
    // `forget` drops records, for a node whose result was not kept.
    const resumeOf = (first, name, { forget = [], ...options } = {}) => {
      for (const key of forget) first.record.delete(key);
      return chainRun(name, { ...options, record: first.record, made: first.made, runId: first.runId });
    };

    it("reads writer_fallbacks as each writer line's ordered models, and none when the map is absent", () => {
      assert.deepEqual(policyWriterFallbacks(standingOrder, "policy"), standingOrder);
      assert.deepEqual(policyWriterFallbacks({ "a/b": [" c/d:high ", "e/f"], "g/h": [] }, "policy"), { "a/b": ["c/d:high", "e/f"], "g/h": [] }, "entries are trimmed; an empty chain is allowed");
      assert.deepEqual(policyWriterFallbacks(undefined, "policy"), {});
      assert.equal(modelLine(`${SOL}:xhigh`), modelLine(`${SOL}:high`), "efforts of one model are one line");
      assert.notEqual(modelLine(`${SOL}:high`), modelLine(`${ASTRA}:high`), "two models of one provider are two lines");
    });

    it("ships the standing order in the shared policy file, where only the complex tier lets Opus fall back to Sol", () => {
      const shipped = parseModelPolicy(readFileSync(new URL("../../../../.config/atomic/goal-select.jsonc", import.meta.url), "utf8"));
      assert.deepEqual(policyWriterFallbacks(shipped.writer_fallbacks, "goal-select.jsonc"), standingOrder);
      const turn = (tier, writer) => {
        const { reviewer_model: reviewer, risk_reviewer_model: risk = reviewer } = shipped.review_tiers[tier];
        const roles = { simple: ["reviewer"], standard: ["completion", "risk"], complex: ["completion", "evidence", "risk"] }[tier];
        return { writer, writerFallbacks: shipped.writer_fallbacks[modelLine(writer)] ?? [], roles, reviewer: { model: reviewer }, completion: { model: reviewer }, evidence: { model: reviewer }, risk: { model: risk } };
      };
      for (const [tier, writer, allowed] of [
        ["complex", OPUS, [`${SOL}:xhigh`]],
        ["standard", OPUS, []],
        ["simple", OPUS, []],
        ["complex", GROK, [KIMI, GLM, SONNET]],
        ["standard", GROK, [KIMI, GLM, SONNET]],
        ["simple", KIMI, [GLM, GROK, SONNET]],
        ["standard", KIMI, [GLM, GROK, SONNET]],
        ["complex", GLM, [SONNET]],
        ["complex", SONNET, []],
        ["complex", `${SOL}:xhigh`, []],
      ]) {
        assert.deepEqual(writerFallback.writerFallbackChain(turn(tier, writer)).allowed, allowed, `${tier} ${writer}`);
      }
    });

    it("fails loudly on a malformed writer_fallbacks, naming the file and the entry", () => {
      for (const [value, message] of [
        [[], /^Error: policy\.jsonc: writer_fallbacks must be an object keyed by writer model line/],
        ["xai/grok-4.7", /must be an object keyed by writer model line/],
        [null, /must be an object keyed by writer model line/],
        [{ grok: [KIMI] }, /key "grok" is not a model line: write provider\/model without an effort suffix\.$/],
        [{ [GROK]: [KIMI] }, /key "xai\/grok-4\.7:xhigh" is not a model line/],
        [{ fallbacks: { "xai/grok-4.7": [KIMI] } }, /key "fallbacks" is not a model line/],
        [{ "xai/grok-4.7": KIMI }, /"xai\/grok-4\.7" must list its fallback models in order, as an array\.$/],
        [{ "xai/grok-4.7": [KIMI, 7] }, /"xai\/grok-4\.7" entry 2 must be a model id such as "kimi-coding\/k3:max", not 7\.$/],
        [{ "xai/grok-4.7": ["kimi"] }, /entry 1 must be a model id .* not "kimi"\.$/],
        [{ "xai/grok-4.7": [""] }, /entry 1 must be a model id/],
        [{ "xai/grok-4.7": ["kimi-coding/k3:maxx"] }, /entry "kimi-coding\/k3:maxx" has an unknown effort "maxx"; use one of off, minimal, low, medium, high, xhigh, max\.$/],
        [{ "xai/grok-4.7": ["xai/grok-4.7:high"] }, /"xai\/grok-4\.7" lists its own model line \("xai\/grok-4\.7:high"\) as a fallback\.$/],
        [{ "xai/grok-4.7": [KIMI, "kimi-coding/k3:high"] }, /lists the model line kimi-coding\/k3 twice\.$/],
      ]) {
        assert.throws(() => policyWriterFallbacks(value, "policy.jsonc"), message, JSON.stringify(value));
      }
    });

    it("stops a run whose policy file has a malformed writer_fallbacks before any stage, and shows the chains in resolve_only", async () => {
      const broken = chainRun("malformed", { policy: { ...sharedPolicy, writer_fallbacks: { "xai/grok-4.7": ["kimi-coding/k3:maxx"] } }, inputs: { writer_model: GROK } });
      const policyPath = join(clone, ".atomic", "chain malformed.jsonc");
      await assert.rejects(goalSelect.run(broken.ctx), (error) => {
        assert.ok(error.message.startsWith(`${policyPath}: writer_fallbacks "xai/grok-4.7" entry "kimi-coding/k3:maxx" has an unknown effort "maxx"`), error.message);
        return true;
      });
      assert.deepEqual(broken.stages, [], "no stage ran");
      await assert.rejects(resolveOnly(seed, { branch_checkout_dir: clone, model_policy_path: policyPath }), /writer_fallbacks "xai\/grok-4\.7" entry "kimi-coding\/k3:maxx" has an unknown effort/);

      writeJson(policyPath, chainPolicy);
      assert.deepEqual((await resolveOnly(seed, { branch_checkout_dir: clone, model_policy_path: policyPath })).writer_fallbacks, standingOrder);
    });

    it("inherits the shared file's chains in a project policy without its own, and lets an empty map switch them off", async () => {
      const projectPath = join(clone, ".atomic", "chain project.jsonc");
      const preview = async (project) => {
        writeJson(projectPath, project);
        return (await resolveOnly(seed, { branch_checkout_dir: clone, model_policy_path: projectPath })).writer_fallbacks;
      };
      assert.deepEqual(await preview({ review_tiers: sharedPolicy.review_tiers }), {}, "no map anywhere: no fallbacks");
      writeJson(sharedDefaultPath, chainPolicy);
      try {
        assert.deepEqual(await preview({ review_tiers: sharedPolicy.review_tiers }), standingOrder, "inherited from the shared file");
        assert.deepEqual(await preview({ writer_fallbacks: {} }), {}, "an empty map of its own switches them off");
        assert.deepEqual(await preview({ writer_fallbacks: { "xai/grok-4.7": [GLM] } }), { "xai/grok-4.7": [GLM] }, "its own map replaces the shared one whole");
        writeJson(sharedDefaultPath, { ...sharedPolicy, writer_fallbacks: { grok: [] } });
        await assert.rejects(preview({ review_tiers: sharedPolicy.review_tiers }), (error) => {
          assert.ok(error.message.startsWith(`${sharedDefaultPath}: writer_fallbacks key "grok" is not a model line`), error.message);
          return true;
        });
        assert.equal((await loadGoalSelectFrom(root)).name, "goal-select", "a malformed shared chain does not stop Atomic loading the workflow");
      } finally {
        writeJson(sharedDefaultPath, sharedPolicy);
      }
    });

    it("sets a fallback on a reviewer's line aside per tier: Opus may fall back to Sol on the complex tier and not on the standard tier", async () => {
      const turn = (tier) => ({
        tier,
        writer: OPUS,
        writerFallbacks: standingOrder["anthropic/claude-opus-5-5"],
        orchestrator: { model: `${SOL}:medium` },
        roles: tier === "complex" ? ["completion", "evidence", "risk"] : ["completion", "risk"],
        completion: { model: tier === "complex" ? `${ASTRA}:high` : SOL_REVIEWER },
        evidence: { model: `${ASTRA}:high` },
        risk: { model: `${ASTRA}:xhigh` },
      });
      assert.deepEqual(writerFallback.writerFallbackChain(turn("complex")), { declared: [`${SOL}:xhigh`], allowed: [`${SOL}:xhigh`], refused: [] });
      assert.deepEqual(writerFallback.writerFallbackChain(turn("standard")), {
        declared: [`${SOL}:xhigh`],
        allowed: [],
        refused: [{ model: `${SOL}:xhigh`, reason: `on the review panel as completion (${SOL_REVIEWER})` }],
      });
      assert.deepEqual(writerFallback.writerCandidates(turn("complex")), [OPUS, `${SOL}:xhigh`]);
      assert.deepEqual(writerFallback.writerCandidates(turn("standard")), [OPUS]);
      assert.deepEqual(writerFallback.writerFallbackChain({ ...turn("complex"), reverify: `${SOL}:low` }).refused, [{ model: `${SOL}:xhigh`, reason: `re-verifies findings (${SOL}:low)` }], "the re-verifier judges the writer too");

      const script = { "orchestrator-1": [{ requested: OPUS, turns: [failed(OPUS, usageLimit)] }] };
      const complex = chainRun("opus complex", { inputs: { review_tier: "complex", writer_model: OPUS }, script });
      assert.equal((await goalSelect.run(complex.ctx)).status, "complete");
      assert.deepEqual(stageNames(complex), ["orchestrator-1", "orchestrator-1-continued-1", "completion-reviewer-1", "evidence-reviewer-1", "risk-reviewer-1"]);
      assert.deepEqual(orchestrators(complex).map(writerNamed), [OPUS, `${SOL}:xhigh`], "the continued stage is told the policy's model and effort");

      const standard = chainRun("opus standard", { inputs: { review_tier: "standard", writer_model: OPUS }, script });
      await assert.rejects(goalSelect.run(standard.ctx), (error) => {
        assert.ok(error.message.includes(`No fallback writer is left after ${OPUS} (the policy allows none for ${OPUS}).`), error.message);
        assert.ok(error.message.includes(`Refused as fallbacks: ${SOL}:xhigh, on the review panel as completion (${SOL_REVIEWER}).`), error.message);
        return true;
      });
      assert.deepEqual(stageNames(standard), ["orchestrator-1"], "Sol never wrote and nothing was reviewed");
    });

    it("bars a fallback onto the launching session's model under a policy that names no reverify_model, since that model then re-verifies", async () => {
      const script = { "orchestrator-1": [{ requested: OPUS, turns: [failed(OPUS, usageLimit)] }] };
      // A project policy with a defaults block of its own does not inherit the shared file's re-verifier.
      const ownDefaults = { ...chainPolicy, defaults: { orchestrator_model: sharedPolicy.defaults.orchestrator_model, review_tier: "complex" } };
      const unpinned = chainRun("opus session model", { policy: ownDefaults, inputs: { review_tier: "complex", writer_model: OPUS }, script, sessionModel: SOL });
      await assert.rejects(goalSelect.run(unpinned.ctx), (error) => {
        assert.ok(error.message.includes(`Refused as fallbacks: ${SOL}:xhigh, re-verifies findings as the launching session's model, no reverify_model being set (${SOL}).`), error.message);
        return true;
      });
      assert.deepEqual(stageNames(unpinned), ["orchestrator-1"]);

      // The shared defaults name Astra, so the session's model judges nothing and the policy's fallback stands.
      assert.equal(chainPolicy.defaults.reverify_model, `${ASTRA}:high`);
      for (const [label, policy] of [["the shared defaults", chainPolicy], ["its own key", { ...ownDefaults, reverify_model: `${ASTRA}:high` }]]) {
        const pinned = chainRun(`opus session model pinned by ${label}`, { policy, inputs: { review_tier: "complex", writer_model: OPUS }, script, sessionModel: SOL });
        assert.equal((await goalSelect.run(pinned.ctx)).status, "complete", label);
        assert.deepEqual(orchestrators(pinned).map(writerNamed), [OPUS, `${SOL}:xhigh`], `a re-verifier named by ${label} on another line lets the policy's fallback through`);
      }

      // A launch writer on the session's model has that exposure today; it is not refused here.
      const launch = chainRun("sol writer session model", { policy: ownDefaults, inputs: { review_tier: "complex", writer_model: `${SOL}:xhigh` }, sessionModel: SOL });
      assert.equal((await goalSelect.run(launch.ctx)).status, "complete");
      assert.equal(orchestrators(launch)[0].options.isFallbackModelAllowed(model("anthropic/claude-opus-5-5"), "xhigh"), true);

      const kimiOrchestrator = { ...sharedPolicy, defaults: { orchestrator_model: "kimi-coding/k3:high", review_tier: "complex" } };
      const gated = chainRun("gate session model", { policy: kimiOrchestrator, inputs: { review_tier: "complex", writer_model: GROK, orchestrator_model: "" }, sessionModel: SOL });
      await goalSelect.run(gated.ctx);
      assert.equal(orchestrators(gated)[0].options.isFallbackModelAllowed(model(SOL), "high"), false, "nor may a delegated agent fall back onto it");
      const gatedPinned = chainRun("gate session model pinned", { policy: { ...kimiOrchestrator, reverify_model: `${ASTRA}:high` }, inputs: { review_tier: "complex", writer_model: GROK, orchestrator_model: "" }, sessionModel: SOL });
      await goalSelect.run(gatedPinned.ctx);
      assert.equal(orchestrators(gatedPinned)[0].options.isFallbackModelAllowed(model(SOL), "high"), true, "with the re-verifier named, the session's model is no judge");
    });

    it("gives the orchestrator a fallback gate its delegated agents inherit: no reviewer's line, and not the orchestrator's own model that Atomic appends", async () => {
      const run = chainRun("gate", { inputs: { review_tier: "standard", writer_model: KIMI } });
      assert.equal((await goalSelect.run(run.ctx)).status, "complete");
      const [orchestrator, ...reviewers] = run.stages;
      const gate = orchestrator.options.isFallbackModelAllowed;
      assert.equal(orchestrator.options.model, `${SOL}:medium`);
      assert.deepEqual(orchestrator.options.fallbackModels, [], "the stage's own chain stays empty");
      for (const effort of ["medium", "high", "xhigh", undefined]) {
        assert.equal(gate(model(SOL), effort), false, `the orchestrator's model, which is also the completion reviewer's line, at ${effort}`);
        assert.equal(gate(model(ASTRA), effort), false, `the risk reviewer's line at ${effort}`);
      }
      for (const allowed of [GLM, SONNET, KIMI, "openai/gpt-6.1-sol-fast"]) assert.equal(gate(model(allowed), "max"), true, allowed);
      assert.ok(reviewers.length > 0 && reviewers.every((stage) => stage.options.isFallbackModelAllowed === undefined), "reviewer stages are unchanged");

      const kimiOrchestrator = { ...sharedPolicy, defaults: { ...sharedPolicy.defaults, orchestrator_model: "kimi-coding/k3:high" } };
      const other = chainRun("gate kimi orchestrator", { policy: kimiOrchestrator, inputs: { review_tier: "complex", writer_model: GROK, orchestrator_model: "" } });
      await goalSelect.run(other.ctx);
      const otherGate = other.stages[0].options.isFallbackModelAllowed;
      assert.equal(otherGate(model(KIMI), "max"), false, "whatever model orchestrates is the one Atomic appends");
      assert.equal(otherGate(model(SOL), "high"), true, "Sol is neither orchestrator nor reviewer here");
      assert.equal(otherGate(model(ASTRA), "high"), false);
      assert.equal(writerFallback.delegatedFallbackGate({ roles: ["reviewer"], reviewer: { model: "a/b:high" }, orchestrator: { model: "c/d" }, reverify: "e/f:low" })("e/f:max"), false, "a model id string is judged by its line");
    });

    it("moves the writer down the chain in policy order when its model fails, keeps it there for later turns, and records who wrote", async () => {
      const run = chainRun("walk", {
        inputs: { review_tier: "complex", writer_model: GROK, max_turns: 2 },
        review: (name) => (name.endsWith("-1") ? keepGoing : approve),
        script: {
          "orchestrator-1": [{ agent: "grok-fixer", requested: GROK, turns: [ok(GROK), failed(GROK, noCredit)], thinking: "xhigh" }],
          "orchestrator-1-continued-1": [{ requested: KIMI, turns: [ok(KIMI), failed(KIMI, usageLimit)] }],
        },
      });
      const result = await goalSelect.run(run.ctx);
      assert.equal(result.status, "complete");
      assert.deepEqual(stageNames(run), [
        "orchestrator-1",
        "orchestrator-1-continued-1",
        "orchestrator-1-continued-2",
        "completion-reviewer-1",
        "evidence-reviewer-1",
        "risk-reviewer-1",
        "orchestrator-2",
        "completion-reviewer-2",
        "evidence-reviewer-2",
        "risk-reviewer-2",
      ]);
      const stages = orchestrators(run);
      assert.deepEqual(stages.map(writerNamed), [GROK, KIMI, GLM, GLM], "Grok, then Kimi, then GLM, which also writes turn 2");
      assert.ok(stages.every((stage) => typeof stage.options.isFallbackModelAllowed === "function"), "every orchestrator stage of the run carries the gate");
      assert.ok(stages.every((stage) => stage.options.prompt.includes("never finish the work yourself and never start an agent on another model")), "and is told to leave the move to the workflow");
      assert.ok(stages.every((stage) => stage.options.prompt.includes("name the writer model on every agent that edits or commits")), "and what an unnamed writer costs");
      const continued = stages[1].options;
      assert.match(continued.prompt, /<writer_change>\nThe implementation agent asked for xai\/grok-4\.7:xhigh did not do its work on that model, though its task came back as completed/);
      assert.ok(continued.prompt.includes(noCredit), "the continued stage is told the provider's own error");
      const sessionOf = (stage) => JSON.parse(run.record.get(`stage:${stage}:1`)).sessionFile;
      assert.deepEqual([continued.context, continued.forkFromSessionFile], ["fork", sessionOf("orchestrator-1")], "it continues the stage it follows");
      assert.deepEqual([stages[2].options.context, stages[2].options.forkFromSessionFile], ["fork", sessionOf("orchestrator-1-continued-1")]);

      const ledger = ledgerOf(run);
      assert.deepEqual(ledger.writer_moves.map((move) => [move.turn, move.attempt, move.kind, move.from, move.to]), [[1, 0, "fallback", GROK, KIMI], [1, 1, "fallback", KIMI, GLM]]);
      assert.deepEqual(
        ledger.delegations.map((entry) => [entry.turn, entry.stage, entry.agent, entry.writer, entry.requested, entry.resolved, entry.models, entry.wrote, entry.error]),
        [
          [1, "orchestrator-1", "grok-fixer", true, GROK, "xai/grok-4.7", ["xai/grok-4.7"], ["xai/grok-4.7"], noCredit],
          [1, "orchestrator-1-continued-1", "worker", true, KIMI, "kimi-coding/k3", ["kimi-coding/k3"], ["kimi-coding/k3"], usageLimit],
          [1, "orchestrator-1-continued-2", "worker", true, GLM, "zai/glm-5.3", ["zai/glm-5.3"], ["zai/glm-5.3"], undefined],
          [2, "orchestrator-2", "worker", true, GLM, "zai/glm-5.3", ["zai/glm-5.3"], ["zai/glm-5.3"], undefined],
        ],
        "each task once, though every later transcript opens with the earlier ones",
      );
      const moved = ledger.lifecycle.filter((event) => event.event === "writer_fallback").map((event) => event.summary);
      assert.equal(moved.length, 2);
      assert.ok(moved[0].startsWith(`Writer moved from ${GROK} to ${KIMI}: grok-fixer on ${GROK} stopped on a model error: ${noCredit}`), moved[0]);
      assert.ok(moved[1].startsWith(`Writer moved from ${KIMI} to ${GLM}: `), moved[1]);
      const [first] = ledger.receipts;
      assert.ok(first.summary.includes(`grok-fixer ${ledger.delegations[0].task.split(":")[0]} asked for ${GROK}, ran on xai/grok-4.7, wrote files on xai/grok-4.7, ended on ${GROK} with a model error (${noCredit})`), first.summary);
      assert.ok(first.summary.includes(`asked for ${GLM}, ran on zai/glm-5.3, wrote files on zai/glm-5.3, ended on ${GLM}`), first.summary);
      assert.ok(result.result.includes(first.summary), "the final report carries it");
      assert.deepEqual(JSON.parse(readFileSync(result.ledger_path, "utf8")).delegations, ledger.delegations, "reviewers read the same record");
    });

    it("stops resumable when the chain is used up, records why, and a resume replays what ran and continues that turn from the launch writer", async () => {
      const script = {
        "orchestrator-1": [{ requested: KIMI, turns: [failed(KIMI, usageLimit)] }],
        "orchestrator-1-continued-1": [{ requested: GLM, turns: [failed(GLM, "500 upstream error")] }],
        "orchestrator-1-continued-2": [{ requested: SONNET, turns: [ok(SONNET), failed(SONNET, "invalid api key")] }],
      };
      // A chain of two, so the stop comes in three stages however long the standing order grows.
      const policy = { ...chainPolicy, writer_fallbacks: { ...standingOrder, "kimi-coding/k3": [GLM, SONNET] } };
      const first = chainRun("exhausted", { policy, inputs: { review_tier: "complex", writer_model: KIMI }, script, exit: true });
      await assert.rejects(goalSelect.run(first.ctx), (error) => {
        assert.deepEqual(error.exit, first.exits[0]);
        return true;
      });
      const [stop] = first.exits;
      assert.deepEqual([stop.status, stop.resumable], ["failed", true], "Atomic keeps a failed, resumable exit in its resume catalog");
      assert.ok(stop.reason.startsWith(`goal-select stopped in turn 1 with the work unfinished: worker on ${SONNET} stopped on a model error: invalid api key. No fallback writer is left after ${SONNET} (the policy allows ${GLM}, then ${SONNET} for ${KIMI}).`), stop.reason);
      assert.ok(stop.reason.endsWith(`Put the provider right, then resume this run: the turn continues from ${KIMI}.`), stop.reason);
      assert.deepEqual(stageNames(first), ["orchestrator-1", "orchestrator-1-continued-1", "orchestrator-1-continued-2"], "no reviewer ran and nothing else wrote");
      const stopped = ledgerOf(first);
      assert.equal(stopped.status, "active", "no decision closes the ledger, so a resume continues it");
      assert.deepEqual(stopped.decisions, []);
      assert.deepEqual(stopped.receipts, []);
      assert.deepEqual(stopped.writer_moves.map((move) => [move.kind, move.from, move.to]), [["fallback", KIMI, GLM], ["fallback", GLM, SONNET], ["stop", SONNET, undefined]]);
      assert.equal(stopped.delegations.length, 3);
      assert.equal(stopped.lifecycle.at(-1).event, "writer_stopped");

      const second = resumeOf(first, "exhausted", { policy, inputs: { review_tier: "complex", writer_model: KIMI }, script, exit: true });
      const result = await goalSelect.run(second.ctx);
      assert.equal(result.status, "complete");
      assert.deepEqual(second.exits, []);
      assert.deepEqual(stageNames(second), [
        "orchestrator-1",
        "orchestrator-1-continued-1",
        "orchestrator-1-continued-2",
        "orchestrator-1-continued-3",
        "completion-reviewer-1",
        "evidence-reviewer-1",
        "risk-reviewer-1",
      ]);
      assert.deepEqual(second.fresh, ["stage:orchestrator-1-continued-3:1", "stage:completion-reviewer-1:1", "stage:evidence-reviewer-1:1", "stage:risk-reviewer-1:1"], "every tool and stage the first pass recorded was replayed by name and count, not run again");
      const resumed = orchestrators(second).at(-1);
      assert.equal(writerNamed(resumed), KIMI, "back at the top of the chain");
      assert.match(resumed.options.prompt, /<writer_change>\nThis run stopped in this turn because the writer's model was not available and no fallback writer was left/);
      const finished = ledgerOf(second);
      assert.equal(finished.writer_moves.length, 3, "the replayed stages decide nothing again");
      assert.deepEqual(finished.delegations.map((entry) => [entry.requested, entry.error]), [[KIMI, usageLimit], [GLM, "500 upstream error"], [SONNET, "invalid api key"], [KIMI, undefined]]);
      assert.equal(finished.receipts.length, 1);
    });

    it("stops the same way with no chain in the policy, and throws the reason where the runtime has no exit", async () => {
      const run = chainRun("no chain", {
        policy: sharedPolicy,
        inputs: { review_tier: "complex", writer_model: KIMI },
        script: { "orchestrator-1": [{ requested: KIMI, turns: [ok(KIMI), failed(KIMI, usageLimit)] }] },
      });
      await assert.rejects(goalSelect.run(run.ctx), (error) => {
        assert.ok(error.message.startsWith(`goal-select stopped in turn 1 with the work unfinished: worker on ${KIMI} stopped on a model error: ${usageLimit}. No fallback writer is left after ${KIMI} (the policy allows none for ${KIMI}).`), error.message);
        return true;
      });
      assert.deepEqual(stageNames(run), ["orchestrator-1"]);
      assert.equal(ledgerOf(run).status, "active");
    });

    it("only moves down the chain when the orchestrator keeps asking for a model that is not the one named", async () => {
      const stubborn = () => [{ requested: GROK, turns: [failed(GROK, noCredit)], thinking: "xhigh" }];
      const run = chainRun("stubborn", {
        inputs: { review_tier: "complex", writer_model: GROK },
        script: { "orchestrator-1": stubborn, "orchestrator-1-continued-1": stubborn, "orchestrator-1-continued-2": stubborn, "orchestrator-1-continued-3": stubborn },
      });
      await assert.rejects(goalSelect.run(run.ctx), /No fallback writer is left after xai\/grok-4\.7:xhigh/);
      assert.deepEqual(orchestrators(run).map(writerNamed), [GROK, KIMI, GLM, SONNET], "one stage per writer the policy allows, then the stop");
    });

    it("decides a failure over the last launch: one of two parallel writers failing moves the writer, whichever was recorded last", async () => {
      for (const [label, parallel] of [
        ["the failed one first", [{ requested: KIMI, turns: [ok(KIMI), failed(KIMI, usageLimit)] }, { requested: KIMI, turns: [ok(KIMI)] }]],
        ["the failed one last", [{ requested: KIMI, turns: [ok(KIMI)] }, { requested: KIMI, turns: [failed(KIMI, usageLimit)] }]],
      ]) {
        const run = chainRun(`parallel ${label}`, { inputs: { review_tier: "complex", writer_model: KIMI }, script: { "orchestrator-1": [{ parallel }] } });
        assert.equal((await goalSelect.run(run.ctx)).status, "complete", label);
        assert.deepEqual(orchestrators(run).map(writerNamed), [KIMI, GLM], label);
        const [move] = ledgerOf(run).writer_moves;
        assert.equal(move.reason, `worker on ${KIMI} stopped on a model error: ${usageLimit}`, label);
        assert.deepEqual(ledgerOf(run).delegations.slice(0, 2).map((entry) => entry.task.split(":")[1]), ["0", "1"], "two tasks of one launch");
      }

      // An earlier launch that failed is behind the orchestrator once it has launched again and that launch held.
      const recovered = chainRun("parallel recovered", {
        inputs: { review_tier: "complex", writer_model: KIMI },
        script: { "orchestrator-1": [{ parallel: [{ requested: KIMI, turns: [failed(KIMI, "529 overloaded")] }, { requested: KIMI, turns: [ok(KIMI)] }] }, { requested: KIMI, turns: [ok(KIMI)] }] },
      });
      assert.equal((await goalSelect.run(recovered.ctx)).status, "complete");
      assert.deepEqual(orchestrators(recovered).map(writerNamed), [KIMI]);

      // Both writers of the last launch down, on two models of the chain: on from the further one.
      const both = chainRun("parallel both", {
        inputs: { review_tier: "complex", writer_model: GROK },
        script: { "orchestrator-1": [{ parallel: [{ requested: KIMI, turns: [failed(KIMI, usageLimit)] }, { requested: GROK, turns: [failed(GROK, noCredit)], thinking: "xhigh" }] }] },
      });
      assert.equal((await goalSelect.run(both.ctx)).status, "complete");
      assert.deepEqual(orchestrators(both).map(writerNamed), [GROK, GLM], "only ever down the chain");
    });

    it("treats a writer Atomic started on the orchestrator's model, for want of credentials, as a writer that failed", async () => {
      // Atomic skips a requested model whose provider has no credentials and
      // starts the agent on the session's own model: not a fallback, so no
      // gate sees it. Here the agent got no further than reading.
      const script = { "orchestrator-1": [{ requested: KIMI, turns: [reading(SOL)], thinking: "high" }] };
      const moved = chainRun("no credentials", { inputs: { review_tier: "standard", writer_model: KIMI }, script });
      assert.equal((await goalSelect.run(moved.ctx)).status, "complete");
      assert.deepEqual(orchestrators(moved).map(writerNamed), [KIMI, GLM]);
      const [move] = ledgerOf(moved).writer_moves;
      assert.deepEqual([move.kind, move.from, move.to], ["fallback", KIMI, GLM]);
      assert.equal(move.reason, `worker on ${KIMI} never ran on it: Atomic started the agent on ${SOL}, as it does when the requested model's provider has no credentials`);

      const last = chainRun("no credentials, no chain", { policy: sharedPolicy, inputs: { review_tier: "complex", writer_model: KIMI }, script });
      await assert.rejects(goalSelect.run(last.ctx), /never ran on it: Atomic started the agent on openai\/gpt-6\.1-sol.*No fallback writer is left after kimi-coding\/k3:max/);

      // Had it written, on a tier where Sol reviews, that is Sol's own work.
      const wrote = chainRun("no credentials, reviewer's line", { inputs: { review_tier: "standard", writer_model: KIMI }, script: { "orchestrator-1": [{ requested: KIMI, turns: [ok(SOL)], thinking: "high" }] } });
      assert.equal((await goalSelect.run(wrote.ctx)).status, "needs_human", "it is refused rather than handed to the next writer");
      assert.deepEqual(stageNames(wrote), ["orchestrator-1"]);
      assert.deepEqual(ledgerOf(wrote).writer_moves, []);
    });

    it("carries on when a later launch finished the work, and leaves a run without a writer model as it was", async () => {
      const retried = chainRun("retried", {
        inputs: { review_tier: "complex", writer_model: KIMI },
        script: { "orchestrator-1": [{ requested: KIMI, turns: [failed(KIMI, "529 overloaded")] }, { requested: KIMI, turns: [ok(KIMI)] }, { agent: "codebase-locator", turns: [failed(SOL, usageLimit)], thinking: "low" }] },
      });
      assert.equal((await goalSelect.run(retried.ctx)).status, "complete");
      assert.deepEqual(orchestrators(retried).map((stage) => stage.name), ["orchestrator-1"], "the last writer launch ended well; a helper's failure is not the writer's");
      assert.deepEqual(ledgerOf(retried).delegations.map((entry) => [entry.agent, entry.writer, entry.asked, entry.requested]), [["worker", true, true, KIMI], ["worker", true, true, KIMI], ["codebase-locator", false, false, null]]);

      const unset = chainRun("no writer", { inputs: { review_tier: "complex" }, script: { "orchestrator-1": [{ turns: [failed(GLM, usageLimit)] }] } });
      assert.equal((await goalSelect.run(unset.ctx)).status, "complete");
      assert.equal(writerNamed(orchestrators(unset)[0]), undefined);
      assert.equal(typeof orchestrators(unset)[0].options.isFallbackModelAllowed, "function", "the gate does not depend on a writer model");
    });

    it("closes before review when a task wrote on a reviewer's line, whatever model it asked for, and never moves the writer for a task that named none", async () => {
      // The orchestrator leaves the model off, so the agent runs on the session's model.
      const unnamed = chainRun("wrote, no model", { inputs: { review_tier: "standard", writer_model: KIMI }, script: { "orchestrator-1": [{ turns: [ok(SOL)], thinking: "high" }] } });
      const closed = await goalSelect.run(unnamed.ctx);
      assert.equal(closed.status, "needs_human");
      assert.deepEqual(stageNames(unnamed), ["orchestrator-1"], "no reviewer was dispatched");
      const [entry] = ledgerOf(unnamed).delegations;
      assert.deepEqual([entry.writer, entry.asked, entry.requested, entry.wrote], [true, false, null, [SOL]], "it counts as a writer because it wrote, not because of what it asked");
      assert.equal(
        closed.remaining_work,
        `Turn 1 was not sent to review: worker ${entry.task.split(":")[0]} (turn 1, asked for no model) wrote files on ${SOL}, a model line that is on the review panel as completion (${SOL_REVIEWER}). A model line never reviews its own work: review this change on a tier whose reviewers differ, or have it rewritten.`,
      );
      const [decision] = ledgerOf(unnamed).decisions;
      assert.deepEqual([decision.decision, decision.pre_review, decision.pre_review_tasks], ["needs_human", "lineage", [entry.task]]);

      // A model that is on neither the chain nor asked of the workflow, named outright.
      const offChain = chainRun("wrote, off chain", { inputs: { review_tier: "complex", writer_model: KIMI }, script: { "orchestrator-1": [{ agent: "astra-fixer", requested: `${ASTRA}:xhigh`, turns: [ok(ASTRA)], thinking: "xhigh" }] } });
      assert.equal((await goalSelect.run(offChain.ctx)).status, "needs_human");
      assert.deepEqual(stageNames(offChain), ["orchestrator-1"]);
      assert.deepEqual(ledgerOf(offChain).delegations.map((each) => [each.writer, each.asked, each.wrote]), [[true, false, [ASTRA]]]);

      // The same two, where no reviewer shares the line: recorded, reviewed.
      const elsewhere = chainRun("wrote, no model, complex", { inputs: { review_tier: "complex", writer_model: KIMI }, script: { "orchestrator-1": [{ turns: [ok(SOL)], thinking: "high" }, { agent: "debugger", requested: "openai-codex/gpt-6-luna", turns: [ok("openai-codex/gpt-6-luna")] }] } });
      assert.equal((await goalSelect.run(elsewhere.ctx)).status, "complete");
      assert.deepEqual(ledgerOf(elsewhere).delegations.map((each) => [each.agent, each.writer, each.asked, each.wrote]), [["worker", true, false, [SOL]], ["debugger", true, false, ["openai-codex/gpt-6-luna"]]]);

      // A task that named no model has no model to have failed: no move, whatever became of it.
      for (const [label, turns] of [["its model failed", [failed(GLM, usageLimit)]], ["it wrote and then its model failed", [ok(GLM), failed(GLM, usageLimit)]], ["it ran on a model that is not the writer's", [ok(GLM)]]]) {
        const run = chainRun(`no model, ${label}`, { inputs: { review_tier: "complex", writer_model: KIMI }, script: { "orchestrator-1": [{ turns }] } });
        assert.equal((await goalSelect.run(run.ctx)).status, "complete", label);
        assert.deepEqual(orchestrators(run).map((stage) => stage.name), ["orchestrator-1"], label);
        assert.deepEqual(ledgerOf(run).writer_moves, [], label);
      }
    });

    it("does not take a helper for a writer: explorer and reviewer agents on the session's model leave a healthy standard-tier run alone", async () => {
      // The shapes of last night's helper transcripts (opus-reviewer 79e61e7d
      // in unit 5's third turn, and codebase-locator), put on Sol: every
      // agent launched with progress on writes and edits its progress note
      // under Atomic's sessions folder, and a reviewing helper writes its
      // evidence under /tmp and under the checkout's ignored .atomic folder.
      const progress = (id) => join(home, ".atomic", "agent", "sessions", "--clone--", "subagent-artifacts", "progress", id, "progress.md");
      const run = chainRun("helpers on the session model", {
        inputs: { review_tier: "standard", writer_model: KIMI },
        script: {
          "orchestrator-1": [
            { requested: KIMI, turns: [ok(KIMI)] },
            { agent: "codebase-locator", turns: [did(SOL, { read: ["apps/web/src/pages/Home.vue", "README.md"] }), did(SOL, { bash: ["git log --oneline -5 | grep commit", "rg -n useFocusReturn apps > /tmp/found.txt", "git commit --dry-run", "git commit --allow-empty -m probe", "echo 'git commit'"] }), reading(SOL)], thinking: "low" },
            {
              agent: "sol-reviewer",
              forkedFrom: SOL,
              turns: [
                did(SOL, { write: [progress("79e61e7d")] }),
                did(SOL, { read: ["apps/api/src/billing/gate.ts"], bash: ["git status --short", "git diff origin/main --stat"] }),
                did(SOL, { edit: [progress("79e61e7d")] }),
                did(SOL, { write: [join(clone, ".atomic", "sol-completion.spec.ts"), join(clone, ".atomic", "sol-browser-init.js"), "/tmp/unit5-evidence/review.md", "gate.log"] }),
                did(SOL, { bash: ["pnpm --filter @casefilecrafter/e2e exec playwright test -c .atomic/sol-completion.config.ts > .atomic/logs/sol.log 2>&1; tail -3 .atomic/logs/sol.log"] }),
                did(SOL, { refusedWrite: ["apps/api/src/billing/gate.ts"] }),
                reading(SOL),
              ],
              thinking: "high",
            },
          ],
        },
      });
      const result = await goalSelect.run(run.ctx);
      assert.equal(result.status, "complete", result.remaining_work);
      assert.deepEqual(stageNames(run), ["orchestrator-1", "completion-reviewer-1", "risk-reviewer-1"]);
      assert.deepEqual(
        ledgerOf(run).delegations.map((entry) => [entry.agent, entry.writer, entry.models, entry.wrote]),
        [["worker", true, ["kimi-coding/k3"], ["kimi-coding/k3"]], ["codebase-locator", false, [SOL], []], ["sol-reviewer", false, [SOL], []]],
        "they ran on the reviewer's line and wrote nothing a reviewer reads",
      );
    });

    it("counts as writing an accepted edit or write to a file of the checkout that Git does not ignore; nothing else, a commit included", () => {
      const made = transcripts();
      const wroteOf = (turns, options = {}) => {
        const { file } = made.stage(`evidence-${randomUUID().slice(0, 8)}`, [{ turns, ...options }]);
        return writerFallback.delegatedTasks(file, clone).at(-1).wrote;
      };
      for (const [label, actions, wrote] of [
        ["an edit, by a path relative to the agent's directory", { edit: ["src/feature.ts"] }, true],
        ["a write, by an absolute path", { write: [join(clone, "docs", "new.md")] }, true],
        ["one section of several in an edit", { edit: ["/tmp/notes.md", "apps/api/src/gate.ts"] }, true],
        ["a file at the top of the checkout whose name begins with two dots", { write: ["..feature.js"] }, true],
        ["the same by an absolute path, in an edit", { edit: [join(clone, "..hidden.ts")] }, true],
        ["a write Atomic refused", { refusedWrite: ["src/feature.ts"] }, false],
        ["an edit that failed", { failedEdit: ["src/feature.ts", "apps/api/src/gate.ts"] }, false],
        ["a commit: the text of a command is not authorship, and committing work is not writing it", { bash: ["git add -A; git commit -m 'Close the gate'", `git -C "${clone}" -c user.name=writer commit --amend --no-edit`] }, false],
        ["a command that only mentions a commit, or makes an empty one", { bash: ["git commit --dry-run", "git commit --allow-empty -m probe", "echo 'git commit'"] }, false],
        ["the folder above the checkout, and a file beside it", { write: ["..", "../sibling/notes.ts", join(dirname(clone), "..feature.js")] }, false],
        ["a file outside the checkout", { write: ["/tmp/evidence/review.md", join(home, "progress.md")] }, false],
        ["a file of the checkout that Git ignores", { write: [".atomic/notes/acceptance.md", "gate.log"], edit: [join(clone, ".atomic", "probe.spec.ts")] }, false],
        ["the repository's own folder", { write: [".git/COMMIT_EDITMSG"] }, false],
        ["a shell redirect, sed -i or a formatter: not seen", { bash: ["echo done > src/feature.ts", "sed -i '' s/a/b/ src/feature.ts", "pnpm format"] }, false],
        ["shell commands that only read", { bash: ["git log --oneline | grep commit", "git show HEAD # the last commit", "git commit-tree --help", "git status"] }, false],
        ["reading", { read: ["src/feature.ts"] }, false],
      ]) {
        assert.deepEqual(wroteOf([did(KIMI, actions)]), wrote ? ["kimi-coding/k3"] : [], label);
      }
      assert.deepEqual(wroteOf([ok(KIMI), reading(SOL), did(GROK, { bash: ["git commit -m x"] }), did(GLM, { write: ["docs/more.md"] })]), ["kimi-coding/k3", "zai/glm-5.3"], "each model that wrote, and not one that only read or committed");
      assert.deepEqual(wroteOf([reading(SOL)], { forkedFrom: SOL }), [], "a forked agent's transcript opens with its parent's writing, which is not its own");
      const { file } = made.stage("evidence-no-checkout", [{ turns: [did(KIMI, { write: ["/tmp/evidence/review.md"] })] }]);
      assert.deepEqual(writerFallback.delegatedTasks(file).at(-1).wrote, ["kimi-coding/k3"], "with no checkout to ask, every file counts");
      const gone = join(root, "removed clone");
      assert.deepEqual(writerFallback.delegatedTasks(made.stage("evidence-gone", [{ turns: [did(KIMI, { write: [join(gone, ".atomic", "notes.md")] })] }]).file, gone).at(-1).wrote, ["kimi-coding/k3"], "a checkout Git cannot answer for ignores nothing");
    });

    it("judges a line by the turns it ran and wrote in, not by where an agent ended or what merely errored or read", async () => {
      for (const [label, launch, resolved, models, wrote] of [
        ["an agent admitted on the reviewer's line whose only request failed", { agent: "sol-fixer", requested: `${SOL}:high`, turns: [failed(SOL, usageLimit)], thinking: "high" }, SOL, [], []],
        ["a writer that ended on the reviewer's line, which only read", { requested: KIMI, turns: [ok(KIMI), reading(SOL)], thinking: "high" }, SOL, ["kimi-coding/k3", SOL], ["kimi-coding/k3"]],
        ["a writer whose reviewer's-line turn tried a write Atomic refused", { requested: KIMI, turns: [ok(KIMI), did(SOL, { refusedWrite: ["src/feature.ts"] })], thinking: "high" }, SOL, ["kimi-coding/k3", SOL], ["kimi-coding/k3"]],
      ]) {
        const run = chainRun(`ran, not wrote: ${label}`, { inputs: { review_tier: "standard", writer_model: KIMI }, script: { "orchestrator-1": [{ requested: KIMI, turns: [ok(KIMI)] }, launch] } });
        assert.equal((await goalSelect.run(run.ctx)).status, "complete", label);
        const recorded = ledgerOf(run).delegations.at(-1);
        assert.deepEqual([recorded.resolved, recorded.models, recorded.wrote], [resolved, models, wrote], label);
      }
      // The model that took over wrote too: that is the crossing.
      const run = chainRun("ran and wrote", { inputs: { review_tier: "standard", writer_model: KIMI }, script: { "orchestrator-1": [{ requested: KIMI, turns: [ok(KIMI), failed(KIMI, usageLimit), ok(SOL)], thinking: "high", forkedFrom: SOL }] } });
      const refused = await goalSelect.run(run.ctx);
      assert.equal(refused.status, "needs_human");
      const [entry] = ledgerOf(run).delegations;
      assert.deepEqual([entry.requested, entry.started, entry.resolved, entry.thinking, entry.models, entry.wrote, entry.error], [KIMI, "kimi-coding/k3", SOL, "high", ["kimi-coding/k3", SOL], ["kimi-coding/k3", SOL], undefined]);
      assert.equal(entry.summary, `worker ${entry.task.split(":")[0]} asked for ${KIMI}, ran on kimi-coding/k3 then ${SOL}, wrote files on kimi-coding/k3 and ${SOL}, ended on ${SOL}:high`);
      assert.ok(refused.receipts[0].summary.endsWith(`. Delegated tasks: ${entry.summary}`), "the receipt names the model that wrote, not only the one asked for");
      assert.ok(refused.result.includes(entry.summary), "and so does the final report");

      // On the complex tier Astra reviews, so the same task is recorded and reviewed.
      const complex = chainRun("ran and wrote, complex", { inputs: { review_tier: "complex", writer_model: KIMI }, script: { "orchestrator-1": [{ requested: KIMI, turns: [ok(KIMI), failed(KIMI, usageLimit), ok(SOL)], thinking: "high" }] } });
      assert.equal((await goalSelect.run(complex.ctx)).status, "complete");

      // An orchestrator that itself asks for the fallback the tier refuses is caught the same way.
      const asked = chainRun("asked for a reviewer", {
        policy: { ...sharedPolicy, writer_fallbacks: { "anthropic/claude-opus-5-5": [`${SOL}:xhigh`] } },
        inputs: { review_tier: "standard", writer_model: OPUS },
        script: { "orchestrator-1": [{ requested: OPUS, turns: [ok(OPUS)], thinking: "xhigh" }, { requested: `${SOL}:xhigh`, turns: [ok(SOL)], thinking: "xhigh" }] },
      });
      assert.equal((await goalSelect.run(asked.ctx)).status, "needs_human");
      assert.deepEqual(stageNames(asked), ["orchestrator-1"]);
    });

    it("keeps a run closed for a reviewer's own line closed on resume, dispatching no reviewer, and reopens it only when the turn's panel, read again, no longer holds that line", async () => {
      const options = { inputs: { review_tier: "standard", writer_model: KIMI, max_turns: 2 }, script: { "orchestrator-1": [{ turns: [ok(SOL)], thinking: "high" }] } };
      const first = chainRun("closure resume", options);
      assert.equal((await goalSelect.run(first.ctx)).status, "needs_human");
      const closed = ledgerOf(first);
      assert.deepEqual([closed.status, closed.decisions.length, closed.decisions[0].pre_review], ["needs_human", 1, "lineage"]);

      // What an interruption right after the closure was written leaves, and
      // what a person resuming the closed run starts from: the ledger closed,
      // the orchestrator stage recorded, no reviewer ever run. Atomic replays
      // the turn's first policy reading, so each resume reads the file again
      // under a new name.
      for (const attempt of [1, 2]) {
        const again = resumeOf(first, "closure resume", options);
        const result = await goalSelect.run(again.ctx);
        assert.equal(result.status, "needs_human", `resume ${attempt}`);
        assert.deepEqual(stageNames(again), [], `resume ${attempt}: no stage is asked for, reviewer or other`);
        assert.deepEqual(again.fresh, [`tool:resolve-models-1-again-${attempt}:1`], `resume ${attempt}: only the policy was read`);
        const ledger = ledgerOf(again);
        assert.deepEqual([ledger.status, ledger.decisions.length, ledger.decisions[0].pre_review, ledger.reviews.length], ["needs_human", 1, "lineage", 0], `resume ${attempt}: closed again, once`);
        assert.equal(result.remaining_work, closed.decisions[0].reason);
      }

      // The person who resumes it has moved the run to a tier where Astra reviews.
      writeJson(first.policyPath, { ...chainPolicy, review_tier: "complex" });
      const outage = "Codex error: The usage limit has been reached";
      const reopened = resumeOf(first, "closure resume", { ...options, policy: null, review: () => keepGoing, script: { "orchestrator-2": () => { throw new Error(outage); } } });
      await assert.rejects(goalSelect.run(reopened.ctx), /usage limit has been reached/);
      assert.deepEqual(reopened.fresh, ["tool:resolve-models-1-again-3:1", "stage:completion-reviewer-1:1", "stage:evidence-reviewer-1:1", "stage:risk-reviewer-1:1", "tool:resolve-models-2:1"], "Astra's panel reviews what Sol wrote in turn 1");
      const ledger = ledgerOf(reopened);
      assert.deepEqual(ledger.decisions.map((decision) => [decision.turn, decision.decision, decision.pre_review]), [[1, "continue", undefined]], "the closure is gone, not stacked under the review's decision");
      assert.ok(ledger.lifecycle.some((event) => event.event === "reopened" && event.summary.startsWith("Reopened after a closure before review (lineage)")));

      // Interrupted in turn 2 and resumed: turn 1 replays under the reading it
      // was reviewed with, not the first one, which had Sol on the panel.
      const later = resumeOf(reopened, "closure resume", { ...options, policy: null, review: (name) => (name.endsWith("-1") ? keepGoing : approve) });
      assert.equal((await goalSelect.run(later.ctx)).status, "complete");
      assert.deepEqual(later.fresh, ["stage:orchestrator-2:1", "stage:completion-reviewer-2:1", "stage:evidence-reviewer-2:1", "stage:risk-reviewer-2:1"]);
      assert.deepEqual(stageNames(later).slice(0, 4), ["orchestrator-1", "completion-reviewer-1", "evidence-reviewer-1", "risk-reviewer-1"]);
    });

    it("dispatches no reviewer on the replay of a turn another failure closed, when a line that wrote is on the panel resolved for it now", async () => {
      // Sol wrote on the complex tier, where Astra reviews; the reviewers then
      // failed, which closes the run with that turn decided and unreviewed.
      const options = { inputs: { review_tier: "complex", writer_model: KIMI }, script: { "orchestrator-1": [{ turns: [ok(SOL)], thinking: "high" }] } };
      const first = chainRun("replayed turn", { ...options, review: () => { throw new Error("reviewer returned no decision"); } });
      assert.equal((await goalSelect.run(first.ctx)).status, "needs_human");
      assert.deepEqual([ledgerOf(first).decisions[0].decision, ledgerOf(first).decisions[0].pre_review], ["needs_human", undefined]);
      assert.deepEqual(freshStages(first), ["orchestrator-1"], "no review was recorded");

      // Resumed where the turn's panel resolves to the standard tier: its
      // replay would start reviewers that never ran, with Sol among them.
      writeJson(first.policyPath, { ...chainPolicy, review_tier: "standard" });
      const second = resumeOf(first, "replayed turn", { ...options, policy: null, forget: ["tool:resolve-models-1:1"] });
      const result = await goalSelect.run(second.ctx);
      assert.equal(result.status, "needs_human");
      assert.deepEqual(freshStages(second), [], "no reviewer was dispatched");
      assert.ok(result.remaining_work.includes(`wrote files on ${SOL}, a model line that is on the review panel as completion`), result.remaining_work);
      assert.equal(ledgerOf(second).decisions.length, 1, "the decision that closed it stands");
    });

    it("does not take a closure before review for an infrastructure failure, whatever its reason quotes", async () => {
      // The agent's name reads like a provider's rate-limit status, which the
      // reopening of infrastructure failures looks for in a closing reason.
      const options = { inputs: { review_tier: "complex", writer_model: KIMI }, script: { "orchestrator-1": [{ agent: "fix-429-retry", requested: KIMI, turns: [ok(KIMI)], delivered: false }] } };
      const first = chainRun("closure quoting 429", options);
      const closed = await goalSelect.run(first.ctx);
      assert.equal(closed.status, "needs_human");
      assert.match(closed.remaining_work, /fix-429-retry task0001/);
      const second = resumeOf(first, "closure quoting 429", options);
      assert.equal((await goalSelect.run(second.ctx)).status, "complete", "resumed as the closure it is: acknowledged, then reviewed");
      assert.equal(ledgerOf(second).lifecycle.some((event) => event.summary.startsWith("Reopened after an infrastructure failure")), false);
    });

    it("checks every earlier turn's recorded writing against the panel of the turn about to be reviewed", async () => {
      // Turn 1 on the complex tier: Opus fails and Sol, allowed there, writes.
      // The policy then puts Sol on the panel, and turn 2 would have it
      // review what it wrote in turn 1.
      const run = chainRun("panel change", {
        inputs: { review_tier: "complex", writer_model: OPUS },
        review: () => keepGoing,
        script: {
          "orchestrator-1": [{ requested: OPUS, turns: [failed(OPUS, usageLimit)], thinking: "xhigh" }],
          "orchestrator-1-continued-1": (named) => {
            writeJson(run.policyPath, { ...chainPolicy, risk_reviewer_model: `${SOL}:xhigh` });
            return [{ requested: named, turns: [ok(named)], thinking: "xhigh" }];
          },
        },
      });
      const result = await goalSelect.run(run.ctx);
      assert.equal(result.status, "needs_human");
      assert.deepEqual(stageNames(run), ["orchestrator-1", "orchestrator-1-continued-1", "completion-reviewer-1", "evidence-reviewer-1", "risk-reviewer-1"], "turn 1 was reviewed by Astra; turn 2 started nothing");
      const task = ledgerOf(run).delegations[1].task.split(":")[0];
      assert.ok(result.remaining_work.startsWith(`Turn 2 was not sent to review: worker ${task} (turn 1, asked for ${SOL}:xhigh) wrote files on ${SOL}, a model line that is on the review panel as risk (${SOL}:xhigh).`), result.remaining_work);
      assert.deepEqual(ledgerOf(run).decisions.map((decision) => [decision.turn, decision.decision, decision.pre_review]), [[1, "continue", undefined], [2, "needs_human", "lineage"]]);
      assert.equal(result.turns_completed, 1, "turn 2 did no work");

      // Replaying turn 1 on a resume judges it by its own panel and by what had been written by then.
      const again = resumeOf(run, "panel change", { policy: null, inputs: { review_tier: "complex", writer_model: OPUS }, review: () => keepGoing });
      assert.equal((await goalSelect.run(again.ctx)).status, "needs_human");
      assert.deepEqual(again.fresh, ["tool:resolve-models-2-again-1:1"], "turn 1's reviews are replayed; turn 2's policy is read again and it closes again before anything runs");
      assert.equal(ledgerOf(again).decisions.length, 2);

      // With Sol taken off the panel again, the resumed run carries on from turn 2.
      writeJson(run.policyPath, chainPolicy);
      const restored = resumeOf(run, "panel change", { policy: null, inputs: { review_tier: "complex", writer_model: OPUS }, review: (name) => (name.endsWith("-1") ? keepGoing : approve) });
      assert.equal((await goalSelect.run(restored.ctx)).status, "complete");
      assert.deepEqual(freshStages(restored), ["orchestrator-2", "completion-reviewer-2", "evidence-reviewer-2", "risk-reviewer-2"]);
      assert.equal(writerNamed(orchestrators(restored).at(-1)), `${SOL}:xhigh`, "still on the fallback it moved to in turn 1");
    });

    it("closes before review when what a writer did cannot be established, says what could not be read, and goes on when the run is resumed", async () => {
      const writer = { requested: KIMI, turns: [ok(KIMI)] };
      for (const [label, launch, unread] of [
        ["a writer that had not ended when the stage returned", { ...writer, delivered: false }, /^it has no delivery record: it had not ended when the stage returned$/],
        ["a delivery record that cannot be read", { ...writer, delivered: "{ not json" }, /^its delivery record could not be read \(task0001_worker_0_meta\.json\)$/],
        ["a delivery record that names no transcript", { ...writer, delivered: JSON.stringify({ status: "ok", model: "kimi-coding/k3" }) }, /^its delivery record names no transcript/],
        ["a transcript that is not there", { ...writer, transcript: false }, /^its transcript could not be read \(.*task0001-0\.jsonl\)$/],
        ["a transcript with no turn of the agent's own", { requested: KIMI, turns: [], forkedFrom: SOL }, /^its transcript holds no turn of its own$/],
      ]) {
        const options = { inputs: { review_tier: "complex", writer_model: KIMI }, script: { "orchestrator-1": [launch] } };
        const first = chainRun(`unknown: ${label}`, options);
        const closed = await goalSelect.run(first.ctx);
        assert.equal(closed.status, "needs_human", label);
        assert.deepEqual(stageNames(first), ["orchestrator-1"], `${label}: no reviewer was dispatched and the writer was not moved`);
        const [entry] = ledgerOf(first).delegations;
        assert.match(entry.unknown, unread, label);
        assert.equal(closed.remaining_work, `Turn 1 was not sent to review: what worker task0001 (turn 1, asked for ${KIMI}) did is not established: ${entry.unknown}. Check what was changed in the checkout and on which model. Resuming this run reads the evidence again, and sends the turn to review unless a reviewer's own line is then found to have written.`, label);
        assert.deepEqual([ledgerOf(first).decisions[0].pre_review, ledgerOf(first).decisions[0].pre_review_tasks], ["unknown", ["task0001:0"]], label);

        const second = resumeOf(first, `unknown: ${label}`, options);
        assert.equal((await goalSelect.run(second.ctx)).status, "complete", `${label}: the resume is the word that it was looked at`);
        assert.deepEqual(freshStages(second), ["completion-reviewer-1", "evidence-reviewer-1", "risk-reviewer-1"], label);
        const ledger = ledgerOf(second);
        assert.deepEqual([ledger.delegations[0].acknowledged, ledger.decisions.map((decision) => decision.decision)], [true, ["complete"]], label);
        assert.ok(ledger.lifecycle.some((event) => event.event === "reopened" && event.summary.startsWith("Reopened after a closure before review (unknown)")), label);
      }
    });

    it("reads an unknown writer's evidence again on resume, and closes for good if a reviewer's own line turns out to have written", async () => {
      const options = { inputs: { review_tier: "standard", writer_model: KIMI }, script: { "orchestrator-1": [{ requested: KIMI, turns: [ok(KIMI)], delivered: false }] } };
      const first = chainRun("unknown then crossing", options);
      assert.equal((await goalSelect.run(first.ctx)).status, "needs_human");
      assert.equal(ledgerOf(first).decisions[0].pre_review, "unknown");
      // The agent ends after the stage has returned: Kimi's window closed and it finished on Sol.
      first.made.agent("task0001", 0, JSON.parse(first.record.get("stage:orchestrator-1:1")).sessionFile, { turns: [ok(KIMI), failed(KIMI, usageLimit), ok(SOL)], thinking: "high" });

      const second = resumeOf(first, "unknown then crossing", options);
      const result = await goalSelect.run(second.ctx);
      assert.equal(result.status, "needs_human");
      assert.deepEqual(second.fresh, [], "no reviewer was dispatched");
      const ledger = ledgerOf(second);
      assert.deepEqual([ledger.delegations[0].unknown, ledger.delegations[0].acknowledged, ledger.delegations[0].wrote], [undefined, undefined, ["kimi-coding/k3", SOL]]);
      assert.deepEqual(ledger.decisions.map((decision) => decision.pre_review), ["lineage"]);
      assert.ok(result.remaining_work.includes(`wrote files on ${SOL}, a model line that is on the review panel as completion`), result.remaining_work);

      // Read again and found healthy: nothing to acknowledge, and the turn is reviewed.
      const healthy = chainRun("unknown then read", { ...options, inputs: { review_tier: "complex", writer_model: KIMI } });
      assert.equal((await goalSelect.run(healthy.ctx)).status, "needs_human");
      healthy.made.agent("task0001", 0, JSON.parse(healthy.record.get("stage:orchestrator-1:1")).sessionFile, { turns: [ok(KIMI)] });
      const read = resumeOf(healthy, "unknown then read", { ...options, inputs: { review_tier: "complex", writer_model: KIMI } });
      assert.equal((await goalSelect.run(read.ctx)).status, "complete");
      assert.deepEqual([ledgerOf(read).delegations[0].unknown, ledgerOf(read).delegations[0].acknowledged, ledgerOf(read).delegations[0].wrote], [undefined, undefined, ["kimi-coding/k3"]]);
    });

    it("counts an unasked agent as a writer of unknown outcome only when its transcript shows it writing, and a stage whose own transcript cannot be read as one", async () => {
      // A helper that had not ended, or whose record cannot be read, wrote nothing that is known: the run goes on.
      for (const [label, launch] of [
        ["not ended, no transcript to be found", { agent: "codebase-locator", turns: [reading(SOL)], delivered: false }],
        ["not ended, reading so far", { agent: "codebase-locator", turns: [reading(SOL)], delivered: false, inStageFolder: true }],
        ["an unreadable record", { agent: "sol-reviewer", turns: [reading(SOL)], delivered: "{" }],
      ]) {
        const run = chainRun(`helper unknown: ${label}`, { inputs: { review_tier: "standard", writer_model: KIMI }, script: { "orchestrator-1": [{ requested: KIMI, turns: [ok(KIMI)] }, launch] } });
        assert.equal((await goalSelect.run(run.ctx)).status, "complete", label);
        assert.deepEqual([ledgerOf(run).delegations[1].writer, ledgerOf(run).delegations[1].unknown], [false, undefined], label);
        assert.match(ledgerOf(run).delegations[1].summary, /; outcome not established: /, "the ledger still says what it could not read");
      }
      // An agent started afresh keeps its transcript in the stage's folder: one still running there has already written.
      const writing = chainRun("unasked, still writing", { inputs: { review_tier: "complex", writer_model: KIMI }, script: { "orchestrator-1": [{ turns: [ok(GLM)], delivered: false, inStageFolder: true }] } });
      assert.equal((await goalSelect.run(writing.ctx)).status, "needs_human");
      assert.deepEqual([ledgerOf(writing).delegations[0].writer, ledgerOf(writing).delegations[0].wrote, ledgerOf(writing).delegations[0].unknown], [true, ["zai/glm-5.3"], "it has no delivery record: it had not ended when the stage returned"]);

      const lost = join(root, `lost-${randomUUID()}.jsonl`);
      const options = { inputs: { review_tier: "complex", writer_model: KIMI }, script: { "orchestrator-1": { sessionFile: lost } } };
      const first = chainRun("stage transcript unreadable", options);
      const closed = await goalSelect.run(first.ctx);
      assert.equal(closed.status, "needs_human");
      assert.equal(closed.remaining_work.startsWith(`Turn 1 was not sent to review: what orchestrator-1 delegated is not established: the stage's transcript could not be read (${lost}).`), true, closed.remaining_work);
      assert.deepEqual(stageNames(first), ["orchestrator-1"]);
      const second = resumeOf(first, "stage transcript unreadable", options);
      assert.equal((await goalSelect.run(second.ctx)).status, "complete");
      assert.equal(ledgerOf(second).delegations[0].acknowledged, true);

      // A transcript cut off mid-line is not read in part: the stage that returns it closes the same way.
      const tornTranscript = join(root, `torn-${randomUUID()}.jsonl`);
      writeFileSync(tornTranscript, '{"type":"session","version":3}\n{"type":"message","message":{"role":"assist');
      assert.equal(writerFallback.delegatedTasks(tornTranscript, clone), undefined);
      assert.deepEqual(writerFallback.delegatedTasks(undefined, clone), [], "a stage with no transcript at all, as under a test adapter, has nothing to audit");
      const torn = chainRun("stage transcript torn", { inputs: { review_tier: "complex", writer_model: KIMI }, script: { "orchestrator-1": { sessionFile: tornTranscript } } });
      const tornResult = await goalSelect.run(torn.ctx);
      assert.equal(tornResult.status, "needs_human");
      assert.equal(tornResult.remaining_work.startsWith(`Turn 1 was not sent to review: what orchestrator-1 delegated is not established: the stage's transcript could not be read (${tornTranscript}).`), true, tornResult.remaining_work);
      assert.deepEqual([ledgerOf(torn).decisions[0].pre_review, stageNames(torn)], ["unknown", ["orchestrator-1"]]);
    });

    it("passes over a transcript line that is JSON but no entry, and closes before review, not as an orchestrator failure, when the audit itself fails", async () => {
      // Lines such as null, a number or a string among the good ones, in the stage's transcript and the agent's.
      const withOddLines = (file) => {
        const [head, ...rest] = readFileSync(file, "utf8").trimEnd().split("\n");
        writeFileSync(file, `${[head, "null", "7", ...rest.slice(0, 1), '"text"', "true", ...rest.slice(1), "null"].join("\n")}\n`);
      };
      const healthy = chainRun("odd lines", { inputs: { review_tier: "standard", writer_model: KIMI } });
      const { file } = healthy.made.stage("orchestrator-1", [{ requested: KIMI, turns: [ok(KIMI)] }, { agent: "codebase-locator", turns: [reading(SOL)] }]);
      withOddLines(file);
      withOddLines(join(healthy.made.dir, "agents", "task0001-0.jsonl"));
      const read = chainRun("odd lines", { policy: null, inputs: { review_tier: "standard", writer_model: KIMI }, script: { "orchestrator-1": { sessionFile: file } }, made: healthy.made });
      assert.equal((await goalSelect.run(read.ctx)).status, "complete");
      assert.deepEqual(ledgerOf(read).delegations.map((entry) => [entry.agent, entry.wrote, entry.unknown]), [["worker", ["kimi-coding/k3"], undefined], ["codebase-locator", [], undefined]]);

      // The same lines do not hide a reviewer's line that wrote.
      const crossing = chainRun("odd lines crossing", { inputs: { review_tier: "standard", writer_model: KIMI } });
      const crossed = crossing.made.stage("orchestrator-1", [{ requested: KIMI, turns: [ok(KIMI), ok(SOL)], thinking: "high" }]).file;
      withOddLines(crossed);
      withOddLines(join(crossing.made.dir, "agents", "task0001-0.jsonl"));
      const closedForLineage = chainRun("odd lines crossing", { policy: null, inputs: { review_tier: "standard", writer_model: KIMI }, script: { "orchestrator-1": { sessionFile: crossed } }, made: crossing.made });
      assert.equal((await goalSelect.run(closedForLineage.ctx)).status, "needs_human");
      assert.equal(ledgerOf(closedForLineage).decisions[0].pre_review, "lineage");

      // A launch record no real run writes: expanding it throws inside the
      // audit. The turn closes as one whose writers are not established,
      // with the marker a resume checks, and the resume audits it again.
      const options = { inputs: { review_tier: "complex", writer_model: KIMI } };
      const broken = chainRun("audit throws", options);
      const unauditable = broken.made.stage("orchestrator-1", [{ requested: KIMI, turns: [ok(KIMI)] }]).file;
      writeFileSync(
        unauditable,
        `${readFileSync(unauditable, "utf8")
          .trimEnd()
          .split("\n")
          .map((text) => {
            const entry = JSON.parse(text);
            const launch = entry.message?.content?.find?.((part) => part.type === "toolCall" && part.name === "subagent" && part.arguments.action === undefined);
            if (launch !== undefined) launch.arguments = { tasks: [{ agent: "worker", task: "Do the work.", model: KIMI, count: 2 ** 32 }] };
            return JSON.stringify(entry);
          })
          .join("\n")}\n`,
      );
      assert.throws(() => writerFallback.delegatedTasks(unauditable, clone), RangeError);
      const first = chainRun("audit throws", { ...options, policy: null, script: { "orchestrator-1": { sessionFile: unauditable } }, made: broken.made });
      const closed = await goalSelect.run(first.ctx);
      assert.equal(closed.status, "needs_human");
      assert.match(closed.remaining_work, /^Turn 1 was not sent to review: what orchestrator-1 delegated is not established: the audit of the stage's transcript failed \(Invalid array length\)\./);
      assert.deepEqual([ledgerOf(first).decisions[0].pre_review, ledgerOf(first).decisions[0].pre_review_tasks, stageNames(first)], ["unknown", ["stage:orchestrator-1"], ["orchestrator-1"]]);
      const second = resumeOf(first, "audit throws", { ...options, policy: null, script: { "orchestrator-1": { sessionFile: unauditable } } });
      assert.equal((await goalSelect.run(second.ctx)).status, "complete", "a person's resume answers for it, as for any writer whose outcome is not established");
      assert.equal(ledgerOf(second).delegations[0].acknowledged, true);
    });

    it("reads the policy afresh on each resume of a closure for a reviewer's own line, after a reading that failed its checks too", async () => {
      const options = { inputs: { review_tier: "standard", writer_model: KIMI }, script: { "orchestrator-1": [{ turns: [ok(SOL)], thinking: "high" }] } };
      const first = chainRun("bad re-read", options);
      assert.equal((await goalSelect.run(first.ctx)).status, "needs_human");
      assert.equal(ledgerOf(first).decisions[0].pre_review, "lineage");

      // Broken: the panel is given the launch writer's own line, which the
      // lineage check refuses once the reading is made and recorded.
      writeJson(first.policyPath, { ...chainPolicy, review_tiers: { ...chainPolicy.review_tiers, standard: { ...chainPolicy.review_tiers.standard, reviewer_model: KIMI } } });
      const second = resumeOf(first, "bad re-read", { ...options, policy: null });
      await assert.rejects(goalSelect.run(second.ctx), /^Error: Review tier standard puts the writer's model \(kimi-coding\/k3:max\) on the review panel/);
      assert.deepEqual(second.fresh, ["tool:resolve-models-1-again-1:1"]);
      const kept = ledgerOf(second);
      assert.deepEqual([kept.status, kept.decisions.length, kept.decisions[0].pre_review, kept.model_reads], ["needs_human", 1, "lineage", { 1: 1 }], "the closure stands and the reading is counted");

      // Corrected: a tier whose panel does not hold Sol. The reading that failed is not the one replayed.
      writeJson(first.policyPath, { ...chainPolicy, review_tier: "complex" });
      const third = resumeOf(second, "bad re-read", { ...options, policy: null });
      assert.equal((await goalSelect.run(third.ctx)).status, "complete");
      assert.deepEqual(third.fresh, ["tool:resolve-models-1-again-2:1", "stage:completion-reviewer-1:1", "stage:evidence-reviewer-1:1", "stage:risk-reviewer-1:1"]);
      assert.deepEqual(ledgerOf(third).decisions.map((decision) => [decision.turn, decision.decision, decision.pre_review]), [[1, "complete", undefined]]);
    });

    it("replays a turn whose models were resolved by the earlier engine with no chain, and audits only that turn's own tasks", async () => {
      const outage = "Codex error: The usage limit has been reached";
      const options = {
        inputs: { review_tier: "complex", writer_model: KIMI },
        review: (name) => (name.endsWith("-1") ? keepGoing : approve),
        script: {
          "orchestrator-1": [{ requested: KIMI, turns: [ok(KIMI), failed(KIMI, usageLimit), ok(SOL)], thinking: "high" }],
          "orchestrator-2": () => {
            throw new Error(outage);
          },
        },
      };
      const first = chainRun("earlier engine", options);
      await assert.rejects(goalSelect.run(first.ctx), /usage limit has been reached/);
      assert.deepEqual(first.fresh.filter((key) => key.startsWith("tool:resolve-models")), ["tool:resolve-models-1:1", "tool:resolve-models-2:1"]);

      // What the earlier engine left: recorded model resolutions without
      // writerFallbacks, and a ledger without delegations or writer moves.
      for (const key of ["tool:resolve-models-1:1", "tool:resolve-models-2:1"]) {
        const { writerFallbacks, ...resolved } = JSON.parse(first.record.get(key));
        assert.deepEqual(writerFallbacks, standingOrder);
        first.record.set(key, JSON.stringify(resolved));
      }
      const statePath = join(JSON.parse(first.record.get("tool:artifact-root:1")), "goal-ledger-state.json");
      const { delegations, writer_moves: _moves, ...earlier } = JSON.parse(readFileSync(statePath, "utf8"));
      assert.equal(delegations.length, 1);
      writeJson(statePath, earlier);

      // Resumed on the changed engine. Turn 2's models were resolved before
      // the change, so its writer has no chain though the policy file now
      // names one; turn 1 is decided, and its Sol-written task is not turn 2's.
      const second = resumeOf(first, "earlier engine", { ...options, script: { "orchestrator-2": [{ requested: KIMI, turns: [failed(KIMI, usageLimit)] }] } });
      await assert.rejects(goalSelect.run(second.ctx), (error) => {
        assert.ok(error.message.includes(`No fallback writer is left after ${KIMI} (the policy allows none for ${KIMI}).`), error.message);
        return true;
      });
      assert.deepEqual(second.fresh, ["stage:orchestrator-2:1"], "both recorded resolutions and every stage of turn 1 were replayed");
      assert.deepEqual(stageNames(second), ["orchestrator-1", "completion-reviewer-1", "evidence-reviewer-1", "risk-reviewer-1", "orchestrator-2"]);
      assert.equal(typeof orchestrators(second)[1].options.isFallbackModelAllowed, "function", "the gate needs nothing the earlier engine did not record");
      assert.deepEqual(ledgerOf(second).delegations.map((entry) => [entry.turn, entry.requested, entry.error]), [[2, KIMI, usageLimit]]);

      // Resumed again: turn 2 continues from its launch writer, and turn 3,
      // resolved by the changed engine, has the chain.
      const third = resumeOf(second, "earlier engine", { ...options, review: (name) => (name.endsWith("-3") ? approve : keepGoing), script: { "orchestrator-3": [{ requested: KIMI, turns: [failed(KIMI, usageLimit)] }] } });
      assert.equal((await goalSelect.run(third.ctx)).status, "complete");
      assert.deepEqual(orchestrators(third).map((stage) => [stage.name, writerNamed(stage)]), [["orchestrator-1", KIMI], ["orchestrator-2", KIMI], ["orchestrator-2-continued-1", KIMI], ["orchestrator-3", KIMI], ["orchestrator-3-continued-1", GLM]]);
    });

    it("reads delegated tasks from a stage's transcript: parallel launches, an agent not yet delivered, and nothing for a stage that delegated nothing", () => {
      const made = transcripts();
      const { file, ids } = made.stage("orchestrator-1", [
        { requested: KIMI, turns: [ok(KIMI)] },
        { agent: "m2.authorized-writer", requested: GLM, turns: [ok(GLM)], delivered: false },
      ]);
      const [done, running] = writerFallback.delegatedTasks(file, clone);
      assert.deepEqual([done.task, done.agent, done.requested, done.started, done.resolved, done.models, done.wrote, done.unread], [`${ids[0]}:0`, "worker", KIMI, "kimi-coding/k3", "kimi-coding/k3", ["kimi-coding/k3"], ["kimi-coding/k3"], undefined]);
      assert.deepEqual([running.agent, running.requested, running.resolved, running.models, running.error, running.unread], ["m2.authorized-writer", GLM, "zai/glm-5.3", [], undefined, "it has no delivery record: it had not ended when the stage returned"], "its task record still names the model");
      assert.equal(writerFallback.describeDelegatedTask(running), `m2.authorized-writer ${ids[1]} asked for ${GLM}, produced no turn, wrote no file, ended on ${GLM}; outcome not established: it has no delivery record: it had not ended when the stage returned`);

      const parallel = join(made.dir, "parallel.jsonl");
      const record = (index, agent, ran) => ({ launchOperationId: `para0001:${index}`, agentName: agent, model: ran, thinking: "max" });
      writeFileSync(
        parallel,
        [
          { type: "session", version: 3, id: "parallel", timestamp: "2026-10-09T01:00:00.000Z" },
          { type: "message", message: { role: "assistant", content: [{ type: "toolCall", id: "call-parallel", name: "subagent", arguments: { tasks: [{ agent: "worker", task: "a", model: KIMI, count: 2 }, { agent: "debugger", task: "b" }] } }] } },
          { type: "message", message: { role: "toolResult", toolCallId: "call-parallel", toolName: "subagent", details: { taskRecords: [record(0, "worker", "kimi-coding/k3"), record(1, "worker", "kimi-coding/k3"), record(2, "debugger", SOL)] } } },
          { type: "message", message: { role: "toolResult", toolCallId: "status-unknown", toolName: "subagent", details: { taskRecords: [{ launchOperationId: "gone0001:0", agentName: "worker", model: SOL }] } } },
        ]
          .map((entry) => JSON.stringify(entry))
          .join("\n"),
      );
      assert.deepEqual(writerFallback.delegatedTasks(parallel, clone).map((task) => [task.task, task.agent, task.requested, task.resolved]), [
        ["para0001:0", "worker", KIMI, "kimi-coding/k3"],
        ["para0001:1", "worker", KIMI, "kimi-coding/k3"],
        ["para0001:2", "debugger", undefined, SOL],
      ]);
      assert.deepEqual(writerFallback.delegatedTaskIds(parallel), ["para0001:0", "para0001:1", "para0001:2"]);
      assert.deepEqual(writerFallback.delegatedTaskIds(join(made.dir, "missing.jsonl")), []);
      assert.equal(writerFallback.delegatedTasks(join(made.dir, "missing.jsonl"), clone), undefined, "a transcript that should be there and is not is not an empty one");
    });

    it("Atomic's runtime hands the orchestrator's fallback gate to its stage session", async () => {
      const seen = [];
      const adapters = { prompt: { prompt: async (_text, meta) => (seen.push([meta.stageName, meta.stageOptions?.isFallbackModelAllowed]), "done") } };
      await run(goalSelect, { objective: "probe", branch_checkout_dir: "seed feature", review_tier: "standard" }, { durability: { mode: "memory" }, cwd: seed, adapters });
      const [[name, gate]] = seen;
      assert.equal(name, "orchestrator-1");
      assert.equal(gate(model(SOL), "high"), false, "the function itself reaches the session options, not a copy of the stage's data");
      assert.equal(gate(model(GLM), "max"), true);
    });

    it("Atomic's runtime ends a run stopped this way as failed with the reason, and kills one that throws the same text", async () => {
      const reason = `goal-select stopped in turn 1 with the work unfinished: worker on ${SONNET} stopped on a model error: invalid api key.`;
      const stopping = (name, stop) =>
        workflow({
          name,
          description: "",
          inputs: {},
          outputs: { done: Type.Optional(Type.Boolean()) },
          run: async (ctx) => {
            await ctx.task("orchestrator-1", { prompt: "delegate" });
            return stop(ctx);
          },
        });
      const options = { durability: { mode: "memory" }, cwd: root, adapters: { prompt: { prompt: async () => "done" } } };
      const stopped = await run(stopping("goal-select-stop-probe", (ctx) => writerFallback.stopResumable(ctx, reason)), {}, options);
      assert.deepEqual([stopped.status, stopped.exited, stopped.exitReason], ["failed", true, reason]);
      const thrown = await run(stopping("goal-select-throw-probe", () => { throw new Error(reason); }), {}, options);
      assert.equal(thrown.status, "killed", "a thrown error that quotes a rejected credential is not resumable, which is why the stop is an exit");
    });
  });

  it("Atomic's runtime hands task and parallel-step cwd to the stage session", async () => {
    const seen = [];
    const probe = workflow({
      name: "goal-select-cwd-probe",
      description: "",
      inputs: {},
      outputs: { done: Type.Optional(Type.Boolean()) },
      run: async (ctx) => {
        await ctx.task("single", { prompt: "single", cwd: clone });
        await ctx.parallel([
          { name: "branch-a", prompt: "a", cwd: clone },
          { name: "branch-b", prompt: "b", cwd: seed },
        ]);
        return { done: true };
      },
    });
    const outcome = await run(probe, {}, {
      durability: { mode: "memory" },
      cwd: root,
      adapters: { prompt: { prompt: async (_text, meta) => (seen.push([meta.stageName, meta.stageOptions?.cwd]), "done") } },
    });
    assert.equal(outcome.status, "completed");
    assert.deepEqual(seen.sort(), [["branch-a", clone], ["branch-b", seed], ["single", clone]]);
  });

  it("Atomic's runtime runs goal-select's orchestrator in a relative sibling clone and resolves inputs there", async () => {
    const seen = [];
    const adapters = { prompt: { prompt: async (_text, meta) => (seen.push([meta.stageName, meta.stageOptions?.cwd, meta.stageOptions?.model]), "done") } };
    const resolved = await run(goalSelect, { objective: "probe", branch_checkout_dir: "seed feature", resolve_only: true }, { durability: { mode: "memory" }, cwd: seed, adapters });
    assert.equal(resolved.status, "completed");
    assert.equal(JSON.parse(resolved.result.models).checkout, clone);

    const failed = await run(goalSelect, { objective: "probe", branch_checkout_dir: "missing clone" }, { durability: { mode: "memory" }, cwd: seed, adapters });
    assert.notEqual(failed.status, "completed");
    assert.match(failed.error ?? "", /does not exist/);
    assert.deepEqual(seen, []);

    await run(goalSelect, { objective: "probe", branch_checkout_dir: "seed feature", model_policy_path: defaultJson }, { durability: { mode: "memory" }, cwd: seed, adapters });
    assert.deepEqual(seen, [["orchestrator-1", clone, "test/clone-orchestrator"]]);
  });

  it("Atomic's runtime marks the run that owns goal-select's stages, so its MCP discovery extension can recognise them", async () => {
    const seen = [];
    const adapters = {
      prompt: {
        prompt: async (_text, meta) => {
          seen.push(meta.runId);
          return "done";
        },
      },
    };
    const runId = `goal-select-mark-${randomUUID()}`;
    assert.equal(discovery.isGoalSelectRun(runId), false);
    await run(goalSelect, { objective: "probe", branch_checkout_dir: "seed feature", model_policy_path: defaultJson }, { durability: { mode: "memory" }, cwd: seed, adapters, runId });
    assert.ok(seen.length > 0);
    assert.ok(seen.every((stageRunId) => stageRunId === runId && discovery.isGoalSelectRun(stageRunId)), JSON.stringify(seen));
    assert.equal(discovery.isGoalSelectRun("some-other-workflow-run"), false);
  });

  it("leaves Git state alone: no worktrees, no branch switches, no process.chdir", () => {
    assert.equal(git("-C", seed, "branch", "--show-current"), "main");
    assert.equal(git("-C", clone, "branch", "--show-current"), cloneBranch);
    assert.equal(git("-C", clone, "config", "bc.source"), seed);
    for (const checkout of [seed, clone]) {
      assert.equal(git("-C", checkout, "worktree", "list", "--porcelain").split("\n").filter((line) => line.startsWith("worktree ")).length, 1);
    }
    assert.equal(existsSync(join(seed, ".atomic", "worktrees")), false);
    assert.equal(existsSync(join(clone, ".atomic", "worktrees")), false);
    assert.equal(process.cwd(), startCwd);
  });
});

describe("goal-select automatic branch clone (real git bc-add fixtures; fake workflow context and Atomic runtime adapters, no model)", () => {
  const objective = "Fix the login redirect loop!";
  const slug = "fix-login-redirect-loop";
  const committedPolicy = { orchestrator_model: "test/committed-orchestrator", reviewer_model: "test/committed-reviewer" };
  const localPolicy = { orchestrator_model: "test/local-orchestrator" };
  let autoRoot;
  let autoServer;
  let autoSeed;
  let seedHead;
  let initialSeed;
  let savedArtifactDir;

  // The naming rule: first 8 hex digits of sha256(run id).
  const idFor = (runId) => createHash("sha256").update(runId).digest("hex").slice(0, 8);
  const siblings = () => readdirSync(autoRoot).filter((name) => name.includes(".goal-")).sort();
  const alive = (pid) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  };
  async function waitFor(check, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (!check()) {
      if (Date.now() > deadline) throw new Error("timed out waiting for fixture state");
      await new Promise((resolveWait) => setTimeout(resolveWait, 50));
    }
  }

  function seedState(dir) {
    return {
      branch: git("-C", dir, "branch", "--show-current"),
      head: git("-C", dir, "rev-parse", "HEAD"),
      refs: git("-C", dir, "for-each-ref", "--format=%(refname) %(objectname)"),
      status: git("-C", dir, "--no-optional-locks", "status", "--porcelain=v1", "--untracked-files=all", "--ignored"),
      index: readFileSync(join(dir, ".git", "index")).toString("base64"),
      config: readFileSync(join(dir, ".git", "config"), "utf8"),
      worktrees: git("-C", dir, "worktree", "list", "--porcelain"),
    };
  }

  function makeRepo(dir, { origin = autoServer, commit = true } = {}) {
    git("init", "--quiet", "-b", "main", dir);
    if (commit) git("-C", dir, "commit", "--quiet", "--allow-empty", "-m", "Seed commit");
    if (origin) git("-C", dir, "remote", "add", "origin", origin);
    return dir;
  }

  // Where a run with this id should put its clone, from the naming rule alone.
  function planned(runId, cwd = autoSeed) {
    const leaf = `${slug}-${idFor(runId)}`;
    return { branch: `goal-${leaf}`, target: join(dirname(cwd), `${basename(cwd)}.goal-${leaf}`) };
  }

  function startAuto({ runId = `auto-${randomUUID()}`, cwd = autoSeed, inputs = {}, ...rest } = {}) {
    const { ctx, calls } = fakeContext({ cwd, runId, inputs: { objective, ...inputs }, ...rest });
    return { outcome: goalSelect.run(ctx), calls, runId, ...planned(runId, cwd) };
  }

  async function autoRun(options) {
    const started = startAuto(options);
    return { ...started, result: await started.outcome };
  }

  const created = (calls) => calls.find((call) => call.name === "create-branch-clone")?.result;

  before(() => {
    savedArtifactDir = process.env.ATOMIC_WORKFLOW_ARTIFACT_DIR;
    autoRoot = realpathSync(mkdtempSync(join(tmpdir(), "goal-select-auto-")));
    process.env.ATOMIC_WORKFLOW_ARTIFACT_DIR = join(autoRoot, "artifacts");
    process.chdir = () => {
      throw new Error("goal-select must not call process.chdir");
    };
    autoServer = join(autoRoot, "server.git");
    autoSeed = join(autoRoot, "auto seed");
    git("init", "--quiet", "--bare", autoServer);
    makeRepo(autoSeed, { commit: false });
    writeFileSync(join(autoSeed, "README.md"), "committed\n");
    writeFileSync(join(autoSeed, "notes.txt"), "committed notes\n");
    writeFileSync(join(autoSeed, ".gitignore"), ".env\n.atomic/local-models.json\n.atomic/secret.json\n");
    writeJson(join(autoSeed, ".atomic", "goal-select-models.json"), committedPolicy);
    git("-C", autoSeed, "add", ".");
    git("-C", autoSeed, "commit", "--quiet", "-m", "Seed commit");
    git("-C", autoSeed, "push", "--quiet", "origin", "main");
    // Uncommitted seed state that must neither change nor reach a clone.
    writeFileSync(join(autoSeed, "README.md"), "staged edit\n");
    git("-C", autoSeed, "add", "README.md");
    writeFileSync(join(autoSeed, "notes.txt"), "unstaged edit\n");
    writeFileSync(join(autoSeed, "scratch.txt"), "untracked\n");
    writeFileSync(join(autoSeed, ".env"), "TOKEN=local\n");
    writeJson(join(autoSeed, ".atomic", "local-models.json"), localPolicy);
    writeJson(join(autoSeed, ".atomic", "secret.json"), { secret: true });
    seedHead = git("-C", autoSeed, "rev-parse", "HEAD");
    initialSeed = seedState(autoSeed);
  });

  after(() => {
    process.chdir = originalChdir;
    process.env.ATOMIC_WORKFLOW_ARTIFACT_DIR = savedArtifactDir;
    rmSync(autoRoot, { recursive: true, force: true });
  });

  it("names the branch and sibling directory from the objective and run id, Git-valid and bounded", () => {
    for (const [text, expected] of [
      ["Fix the login redirect loop!", "fix-login-redirect-loop"],
      ["<keepContext>Update goal-select so it automatically generates a suitable objective-derived branch name</keepContext>", "update-goal-select-automatically"],
      ["Café naïve résumé\nsecond line", "cafe-naive-resume-second-line"],
      ["../../etc/passwd --force $(rm -rf ~) `id`", "etc-passwd-force-rm-rf-id"],
      ["修复登录 🚀", "task"],
      ["", "task"],
      ["   \n\t", "task"],
      ["x".repeat(5000), "x".repeat(40)],
      [`Refactor ${"module ".repeat(1000)}`, "refactor-module-module-module-module"],
    ]) {
      assert.equal(objectiveSlug(text), expected, JSON.stringify(text.slice(0, 40)));
      for (const owner of ["run-1", randomUUID()]) {
        const { branch, target } = branchCloneName("/code/auto seed", expected, owner);
        assert.equal(git("check-ref-format", "--branch", branch), branch);
        assert.match(branch, /^goal-[a-z0-9]+(-[a-z0-9]+)*-[0-9a-f]{8}$/, "flat: no ref directory that a seed branch named goal could block");
        assert.ok(branch.length <= 54, branch);
        assert.equal(dirname(target), "/code");
        assert.equal(basename(target), `auto seed.${branch}`);
      }
    }
    assert.deepEqual(branchCloneName("/code/auto seed", slug, "run-1"), {
      branch: "goal-fix-login-redirect-loop-4e65d3fb",
      target: "/code/auto seed.goal-fix-login-redirect-loop-4e65d3fb",
    });
    assert.equal(branchCloneName("/code/auto seed", slug, "run-2").branch, "goal-fix-login-redirect-loop-b9d17232");
  });

  it("bounds the whole sibling directory name to 255 bytes for a long seed name, keeping whole codepoints, the objective words and the run id", async () => {
    const branch = "goal-fix-login-redirect-loop-4e65d3fb";
    for (const [name, kept] of [
      ["s".repeat(220), "s".repeat(217)],
      ["é".repeat(120), "é".repeat(108)],
      ["种".repeat(80), "种".repeat(72)],
      ["🚀".repeat(60), "🚀".repeat(54)],
      ["s".repeat(217), "s".repeat(217)],
    ]) {
      const { target } = branchCloneName(`/code/${name}`, slug, "run-1");
      assert.equal(target, `/code/${kept}.${branch}`);
      assert.ok(Buffer.byteLength(basename(target)) <= 255, `${Buffer.byteLength(basename(target))} bytes`);
    }

    for (const name of ["s".repeat(220), "种".repeat(80)]) {
      const longSeed = makeRepo(join(autoRoot, name));
      const longSeedBefore = seedState(longSeed);
      const { result, calls } = await autoRun({ cwd: longSeed, runId: `long-${randomUUID()}` });
      const made = created(calls);
      assert.equal(result.status, "complete");
      assert.match(made.branch, /^goal-fix-login-redirect-loop-[0-9a-f]{8}$/);
      assert.equal(dirname(made.checkout), autoRoot);
      assert.ok(basename(made.checkout).endsWith(`.${made.branch}`), made.checkout);
      assert.ok(Buffer.byteLength(basename(made.checkout)) <= 255, `${Buffer.byteLength(basename(made.checkout))} bytes`);
      assert.equal(git("-C", made.checkout, "branch", "--show-current"), made.branch);
      assert.equal(git("-C", made.checkout, "config", "bc.source"), longSeed);
      assert.ok(modelStages(calls).length > 0);
      assert.ok(modelStages(calls).every((stage) => stage.options.cwd === made.checkout));
      assert.deepEqual(seedState(longSeed), longSeedBefore);
    }
  });

  it("clones a seed whose current branch is goal, and a replay adopts that one clone; a plan whose branch the seed's current branch blocks fails before git bc-add", async () => {
    const goalSeed = join(autoRoot, "goal seed");
    git("init", "--quiet", "-b", "goal", goalSeed);
    git("-C", goalSeed, "commit", "--quiet", "--allow-empty", "-m", "Seed commit");
    git("-C", goalSeed, "remote", "add", "origin", autoServer);
    const goalSeedBefore = seedState(goalSeed);
    assert.equal(git("-C", goalSeed, "for-each-ref", "--format=%(refname)"), "refs/heads/goal");
    const goalClones = () => readdirSync(autoRoot).filter((name) => name.startsWith("goal seed.goal-"));

    const runId = `goal-head-${randomUUID()}`;
    const first = await autoRun({ cwd: goalSeed, runId });
    assert.equal(first.result.status, "complete");
    assert.equal(first.branch, `goal-${slug}-${idFor(runId)}`);
    assert.deepEqual(created(first.calls), { checkout: first.target, branch: first.branch, seed: goalSeed, head: goalSeedBefore.head, adopted: false, policy_copied_from: null });
    assert.equal(git("-C", first.target, "branch", "--show-current"), first.branch);
    assert.equal(git("-C", first.target, "config", "bc.source"), goalSeed);
    assert.ok(modelStages(first.calls).length > 0);
    assert.ok(modelStages(first.calls).every((stage) => stage.options.cwd === first.target));
    assert.deepEqual(goalClones(), [basename(first.target)]);

    const replay = await autoRun({ cwd: goalSeed, runId });
    assert.equal(created(replay.calls).adopted, true);
    assert.equal(created(replay.calls).checkout, first.target);
    assert.deepEqual(goalClones(), [basename(first.target)]);

    // A plan checkpointed under the old goal/<leaf> naming must not leave a partial clone.
    const plan = await planBranchClone({ invocationCwd: goalSeed, slug, runId: `goal-head-legacy-${randomUUID()}` });
    const legacy = { ...plan, branch: `goal/${plan.branch.slice("goal-".length)}` };
    await assert.rejects(createBranchClone(legacy, {}), (error) => {
      assert.match(error.message, /goal\/fix-login-redirect-loop-[0-9a-f]{8} conflicts with the seed's current branch goal \(refs\/heads\/goal\)/);
      assert.ok(error.message.includes("did not fall back to the invoking checkout"), error.message);
      assert.equal(error.message.includes("move it aside"), false, error.message);
      return true;
    });
    assert.equal(existsSync(legacy.target), false);
    assert.deepEqual(goalClones(), [basename(first.target)]);

    assert.deepEqual(seedState(goalSeed), goalSeedBefore);
    assert.equal(git("-C", goalSeed, "for-each-ref", "--format=%(refname)"), "refs/heads/goal");
  });

  it("creates a full git bc-add clone beside the seed by default and runs every stage there", async () => {
    const siblingsBefore = siblings();
    const { result, calls, target, branch } = await autoRun({
      runId: "run-1",
      inputs: { create_pr: true },
      onTask: (name) => (name.startsWith("reverify-") ? { structured: { score: 15, evidence: ["Confirmed."] } } : {}),
      review: (name) => {
        if (name === "risk-reviewer-1") return blocking(join(autoSeed, "README.md"));
        return name.endsWith("-1") ? keepGoing : approve;
      },
    });
    assert.equal(target, join(autoRoot, "auto seed.goal-fix-login-redirect-loop-4e65d3fb"));
    assert.equal(branch, "goal-fix-login-redirect-loop-4e65d3fb");
    assert.equal(result.status, "complete");
    assert.deepEqual(calls.slice(0, 2).map((call) => call.name), ["plan-branch-clone", "create-branch-clone"]);
    assert.equal(calls.some((call) => call.name === "resolve-branch-checkout"), false);
    assert.deepEqual(toolArgs(calls, "plan-branch-clone"), { invocation_cwd: autoSeed, slug, run_id: "run-1" });
    assert.deepEqual(created(calls), { checkout: target, branch, seed: autoSeed, head: seedHead, adopted: false, policy_copied_from: null });
    assert.deepEqual(siblings(), [...siblingsBefore, basename(target)].sort());

    assert.equal(dirname(target), dirname(autoSeed));
    assert.equal(lstatSync(join(target, ".git")).isDirectory(), true, "a full clone, not a worktree");
    assert.equal(git("-C", target, "rev-parse", "--show-toplevel"), target);
    assert.equal(git("-C", target, "branch", "--show-current"), branch);
    assert.equal(git("-C", target, "rev-parse", "HEAD"), seedHead);
    assert.equal(git("-C", target, "config", "bc.source"), autoSeed);
    assert.equal(git("-C", target, "remote", "get-url", "origin"), autoServer);
    assert.equal(git("-C", target, "worktree", "list", "--porcelain").split("\n").filter((line) => line.startsWith("worktree ")).length, 1);
    assert.equal(readFileSync(join(target, "README.md"), "utf8"), "committed\n");
    assert.equal(readFileSync(join(target, "notes.txt"), "utf8"), "committed notes\n");
    assert.equal(existsSync(join(target, "scratch.txt")), false);
    assert.equal(readFileSync(join(target, ".env"), "utf8"), "TOKEN=local\n", "git bc-add carries ignored extras");
    assert.deepEqual(readdirSync(join(target, ".atomic")), ["goal-select-models.json"]);
    assert.equal(git("-C", target, "--no-optional-locks", "status", "--porcelain"), "");

    const stages = modelStages(calls);
    assert.deepEqual(
      stages.map((stage) => stage.name),
      ["orchestrator-1", "completion-reviewer-1", "evidence-reviewer-1", "risk-reviewer-1", "reverify-1", "reverify-2", "reverify-3", "orchestrator-2", "completion-reviewer-2", "evidence-reviewer-2", "risk-reviewer-2", "pull-request"],
    );
    for (const stage of stages) {
      assert.equal(stage.options.cwd, target, `${stage.name} cwd`);
      for (const key of ["worktree", "gitWorktreeDir", "baseBranch"]) assert.equal(key in stage.options, false, `${stage.name} ${key}`);
    }
    const byName = Object.fromEntries(stages.map((stage) => [stage.name, stage.options]));
    assert.ok(byName["orchestrator-1"].prompt.includes(`Current working directory: ${target}`));
    assert.ok(byName["pull-request"].prompt.includes(`Current working directory: ${target}`));
    assert.equal(byName["orchestrator-1"].model, sharedPolicy.defaults.orchestrator_model, "the shared policy wins over the clone's committed project-local policy");
    assert.equal(byName["completion-reviewer-1"].model, sharedPolicy.review_tiers.complex.reviewer_model);
    assert.equal(byName["risk-reviewer-1"].model, sharedPolicy.review_tiers.complex.risk_reviewer_model);
    assert.equal(toolArgs(calls, "resolve-models-1").path, sharedDefaultPath);
    assert.deepEqual(seedState(autoSeed), initialSeed);
    assert.equal(process.cwd(), startCwd);
  });

  it("treats a literal auto like the default", async () => {
    for (const value of ["auto", " auto "]) {
      const { result, calls, target, branch } = await autoRun({ inputs: { branch_checkout_dir: value } });
      assert.equal(result.status, "complete");
      assert.equal(created(calls).checkout, target);
      assert.equal(git("-C", target, "branch", "--show-current"), branch);
      assert.ok(modelStages(calls).every((stage) => stage.options.cwd === target));
    }
  });

  it("previews auto under resolve_only without creating a clone, naming where the policy comes from", async () => {
    const siblingsBefore = siblings();
    const target = join(autoRoot, "auto seed.goal-fix-login-redirect-loop-b9d17232");
    for (const inputs of [{}, { branch_checkout_dir: "auto" }]) {
      const { result, calls } = await autoRun({ runId: "run-2", inputs: { ...inputs, resolve_only: true } });
      assert.deepEqual(calls.map((call) => call.name), ["plan-branch-clone", "resolve-models-1"]);
      assert.deepEqual(modelStages(calls), []);
      const models = JSON.parse(result.models);
      assert.equal(models.checkout, null);
      assert.deepEqual(models.planned_checkout, { path: target, branch: "goal-fix-login-redirect-loop-b9d17232", seed: autoSeed, seed_head: seedHead, created: false });
      assert.equal(models.launch.policyPath, sharedDefaultPath);
      assert.equal("policyFallbackPath" in models.launch, false);
      assert.deepEqual(models.policy, sharedPolicy);
      assert.equal(models.policy_source, sharedDefaultPath, "the shared absolute policy is previewed as-is, never copied");
      assert.ok(result.result.startsWith("- Preview only: no branch clone was created and no Goal stage ran."), result.result);
      assert.ok(result.result.includes(`- Planned clone: ${target}`), result.result);
      assert.equal(existsSync(target), false);
    }

    const local = JSON.parse((await autoRun({ inputs: { resolve_only: true, model_policy_path: ".atomic/local-models.json" } })).result.models);
    assert.deepEqual(local.policy, localPolicy);
    assert.equal(local.policy_source, `${join(autoSeed, ".atomic", "local-models.json")} (not committed; copied into the clone when it is created)`);
    assert.equal(local.launch.policyPath, join(local.planned_checkout.path, ".atomic", "local-models.json"));

    const absolutePath = join(autoRoot, "policies", "absolute policy.json");
    writeJson(absolutePath, { orchestrator_model: "test/absolute-orchestrator" });
    const absolute = JSON.parse((await autoRun({ inputs: { resolve_only: true, model_policy_path: absolutePath } })).result.models);
    assert.equal(absolute.launch.policyPath, absolutePath);
    assert.equal(absolute.policy_source, absolutePath);
    assert.equal(absolute.policy.orchestrator_model, "test/absolute-orchestrator");

    const none = await autoRun({ inputs: { resolve_only: true, model_policy_path: ".atomic/none.json" } });
    assert.deepEqual(JSON.parse(none.result.models).policy, {});
    assert.equal(JSON.parse(none.result.models).policy_source, null);
    assert.ok(none.result.result.includes("no policy file found; launch inputs apply"));

    assert.deepEqual(siblings(), siblingsBefore);
    assert.deepEqual(seedState(autoSeed), initialSeed);
  });

  it("copies an uncommitted seed policy file into the new clone once and reads it there; absolute policy paths stay put", async () => {
    const { calls, target } = await autoRun({ inputs: { model_policy_path: ".atomic/local-models.json" } });
    assert.equal(created(calls).policy_copied_from, join(autoSeed, ".atomic", "local-models.json"));
    assert.deepEqual(JSON.parse(readFileSync(join(target, ".atomic", "local-models.json"), "utf8")), localPolicy);
    assert.deepEqual(readdirSync(join(target, ".atomic")).sort(), ["goal-select-models.json", "local-models.json"], "one file, not the seed's .atomic");
    assert.equal(toolArgs(calls, "resolve-models-1").path, join(target, ".atomic", "local-models.json"));
    assert.equal(modelStages(calls)[0].options.model, "test/local-orchestrator");
    assert.deepEqual(JSON.parse(readFileSync(join(autoSeed, ".atomic", "local-models.json"), "utf8")), localPolicy);

    const absolutePath = join(autoRoot, "policies", "run policy.json");
    writeJson(absolutePath, { orchestrator_model: "test/absolute-orchestrator" });
    const absolute = await autoRun({ inputs: { model_policy_path: absolutePath } });
    assert.equal(created(absolute.calls).policy_copied_from, null);
    assert.equal(toolArgs(absolute.calls, "resolve-models-1").path, absolutePath);
    assert.equal(modelStages(absolute.calls)[0].options.model, "test/absolute-orchestrator");
    assert.deepEqual(seedState(autoSeed), initialSeed);
  });

  it("previews committed and uncommitted JSONC policies as the clone reads them, and falls back to launch inputs for malformed ones", async () => {
    const jsoncSeed = makeRepo(join(autoRoot, "jsonc seed"), { commit: false });
    writeFileSync(join(jsoncSeed, "committed.json"), jsoncPolicyText);
    writeFileSync(join(jsoncSeed, "committed-malformed.json"), malformedPolicyText);
    git("-C", jsoncSeed, "add", ".");
    git("-C", jsoncSeed, "commit", "--quiet", "-m", "JSONC policies");
    writeFileSync(join(jsoncSeed, "local.json"), jsoncPolicyText);
    writeFileSync(join(jsoncSeed, "local-malformed.json"), malformedPolicyText);
    const jsoncSeedBefore = seedState(jsoncSeed);
    const head = jsoncSeedBefore.head.slice(0, 12);
    const committed = (path) => `${path} at seed commit ${head} (the clone gets this committed file)`;
    const uncommitted = (path) => `${join(jsoncSeed, path)} (not committed; copied into the clone when it is created)`;
    const launch = { orchestrator: goalSelect.inputs.orchestrator_model.default, reviewer: "test/launch-reviewer" };
    const fromJsonc = { orchestrator: jsoncPolicy.orchestrator_model, reviewer: jsoncPolicy.reviewer_model };

    for (const [path, policy, source, models, copied] of [
      ["committed.json", jsoncPolicy, committed("committed.json"), fromJsonc, null],
      ["committed-malformed.json", {}, committed("committed-malformed.json"), launch, null],
      ["local.json", jsoncPolicy, uncommitted("local.json"), fromJsonc, join(jsoncSeed, "local.json")],
      ["local-malformed.json", {}, uncommitted("local-malformed.json"), launch, join(jsoncSeed, "local-malformed.json")],
    ]) {
      const preview = await autoRun({ cwd: jsoncSeed, inputs: { resolve_only: true, model_policy_path: path } });
      const previewed = JSON.parse(preview.result.models);
      assert.deepEqual(previewed.policy, policy, path);
      assert.equal(previewed.policy_source, source, path);
      assert.equal(existsSync(previewed.planned_checkout.path), false, `${path} preview creates no clone`);

      const actual = await autoRun({ cwd: jsoncSeed, inputs: { model_policy_path: path, reviewer_model: launch.reviewer } });
      assert.equal(created(actual.calls).policy_copied_from, copied, path);
      assert.equal(readFileSync(join(actual.target, path), "utf8"), readFileSync(join(jsoncSeed, path), "utf8"), `${path} reaches the clone verbatim`);
      const byName = Object.fromEntries(modelStages(actual.calls).map((stage) => [stage.name, stage.options]));
      assert.equal(byName["orchestrator-1"].model, models.orchestrator, `${path} preview matches the run`);
      assert.equal(byName["completion-reviewer-1"].model, models.reviewer, path);
    }
    assert.deepEqual(seedState(jsoncSeed), jsoncSeedBefore);
  });

  it("hands an explicit project-local policy to a new clone as the clone reads it, matched by the preview", async () => {
    // The launch risk reviewer is distinct from the generic reviewer_model, so
    // a role that falls back to the launch shows which input it took.
    const launch = { orchestrator: goalSelect.inputs.orchestrator_model.default, reviewer: "test/launch-reviewer", risk: "test/launch-risk" };
    const launchModels = { reviewer_model: launch.reviewer, risk_reviewer_model: launch.risk };
    const fromJsonc = { orchestrator: jsoncPolicy.orchestrator_model, reviewer: jsoncPolicy.reviewer_model };
    const fromJson = { orchestrator: "test/json-orchestrator", reviewer: launch.reviewer, risk: launch.risk };
    const committedFile = (path, head) => `${path} at seed commit ${head} (the clone gets this committed file)`;
    const uncommittedFile = (dir, path) => `${join(dir, path)} (not committed; copied into the clone when it is created)`;
    for (const [label, committed, untracked, expected] of [
      ["untracked .jsonc only", {}, { [defaultJsonc]: jsoncPolicyText }, { policy: jsoncPolicy, source: "uncommitted", path: defaultJsonc, copied: defaultJsonc, models: fromJsonc }],
      ["committed .jsonc only", { [defaultJsonc]: jsoncPolicyText }, {}, { policy: jsoncPolicy, source: "committed", path: defaultJsonc, copied: null, models: fromJsonc }],
      ["untracked .json and .jsonc", {}, { [defaultJson]: jsonPolicyText, [defaultJsonc]: jsoncPolicyText }, { policy: { orchestrator_model: "test/json-orchestrator" }, source: "uncommitted", path: defaultJson, copied: defaultJson, models: fromJson }],
      ["committed .json, untracked .jsonc", { [defaultJson]: jsonPolicyText }, { [defaultJsonc]: jsoncPolicyText }, { policy: { orchestrator_model: "test/json-orchestrator" }, source: "committed", path: defaultJson, copied: null, models: fromJson }],
      ["untracked malformed .json beside a valid .jsonc", {}, { [defaultJson]: malformedPolicyText, [defaultJsonc]: jsoncPolicyText }, { policy: {}, source: "uncommitted", path: defaultJson, copied: defaultJson, models: launch }],
      ["committed malformed .json beside a committed .jsonc", { [defaultJson]: malformedPolicyText, [defaultJsonc]: jsoncPolicyText }, {}, { policy: {}, source: "committed", path: defaultJson, copied: null, models: launch }],
      ["missing", {}, {}, { policy: {}, source: null, path: defaultJson, copied: null, models: launch }],
    ]) {
      const dir = makeRepo(join(autoRoot, `explicit policy ${label}`), { commit: false });
      for (const [path, text] of Object.entries(committed)) writeJsonText(join(dir, path), text);
      git("-C", dir, "add", ".");
      git("-C", dir, "commit", "--quiet", "--allow-empty", "-m", "Policies");
      for (const [path, text] of Object.entries(untracked)) writeJsonText(join(dir, path), text);
      const before = seedState(dir);
      const head = before.head.slice(0, 12);
      const source = expected.source === "committed" ? committedFile(expected.path, head) : expected.source === "uncommitted" ? uncommittedFile(dir, expected.path) : null;

      const preview = await autoRun({ cwd: dir, inputs: { model_policy_path: expected.path, resolve_only: true } });
      assert.deepEqual(modelStages(preview.calls), [], label);
      const previewed = JSON.parse(preview.result.models);
      assert.deepEqual(previewed.policy, expected.policy, label);
      assert.equal(previewed.policy_source, source, label);
      assert.equal(previewed.launch.policyPath, join(preview.target, expected.path), label);
      assert.equal("policyFallbackPath" in previewed.launch, false, label);
      assert.ok(preview.result.result.includes(`- Turn-1 model policy: ${source ?? "no policy file found; launch inputs apply"}`), `${label}: ${preview.result.result}`);
      assert.equal(existsSync(preview.target), false, `${label}: preview creates no clone`);
      assert.deepEqual(seedState(dir), before, `${label}: preview leaves the seed alone`);

      const actual = await autoRun({ cwd: dir, inputs: { model_policy_path: expected.path, ...launchModels } });
      assert.equal(actual.result.status, "complete", label);
      assert.equal(created(actual.calls).policy_copied_from, expected.copied === null ? null : join(dir, expected.copied), label);
      const cloned = existsSync(join(actual.target, ".atomic")) ? readdirSync(join(actual.target, ".atomic")).sort() : [];
      const expectedFiles = [...new Set([...Object.keys(committed), ...(expected.copied === null ? [] : [expected.copied])])].map((path) => basename(path)).sort();
      assert.deepEqual(cloned, expectedFiles, `${label}: the clone gets committed policies plus at most the one copied`);
      if (expected.copied !== null) assert.equal(readFileSync(join(actual.target, expected.copied), "utf8"), readFileSync(join(dir, expected.copied), "utf8"), `${label}: copied verbatim`);
      const byName = Object.fromEntries(modelStages(actual.calls).map((stage) => [stage.name, stage.options]));
      assert.equal(byName["orchestrator-1"].model, expected.models.orchestrator, `${label}: preview matches turn 1`);
      for (const role of ["completion", "evidence", "risk"]) assert.equal(byName[`${role}-reviewer-1`].model, expected.models[role] ?? expected.models.reviewer, `${label} ${role}`);
      assert.ok(Object.values(byName).every((stage) => stage.cwd === actual.target), label);
      assert.deepEqual(seedState(dir), before, `${label}: the run leaves the seed alone`);
    }
  });

  it("reads a committed dangling policy symlink in the clone as no policy, in the preview and the run alike", async () => {
    const dir = makeRepo(join(autoRoot, "explicit policy dangling json"), { commit: false });
    mkdirSync(join(dir, ".atomic"));
    symlinkSync("missing-models.json", join(dir, defaultJson));
    git("-C", dir, "add", ".");
    git("-C", dir, "commit", "--quiet", "-m", "Dangling policy link");
    const before = seedState(dir);
    const head = before.head.slice(0, 12);

    const preview = JSON.parse((await autoRun({ cwd: dir, inputs: { resolve_only: true, model_policy_path: defaultJson } })).result.models);
    assert.deepEqual(preview.policy, {});
    assert.equal(preview.policy_source, `${defaultJson} at seed commit ${head}, resolved through committed symlinks to .atomic/missing-models.json, which is not committed, so the clone reads no policy there`);

    const actual = await autoRun({ cwd: dir, inputs: { model_policy_path: defaultJson } });
    assert.equal(created(actual.calls).policy_copied_from, null);
    assert.equal(lstatSync(join(actual.target, defaultJson)).isSymbolicLink(), true);
    assert.equal(modelStages(actual.calls)[0].options.model, goalSelect.inputs.orchestrator_model.default);
    assert.deepEqual(seedState(dir), before);
  });

  it("Atomic's runtime previews and runs an explicit ignored .jsonc policy in a new branch clone", async () => {
    const dir = makeRepo(join(autoRoot, "runtime jsonc seed"), { commit: false });
    writeFileSync(join(dir, ".gitignore"), ".atomic/\n");
    git("-C", dir, "add", ".");
    git("-C", dir, "commit", "--quiet", "-m", "Ignore .atomic");
    writeJsonText(join(dir, defaultJsonc), jsoncPolicyText);
    const before = seedState(dir);
    const seen = [];
    const adapters = { prompt: { prompt: async (_text, meta) => (seen.push([meta.stageName, meta.stageOptions?.cwd, meta.stageOptions?.model]), "done") } };
    const options = (runId) => ({ durability: { mode: "memory" }, cwd: dir, adapters, runId });

    const preview = await run(goalSelect, { objective, resolve_only: true, model_policy_path: defaultJsonc }, options(randomUUID()));
    assert.equal(preview.status, "completed");
    const models = JSON.parse(preview.result.models);
    assert.deepEqual(models.policy, jsoncPolicy);
    assert.equal(models.policy_source, `${join(dir, defaultJsonc)} (not committed; copied into the clone when it is created)`);
    assert.equal(existsSync(models.planned_checkout.path), false);
    assert.deepEqual(seen, []);

    const runId = randomUUID();
    const target = join(autoRoot, `runtime jsonc seed.goal-${slug}-${idFor(runId)}`);
    await run(goalSelect, { objective, model_policy_path: defaultJsonc }, options(runId));
    assert.deepEqual(seen[0], ["orchestrator-1", target, jsoncPolicy.orchestrator_model]);
    assert.equal(readFileSync(join(target, defaultJsonc), "utf8"), jsoncPolicyText);
    assert.equal(existsSync(join(target, defaultJson)), false);
    assert.deepEqual(seedState(dir), before);
  });

  it("previews the policy that committed symlinks lead to, as the clone reads it, without creating a clone", async () => {
    const linkSeed = makeRepo(join(autoRoot, "link seed"), { commit: false });
    const external = join(autoRoot, "link external.json");
    const absoluteTarget = join(autoRoot, "policies", "link absolute.json");
    writeJson(join(linkSeed, "real-policy.json"), { orchestrator_model: "test/linked" });
    writeJson(join(linkSeed, "conf", "atomic", "models.json"), { orchestrator_model: "test/dir-linked" });
    writeJson(external, { orchestrator_model: "test/external-linked" });
    writeJson(absoluteTarget, { orchestrator_model: "test/absolute-linked" });
    writeFileSync(join(linkSeed, ".gitignore"), "local-policy.json\n");
    mkdirSync(join(linkSeed, "nested"));
    for (const [link, to] of [
      ["linked-policy.json", "real-policy.json"],
      ["chain.json", "linked-policy.json"],
      [".atomic", "conf/atomic"],
      ["nested/up.json", "../real-policy.json"],
      ["outside.json", "../link external.json"],
      ["absolute.json", absoluteTarget],
      ["loop-a.json", "loop-b.json"],
      ["loop-b.json", "loop-a.json"],
      ["local-link.json", "local-policy.json"],
    ]) {
      symlinkSync(to, join(linkSeed, link));
    }
    git("-C", linkSeed, "add", ".");
    git("-C", linkSeed, "commit", "--quiet", "-m", "Linked policies");
    writeJson(join(linkSeed, "real-policy.json"), { orchestrator_model: "test/dirty-seed" });
    writeJson(join(linkSeed, "local-policy.json"), { orchestrator_model: "test/ignored-local" });
    const linkSeedBefore = seedState(linkSeed);
    const head = linkSeedBefore.head.slice(0, 12);
    const launchDefault = goalSelect.inputs.orchestrator_model.default;
    const linkClones = () => readdirSync(autoRoot).filter((name) => name.startsWith("link seed.goal-")).length;
    const committed = (path, to) => `${path} at seed commit ${head}, resolved through committed symlinks to ${to} (the clone gets these committed files)`;

    for (const [path, policy, source, model] of [
      ["linked-policy.json", { orchestrator_model: "test/linked" }, committed("linked-policy.json", "real-policy.json"), "test/linked"],
      ["chain.json", { orchestrator_model: "test/linked" }, committed("chain.json", "real-policy.json"), "test/linked"],
      [".atomic/models.json", { orchestrator_model: "test/dir-linked" }, committed(".atomic/models.json", "conf/atomic/models.json"), "test/dir-linked"],
      ["nested/up.json", { orchestrator_model: "test/linked" }, committed("nested/up.json", "real-policy.json"), "test/linked"],
      ["outside.json", { orchestrator_model: "test/external-linked" }, `outside.json at seed commit ${head}, resolved through committed symlinks to ${external}, outside the clone`, "test/external-linked"],
      ["absolute.json", { orchestrator_model: "test/absolute-linked" }, `absolute.json at seed commit ${head}, resolved through committed symlinks to ${absoluteTarget}, outside the clone`, "test/absolute-linked"],
      ["loop-a.json", {}, `loop-a.json at seed commit ${head} is a loop of committed symlinks, so the clone reads no policy there`, launchDefault],
      [
        "local-link.json",
        null,
        `local-link.json at seed commit ${head}, resolved through committed symlinks to local-policy.json, which is not committed and which goal-select does not copy; the clone has it only if git bc-add copies it as an ignored extra, so the policy is not previewed`,
        launchDefault,
      ],
    ]) {
      const clonesBefore = linkClones();
      const preview = await autoRun({ cwd: linkSeed, inputs: { resolve_only: true, model_policy_path: path } });
      const models = JSON.parse(preview.result.models);
      assert.deepEqual(models.policy, policy, path);
      assert.equal(models.policy_source, source, path);
      assert.deepEqual(modelStages(preview.calls), []);
      assert.equal(linkClones(), clonesBefore, `${path} preview creates no clone`);

      const actual = await autoRun({ cwd: linkSeed, inputs: { model_policy_path: path } });
      assert.equal(created(actual.calls).policy_copied_from, null, path);
      assert.equal(modelStages(actual.calls)[0].options.model, model, path);
      if (policy !== null) assert.equal(policy.orchestrator_model ?? launchDefault, model, `${path} preview matches the run`);
    }

    const seen = [];
    const adapters = { prompt: { prompt: async (_text, meta) => (seen.push([meta.stageName, meta.stageOptions?.cwd, meta.stageOptions?.model]), "done") } };
    const options = (runId) => ({ durability: { mode: "memory" }, cwd: linkSeed, adapters, runId });
    const inputs = { objective, model_policy_path: "linked-policy.json" };
    const clonesBefore = linkClones();
    const preview = await run(goalSelect, { ...inputs, resolve_only: true }, options(randomUUID()));
    assert.equal(preview.status, "completed");
    assert.deepEqual(JSON.parse(preview.result.models).policy, { orchestrator_model: "test/linked" });
    assert.equal(linkClones(), clonesBefore);
    const runId = randomUUID();
    await run(goalSelect, inputs, options(runId));
    assert.deepEqual(seen, [["orchestrator-1", join(autoRoot, `link seed.goal-${slug}-${idFor(runId)}`), "test/linked"]]);
    assert.deepEqual(seedState(linkSeed), linkSeedBefore);
  });

  it("previews a committed policy link that re-enters the planned clone through an outside alias as unavailable, not empty", async () => {
    const reentrySeed = makeRepo(join(autoRoot, "reentry seed"), { commit: false });
    const alias = join(autoRoot, "reentry alias");
    writeJson(join(reentrySeed, "real", "policy.json"), { orchestrator_model: "test/reentry" });
    symlinkSync("../reentry alias/real/policy.json", join(reentrySeed, "reentry-policy.json"));
    symlinkSync("../reentry gone.json", join(reentrySeed, "gone-policy.json"));
    git("-C", reentrySeed, "add", ".");
    git("-C", reentrySeed, "commit", "--quiet", "-m", "Re-entering policy");
    const head = git("-C", reentrySeed, "rev-parse", "HEAD").slice(0, 12);
    const runId = `reentry-${randomUUID()}`;
    const { target } = planned(runId, reentrySeed);
    symlinkSync(target, alias);
    const launchDefault = goalSelect.inputs.orchestrator_model.default;

    for (const [path, policy, source, model] of [
      [
        "reentry-policy.json",
        null,
        `reentry-policy.json at seed commit ${head}, resolved through committed symlinks to ${join(alias, "real", "policy.json")}, outside the clone, which leads back into the planned clone before it exists, so the policy is not previewed`,
        "test/reentry",
      ],
      ["gone-policy.json", {}, `gone-policy.json at seed commit ${head}, resolved through committed symlinks to ${join(autoRoot, "reentry gone.json")}, outside the clone`, launchDefault],
    ]) {
      const preview = await autoRun({ runId, cwd: reentrySeed, inputs: { resolve_only: true, model_policy_path: path } });
      const models = JSON.parse(preview.result.models);
      assert.deepEqual(models.policy, policy, path);
      assert.equal(models.policy_source, source, path);
      assert.deepEqual(modelStages(preview.calls), []);
      assert.equal(existsSync(target), false, `${path} preview creates no clone`);
    }

    const actual = await autoRun({ runId, cwd: reentrySeed, inputs: { model_policy_path: "reentry-policy.json" } });
    assert.equal(created(actual.calls).checkout, target);
    assert.equal(modelStages(actual.calls)[0].options.model, "test/reentry");
    const replay = await autoRun({ runId, cwd: reentrySeed, inputs: { model_policy_path: "gone-policy.json" } });
    assert.equal(created(replay.calls).adopted, true);
    assert.equal(modelStages(replay.calls)[0].options.model, launchDefault);
  });

  it("previews a policy link that spells the planned clone in decomposed Unicode as unavailable, not empty", async () => {
    const reentrySeed = makeRepo(join(autoRoot, "reentry caf\u00e9"), { commit: false });
    const alias = join(autoRoot, "decomposed alias");
    writeJson(join(reentrySeed, "real", "policy.json"), { orchestrator_model: "test/reentry" });
    symlinkSync("../decomposed alias/real/policy.json", join(reentrySeed, "reentry-policy.json"));
    git("-C", reentrySeed, "add", ".");
    git("-C", reentrySeed, "commit", "--quiet", "-m", "Re-entering policy");
    const head = git("-C", reentrySeed, "rev-parse", "HEAD").slice(0, 12);
    const runId = `reentry-nfd-${randomUUID()}`;
    const { target } = planned(runId, reentrySeed);
    const decomposed = target.normalize("NFD");
    assert.notEqual(decomposed, target);
    symlinkSync(decomposed, alias);
    const outside = join(alias, "real", "policy.json");
    const unavailable = "which leads back into the planned clone before it exists, so the policy is not previewed";

    for (const [path, source] of [
      ["reentry-policy.json", `reentry-policy.json at seed commit ${head}, resolved through committed symlinks to ${outside}, outside the clone, ${unavailable}`],
      [outside, `${outside}, ${unavailable}`],
    ]) {
      const preview = await autoRun({ runId, cwd: reentrySeed, inputs: { resolve_only: true, model_policy_path: path } });
      const models = JSON.parse(preview.result.models);
      assert.equal(models.policy, null, path);
      assert.equal(models.policy_source, source, path);
      assert.deepEqual(modelStages(preview.calls), []);
      assert.equal(existsSync(target), false, `${path} preview creates no clone`);
    }

    const actual = await autoRun({ runId, cwd: reentrySeed, inputs: { model_policy_path: "reentry-policy.json" } });
    assert.equal(created(actual.calls).checkout, target);
    assert.equal(modelStages(actual.calls)[0].options.model, "test/reentry");
  });

  it("previews a policy link that spells the planned clone in other capitalization as unavailable, not empty", async () => {
    const reentrySeed = makeRepo(join(autoRoot, "reentry case"), { commit: false });
    const alias = join(autoRoot, "capitalized alias");
    writeJson(join(reentrySeed, "real", "policy.json"), { orchestrator_model: "test/reentry" });
    symlinkSync("../capitalized alias/real/policy.json", join(reentrySeed, "reentry-policy.json"));
    git("-C", reentrySeed, "add", ".");
    git("-C", reentrySeed, "commit", "--quiet", "-m", "Re-entering policy");
    const head = git("-C", reentrySeed, "rev-parse", "HEAD").slice(0, 12);
    const runId = `reentry-case-${randomUUID()}`;
    const { target } = planned(runId, reentrySeed);
    const capitalized = join(dirname(target), basename(target).toUpperCase());
    assert.notEqual(capitalized, target);
    symlinkSync(capitalized, alias);
    const outside = join(alias, "real", "policy.json");
    const unavailable = "which leads back into the planned clone before it exists, so the policy is not previewed";

    for (const [path, source] of [
      ["reentry-policy.json", `reentry-policy.json at seed commit ${head}, resolved through committed symlinks to ${outside}, outside the clone, ${unavailable}`],
      [outside, `${outside}, ${unavailable}`],
    ]) {
      const preview = await autoRun({ runId, cwd: reentrySeed, inputs: { resolve_only: true, model_policy_path: path } });
      const models = JSON.parse(preview.result.models);
      assert.equal(models.policy, null, path);
      assert.equal(models.policy_source, source, path);
      assert.deepEqual(modelStages(preview.calls), []);
      assert.equal(existsSync(target), false, `${path} preview creates no clone`);
    }
  });

  it("gives concurrent runs of the same objective separate clones", async () => {
    const runs = await Promise.all([autoRun(), autoRun()]);
    assert.notEqual(runs[0].target, runs[1].target);
    for (const { calls, target, branch } of runs) {
      assert.equal(created(calls).checkout, target);
      assert.equal(created(calls).adopted, false);
      assert.equal(git("-C", target, "branch", "--show-current"), branch);
      assert.equal(git("-C", target, "config", "bc.source"), autoSeed);
      assert.ok(modelStages(calls).every((stage) => stage.options.cwd === target));
    }
    assert.deepEqual(seedState(autoSeed), initialSeed);
  });

  it("reuses its own finished clone when the same run is replayed, even across a checkpoint gap, without creating another or overwriting work", async () => {
    const runId = `replay-${randomUUID()}`;
    const first = await autoRun({ runId });
    const siblingsAfterFirst = siblings();
    assert.equal(git("-C", first.target, "config", "--local", "goal-select.completed-run"), runId, "finished clones carry this run's completion mark");
    writeFileSync(join(first.target, "work.txt"), "in progress\n");
    writeFileSync(join(first.target, ".env"), "TOKEN=changed in clone\n");
    // The fake context records no checkpoints, so this replay re-executes plan-branch-clone and
    // create-branch-clone as if the finished create had never been checkpointed.
    const second = await autoRun({ runId });
    assert.equal(second.target, first.target);
    assert.deepEqual(created(second.calls), { ...created(first.calls), adopted: true });
    assert.deepEqual(siblings(), siblingsAfterFirst);
    assert.equal(readFileSync(join(first.target, "work.txt"), "utf8"), "in progress\n");
    assert.equal(readFileSync(join(first.target, ".env"), "utf8"), "TOKEN=changed in clone\n");
    assert.ok(modelStages(second.calls).length > 0);
    assert.ok(modelStages(second.calls).every((stage) => stage.options.cwd === first.target));

    // The same gap one level down: a finished create whose result was lost is adopted by the next one.
    const plan = await planBranchClone({ invocationCwd: autoSeed, slug, runId: `gap-${randomUUID()}` });
    const made = await createBranchClone(plan, {});
    assert.equal(made.adopted, false);
    writeFileSync(join(plan.target, "work.txt"), "in progress\n");
    assert.deepEqual(await createBranchClone(plan, {}), { ...made, adopted: true });
    assert.equal(readFileSync(join(plan.target, "work.txt"), "utf8"), "in progress\n");
    assert.deepEqual(seedState(autoSeed), initialSeed);
  });

  it("keeps a finished clone's deletions and edits when the same run is replayed: no git bc-add resync and no policy copy", async () => {
    const runId = `deleted-${randomUUID()}`;
    const policy = ".atomic/local-models.json";
    const first = await autoRun({ runId, inputs: { model_policy_path: policy } });
    assert.equal(created(first.calls).policy_copied_from, join(autoSeed, ".atomic", "local-models.json"));
    assert.equal(modelStages(first.calls)[0].options.model, "test/local-orchestrator");
    const deleted = [".env", ".atomic/local-models.json", "notes.txt"];
    for (const path of deleted) rmSync(join(first.target, path));
    writeFileSync(join(first.target, "README.md"), "clone edit\n");
    const restored = () => deleted.filter((path) => existsSync(join(first.target, path)));
    const siblingsAfterFirst = siblings();

    const replay = await autoRun({ runId, inputs: { model_policy_path: policy } });
    assert.deepEqual(created(replay.calls), { checkout: first.target, branch: first.branch, seed: autoSeed, head: seedHead, adopted: true, policy_copied_from: null });
    assert.deepEqual(restored(), []);
    assert.equal(readFileSync(join(first.target, "README.md"), "utf8"), "clone edit\n");
    assert.equal(modelStages(replay.calls)[0].options.cwd, first.target);
    assert.equal(modelStages(replay.calls)[0].options.model, goalSelect.inputs.orchestrator_model.default, "the deleted policy stays unused");

    const { policy_path: _policyPath, ...plan } = toolArgs(first.calls, "create-branch-clone");
    assert.deepEqual(await createBranchClone(plan, { policyPath: policy }), created(replay.calls));
    assert.deepEqual(restored(), []);
    assert.deepEqual(git("-C", first.target, "--no-optional-locks", "status", "--porcelain").split("\n").map((line) => line.trim()), ["M README.md", "D notes.txt"]);
    assert.deepEqual(siblings(), siblingsAfterFirst);
    assert.deepEqual(seedState(autoSeed), initialSeed);
  });

  it("refuses an unrelated path at the planned name, before any model stage, and leaves it untouched", async () => {
    for (const [label, setup, reason, check] of [
      ["a file", (target) => writeFileSync(target, "keep me\n"), /is not a directory/, (target) => assert.equal(readFileSync(target, "utf8"), "keep me\n")],
      ["a symlink to the seed", (target) => symlinkSync(autoSeed, target), /is not a directory/, (target) => assert.equal(lstatSync(target).isSymbolicLink(), true)],
      [
        "a plain directory",
        (target) => {
          mkdirSync(target);
          writeFileSync(join(target, "keep.txt"), "keep me\n");
        },
        /is not its own Git checkout/,
        (target) => assert.deepEqual(readdirSync(target), ["keep.txt"]),
      ],
      [
        "a branch clone on another branch",
        (target) => git("bc-add", "--offline", autoSeed, "other/work", target),
        /is not this run's branch clone \(bc\.source .+, branch other\/work\)/,
        (target) => assert.equal(git("-C", target, "branch", "--show-current"), "other/work"),
      ],
      [
        "a checkout of the planned branch that git bc-add did not make",
        (target, branch) => {
          git("clone", "--quiet", autoServer, target);
          git("-C", target, "checkout", "--quiet", "-b", branch);
        },
        /is not this run's branch clone \(bc\.source unset/,
        (target) => assert.equal(git("-C", target, "config", "--get-all", "remote.origin.url"), autoServer),
      ],
      [
        "a git bc-add clone of the seed on the planned branch that this run never finished",
        (target, branch) => git("bc-add", "--offline", autoSeed, branch, target),
        /has bc\.source .+ and branch goal-.+ but no completion mark from this run \(goal-select\.completed-run unset\)/,
        (target, branch) => {
          assert.equal(git("-C", target, "branch", "--show-current"), branch);
          assert.equal(git("-C", target, "config", "bc.source"), autoSeed);
          assert.equal(git("-C", target, "config", "--local", "--default", "", "--get", "goal-select.completed-run"), "");
        },
      ],
      [
        "a git bc-add clone of the seed on the planned branch that another run marked finished",
        (target, branch) => {
          git("bc-add", "--offline", autoSeed, branch, target);
          git("-C", target, "config", "goal-select.completed-run", "another-run");
        },
        /no completion mark from this run \(goal-select\.completed-run another-run\)/,
        (target) => assert.equal(git("-C", target, "config", "goal-select.completed-run"), "another-run"),
      ],
    ]) {
      const runId = `collision-${randomUUID()}`;
      const { target, branch } = planned(runId);
      setup(target, branch);
      for (const resolve_only of [true, false]) {
        const started = startAuto({ runId, inputs: { resolve_only } });
        await assert.rejects(started.outcome, (error) => {
          assert.match(error.message, reason, label);
          assert.ok(error.message.includes(`${target} already exists`), error.message);
          assert.ok(error.message.includes("did not fall back to the invoking checkout"), error.message);
          assert.equal(error.message.includes(objective), false);
          return true;
        });
        assert.deepEqual(started.calls.map((call) => call.name), ["plan-branch-clone"], label);
        assert.deepEqual(modelStages(started.calls), []);
      }
      check(target, branch);
    }
    assert.deepEqual(seedState(autoSeed), initialSeed);
  });

  it("recognises its own clone of a seed spelled in decomposed Unicode by filesystem identity, and still refuses another source, an unfinished clone and another run's clone", async () => {
    const unicodeSeed = makeRepo(join(autoRoot, "Cafe\u0301 seed"));
    const otherSeed = makeRepo(join(autoRoot, "Cafe\u0301 other"));
    const unicodeBefore = seedState(unicodeSeed);
    const own = await autoRun({ cwd: unicodeSeed });
    assert.equal(git("-C", own.target, "config", "bc.source"), unicodeSeed.normalize("NFC"));
    assert.notEqual(unicodeSeed.normalize("NFC"), unicodeSeed);
    assert.deepEqual(created(own.calls), { checkout: own.target, branch: own.branch, seed: unicodeSeed, head: unicodeBefore.head, adopted: false, policy_copied_from: null });
    assert.equal(git("-C", own.target, "config", "goal-select.completed-run"), own.runId);
    assert.ok(modelStages(own.calls).every((stage) => stage.options.cwd === own.target));
    const replay = await autoRun({ cwd: unicodeSeed, runId: own.runId });
    assert.equal(created(replay.calls).adopted, true);

    for (const [label, setup, reason, check] of [
      [
        "a branch clone of a different seed on the planned branch",
        (plan) => git("bc-add", "--offline", otherSeed, plan.branch, plan.target),
        /is not this run's branch clone \(bc\.source .+ other, branch goal-/,
        (plan) => assert.equal(git("-C", plan.target, "config", "--local", "--default", "", "--get", "goal-select.completed-run"), ""),
      ],
      [
        "an unfinished branch clone of the seed",
        (plan) => git("bc-add", "--offline", unicodeSeed, plan.branch, plan.target),
        /no completion mark from this run \(goal-select\.completed-run unset\)/,
        (plan) => assert.equal(git("-C", plan.target, "config", "--local", "--default", "", "--get", "goal-select.completed-run"), ""),
      ],
      [
        "a branch clone of the seed that another run marked finished",
        (plan) => {
          git("bc-add", "--offline", unicodeSeed, plan.branch, plan.target);
          git("-C", plan.target, "config", "goal-select.completed-run", "another-run");
        },
        /no completion mark from this run \(goal-select\.completed-run another-run\)/,
        (plan) => assert.equal(git("-C", plan.target, "config", "goal-select.completed-run"), "another-run"),
      ],
    ]) {
      const plan = await planBranchClone({ invocationCwd: unicodeSeed, slug, runId: `unicode-${randomUUID()}` });
      setup(plan);
      const head = git("-C", plan.target, "rev-parse", "HEAD");
      await assert.rejects(createBranchClone(plan), (error) => {
        assert.match(error.message, reason, label);
        return true;
      });
      assert.equal(git("-C", plan.target, "branch", "--show-current"), plan.branch, label);
      assert.equal(git("-C", plan.target, "rev-parse", "HEAD"), head, label);
      check(plan);
    }
    assert.deepEqual(seedState(unicodeSeed), unicodeBefore);
  });

  it("re-checks the target when creating, so a path that appears after planning is refused", async () => {
    const plan = await planBranchClone({ invocationCwd: autoSeed, slug, runId: `race-${randomUUID()}` });
    mkdirSync(plan.target);
    writeFileSync(join(plan.target, "keep.txt"), "keep me\n");
    await assert.rejects(createBranchClone(plan, {}), /is not its own Git checkout/);
    assert.deepEqual(readdirSync(plan.target), ["keep.txt"]);
  });

  it("never clones onto a branch the seed already has, so git bc-add cannot switch the seed", async () => {
    const runId = `seed-branch-${randomUUID()}`;
    const { branch, target } = planned(runId);
    git("-C", autoSeed, "branch", branch);
    try {
      const withBranch = seedState(autoSeed);
      for (const resolve_only of [true, false]) {
        const started = startAuto({ runId, inputs: { resolve_only } });
        await assert.rejects(started.outcome, new RegExp(`already has branch ${branch}`));
        assert.deepEqual(modelStages(started.calls), []);
      }
      assert.equal(existsSync(target), false);
      assert.deepEqual(seedState(autoSeed), withBranch);
    } finally {
      git("-C", autoSeed, "branch", "--quiet", "-D", branch);
    }

    const plan = await planBranchClone({ invocationCwd: autoSeed, slug, runId: `seed-branch-race-${randomUUID()}` });
    git("-C", autoSeed, "branch", plan.branch);
    try {
      await assert.rejects(createBranchClone(plan, {}), /already has branch/);
      assert.equal(existsSync(plan.target), false);
      assert.equal(git("-C", autoSeed, "branch", "--show-current"), "main");
    } finally {
      git("-C", autoSeed, "branch", "--quiet", "-D", plan.branch);
    }
    assert.deepEqual(seedState(autoSeed), initialSeed);
  });

  it("fails before any model stage, creating nothing, when the seed cannot be cloned", async () => {
    const noOrigin = makeRepo(join(autoRoot, "no origin"), { origin: null });
    const noCommit = makeRepo(join(autoRoot, "no commit"), { commit: false });
    const badOrigin = makeRepo(join(autoRoot, "bad origin"), { origin: join(autoRoot, "gone.git") });
    const notGit = join(autoRoot, "not git");
    mkdirSync(notGit);
    const siblingsBefore = siblings();
    for (const [cwd, reason, modes] of [
      [noOrigin, /has no origin remote/, [true, false]],
      [noCommit, /has no commit to clone/, [true, false]],
      [notGit, /is not inside a Git checkout, so there is no seed to clone/, [true, false]],
      [badOrigin, /git bc-add could not create .+could not resolve an upstream.+Nothing was created at /, [false]],
    ]) {
      for (const resolve_only of modes) {
        const started = startAuto({ cwd, inputs: { resolve_only } });
        await assert.rejects(started.outcome, (error) => {
          assert.match(error.message, reason);
          assert.ok(error.message.includes("No model stage ran, and goal-select did not fall back to the invoking checkout."), error.message);
          assert.equal(error.message.includes(objective), false);
          return true;
        });
        assert.deepEqual(modelStages(started.calls), []);
        assert.equal(existsSync(started.target), false);
      }
    }
    assert.deepEqual(siblings(), siblingsBefore);
  });

  it("fails before any model stage when git bc-add is not installed", async () => {
    const savedPath = process.env.PATH;
    process.env.PATH = savedPath
      .split(":")
      .filter((dir) => !existsSync(join(dir, "git-bc-add")))
      .join(":");
    const siblingsBefore = siblings();
    try {
      for (const resolve_only of [true, false]) {
        const started = startAuto({ inputs: { resolve_only } });
        await assert.rejects(started.outcome, /git bc-add is not available/);
        assert.deepEqual(modelStages(started.calls), []);
      }
    } finally {
      process.env.PATH = savedPath;
    }
    assert.deepEqual(siblings(), siblingsBefore);
  });

  it("aborts before planning when the run is already cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    const siblingsBefore = siblings();
    const started = startAuto({ signal: controller.signal });
    await assert.rejects(started.outcome, { name: "AbortError" });
    assert.deepEqual(started.calls.map((call) => call.name), ["plan-branch-clone"]);
    assert.deepEqual(modelStages(started.calls), []);
    assert.deepEqual(siblings(), siblingsBefore);
  });

  it("stops a slow clone, bc.postadd included, when cancelled or out of time, and a replay refuses the unfinished clone before any model stage without rerunning bc.postadd", async () => {
    const slowSeed = makeRepo(join(autoRoot, "slow seed"));
    const pidFile = join(autoRoot, "postadd.pid");
    git("-C", slowSeed, "config", "bc.postadd", `echo $$ > '${pidFile}'; exec sleep 60`);
    const slowClones = () => readdirSync(autoRoot).filter((name) => name.startsWith("slow seed.goal-"));
    const slowSeedBefore = seedState(slowSeed);
    const leftover = (error, target) => {
      assert.ok(error.message.includes(`${target} was left in place for inspection`), error.message);
      assert.ok(error.message.includes("goal-select never deletes it"), error.message);
      assert.ok(error.message.includes("did not fall back to the invoking checkout"), error.message);
      return true;
    };

    const controller = new AbortController();
    const runId = `slow-${randomUUID()}`;
    const cancelled = startAuto({ cwd: slowSeed, runId, signal: controller.signal });
    await waitFor(() => existsSync(pidFile) && readFileSync(pidFile, "utf8").trim() !== "", 20_000);
    const pid = Number(readFileSync(pidFile, "utf8").trim());
    assert.equal(alive(pid), true);
    const abortedAt = Date.now();
    controller.abort();
    await assert.rejects(cancelled.outcome, (error) => {
      assert.equal(error.name, "AbortError");
      return leftover(error, cancelled.target);
    });
    assert.ok(Date.now() - abortedAt < 5_000, "cancellation is prompt");
    await waitFor(() => !alive(pid), 5_000);
    assert.deepEqual(cancelled.calls.map((call) => call.name), ["plan-branch-clone", "create-branch-clone"]);
    assert.deepEqual(modelStages(cancelled.calls), []);
    // git bc-add had already set bc.source and checked out the planned branch when bc.postadd was stopped.
    assert.equal(git("-C", cancelled.target, "config", "bc.source"), slowSeed);
    assert.equal(git("-C", cancelled.target, "branch", "--show-current"), cancelled.branch);
    writeFileSync(join(cancelled.target, "keep.txt"), "keep me\n");
    rmSync(pidFile);

    const refusal = (error) => {
      assert.match(error.message, /no completion mark from this run \(goal-select\.completed-run unset\)/);
      assert.ok(error.message.includes(`${cancelled.target} already exists`), error.message);
      assert.ok(error.message.includes("did not fall back to the invoking checkout"), error.message);
      return true;
    };
    const replay = startAuto({ cwd: slowSeed, runId });
    await assert.rejects(replay.outcome, refusal);
    assert.deepEqual(modelStages(replay.calls), []);
    // A checkpointed plan goes straight to create-branch-clone, which refuses too.
    const { policy_path: _policyPath, ...checkpointedPlan } = toolArgs(cancelled.calls, "create-branch-clone");
    await assert.rejects(createBranchClone(checkpointedPlan, {}), refusal);
    assert.equal(existsSync(pidFile), false, "bc.postadd is not rerun");
    assert.equal(readFileSync(join(cancelled.target, "keep.txt"), "utf8"), "keep me\n");
    assert.equal(git("-C", cancelled.target, "branch", "--show-current"), cancelled.branch);
    assert.deepEqual(slowClones(), [basename(cancelled.target)]);

    const plan = await planBranchClone({ invocationCwd: slowSeed, slug, runId: `deadline-${randomUUID()}` });
    await assert.rejects(createBranchClone(plan, { timeoutMs: 3_000 }), (error) => {
      assert.match(error.message, /timed out after 3s/);
      return leftover(error, plan.target);
    });
    const deadlinePid = Number(readFileSync(pidFile, "utf8").trim());
    await waitFor(() => !alive(deadlinePid), 5_000);
    await assert.rejects(createBranchClone(plan, {}), /no completion mark from this run/);
    assert.deepEqual(seedState(slowSeed), slowSeedBefore);
  });

  it("Atomic's runtime previews without creating, runs goal-select in a new branch clone by default, and adopts it on a same-id rerun", async () => {
    const seen = [];
    const adapters = { prompt: { prompt: async (_text, meta) => (seen.push([meta.stageName, meta.stageOptions?.cwd, meta.stageOptions?.model]), "done") } };
    const options = (runId) => ({ durability: { mode: "memory" }, cwd: autoSeed, adapters, runId });
    const runId = randomUUID();
    const target = join(autoRoot, `auto seed.goal-${slug}-${idFor(runId)}`);

    const preview = await run(goalSelect, { objective, resolve_only: true }, options(randomUUID()));
    assert.equal(preview.status, "completed");
    const models = JSON.parse(preview.result.models);
    assert.equal(models.checkout, null);
    assert.equal(existsSync(models.planned_checkout.path), false);
    assert.deepEqual(seen, []);

    await run(goalSelect, { objective, model_policy_path: defaultJson }, options(runId));
    assert.deepEqual(seen, [["orchestrator-1", target, "test/committed-orchestrator"]]);
    assert.equal(git("-C", target, "branch", "--show-current"), `goal-${slug}-${idFor(runId)}`);
    assert.equal(git("-C", target, "config", "--local", "goal-select.completed-run"), runId);
    assert.equal(git("-C", target, "config", "bc.source"), autoSeed);
    const siblingsAfterFirst = siblings();

    await run(goalSelect, { objective, model_policy_path: defaultJson }, options(runId));
    assert.deepEqual(seen.at(-1), ["orchestrator-1", target, "test/committed-orchestrator"]);
    assert.deepEqual(siblings(), siblingsAfterFirst);
    assert.deepEqual(seedState(autoSeed), initialSeed);
  });

  it("leaves the seed alone throughout: same branch, HEAD, refs, index, worktree, config and process cwd", () => {
    assert.deepEqual(seedState(autoSeed), initialSeed);
    assert.equal(initialSeed.branch, "main");
    assert.equal(initialSeed.head, seedHead);
    assert.match(initialSeed.status, /^M  README\.md$/m);
    assert.match(initialSeed.status, /^ M notes\.txt$/m);
    assert.match(initialSeed.status, /^\?\? scratch\.txt$/m);
    assert.equal(process.cwd(), startCwd);
  });
});

describe("goal-select model policy parser (JSONC)", () => {
  it("parses strict JSON exactly as JSON.parse does", () => {
    for (const text of [
      '{"orchestrator_model":"a/b","max_turns":4}',
      '{\n  "nested": {"list": [1, -2.5e3, true, false, null, "x"]},\n  "escapes": "quote \\" backslash \\\\ slash \\/ tab \\t unicode \\u00e9"\n}',
      "[]",
      '"text"',
      "0",
      " \t\r\n{ } \n",
    ]) {
      assert.deepEqual(parseModelPolicy(text), JSON.parse(text), text);
    }
  });

  it("ignores line and block comments, including commented-out duplicate role entries", () => {
    assert.deepEqual(parseModelPolicy(jsoncPolicyText), jsoncPolicy);
    assert.deepEqual(parseModelPolicy('{"a"/* c */:/* c */1// end\n}// after'), { a: 1 });
    assert.deepEqual(parseModelPolicy('/** header\n * "orchestrator_model": "x",\n */{"b": 2}'), { b: 2 });
    assert.deepEqual(parseModelPolicy('{\r\n  // "a": 0,\r\n  "a": 1\r\n}'), { a: 1 });
    assert.deepEqual(
      parseModelPolicy('{\r// alternative\r"orchestrator_model":"active",\r}'),
      { orchestrator_model: "active" },
    );
  });

  it("accepts trailing commas in objects and arrays, with whitespace or comments before the closer", () => {
    assert.deepEqual(parseModelPolicy('{"a": [1, 2,], "b": {"c": 3,},}'), { a: [1, 2], b: { c: 3 } });
    assert.deepEqual(parseModelPolicy('{"a": 1, // last\n /* gone */ }'), { a: 1 });
  });

  it("keeps comment markers, commas and escapes inside strings verbatim", () => {
    const text = String.raw`{"url": "https://example.com//path", "block": "a /* b */ c", "line": "// not a comment", "escaped": "say \"//\" then \"/*\"", "comma": ",}", "slash": "\\", "//": "key", "after": "x"}`;
    assert.deepEqual(parseModelPolicy(text), {
      url: "https://example.com//path",
      block: "a /* b */ c",
      line: "// not a comment",
      escaped: 'say "//" then "/*"',
      comma: ",}",
      slash: "\\",
      "//": "key",
      after: "x",
    });
  });

  it("rejects malformed input with a SyntaxError", () => {
    for (const text of [
      "",
      "   ",
      "// only a comment",
      "/* only a comment */",
      malformedPolicyText,
      '{"a": 1',
      '{"a": 1,,}',
      "[,]",
      "{,}",
      "[1,,2]",
      '{"a": 1}, ',
      '{"a": 1} /',
      '{"a": 1/**/2}',
      "1/**/2",
      '{"a" 1}',
      "{'a': 1}",
      "{a: 1}",
      '{"a": "unterminated}',
      '{"a": 1} {"b": 2}',
      '\uFEFF{"a": 1}',
    ]) {
      assert.throws(() => parseModelPolicy(text), SyntaxError, JSON.stringify(text));
    }
  });
});

describe("goal-select launch-form prefill (module evaluated as Atomic discovery does, reading the shared goal-select.jsonc)", () => {
  const builtin = { orchestrator_model: "openai/gpt-6.1-sol:medium", review_tier: "complex" };
  const unprefilled = ["reviewer_model", "max_turns", "completion_reviewer_model", "evidence_reviewer_model", "risk_reviewer_model", "writer_model"];
  const sharedFile = join(".config", "atomic", "goal-select.jsonc");
  let prefillRoot;
  let prefillCwd;

  async function loadWithHome(name, files) {
    const homeDir = join(prefillRoot, name);
    for (const [path, text] of Object.entries(files)) writeJsonText(join(homeDir, path), text);
    process.env.HOME = homeDir;
    try {
      return await loadGoalSelectFrom(prefillCwd);
    } finally {
      process.env.HOME = home;
    }
  }

  function assertBuiltinDefaults(definition, label) {
    for (const [key, value] of Object.entries(builtin)) assert.equal(definition.inputs[key].default, value, `${label}: ${key}`);
    for (const key of unprefilled) assert.equal(definition.inputs[key].default, undefined, `${label}: ${key}`);
  }

  before(() => {
    prefillRoot = realpathSync(mkdtempSync(join(tmpdir(), "goal-select-prefill-")));
    prefillCwd = join(prefillRoot, "cwd");
    writeJsonText(join(prefillCwd, defaultJson), jsonPolicyText);
  });

  after(() => {
    rmSync(prefillRoot, { recursive: true, force: true });
  });

  it("keeps the builtin defaults when the shared policy is absent, never reading a project-local policy where Atomic runs, and Atomic's input resolution accepts the definition", async () => {
    const definition = await loadWithHome("absent", {});
    assertBuiltinDefaults(definition, "absent");
    const resolved = resolveInputs(definition.inputs, { objective: "probe" });
    assert.equal(resolved.orchestrator_model, builtin.orchestrator_model);
    assert.equal(resolved.review_tier, builtin.review_tier);
    assert.equal("max_turns" in resolved, false, "an empty max_turns leaves the tier's cap");
    assert.equal("reviewer_model" in resolved, false, "an empty reviewer_model leaves the tier's models");
    assert.equal(resolved.tracker, "none");
    assert.equal("completion_reviewer_model" in resolved, false);
  });

  it("defaults model_policy_path to the home-derived shared goal-select.jsonc, whatever directory Atomic discovers in", async () => {
    const definition = await loadWithHome("default path", {});
    const expected = join(prefillRoot, "default path", sharedFile);
    assert.equal(definition.inputs.model_policy_path.default, expected);
    assert.equal(resolveInputs(definition.inputs, { objective: "probe" }).model_policy_path, expected);
  });

  it("prefills the orchestrator, writer and review tier from the defaults block as real launch-form defaults that Atomic applies", async () => {
    const policy = {
      defaults: { orchestrator_model: "  test/default-orchestrator  ", writer_model: "test/default-writer", review_tier: "simple" },
      review_tiers: { simple: { reviewer_model: "test/simple-reviewer", max_turns: 5 } },
    };
    const definition = await loadWithHome("defaults", { [sharedFile]: JSON.stringify(policy) });
    const expected = { orchestrator_model: "test/default-orchestrator", writer_model: "test/default-writer", review_tier: "simple" };
    for (const [key, value] of Object.entries(expected)) assert.equal(definition.inputs[key].default, value, key);
    for (const key of ["reviewer_model", "max_turns"]) assert.equal(definition.inputs[key].default, undefined, `${key}: the tier supplies it when the run starts`);
    const resolved = resolveInputs(definition.inputs, { objective: "probe" });
    for (const [key, value] of Object.entries(expected)) assert.equal(resolved[key], value, `resolved ${key}`);
    assert.equal(resolveInputs(definition.inputs, { objective: "probe", review_tier: "standard" }).review_tier, "standard");
    assert.equal(resolveInputs(definition.inputs, { objective: "probe", orchestrator_model: "test/typed" }).orchestrator_model, "test/typed");
    assert.equal(resolveInputs(definition.inputs, { objective: "probe", writer_model: "" }).writer_model, "");
    assert.equal(goalSelect.inputs.orchestrator_model.default, sharedPolicy.defaults.orchestrator_model, "other homes keep their own prefill");
    assert.equal(goalSelect.inputs.review_tier.default, sharedPolicy.defaults.review_tier, "other homes keep their own prefill");
  });

  it("prefills from the file's top-level keys before its defaults block, and never prefills reviewer_model or max_turns", async () => {
    const policy = {
      orchestrator_model: "test/top-orchestrator",
      reviewer_model: "test/top-reviewer",
      completion_reviewer_model: "test/top-completion",
      evidence_reviewer_model: "test/top-evidence",
      risk_reviewer_model: "test/top-risk",
      writer_model: "test/top-writer",
      review_tier: "standard",
      max_turns: 4.7,
      defaults: { orchestrator_model: "test/default-orchestrator", writer_model: "test/default-writer", review_tier: "simple" },
    };
    const definition = await loadWithHome("top level", { [sharedFile]: JSON.stringify(policy) });
    const expected = {
      orchestrator_model: "test/top-orchestrator",
      completion_reviewer_model: "test/top-completion",
      evidence_reviewer_model: "test/top-evidence",
      risk_reviewer_model: "test/top-risk",
      writer_model: "test/top-writer",
      review_tier: "standard",
    };
    for (const [key, value] of Object.entries(expected)) assert.equal(definition.inputs[key].default, value, key);
    for (const key of ["reviewer_model", "max_turns"]) assert.equal(definition.inputs[key].default, undefined, `${key}: a top-level value overrides when the run starts instead`);
  });

  it("prefills from a JSONC shared policy, comments and trailing commas included", async () => {
    const text = `{
  // Launch-form defaults.
  "defaults": {
    "orchestrator_model": "test/jsonc-default//not-a-comment",
    // "orchestrator_model": "test/commented-out",
    "review_tier": "standard", /* the closer follows a trailing comma */
  },
}
`;
    const definition = await loadWithHome("jsonc", { [sharedFile]: text });
    assert.equal(definition.inputs.orchestrator_model.default, "test/jsonc-default//not-a-comment");
    assert.equal(definition.inputs.review_tier.default, "standard");
    assert.equal(definition.inputs.reviewer_model.default, undefined);
  });

  it("reads only goal-select.jsonc: the old preset library and sibling files change no prefill", async () => {
    const other = JSON.stringify({ orchestrator_model: "test/other", defaults: { orchestrator_model: "test/other-default", review_tier: "simple" } });
    const definition = await loadWithHome("other files", {
      [join(".config", "atomic", "goal-select-models", "sol-astra.json")]: other,
      [join(".config", "atomic", "goal-select.json")]: other,
    });
    assertBuiltinDefaults(definition, "other files");
  });

  it("keeps every builtin default for a malformed shared policy", async () => {
    const definition = await loadWithHome("malformed", { [sharedFile]: malformedPolicyText });
    assertBuiltinDefaults(definition, "malformed");
  });

  it("ignores missing keys and wrong-typed values key by key, and non-object or unreadable shared policies entirely", async () => {
    const mixed = await loadWithHome("mixed", {
      [sharedFile]: JSON.stringify({
        orchestrator_model: 42,
        completion_reviewer_model: null,
        writer_model: ["x"],
        risk_reviewer_model: "test/only-risk",
        review_tier: "gold",
        defaults: { orchestrator_model: "   ", review_tier: 2, writer_model: "test/default-writer" },
      }),
    });
    assert.equal(mixed.inputs.orchestrator_model.default, builtin.orchestrator_model);
    assert.equal(mixed.inputs.review_tier.default, builtin.review_tier);
    assert.equal(mixed.inputs.completion_reviewer_model.default, undefined);
    assert.equal(mixed.inputs.writer_model.default, "test/default-writer", "a wrong-typed top-level writer falls through to defaults");
    assert.equal(mixed.inputs.risk_reviewer_model.default, "test/only-risk");
    for (const [name, defaults] of [["null defaults", null], ["string defaults", "complex"], ["array defaults", ["simple"]]]) {
      assertBuiltinDefaults(await loadWithHome(name, { [sharedFile]: JSON.stringify({ defaults }) }), name);
    }
    for (const [name, text] of [["array", "[1, 2]"], ["string", '"test/x"'], ["null", "null"]]) {
      assertBuiltinDefaults(await loadWithHome(name, { [sharedFile]: text }), name);
    }
    const unreadable = join(prefillRoot, "unreadable", sharedFile);
    mkdirSync(unreadable, { recursive: true });
    assertBuiltinDefaults(await loadWithHome("unreadable", {}), "unreadable");
  });

  it("still re-reads the policy before every turn: prefilled launch values are only the fallback", async () => {
    const definition = await loadWithHome("refresh", {
      [sharedFile]: JSON.stringify({ defaults: { orchestrator_model: "test/prefill-orchestrator", review_tier: "simple" }, review_tiers: { simple: { reviewer_model: "test/prefill-reviewer" } } }),
    });
    const sharedPath = join(prefillRoot, "refresh", sharedFile);
    const dir = join(prefillRoot, "refresh cwd");
    git("init", "--quiet", "-b", "main", dir);
    git("-C", dir, "commit", "--quiet", "--allow-empty", "-m", "Prefill commit");
    const { ctx, calls } = fakeContext({
      cwd: dir,
      definition,
      inputs: { branch_checkout_dir: "" },
      onTask: (name) => {
        if (name === "orchestrator-1") writeJson(sharedPath, { defaults: { orchestrator_model: "test/edited-default", review_tier: "standard" }, review_tiers: { simple: { reviewer_model: "test/turn-2-reviewer" } } });
        if (name === "orchestrator-2") writeJson(sharedPath, { orchestrator_model: "test/turn-3-orchestrator", review_tiers: { simple: { reviewer_model: "test/turn-2-reviewer" } } });
        return {};
      },
      review: (name) => (name.endsWith("-3") ? approve : keepGoing),
    });
    assert.equal(ctx.inputs.orchestrator_model, "test/prefill-orchestrator");
    assert.equal(ctx.inputs.review_tier, "simple");
    assert.equal(ctx.inputs.max_turns, undefined);
    assert.equal(ctx.inputs.model_policy_path, sharedPath);
    const result = await definition.run(ctx);
    assert.equal(result.status, "complete");
    const stages = modelStages(calls);
    assert.deepEqual(stages.map((stage) => stage.name), ["orchestrator-1", "reviewer-1", "orchestrator-2", "reviewer-2", "orchestrator-3", "reviewer-3"], "an edited defaults.review_tier does not displace the launch tier");
    const byName = Object.fromEntries(stages.map((stage) => [stage.name, stage.options]));
    assert.equal(byName["orchestrator-1"].model, "test/prefill-orchestrator");
    assert.equal(byName["orchestrator-2"].model, "test/prefill-orchestrator", "an edited defaults block does not displace the prefilled launch value");
    assert.equal(byName["orchestrator-3"].model, "test/turn-3-orchestrator", "a top-level key does");
    assert.equal(byName["reviewer-1"].model, "test/prefill-reviewer");
    assert.equal(byName["reviewer-2"].model, "test/turn-2-reviewer", "the tier's models are re-read each turn");
    assert.equal(byName["reviewer-3"].model, "test/turn-2-reviewer");
  });
});

describe("goal-select tracker intake (native MCP transcript fixtures and fake workflow context; no live tracker, model or TUI)", () => {
  const guardSource = fileURLToPath(new URL("../../extensions/goal-select-tracker-guard.ts", import.meta.url));
  const jiraIssue = {
    id: "10007",
    key: "PROJ-7",
    fields: { summary: "Fix the login redirect", description: "Users loop on /login.\n\n## Acceptance criteria\n- Login lands on the dashboard\n- No redirect loop" },
  };
  const jiraCriteria = "- Login lands on the dashboard\n- No redirect loop";
  const fetchedJira = {
    outcome: "fetched",
    issue_key: "PROJ-7",
    title: "Fix the login redirect",
    url: "https://example.atlassian.net/browse/PROJ-7",
    acceptance_criteria: jiraCriteria,
    acceptance_criteria_source: "description section 'Acceptance criteria'",
    candidates: [],
    detail: "Fetched PROJ-7.",
  };
  const noIssue = { outcome: "unavailable", issue_key: "", title: "", url: "", acceptance_criteria: "", acceptance_criteria_source: "", candidates: [], detail: "" };
  let trackerRoot;
  let trackerSeed;
  let agentDir;
  let saved;
  let steps = 0;

  function call(name, args, { text = "ok", details, isError = false, guarded = true, recorded } = {}) {
    steps += 1;
    return { id: `call-${steps}`, name, args, text, details, isError, guarded, recorded };
  }

  function read(server, tool, args, text, { modelText = text, fullOutputPath } = {}) {
    return call(guard.mcpToolName(server, tool), args, {
      text: modelText,
      details: { server, tool, ...(fullOutputPath ? { fullOutputPath } : {}) },
      recorded: { content: [{ type: "text", text }] },
    });
  }

  function readError(server, tool, args, text) {
    return call(guard.mcpToolName(server, tool), args, { text, details: { server, tool }, isError: true });
  }

  function blockedCall(name, args, scope = { tracker: "jira", server: "atlassian" }) {
    const decision = guard.trackerGuardDecision(name, scope);
    return call(name, args, { text: `goal-select tracker intake is read-only: ${decision.reason}.`, isError: true });
  }

  const probe = (stage = "goal-select-tracker-intake-jira-atlassian") => {
    const { scope } = guard.parseTrackerStage(stage);
    return call(guard.TRACKER_GUARD_TOOL, {}, {
      text: `goal-select-tracker-guard is active in ${stage}.`,
      details: { guard: "active", stage: guard.parseTrackerStage(stage).stage, ...(scope ?? {}), read_tools: scope ? guard.trackerReadTools(scope) : [] },
    });
  };
  const discover = (server = "atlassian") => call(guard.TOOL_SEARCH_TOOL, { query: `${server} reads` }, { text: "No matching tools found.", details: { loaded: [] } });
  const jiraCheck = () => read("atlassian", "getAccessibleAtlassianResources", {}, JSON.stringify([{ id: "cloud-1", url: "https://example.atlassian.net" }]));
  const jiraFetch = (issue = jiraIssue, options) =>
    read("atlassian", "getJiraIssue", { cloudId: "cloud-1", issueIdOrKey: issue.key, fields: ["*all"], responseContentFormat: "markdown", updateHistory: false }, JSON.stringify(issue, null, 2), options);
  const jiraSteps = () => [discover(), jiraCheck(), jiraFetch()];

  function transcript(stageName, stageSteps) {
    const scope = guard.parseTrackerStage(stageName)?.scope;
    const file = join(trackerRoot, "sessions", `${stageName}-${randomUUID()}.jsonl`);
    const lines = [{ type: "session", version: 3, id: randomUUID(), timestamp: new Date().toISOString(), cwd: trackerSeed, internal: true, workflow: { runId: "fixture", stageId: randomUUID(), stageName } }];
    let probed = false;
    for (const step of stageSteps) {
      lines.push({ type: "message", timestamp: new Date().toISOString(), message: { role: "assistant", content: [{ type: "toolCall", id: step.id, name: step.name, arguments: step.args }] } });
      if (step.guarded) {
        lines.push({ type: "custom", customType: guard.TRACKER_GUARD_ENTRY, data: { event: "decision", toolCallId: step.id, toolName: step.name, ...(step.decision ?? guard.trackerGuardDecision(step.name, scope, probed)) } });
      }
      if (step.name === guard.TRACKER_GUARD_TOOL && !step.isError) probed = true;
      if (step.guarded && step.recorded && !step.isError) {
        lines.push({ type: "custom", customType: guard.TRACKER_GUARD_ENTRY, data: { event: "result", toolCallId: step.id, toolName: step.name, result: step.recorded } });
      }
      lines.push({
        type: "message",
        timestamp: "2026-10-01T09:00:00.000Z",
        message: { role: "toolResult", toolCallId: step.id, toolName: step.name, content: [{ type: "text", text: step.text }], ...(step.details ? { details: step.details } : {}), isError: step.isError },
      });
    }
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`);
    return file;
  }

  function trackerRun({ cwd = trackerSeed, inputs = {}, stages = {}, ui, review, runId } = {}) {
    const { ctx, calls } = fakeContext({
      cwd,
      runId,
      ui,
      review,
      inputs: { objective: undefined, tracker: "jira", ...inputs },
      onTask: (name) => {
        const base = guard.parseTrackerStage(name)?.stage;
        const stage = stages[base] ?? (base === guard.TRACKER_GUARD_CHECK_STAGE ? { steps: [probe(name)] } : undefined);
        if (!stage) return {};
        const stageSteps = base === guard.TRACKER_GUARD_CHECK_STAGE || stage.probe === false ? stage.steps : [probe(name), ...stage.steps];
        return { structured: stage.structured, sessionFile: transcript(name, stageSteps) };
      },
    });
    return { outcome: goalSelect.run(ctx), calls, ctx };
  }

  function recordingUi({ input = [], select = [] } = {}) {
    const asked = [];
    return {
      asked,
      ui: {
        async input(message) {
          asked.push({ kind: "input", message });
          return input.shift();
        },
        async select(message, options) {
          asked.push({ kind: "select", message, options });
          const answer = select.shift();
          return typeof answer === "function" ? answer(options) : answer;
        },
      },
    };
  }

  const snapshotsIn = (dir) => {
    const work = join(dir, ".atomic", "goal-select", "work");
    return existsSync(work) ? readdirSync(work).map((name) => join(work, name)) : [];
  };
  const siblings = () => readdirSync(trackerRoot).filter((name) => name.includes(".goal-")).sort();
  const names = (calls) => calls.map((entry) => entry.name);
  const stageNames = (calls) => modelStages(calls).map((stage) => stage.name);

  async function assertStopsBeforeGoal(started, pattern) {
    await assert.rejects(started.outcome, pattern);
    assert.deepEqual(stageNames(started.calls).filter((name) => !name.startsWith("goal-select-tracker-")), [], "no Goal stage ran");
    assert.equal(names(started.calls).includes("write-tracker-snapshot"), false);
    assert.equal(names(started.calls).includes("create-branch-clone"), false);
    assert.deepEqual(snapshotsIn(trackerSeed), []);
    assert.deepEqual(siblings(), []);
  }

  beforeEach(() => {
    rmSync(join(trackerSeed, ".atomic"), { recursive: true, force: true });
    for (const name of siblings()) rmSync(join(trackerRoot, name), { recursive: true, force: true });
  });

  before(() => {
    trackerRoot = realpathSync(mkdtempSync(join(tmpdir(), "goal-select-tracker-")));
    saved = {
      artifacts: process.env.ATOMIC_WORKFLOW_ARTIFACT_DIR,
      agentDir: process.env.ATOMIC_CODING_AGENT_DIR,
      piAgentDir: process.env.PI_CODING_AGENT_DIR,
    };
    process.env.ATOMIC_WORKFLOW_ARTIFACT_DIR = join(trackerRoot, "artifacts");
    agentDir = join(trackerRoot, "agent");
    mkdirSync(join(agentDir, "extensions"), { recursive: true });
    symlinkSync(guardSource, join(agentDir, "extensions", "goal-select-tracker-guard.ts"));
    process.env.ATOMIC_CODING_AGENT_DIR = agentDir;
    delete process.env.PI_CODING_AGENT_DIR;
    const origin = join(trackerRoot, "server.git");
    trackerSeed = join(trackerRoot, "tracker seed");
    git("init", "--quiet", "--bare", origin);
    git("init", "--quiet", "-b", "main", trackerSeed);
    writeFileSync(join(trackerSeed, "README.md"), "tracker seed\n");
    git("-C", trackerSeed, "add", ".");
    git("-C", trackerSeed, "commit", "--quiet", "-m", "Tracker seed");
    git("-C", trackerSeed, "remote", "add", "origin", origin);
    git("-C", trackerSeed, "push", "--quiet", "origin", "main");
    process.chdir = () => {
      throw new Error("goal-select must not call process.chdir");
    };
  });

  after(() => {
    process.chdir = originalChdir;
    for (const [key, name] of [["artifacts", "ATOMIC_WORKFLOW_ARTIFACT_DIR"], ["agentDir", "ATOMIC_CODING_AGENT_DIR"], ["piAgentDir", "PI_CODING_AGENT_DIR"]]) {
      if (saved[key] === undefined) delete process.env[name];
      else process.env[name] = saved[key];
    }
    rmSync(trackerRoot, { recursive: true, force: true });
  });

  it("declares tracker inputs as optional, with none as the default and objective no longer forced by the picker", () => {
    assert.deepEqual(goalSelect.inputs.tracker.anyOf.map((member) => member.const), ["none", "jira", "linear"]);
    assert.equal(goalSelect.inputs.tracker.default, "none");
    assert.equal(goalSelect.inputs.tracker_issue.default, undefined);
    assert.equal(goalSelect.inputs.tracker_mcp_server.default, undefined);
    const resolved = resolveInputs(goalSelect.inputs, {});
    assert.equal(resolved.tracker, "none");
    assert.equal(resolved.objective, undefined);
  });

  it("runs the tracker stages on tracker_model when one is given, and on the session's model otherwise", async () => {
    const intake = await import(new URL("./tracker-intake.js", import.meta.url).href);
    assert.equal(goalSelect.inputs.tracker_model.default, undefined);
    const pinned = intake.trackerIntake({ tracker: "jira", tracker_model: " anthropic/claude-sonnet-5-5:medium " }, trackerSeed);
    for (const options of [intake.guardCheckStageOptions(pinned), intake.trackerStageOptions(pinned, "unused")]) {
      assert.equal(options.model, "anthropic/claude-sonnet-5-5:medium");
      assert.deepEqual(options.fallbackModels, []);
    }
    for (const tracker_model of [undefined, "", "  "]) {
      const unpinned = intake.trackerIntake({ tracker: "jira", tracker_model }, trackerSeed);
      for (const options of [intake.guardCheckStageOptions(unpinned), intake.trackerStageOptions(unpinned, "unused")]) {
        assert.equal("model" in options, false);
        assert.equal("fallbackModels" in options, false);
      }
    }
  });

  it("keeps the manual path: tracker none needs a typed objective, runs no tracker step and puts the typed text in the ledger", async () => {
    for (const objective of [undefined, "", "   "]) {
      for (const resolve_only of [false, true]) {
        const { ctx, calls } = fakeContext({ cwd: trackerSeed, inputs: { objective, resolve_only, branch_checkout_dir: "" } });
        await assert.rejects(goalSelect.run(ctx), /goal requires an objective input\./);
        assert.deepEqual(calls, [], "nothing ran before the objective check");
      }
    }
    const typed = "Fix the typed login bug.";
    const { ctx, calls } = fakeContext({ cwd: trackerSeed, inputs: { objective: typed, acceptance_criteria: "Typed criteria.", branch_checkout_dir: "", tracker_issue: "PROJ-7" } });
    const result = await goalSelect.run(ctx);
    assert.equal(result.status, "complete");
    assert.equal(result.objective, typed);
    assert.equal(result.acceptance_criteria, "Typed criteria.");
    assert.deepEqual(stageNames(calls), ["orchestrator-1", "completion-reviewer-1", "evidence-reviewer-1", "risk-reviewer-1"]);
    assert.equal(names(calls).some((name) => name?.includes("tracker")), false);
    const preview = await resolveOnly(trackerSeed, { objective: typed, branch_checkout_dir: "" });
    assert.equal("tracker" in preview, false);
  });

  it("reads only Atomic's native MCP config: stops on enabled false, lets a trusted project file replace the global entry, and ignores legacy files and fields", async () => {
    const globalFile = join(agentDir, "mcp.json");
    const projectFile = join(trackerSeed, ".atomic", "mcp.json");
    const trust = (decision) => writeJson(join(agentDir, "trust.json"), { [trackerSeed]: decision });
    const preview = () => resolveOnly(trackerSeed, { objective: undefined, tracker: "jira", tracker_issue: "PROJ-7", branch_checkout_dir: "" });
    writeJson(globalFile, { mcpServers: { atlassian: { url: "https://mcp.atlassian.com/v1/mcp", enabled: false } } });
    try {
      const started = trackerRun({ inputs: { tracker_issue: "PROJ-7" } });
      await assertStopsBeforeGoal(started, (error) => error.message.includes(`disabled ("enabled": false in ${globalFile})`) && error.message.includes("No checkout or snapshot was created"));
      assert.deepEqual(names(started.calls), ["check-tracker-mcp"]);

      writeJson(projectFile, { mcpServers: { atlassian: { url: "https://mcp.atlassian.com/v1/mcp" } } });
      trust(true);
      assert.equal((await preview()).tracker.config_source, projectFile, "a trusted project entry replaces the global one");
      trust(false);
      await assertStopsBeforeGoal(trackerRun({ inputs: { tracker_issue: "PROJ-7" } }), /disabled \("enabled": false in /);

      writeJson(projectFile, { mcpServers: { atlassian: { url: "https://mcp.atlassian.com/v1/mcp", enabled: false } } });
      writeJson(globalFile, { mcpServers: { atlassian: { url: "https://mcp.atlassian.com/v1/mcp" } } });
      assert.equal((await preview()).tracker.config_source, globalFile, "an untrusted project file is not read");
      trust(true);
      await assertStopsBeforeGoal(trackerRun({ inputs: { tracker_issue: "PROJ-7" } }), (error) => error.message.includes(`("enabled": false in ${projectFile})`));

      rmSync(projectFile, { force: true });
      writeJson(globalFile, { mcpServers: { atlassian: { url: "https://mcp.atlassian.com/v1/mcp", disabled: true } } });
      writeJson(join(trackerSeed, ".mcp.json"), { mcpServers: { atlassian: { url: "https://mcp.atlassian.com/v1/mcp", enabled: false } } });
      writeJson(join(trackerSeed, ".pi", "mcp.json"), { mcpServers: { atlassian: { url: "https://mcp.atlassian.com/v1/mcp", enabled: false } } });
      assert.equal((await preview()).tracker.config_source, globalFile, "legacy disabled and legacy files are not native configuration");

      writeJson(globalFile, { mcpServers: { work_linear: { url: "https://mcp.linear.app/mcp", enabled: false } } });
      await assertStopsBeforeGoal(
        trackerRun({ inputs: { tracker: "linear", tracker_issue: "TUS-5", tracker_mcp_server: "work-linear" } }),
        /MCP server "work_linear" for Linear is disabled/,
      );
      await assertStopsBeforeGoal(trackerRun({ inputs: { tracker_issue: "PROJ-7", tracker_mcp_server: "my server" } }), /"my server" is not a valid MCP server name/);
    } finally {
      for (const path of [globalFile, join(agentDir, "trust.json"), join(trackerSeed, ".mcp.json"), join(trackerSeed, ".pi")]) rmSync(path, { recursive: true, force: true });
    }
  });

  it("previews tracker intake under resolve_only without an intake stage, clone or snapshot, reporting a server the config files omit as possibly contributed, not absent", async () => {
    const explicit = trackerRun({ inputs: { tracker_issue: "PROJ-7", branch_checkout_dir: "", resolve_only: true } });
    const explicitResult = await explicit.outcome;
    assert.deepEqual(stageNames(explicit.calls), []);
    assert.match(explicitResult.result, /Resolved models for turn 1\. No Goal stage ran\./);
    assert.match(explicitResult.result, /Tracker intake \(not run in preview\): Jira issue "PROJ-7"/);
    assert.match(explicitResult.result, /not in Atomic's MCP config files .*a package or extension may still provide it/);
    const models = JSON.parse(explicitResult.models);
    assert.deepEqual(models.tracker, {
      tracker: "jira",
      server: "atlassian",
      config_source: null,
      guard: join(agentDir, "extensions", "goal-select-tracker-guard.ts"),
      issue_request: "PROJ-7",
      intake_ran: false,
    });
    const auto = trackerRun({ inputs: { tracker: "linear", tracker_issue: "TUS-5", resolve_only: true } });
    const autoResult = await auto.outcome;
    assert.deepEqual(stageNames(auto.calls), []);
    assert.match(autoResult.result, /Planned clone: .*tracker seed\.goal-tus-5-/);
    assert.match(autoResult.result, /provisional/);
    assert.equal(JSON.parse(autoResult.models).tracker.server, "linear");
    assert.deepEqual(siblings(), []);
    assert.deepEqual(snapshotsIn(trackerSeed), []);
  });

  it("refuses tracker intake before any stage when the guard extension is not where Atomic discovers extensions", async () => {
    const link = join(agentDir, "extensions", "goal-select-tracker-guard.ts");
    unlinkSync(link);
    try {
      const started = trackerRun({ inputs: { tracker_issue: "PROJ-7" } });
      await assertStopsBeforeGoal(started, /needs the goal-select-tracker-guard\.ts Atomic extension/);
      assert.deepEqual(names(started.calls), ["check-tracker-mcp"]);
    } finally {
      symlinkSync(guardSource, link);
    }
  });

  it("fetches an issue the request names, saves a readable snapshot in an existing checkout before Goal starts, and hands it to every agent", async () => {
    const started = trackerRun({
      inputs: { tracker_issue: "PROJ-7", branch_checkout_dir: "" },
      stages: { "goal-select-tracker-intake": { structured: fetchedJira, steps: jiraSteps() } },
    });
    const result = await started.outcome;
    assert.equal(result.status, "complete");
    assert.deepEqual(stageNames(started.calls), ["goal-select-tracker-guard-check", "goal-select-tracker-intake-jira-atlassian", "orchestrator-1", "completion-reviewer-1", "evidence-reviewer-1", "risk-reviewer-1"]);
    const order = names(started.calls);
    assert.deepEqual(order.slice(0, 7), [
      "check-tracker-mcp",
      "resolve-branch-checkout",
      "goal-select-tracker-guard-check",
      "audit-goal-select-tracker-guard-check",
      "goal-select-tracker-intake-jira-atlassian",
      "audit-goal-select-tracker-intake-jira-atlassian",
      "write-tracker-snapshot",
    ]);
    const guardCheck = modelStages(started.calls)[0].options;
    assert.deepEqual(guardCheck.tools, [guard.TRACKER_GUARD_TOOL], "the guard check stage has no MCP access at all");
    assert.equal(guardCheck.cwd, trackerSeed);

    const intake = modelStages(started.calls)[1].options;
    assert.equal(intake.cwd, trackerSeed);
    assert.ok(intake.schema);
    assert.equal(intake.mcp, undefined, "the native MCP client ignores stage mcp scopes, so the guard and allowlist enforce the server");
    assert.deepEqual(intake.tools, [
      guard.TRACKER_GUARD_TOOL,
      "tool_search",
      "mcp__atlassian__getAccessibleAtlassianResources",
      "mcp__atlassian__getJiraIssue",
      "mcp__atlassian__searchJiraIssuesUsingJql",
    ]);
    assert.match(intake.prompt, /0\. Call goal_select_tracker_guard with no arguments, alone, before any other tool/);
    assert.match(intake.prompt, /1\. Call tool_search once with the query "atlassian getAccessibleAtlassianResources getJiraIssue searchJiraIssuesUsingJql"/);
    assert.match(intake.prompt, /- Fetch: tool "mcp__atlassian__getJiraIssue", arguments \{"cloudId": "<cloudId>", "issueIdOrKey": "<KEY>"/);
    assert.doesNotMatch(intake.prompt, /mcp\(\{|gateway/);
    assert.match(intake.prompt, /<request>\nPROJ-7\n<\/request>/);
    assert.match(intake.prompt, /Never create, edit, transition/);

    const [snapshot] = snapshotsIn(trackerSeed);
    const runHash = createHash("sha256").update(started.ctx.runId).digest("hex").slice(0, 8);
    assert.equal(snapshot, join(trackerSeed, ".atomic", "goal-select", "work", `jira-proj-7-${runHash}.md`));
    const text = readFileSync(snapshot, "utf8");
    assert.match(text, /^# Jira PROJ-7: Fix the login redirect\n/);
    assert.ok(text.includes("- MCP server: atlassian (not in Atomic's MCP config files; provided by a package or extension)"), text);
    assert.ok(text.includes("- URL: https://example.atlassian.net/browse/PROJ-7"));
    assert.ok(text.includes("- Request: PROJ-7"));
    assert.ok(text.includes("- Fetched: 2026-10-01T09:00:00.000Z"));
    assert.ok(text.includes("- Successful read calls: getAccessibleAtlassianResources, getJiraIssue"));
    assert.ok(text.includes(`- Workflow run: ${started.ctx.runId}`));
    assert.ok(text.includes(`## Description\n\n${jiraIssue.fields.description}\n`));
    assert.ok(text.includes(`From the issue (description section 'Acceptance criteria'), copied verbatim from the response:\n\n${jiraCriteria}`));
    assert.ok(text.includes(`~~~\n${JSON.stringify(jiraIssue, null, 2)}\n~~~`));
    assert.equal(readFileSync(join(trackerSeed, ".atomic", "goal-select", ".gitignore"), "utf8"), "*\n");
    assert.equal(git("-C", trackerSeed, "status", "--porcelain", "--untracked-files=all"), "", "the snapshot never dirties the checkout");

    assert.ok(result.objective.startsWith("Deliver Jira PROJ-7: Fix the login redirect\n"), result.objective);
    assert.ok(result.objective.includes(`Work definition: the snapshot ${snapshot}`));
    assert.ok(result.objective.includes("so no agent needs tracker or MCP access"));
    assert.equal(result.acceptance_criteria, `Acceptance criteria of Jira PROJ-7 (description section 'Acceptance criteria'), as saved in ${snapshot}:\n${jiraCriteria}`);
    const ledger = JSON.parse(readFileSync(result.ledger_path, "utf8"));
    assert.equal(ledger.objective, result.objective);
    assert.equal(ledger.acceptance_criteria, result.acceptance_criteria);
    const byName = Object.fromEntries(modelStages(started.calls).map((stage) => [stage.name, stage.options]));
    assert.ok(byName["orchestrator-1"].reads.includes(result.ledger_path));
    for (const reviewer of ["completion-reviewer-1", "evidence-reviewer-1", "risk-reviewer-1"]) {
      assert.ok(byName[reviewer].reads.includes(result.ledger_path), `${reviewer} reads the ledger`);
      assert.equal(byName[reviewer].cwd, trackerSeed);
    }
    const reviewRound = started.calls.find((entry) => entry.kind === "parallel");
    assert.ok(reviewRound.options.task.includes(snapshot), "the reviewers' shared task names the snapshot");
  });

  it("names the auto clone from the issue key and writes the snapshot into the new clone, not the seed", async () => {
    const started = trackerRun({
      inputs: { tracker_issue: "proj-7" },
      stages: { "goal-select-tracker-intake": { structured: fetchedJira, steps: jiraSteps() } },
    });
    const result = await started.outcome;
    assert.equal(result.status, "complete");
    const order = names(started.calls);
    assert.ok(order.indexOf("goal-select-tracker-intake-jira-atlassian") < order.indexOf("plan-branch-clone"), "intake runs before the clone is planned");
    const clone = started.calls.find((entry) => entry.name === "create-branch-clone").result.checkout;
    assert.match(basename(clone), /^tracker seed\.goal-proj-7-[0-9a-f]{8}$/);
    assert.equal(modelStages(started.calls)[1].options.cwd, trackerSeed, "the intake stage runs in the invoking checkout");
    assert.equal(modelStages(started.calls)[2].options.cwd, clone);
    assert.deepEqual(snapshotsIn(trackerSeed), []);
    const [snapshot] = snapshotsIn(clone);
    assert.ok(snapshot.startsWith(join(clone, ".atomic", "goal-select", "work", "jira-proj-7-")));
    assert.ok(result.objective.includes(snapshot));
    assert.equal(git("-C", clone, "status", "--porcelain", "--untracked-files=all"), "");
  });

  it("offers search matches to choose from, then fetches only the chosen issue in a second read-only stage", async () => {
    const { ui, asked } = recordingUi({ select: [(options) => options[0]] });
    const candidates = { ...noIssue, outcome: "candidates", candidates: [{ key: "PROJ-7", title: "Fix the login redirect" }, { key: "PROJ-9", title: "Login copy" }], detail: "Two matches." };
    const search = read("atlassian", "searchJiraIssuesUsingJql", { cloudId: "cloud-1", jql: 'text ~ "login redirect"' }, JSON.stringify({ issues: [{ key: "PROJ-7" }, { key: "PROJ-9" }] }));
    const started = trackerRun({
      ui,
      inputs: { tracker_issue: "login redirect", branch_checkout_dir: "" },
      stages: {
        "goal-select-tracker-intake": { structured: candidates, steps: [discover(), jiraCheck(), search] },
        "goal-select-tracker-fetch": { structured: fetchedJira, steps: jiraSteps() },
      },
    });
    const result = await started.outcome;
    assert.equal(result.status, "complete");
    assert.deepEqual(asked, [{ kind: "select", message: "Choose the Jira issue for this run (request: login redirect)", options: ["PROJ-7: Fix the login redirect", "PROJ-9: Login copy", "Stop: none of these"] }]);
    assert.deepEqual(stageNames(started.calls).slice(0, 3), ["goal-select-tracker-guard-check", "goal-select-tracker-intake-jira-atlassian", "goal-select-tracker-fetch-jira-atlassian"]);
    assert.deepEqual(modelStages(started.calls)[2].options.tools, modelStages(started.calls)[1].options.tools, "the fetch stage has the same native read allowlist");
    assert.match(modelStages(started.calls)[2].options.prompt, /<request>\nPROJ-7\n<\/request>/);
    assert.match(modelStages(started.calls)[2].options.prompt, /Fetch exactly the issue PROJ-7/);
    assert.ok(readFileSync(snapshotsIn(trackerSeed)[0], "utf8").includes("- Request: login redirect"));
  });

  it("stops truthfully when the choice is stopped, the request is empty, or the fetched issue the request did not name is refused", async () => {
    const candidates = { ...noIssue, outcome: "candidates", candidates: [{ key: "PROJ-7", title: "Fix the login redirect" }] };
    const stopped = recordingUi({ select: [STOP_CHOICE_TEXT] });
    await assertStopsBeforeGoal(
      trackerRun({ ui: stopped.ui, inputs: { tracker_issue: "login" }, stages: { "goal-select-tracker-intake": { structured: candidates, steps: [discover(), jiraCheck()] } } }),
      /No Jira issue was chosen for "login"/,
    );

    const empty = recordingUi({ input: ["   "] });
    const emptyRun = trackerRun({ ui: empty.ui });
    await assertStopsBeforeGoal(emptyRun, /No Jira issue was given/);
    assert.deepEqual(empty.asked, [{ kind: "input", message: "Jira issue key, URL or search words" }]);
    assert.deepEqual(stageNames(emptyRun.calls), ["goal-select-tracker-guard-check"]);

    const unnamed = recordingUi({ select: [STOP_CHOICE_TEXT] });
    const unnamedRun = trackerRun({ ui: unnamed.ui, inputs: { tracker_issue: "10007" }, stages: { "goal-select-tracker-intake": { structured: fetchedJira, steps: jiraSteps() } } });
    await assertStopsBeforeGoal(unnamedRun, /No Jira issue was chosen for "10007"/);
    assert.deepEqual(unnamed.asked[0].options, ["PROJ-7: Fix the login redirect", "Stop: none of these"]);
  });

  it("asks for the issue when tracker_issue is empty, and confirms a fetched issue the request did not name before using it", async () => {
    const asked = recordingUi({ input: ["PROJ-7"] });
    const askedRun = trackerRun({ ui: asked.ui, inputs: { branch_checkout_dir: "" }, stages: { "goal-select-tracker-intake": { structured: fetchedJira, steps: jiraSteps() } } });
    assert.equal((await askedRun.outcome).status, "complete");
    assert.match(modelStages(askedRun.calls)[1].options.prompt, /<request>\nPROJ-7\n<\/request>/);
    assert.ok(readFileSync(snapshotsIn(trackerSeed)[0], "utf8").includes("- Request: entered at launch"));

    const confirmed = recordingUi({ select: [(options) => options[0]] });
    const confirmedRun = trackerRun({ ui: confirmed.ui, inputs: { tracker_issue: "10007", branch_checkout_dir: "" }, stages: { "goal-select-tracker-intake": { structured: fetchedJira, steps: jiraSteps() } } });
    assert.equal((await confirmedRun.outcome).status, "complete");
    assert.equal(confirmed.asked.length, 1);
    assert.equal(stageNames(confirmedRun.calls).some((name) => name.startsWith("goal-select-tracker-fetch")), false, "a confirmed issue is not fetched again");
  });

  it("stops when the tracker is unavailable or the issue is missing, never falling back to the typed objective", async () => {
    const unconnected = discover();
    await assertStopsBeforeGoal(
      trackerRun({ inputs: { objective: "Typed fallback that must not run.", tracker_issue: "PROJ-7" }, stages: { "goal-select-tracker-intake": { structured: { ...noIssue, detail: "atlassian needs sign-in." }, steps: [unconnected] } } }),
      /Jira through MCP server "atlassian" is unavailable: the getAccessibleAtlassianResources read check did not succeed\. atlassian needs sign-in\. Sign in with \/mcp login atlassian \(or atomic mcp login atlassian\)/,
    );
    const authError = readError("atlassian", "getAccessibleAtlassianResources", {}, 'MCP server "atlassian" needs sign-in. Run /mcp login atlassian.');
    await assertStopsBeforeGoal(
      trackerRun({ inputs: { tracker_issue: "PROJ-7" }, stages: { "goal-select-tracker-intake": { structured: fetchedJira, steps: [discover(), authError, jiraFetch()] } } }),
      /is unavailable: the getAccessibleAtlassianResources read check did not succeed/,
    );
    const missing = readError("atlassian", "getJiraIssue", { cloudId: "cloud-1", issueIdOrKey: "PROJ-404" }, "Error: Issue does not exist or you do not have permission to see it.");
    await assertStopsBeforeGoal(
      trackerRun({ inputs: { tracker_issue: "PROJ-404" }, stages: { "goal-select-tracker-intake": { structured: { ...noIssue, outcome: "not_found", detail: "Issue does not exist." }, steps: [discover(), jiraCheck(), missing] } } }),
      /No Jira issue matched "PROJ-404" through MCP server "atlassian"\. Issue does not exist\./,
    );
    await assertStopsBeforeGoal(
      trackerRun({ inputs: { tracker_issue: "PROJ-7" }, stages: { "goal-select-tracker-intake": { structured: fetchedJira, steps: [discover(), jiraCheck()] } } }),
      /did not return a Jira issue that a successful getJiraIssue call fetched \(reported "PROJ-7"\)/,
    );
    await assertStopsBeforeGoal(
      trackerRun({ inputs: { tracker_issue: "PROJ-7" }, stages: { "goal-select-tracker-intake": { steps: jiraSteps() } } }),
      /is unavailable|did not return/,
    );
    const legacyGateway = call("mcp", { tool: "atlassian_getJiraIssue", args: "{}" }, { text: JSON.stringify(jiraIssue), details: { server: "atlassian", tool: "getJiraIssue" } });
    await assertStopsBeforeGoal(
      trackerRun({ inputs: { tracker_issue: "PROJ-7" }, stages: { "goal-select-tracker-intake": { structured: fetchedJira, steps: [jiraCheck(), legacyGateway] } } }),
      /blocked them before they ran: tool "mcp" is not an allow-listed jira read tool of MCP server "atlassian"/,
    );
  });

  it("never counts a read of another MCP server, even one shaped like the selected server's, as the issue", async () => {
    const linearRead = read("linear", "get_issue", { id: "PROJ-7" }, JSON.stringify(jiraIssue));
    await assertStopsBeforeGoal(
      trackerRun({ inputs: { tracker_issue: "PROJ-7" }, stages: { "goal-select-tracker-intake": { structured: fetchedJira, steps: [discover(), jiraCheck(), linearRead] } } }),
      /goal-select-tracker-guard blocked them before they ran: tool "mcp__linear__get_issue" is not an allow-listed jira read tool of MCP server "atlassian"/,
    );
    const spoofed = { ...jiraFetch(), details: { server: "linear", tool: "getJiraIssue" } };
    await assertStopsBeforeGoal(
      trackerRun({ inputs: { tracker_issue: "PROJ-7" }, stages: { "goal-select-tracker-intake": { structured: fetchedJira, steps: [discover(), jiraCheck(), spoofed] } } }),
      /did not return a Jira issue that a successful getJiraIssue call fetched/,
    );
    const otherScope = { ...probe("goal-select-tracker-intake-jira-other"), decision: { allowed: true } };
    await assertStopsBeforeGoal(
      trackerRun({ inputs: { tracker_issue: "PROJ-7" }, stages: { "goal-select-tracker-intake": { structured: fetchedJira, probe: false, steps: [otherScope, ...jiraSteps()] } } }),
      /goal_select_tracker_guard did not run/,
    );
  });

  it("snapshots the complete response of a large native result, not the shortened text the model saw, and stops when the full text is gone", async () => {
    const big = { ...jiraIssue, fields: { ...jiraIssue.fields, description: `${jiraIssue.fields.description}\n\n${"Long field. ".repeat(4000)}` } };
    const full = JSON.stringify(big, null, 2);
    assert.ok(full.length > 40_000);
    const shortened = `Warning: truncated output\n\n${full.slice(0, 10_000)}\n\n[Full output: /missing (read it with offset/limit)]`;
    const savedPath = join(trackerRoot, "full-output.txt");
    writeFileSync(savedPath, full);
    for (const fetch of [
      jiraFetch(big, { modelText: shortened, fullOutputPath: join(trackerRoot, "gone.txt") }),
      { ...jiraFetch(big, { modelText: shortened, fullOutputPath: savedPath }), recorded: undefined },
    ]) {
      const started = trackerRun({ inputs: { tracker_issue: "PROJ-7", branch_checkout_dir: "" }, stages: { "goal-select-tracker-intake": { structured: fetchedJira, steps: [discover(), jiraCheck(), fetch] } } });
      assert.equal((await started.outcome).status, "complete");
      const [snapshot] = snapshotsIn(trackerSeed);
      const text = readFileSync(snapshot, "utf8");
      assert.ok(text.includes(`~~~\n${full}\n~~~`), "the raw section holds the complete response");
      assert.ok(!text.includes("Warning: truncated output"));
      rmSync(join(trackerSeed, ".atomic"), { recursive: true, force: true });
    }
    const lost = { ...jiraFetch(big, { modelText: shortened, fullOutputPath: join(trackerRoot, "gone.txt") }), recorded: undefined };
    await assertStopsBeforeGoal(
      trackerRun({ inputs: { tracker_issue: "PROJ-7" }, stages: { "goal-select-tracker-intake": { structured: fetchedJira, steps: [discover(), jiraCheck(), lost] } } }),
      /its full getJiraIssue response was not preserved/,
    );
  });

  it("stops when the guard blocked a tracker write attempt before it ran, or when any call ran without a guard decision", async () => {
    const transition = blockedCall("mcp__atlassian__transitionJiraIssue", { cloudId: "cloud-1", issueIdOrKey: "PROJ-7", transition: { id: "31" } });
    await assertStopsBeforeGoal(
      trackerRun({ inputs: { tracker_issue: "PROJ-7" }, stages: { "goal-select-tracker-intake": { structured: fetchedJira, steps: [discover(), jiraCheck(), transition, jiraFetch()] } } }),
      /attempted tracker calls outside the read-only allow-list; goal-select-tracker-guard blocked them before they ran: tool "mcp__atlassian__transitionJiraIssue" is not an allow-listed jira read tool of MCP server "atlassian"/,
    );
    const unguardedFetch = { ...jiraFetch(), guarded: false };
    await assertStopsBeforeGoal(
      trackerRun({ inputs: { tracker_issue: "PROJ-7" }, stages: { "goal-select-tracker-intake": { structured: fetchedJira, steps: [discover(), jiraCheck(), unguardedFetch] } } }),
      /goal-select-tracker-guard was not shown active for every call in the goal-select-tracker-intake-jira-atlassian stage \(unchecked: mcp__atlassian__getJiraIssue\)/,
    );
    await assertStopsBeforeGoal(
      trackerRun({ inputs: { tracker_issue: "PROJ-7" }, stages: { "goal-select-tracker-intake": { structured: fetchedJira, probe: false, steps: jiraSteps() } } }),
      /not shown active for every call in the goal-select-tracker-intake-jira-atlassian stage \(goal_select_tracker_guard did not run\)/,
    );
  });

  it("refuses before any MCP-capable stage when the guard check stage shows the guard is not loaded", async () => {
    for (const steps of [[], [call(guard.TRACKER_GUARD_TOOL, {}, { text: "Tool goal_select_tracker_guard not found", isError: true })], [{ ...probe("goal-select-tracker-guard-check"), guarded: false }]]) {
      const started = trackerRun({ inputs: { tracker_issue: "PROJ-7" }, stages: { "goal-select-tracker-guard-check": { steps } } });
      await assertStopsBeforeGoal(started, /goal-select-tracker-guard did not run in the goal-select-tracker-guard-check stage, so Atomic is not enforcing read-only Jira calls\. No MCP call was made\./);
      assert.deepEqual(stageNames(started.calls), ["goal-select-tracker-guard-check"]);
    }
  });

  it("does not treat reads the guard held back until its probe ran as write attempts", async () => {
    const heldBack = {
      ...call("tool_search", { query: "atlassian" }, { text: "goal-select tracker intake is read-only: goal_select_tracker_guard must run before any other call.", isError: true }),
      decision: guard.trackerGuardDecision("tool_search", { tracker: "jira", server: "atlassian" }, false),
    };
    const started = trackerRun({
      inputs: { tracker_issue: "PROJ-7", branch_checkout_dir: "" },
      stages: { "goal-select-tracker-intake": { structured: fetchedJira, probe: false, steps: [heldBack, probe(), discover(), jiraCheck(), jiraFetch()] } },
    });
    assert.equal((await started.outcome).status, "complete");
  });

  it("tolerates a read Atomic refused because the server had not connected yet, but stops on a refused write", async () => {
    const refused = (name, args) => call(name, args, { text: `Tool ${name} not found`, isError: true, guarded: false });
    const early = trackerRun({
      inputs: { tracker_issue: "PROJ-7", branch_checkout_dir: "" },
      stages: { "goal-select-tracker-intake": { structured: fetchedJira, steps: [refused("mcp__atlassian__getAccessibleAtlassianResources", {}), ...jiraSteps()] } },
    });
    assert.equal((await early.outcome).status, "complete");
    rmSync(join(trackerSeed, ".atomic"), { recursive: true, force: true });
    await assertStopsBeforeGoal(
      trackerRun({ inputs: { tracker_issue: "PROJ-7" }, stages: { "goal-select-tracker-intake": { structured: fetchedJira, steps: [...jiraSteps(), refused("mcp__atlassian__editJiraIssue", { issueIdOrKey: "PROJ-7" })] } } }),
      /blocked them before they ran: tool "mcp__atlassian__editJiraIssue" is not available in this stage/,
    );
    const unexplained = { ...call("mcp__atlassian__getJiraIssue", {}, { text: "ran without the guard", guarded: false }) };
    await assertStopsBeforeGoal(
      trackerRun({ inputs: { tracker_issue: "PROJ-7" }, stages: { "goal-select-tracker-intake": { structured: fetchedJira, steps: [...jiraSteps(), unexplained] } } }),
      /not shown active for every call .*unchecked: mcp__atlassian__getJiraIssue/,
    );
  });

  it("uses launch acceptance_criteria instead of the issue's and keeps launch objective text, recording both in the snapshot", async () => {
    const started = trackerRun({
      inputs: { tracker_issue: "PROJ-7", branch_checkout_dir: "", objective: "Also keep the audit log.", acceptance_criteria: "Typed criteria win." },
      stages: { "goal-select-tracker-intake": { structured: fetchedJira, steps: jiraSteps() } },
    });
    const result = await started.outcome;
    const [snapshot] = snapshotsIn(trackerSeed);
    assert.equal(result.acceptance_criteria, `Typed criteria win.\n\n(Supplied at launch for Jira PROJ-7; they replace the issue's own criteria, which remain in ${snapshot}.)`);
    assert.ok(result.objective.endsWith("\n\nAdditional objective text supplied at launch:\nAlso keep the audit log."), result.objective);
    const text = readFileSync(snapshot, "utf8");
    assert.ok(text.includes("Supplied at launch through acceptance_criteria; this run uses them instead of the issue's own criteria.\n\nTyped criteria win."));
    assert.ok(text.includes(`The issue's own criteria, for reference:\n\nFrom the issue (description section 'Acceptance criteria'), copied verbatim from the response:\n\n${jiraCriteria}`));
  });

  it("fetches a Linear issue through the native tools of a custom server name and labels criteria it could not find", async () => {
    const linearIssue = { id: "TUS-5", uuid: "u-5", title: "Complete the token layer", description: "Bring main.css to the full token set.", url: "https://linear.app/acme/issue/TUS-5/complete-the-token-layer" };
    const native = (tool, args, text) => read("work-linear", tool, args, text);
    const started = trackerRun({
      inputs: { tracker: "linear", tracker_issue: "https://linear.app/acme/issue/TUS-5/complete-the-token-layer", tracker_mcp_server: " work-linear ", branch_checkout_dir: "" },
      stages: {
        "goal-select-tracker-intake": {
          structured: { ...fetchedJira, issue_key: "TUS-5", title: "Model title", url: "", acceptance_criteria: "", acceptance_criteria_source: "" },
          steps: [discover("work-linear"), native("get_workspace", {}, JSON.stringify({ name: "Acme" })), native("get_issue", { id: "TUS-5" }, JSON.stringify(linearIssue))],
        },
      },
    });
    const result = await started.outcome;
    assert.equal(modelStages(started.calls)[1].name, "goal-select-tracker-intake-linear-work-linear");
    const intake = modelStages(started.calls)[1].options;
    assert.deepEqual(intake.tools.slice(2), ["mcp__work_linear__get_workspace", "mcp__work_linear__get_issue", "mcp__work_linear__list_issues"]);
    assert.match(intake.prompt, /tool "mcp__work_linear__get_issue", arguments \{"id": "<IDENTIFIER>"\}/);
    const [snapshot] = snapshotsIn(trackerSeed);
    assert.match(basename(snapshot), /^linear-tus-5-[0-9a-f]{8}\.md$/);
    const text = readFileSync(snapshot, "utf8");
    assert.match(text, /^# Linear TUS-5: Complete the token layer\n/, "the title comes from the tracker response, not the model");
    assert.ok(text.includes(`- URL: ${linearIssue.url}`));
    assert.ok(text.includes("- Successful read calls: get_workspace, get_issue"));
    assert.ok(text.includes("The issue has no separate acceptance criteria, so the whole work definition above is the acceptance contract."));
    assert.equal(result.acceptance_criteria, `Linear TUS-5 has no separate acceptance criteria; the complete work definition in ${snapshot} is the acceptance contract.`);
  });
});



describe("goal-select-tracker-guard extension (fake extension API; Atomic's tool_call and tool_result hook contract, not a live session)", () => {
  const jira = { tracker: "jira", server: "atlassian" };
  const linear = { tracker: "linear", server: "work-linear" };
  const writeTools = [
    "mcp__atlassian__editJiraIssue",
    "mcp__atlassian__createJiraIssue",
    "mcp__atlassian__transitionJiraIssue",
    "mcp__atlassian__addCommentToJiraIssue",
    "mcp__atlassian__addWorklogToJiraIssue",
    "mcp__atlassian__createIssueLink",
    "mcp__atlassian__createConfluencePage",
    "mcp__atlassian__updateConfluencePage",
    "mcp__work_linear__save_issue",
    "mcp__work_linear__save_comment",
    "mcp__work_linear__delete_comment",
    "mcp__work_linear__create_attachment",
    "mcp__work_linear__share_issue",
    "mcp__work_linear__merge_diff",
  ];

  function session(stageName) {
    const handlers = {};
    const entries = [];
    const tools = [];
    guard.default({
      on: (event, handler) => {
        handlers[event] = handler;
      },
      appendEntry: (type, data) => entries.push({ type, data }),
      registerTool: (tool) => tools.push(tool),
    });
    assert.deepEqual(Object.keys(handlers).sort(), ["session_start", "tool_call", "tool_result"]);
    const header = stageName === undefined ? { type: "session" } : { type: "session", workflow: { runId: "r", stageId: "s", stageName } };
    const ctx = { sessionManager: { getHeader: () => header } };
    handlers.session_start({ reason: "startup" }, ctx);
    let id = 0;
    const fire = (toolName, input = {}) => {
      id += 1;
      return handlers.tool_call({ toolName, input, toolCallId: `t${id}` }, ctx);
    };
    const result = (toolName, structuredContent, isError = false) => handlers.tool_result({ type: "tool_result", toolName, toolCallId: `t${id}`, input: {}, content: [], isError, structuredContent }, ctx);
    const runProbe = async () => {
      assert.equal(fire(guard.TRACKER_GUARD_TOOL, {}), undefined);
      return tools[0].execute(`t${id}`, {});
    };
    return { fire, result, entries, tools, runProbe };
  }

  it("names native MCP tools exactly as Atomic does, including server punctuation and over-long names", () => {
    assert.equal(guard.mcpToolName("atlassian", "getJiraIssue"), "mcp__atlassian__getJiraIssue");
    assert.equal(guard.mcpToolName("work-linear", "get_issue"), "mcp__work_linear__get_issue");
    const long = guard.mcpToolName("a-very-long-server-name-for-tests-x", "searchJiraIssuesUsingJql");
    assert.equal(long.length, 64);
    assert.match(long, /^mcp__a_very_long_server_name_for_tests_x__searchJira\w*_[0-9a-f]{8}$/);
    assert.deepEqual(guard.trackerReadTools(jira), ["mcp__atlassian__getAccessibleAtlassianResources", "mcp__atlassian__getJiraIssue", "mcp__atlassian__searchJiraIssuesUsingJql"]);
  });

  it("reads the tracker and server only from the workflow's stage name, and gives unscoped stages no MCP access", () => {
    assert.deepEqual(guard.parseTrackerStage("goal-select-tracker-intake-jira-atlassian"), { stage: guard.TRACKER_INTAKE_STAGE, scope: jira });
    assert.deepEqual(guard.parseTrackerStage("goal-select-tracker-fetch-linear-work-linear"), { stage: guard.TRACKER_FETCH_STAGE, scope: linear });
    assert.deepEqual(guard.parseTrackerStage("goal-select-tracker-intake"), { stage: guard.TRACKER_INTAKE_STAGE });
    assert.deepEqual(guard.parseTrackerStage("goal-select-tracker-intake-github-x"), { stage: guard.TRACKER_INTAKE_STAGE });
    assert.deepEqual(guard.parseTrackerStage(guard.TRACKER_GUARD_CHECK_STAGE), { stage: guard.TRACKER_GUARD_CHECK_STAGE });
    for (const name of ["orchestrator-1", "tracker-intake", undefined]) assert.equal(guard.parseTrackerStage(name), undefined);
    assert.equal(guard.trackerStageName(guard.TRACKER_INTAKE_STAGE, linear), "goal-select-tracker-intake-linear-work-linear");
  });

  it("does nothing outside goal-select's intake stages: no probe tool, no entries, no blocking", () => {
    for (const stage of [undefined, "orchestrator-1", "completion-reviewer-1", "tracker-intake"]) {
      const { fire, result, entries, tools } = session(stage);
      assert.equal(fire("mcp__atlassian__editJiraIssue"), undefined, String(stage));
      assert.equal(fire("bash", { command: "true" }), undefined, String(stage));
      assert.equal(result("mcp__atlassian__getJiraIssue", { content: [] }), undefined);
      assert.deepEqual(tools, [], String(stage));
      assert.deepEqual(entries, [], String(stage));
    }
  });

  it("holds back discovery and reads until the probe runs, then allows only tool_search and the selected server's three reads", async () => {
    for (const [stage, scope] of [["goal-select-tracker-intake-jira-atlassian", jira], ["goal-select-tracker-fetch-linear-work-linear", linear]]) {
      const { fire, entries, tools, runProbe } = session(stage);
      assert.deepEqual(tools.map((tool) => tool.name), [guard.TRACKER_GUARD_TOOL]);
      assert.deepEqual(entries, [{ type: guard.TRACKER_GUARD_ENTRY, data: { event: "loaded", stage: guard.parseTrackerStage(stage).stage, ...scope } }]);
      for (const early of [guard.TOOL_SEARCH_TOOL, ...guard.trackerReadTools(scope)]) {
        const outcome = fire(early);
        assert.equal(outcome?.block, true, early);
        assert.match(outcome.reason, /goal_select_tracker_guard must run before any other call/);
      }
      const probe = await runProbe();
      assert.deepEqual(probe.details, { guard: "active", stage: guard.parseTrackerStage(stage).stage, ...scope, read_tools: guard.trackerReadTools(scope) });
      for (const allowed of [guard.TOOL_SEARCH_TOOL, ...guard.trackerReadTools(scope), "structured_output"]) assert.equal(fire(allowed), undefined, `${stage} ${allowed}`);
    }
  });

  it("blocks writes, unlisted reads, other servers' reads, the removed gateway, codemode and shell escapes after the probe", async () => {
    const { fire, entries, runProbe } = session("goal-select-tracker-intake-jira-atlassian");
    await runProbe();
    const blocked = [
      ...writeTools,
      "mcp__atlassian__getJiraIssue_extra",
      "mcp__atlassian__getConfluencePage",
      "mcp__atlassian__getTransitionsForJiraIssue",
      "mcp__linear__get_issue",
      "mcp__work_linear__get_issue",
      "mcp__atlassian2__getJiraIssue",
      "getJiraIssue",
      "atlassian_getJiraIssue",
      "mcp",
      "codemode",
      "read_mcp_resource",
      "bash",
      "write",
      "subagent",
    ];
    for (const toolName of blocked) {
      const outcome = fire(toolName, { command: "curl -X POST https://example.atlassian.net" });
      assert.equal(outcome?.block, true, toolName);
      assert.match(outcome.reason, /^goal-select tracker intake is read-only: tool ".*" is not an allow-listed jira read tool of MCP server "atlassian"\.$/);
    }
    const decisions = entries.filter((entry) => entry.data.event === "decision").slice(1);
    assert.equal(decisions.length, blocked.length);
    assert.ok(decisions.every((entry) => entry.data.allowed === false && entry.data.reason));
  });

  it("lets the guard check stage run its probe and nothing else", async () => {
    const { fire, runProbe } = session(guard.TRACKER_GUARD_CHECK_STAGE);
    const probe = await runProbe();
    assert.deepEqual(probe.details, { guard: "active", stage: guard.TRACKER_GUARD_CHECK_STAGE, read_tools: [] });
    for (const toolName of [guard.TOOL_SEARCH_TOOL, "mcp__atlassian__getJiraIssue"]) assert.equal(fire(toolName)?.block, true, toolName);
  });

  it("records the complete native result of each allowed read, and nothing for other tools or failed calls", async () => {
    const { fire, result, entries, runProbe } = session("goal-select-tracker-intake-jira-atlassian");
    await runProbe();
    const full = { content: [{ type: "text", text: "x".repeat(30_000) }], structuredContent: { key: "PROJ-7" } };
    fire("mcp__atlassian__getJiraIssue");
    result("mcp__atlassian__getJiraIssue", full);
    fire(guard.TOOL_SEARCH_TOOL);
    result(guard.TOOL_SEARCH_TOOL, { loaded: [] });
    fire("mcp__atlassian__getJiraIssue");
    result("mcp__atlassian__getJiraIssue", { content: [], isError: true }, true);
    const recorded = entries.filter((entry) => entry.data.event === "result");
    assert.equal(recorded.length, 1);
    assert.deepEqual(recorded[0].data, { event: "result", toolCallId: "t2", toolName: "mcp__atlassian__getJiraIssue", result: full });
  });
});
