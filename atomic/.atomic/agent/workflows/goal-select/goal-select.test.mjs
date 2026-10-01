import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { after, before, describe, it } from "node:test";

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
const { default: goalSelect } = await import(new URL("../goal-select.ts", import.meta.url).href);
const { branchCloneName, createBranchClone, objectiveSlug, planBranchClone } = await import(new URL("./branch-clone.js", import.meta.url).href);
const { parseModelPolicy } = await import(new URL("./model-policy.js", import.meta.url).href);
const { run, workflow } = await import("@bastani/atomic/workflows");
const { Type } = await import("typebox");

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

function launchInputs(overrides) {
  const inputs = { objective: "Prove branch checkout routing." };
  for (const [key, schema] of Object.entries(goalSelect.inputs)) {
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

function fakeContext({ cwd, inputs, onTask = () => ({}), review = () => approve, signal = new AbortController().signal, runId = `goal-select-test-${randomUUID()}` }) {
  const calls = [];
  const ctx = {
    runId,
    cwd,
    inputs: launchInputs(inputs),
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

const originalChdir = process.chdir;
const startCwd = process.cwd();

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

  it("uses the invoking checkout when branch_checkout_dir is blank", async () => {
    for (const blank of ["", "   "]) {
      const models = await resolveOnly(seed, { branch_checkout_dir: blank });
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

  it("accepts a git bc-add branch clone by absolute path containing spaces", async () => {
    const models = await resolveOnly(seed, { branch_checkout_dir: clone });
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
    const { ctx, calls } = fakeContext({
      cwd: seed,
      inputs: { branch_checkout_dir: clone, model_policy_path: ".atomic/jsonc-turns.json" },
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
    for (const role of ["completion", "evidence", "risk"]) assert.equal(byName[`${role}-reviewer-1`].model, jsoncPolicy.reviewer_model, role);
    assert.equal(byName["orchestrator-2"].model, goalSelect.inputs.orchestrator_model.default);
    for (const role of ["completion", "evidence", "risk"]) assert.equal(byName[`${role}-reviewer-2`].model, goalSelect.inputs.reviewer_model.default, role);
    const turnPolicy = (turn) => calls.find((call) => call.name === `resolve-models-${turn}`).result;
    assert.equal(turnPolicy(1).maxTurns, 3);
    assert.deepEqual(turnPolicy(2), {});
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

    await run(goalSelect, { objective: "probe", branch_checkout_dir: "seed feature" }, { durability: { mode: "memory" }, cwd: seed, adapters });
    assert.deepEqual(seen, [["orchestrator-1", clone, "test/clone-orchestrator"]]);
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
    assert.equal(byName["orchestrator-1"].model, "test/committed-orchestrator");
    assert.equal(byName["completion-reviewer-1"].model, "test/committed-reviewer");
    assert.equal(toolArgs(calls, "resolve-models-1").path, join(target, ".atomic", "goal-select-models.json"));
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
      assert.equal(models.launch.policyPath, join(target, ".atomic", "goal-select-models.json"));
      assert.deepEqual(models.policy, committedPolicy);
      assert.equal(models.policy_source, `.atomic/goal-select-models.json at seed commit ${seedHead.slice(0, 12)} (the clone gets this committed file)`);
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
    const launch = { orchestrator: goalSelect.inputs.orchestrator_model.default, reviewer: goalSelect.inputs.reviewer_model.default };
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

      const actual = await autoRun({ cwd: jsoncSeed, inputs: { model_policy_path: path } });
      assert.equal(created(actual.calls).policy_copied_from, copied, path);
      assert.equal(readFileSync(join(actual.target, path), "utf8"), readFileSync(join(jsoncSeed, path), "utf8"), `${path} reaches the clone verbatim`);
      const byName = Object.fromEntries(modelStages(actual.calls).map((stage) => [stage.name, stage.options]));
      assert.equal(byName["orchestrator-1"].model, models.orchestrator, `${path} preview matches the run`);
      assert.equal(byName["completion-reviewer-1"].model, models.reviewer, path);
    }
    assert.deepEqual(seedState(jsoncSeed), jsoncSeedBefore);
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

    await run(goalSelect, { objective }, options(runId));
    assert.deepEqual(seen, [["orchestrator-1", target, "test/committed-orchestrator"]]);
    assert.equal(git("-C", target, "branch", "--show-current"), `goal-${slug}-${idFor(runId)}`);
    assert.equal(git("-C", target, "config", "--local", "goal-select.completed-run"), runId);
    assert.equal(git("-C", target, "config", "bc.source"), autoSeed);
    const siblingsAfterFirst = siblings();

    await run(goalSelect, { objective }, options(runId));
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
