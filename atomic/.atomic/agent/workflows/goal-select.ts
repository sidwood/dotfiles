import { workflow } from "@bastani/atomic/workflows";
import { Type } from "typebox";
import { withSteeringPropagationContext } from "/Users/sidwood/.local/share/atomic/node_modules/@bastani/atomic/dist/builtin/workflows/builtin/steering-context.js";
import { resolveBranchCheckout, resolvePolicyPath } from "./goal-select/branch-checkout.js";
import {
  CLONE_TIMEOUT_MS,
  createBranchClone,
  isAutoCheckout,
  objectiveSlug,
  planBranchClone,
  previewBranchClonePolicy,
} from "./goal-select/branch-clone.js";
import { runGoalWorkflow } from "./goal-select/goal-engine.js";
import { modelPolicyPaths, readModelPolicyFile } from "./goal-select/model-policy.js";

function cleanModel(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function withFallback<T extends object>(args: T, key: string, fallback: string | undefined): T {
  return fallback === undefined ? args : { ...args, [key]: fallback };
}

export default workflow({
  name: "goal-select",
  description:
    "Builtin Goal Runner, including its ledger, three reviewer roles, quorum of 2, and reducer, with a model choice for the orchestrator, each reviewer, and the implementation agent. By default every stage works in a new objective-named git bc-add branch clone beside the invoking checkout. A JSONC policy file, by default .atomic/goal-select-models.json or else .atomic/goal-select-models.jsonc, is read before every turn for models and max_turns. A stage that has already started keeps its model.",
  heartbeatIntervalMinutes: 15,
  inputs: {
    objective: Type.String({
      description:
        "The objective or delta for this Goal Runner workflow run. Do not include PR/MR submission instructions here; strip them from the task text and request them via create_pr=true instead.",
    }),
    acceptance_criteria: Type.Optional(
      Type.String({
        description:
          "Original immutable task contract this run must remain consistent with. Defaults to objective. Orchestrators launching follow-up runs from reviewer findings should pass the ORIGINAL task text here.",
      }),
    ),
    max_turns: Type.Number({
      default: 10,
      description: "Launch cap on orchestrator/review turns before Goal Runner stops as needs_human. A positive max_turns in the policy file replaces this before each later turn.",
    }),
    base_branch: Type.String({
      default: "origin/main",
      description: "Optional branch reviewers compare the current code delta against (default origin/main).",
    }),
    branch_checkout_dir: Type.String({
      default: "auto",
      description:
        "Checkout every stage and delegated agent works in. 'auto' (default) runs git bc-add --offline to clone the invoking checkout's committed HEAD into a new sibling named from the objective, such as <seed>.goal-fix-login-1a2b3c4d on branch goal-fix-login-1a2b3c4d; it never switches the seed or reuses an unrelated path, and a failed clone stops the run before any model stage. Empty selects the invoking checkout. Any other value names an existing checkout or branch clone: a relative path resolves from the parent of the invoking directory, so a sibling clone's name selects it and '.' names that parent; a missing or non-Git path fails before any model stage and nothing is created.",
    }),
    create_pr: Type.Boolean({
      default: false,
      description:
        "Whether to run the final pull-request creation stage after reviewer/reducer approval. Defaults to false; prompt text alone does not opt in.",
    }),
    orchestrator_model: Type.String({
      default: "openai-codex/gpt-6-astra:medium",
      description:
        "Orchestrator model, with an optional :thinking suffix. Default matches builtin Goal: openai-codex/gpt-6-astra:medium. A policy-file orchestrator_model replaces this before the turn.",
    }),
    reviewer_model: Type.String({
      default: "openai-codex/gpt-6-astra:high",
      description:
        "Model for any reviewer role that does not have its own model. Default matches builtin Goal: openai-codex/gpt-6-astra:high. A policy-file reviewer_model replaces this before the turn.",
    }),
    completion_reviewer_model: Type.Optional(
      Type.String({
        description: "Completion reviewer model. Overrides reviewer_model for that role.",
      }),
    ),
    evidence_reviewer_model: Type.Optional(
      Type.String({
        description: "Evidence reviewer model. Overrides reviewer_model for that role.",
      }),
    ),
    risk_reviewer_model: Type.Optional(
      Type.String({
        description: "Risk reviewer model. Overrides reviewer_model for that role.",
      }),
    ),
    writer_model: Type.Optional(
      Type.String({
        description:
          "Model the orchestrator must pass when it delegates implementation. Empty leaves the builtin worker pin unchanged.",
      }),
    ),
    model_policy_path: Type.Optional(
      Type.String({
        description:
          "JSONC file read before every turn: JSON plus // and /* */ comments and trailing commas, so alternative models can stay in it commented out. Omitted selects the default policy, chosen again before every read: .atomic/goal-select-models.json when it exists, and .atomic/goal-select-models.jsonc only when .json is absent. A malformed .json is not skipped for the .jsonc; that turn uses the launch inputs. Any supplied path, including an empty or whitespace string and .atomic/goal-select-models.json, is read exactly as given, with no .jsonc fallback. A relative path resolves from the selected checkout; in auto mode a relative file the new clone lacks is copied from the seed once, when the clone is created, and for the default policy only the one file the clone will read is copied. Model keys: orchestrator_model, reviewer_model, completion_reviewer_model, evidence_reviewer_model, risk_reviewer_model, writer_model. A present model key replaces the launch input for that turn. A positive max_turns replaces the turn cap before the next turn starts; omit it to keep the current cap.",
      }),
    ),
    resolve_only: Type.Boolean({
      default: false,
      description: "Resolve turn-1 models and stop. Does not run Goal. policy_source names the policy file turn 1 reads, or null when there is none. In auto mode it previews the planned clone path, branch and policy source without creating the clone.",
    }),
  },
  outputs: {
    result: Type.Optional(Type.String()),
    status: Type.Optional(
      Type.Union([
        Type.Literal("complete"),
        Type.Literal("blocked"),
        Type.Literal("needs_human"),
        Type.Literal("active"),
      ]),
    ),
    approved: Type.Optional(Type.Boolean()),
    goal_id: Type.Optional(Type.String()),
    objective: Type.Optional(Type.String()),
    acceptance_criteria: Type.Optional(Type.String()),
    ledger_path: Type.Optional(Type.String()),
    turns_completed: Type.Optional(Type.Number()),
    iterations_completed: Type.Optional(Type.Number()),
    receipts: Type.Optional(
      Type.Array(
        Type.Object({
          turn: Type.Number(),
          stage: Type.String(),
          artifact_path: Type.String(),
          summary: Type.String(),
        }),
      ),
    ),
    remaining_work: Type.Optional(Type.String()),
    review_report: Type.Optional(Type.String()),
    review_report_path: Type.Optional(Type.String()),
    pr_report: Type.Optional(Type.String()),
    models: Type.Optional(Type.String()),
  },
  run: async (ctx) => {
    const invocationCwd = ctx.cwd ?? process.cwd();
    const [policyPath, policyFallbackPath] = modelPolicyPaths(ctx.inputs.model_policy_path);
    const launchSelection = (checkoutDir: string) => ({
      policyPath: resolvePolicyPath(policyPath, checkoutDir),
      policyFallbackPath: policyFallbackPath && resolvePolicyPath(policyFallbackPath, checkoutDir),
      orchestrator: cleanModel(ctx.inputs.orchestrator_model),
      reviewer: cleanModel(ctx.inputs.reviewer_model),
      completionReviewer: cleanModel(ctx.inputs.completion_reviewer_model),
      evidenceReviewer: cleanModel(ctx.inputs.evidence_reviewer_model),
      riskReviewer: cleanModel(ctx.inputs.risk_reviewer_model),
      writer: cleanModel(ctx.inputs.writer_model),
    });
    let checkoutDir: string;
    if (isAutoCheckout(ctx.inputs.branch_checkout_dir)) {
      const slug = objectiveSlug(ctx.inputs.objective);
      const runId = ctx.runId ?? "";
      const plan = await ctx.tool(
        "plan-branch-clone",
        { invocation_cwd: invocationCwd, slug, run_id: runId },
        async ({ signal }) => planBranchClone({ invocationCwd, slug, runId, signal }),
        { timeoutMs: 30_000 },
      );
      if (ctx.inputs.resolve_only) {
        const selection = launchSelection(plan.target);
        const preview = await ctx.tool(
          "resolve-models-1",
          { ...withFallback({ path: selection.policyPath }, "fallback_path", selection.policyFallbackPath), turn: 1, preview: true },
          async ({ signal }) => previewBranchClonePolicy(plan, policyPath, signal, policyFallbackPath),
          { timeoutMs: 10_000 },
        );
        return {
          status: "complete" as const,
          result: [
            "- Preview only: no branch clone was created and no Goal stage ran.",
            `- Planned clone: ${plan.target}`,
            `- Planned branch: ${plan.branch}, from committed HEAD ${plan.seed_head.slice(0, 12)} of ${plan.seed}; uncommitted seed changes are not copied.`,
            `- Turn-1 model policy: ${preview.source ?? "no policy file found; launch inputs apply"}`,
          ].join("\n"),
          models: JSON.stringify({
            checkout: null,
            planned_checkout: { path: plan.target, branch: plan.branch, seed: plan.seed, seed_head: plan.seed_head, created: false },
            launch: selection,
            policy: preview.policy,
            policy_source: preview.source,
          }),
        };
      }
      const clone = await ctx.tool(
        "create-branch-clone",
        withFallback({ ...plan, policy_path: policyPath }, "policy_fallback_path", policyFallbackPath),
        async ({ signal }) => createBranchClone(plan, { policyPath, policyFallbackPath, signal }),
        { timeoutMs: CLONE_TIMEOUT_MS + 30_000 },
      );
      checkoutDir = clone.checkout;
    } else {
      checkoutDir = await ctx.tool(
        "resolve-branch-checkout",
        { branch_checkout_dir: ctx.inputs.branch_checkout_dir, invocation_cwd: invocationCwd },
        async ({ signal }) => resolveBranchCheckout(ctx.inputs.branch_checkout_dir, invocationCwd, signal),
        { timeoutMs: 15_000 },
      );
    }
    const selection = launchSelection(checkoutDir);
    if (ctx.inputs.resolve_only) {
      const resolved = await ctx.tool(
        "resolve-models-1",
        { ...withFallback({ path: selection.policyPath }, "fallback_path", selection.policyFallbackPath), turn: 1 },
        async () => readModelPolicyFile(selection.policyPath, selection.policyFallbackPath),
        { timeoutMs: 10_000 },
      );
      return {
        status: "complete" as const,
        result: "Resolved models for turn 1. No Goal stage ran.",
        models: JSON.stringify({ checkout: checkoutDir, launch: selection, policy: resolved.policy, policy_source: resolved.source }),
      };
    }
    const workflowCtx = withSteeringPropagationContext(ctx);
    return await runGoalWorkflow(workflowCtx, {
      createPr: workflowCtx.inputs.create_pr === true,
      workflowStartCwd: checkoutDir,
      modelSelection: selection,
    });
  },
});
