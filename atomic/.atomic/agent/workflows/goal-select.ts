import { homedir } from "node:os";
import { workflow } from "@bastani/atomic/workflows";
import { Type } from "typebox";
import { withSteeringPropagationContext } from "/Users/sidwood/.local/share/atomic/node_modules/@bastani/atomic/dist/builtin/workflows/builtin/steering-context.js";
import { markGoalSelectRun } from "../extensions/goal-select-mcp-discovery.ts";
import { TRACKER_FETCH_STAGE, TRACKER_GUARD_CHECK_STAGE, TRACKER_INTAKE_STAGE } from "../extensions/goal-select-tracker-guard.ts";
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
import { DEFAULT_REVIEW_TIER, defaultPolicyPath, launchDefaults, modelPolicyPaths, readModelPolicyFile } from "./goal-select/model-policy.js";
import {
  STOP_CHOICE,
  auditGuardCheck,
  auditTrackerStage,
  describeTrackerConfig,
  guardCheckOutcome,
  guardCheckStageOptions,
  issueChoice,
  namesIssue,
  trackerIntake,
  trackerPreflight,
  trackerPrompt,
  trackerSnapshot,
  trackerSnapshotPath,
  trackerStage,
  trackerStageOptions,
  trackerStageOutcome,
  writeTrackerSnapshot,
} from "./goal-select/tracker-intake.js";

const prefill = launchDefaults();

function cleanModel(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function withFallback<T extends object>(args: T, key: string, fallback: string | undefined): T {
  return fallback === undefined ? args : { ...args, [key]: fallback };
}

function prefilled(value: string | undefined): { default?: string } {
  return value === undefined ? {} : { default: value };
}

function withGoalInputs<T extends { inputs: object }>(ctx: T, inputs: { objective: string; acceptance_criteria: string }): T {
  const wrapped = Object.create(ctx);
  Object.defineProperty(wrapped, "inputs", { value: { ...ctx.inputs, ...inputs } });
  return wrapped;
}

type TrackerIntake = NonNullable<ReturnType<typeof trackerIntake>>;
type TrackerIssue = { key: string; title: string };

async function runTrackerStage(ctx: any, name: string, intake: TrackerIntake, request: string, stage: Promise<any>) {
  const result = await stage;
  const audit = await ctx.tool(
    `audit-${name}`,
    { session_file: result.sessionFile ?? null, tracker: intake.tracker, server: intake.server },
    async () => auditTrackerStage(result.sessionFile, intake),
    { timeoutMs: 30_000 },
  );
  return trackerStageOutcome({ ...result, name }, audit, intake, request);
}

async function intakeTrackerIssue(ctx: any, intake: TrackerIntake) {
  const guardCheck = await ctx.task(TRACKER_GUARD_CHECK_STAGE, guardCheckStageOptions(intake));
  const guardAudit = await ctx.tool(
    `audit-${TRACKER_GUARD_CHECK_STAGE}`,
    { session_file: guardCheck.sessionFile ?? null },
    async () => auditGuardCheck(guardCheck.sessionFile),
    { timeoutMs: 30_000 },
  );
  guardCheckOutcome(guardAudit, intake);
  const request = intake.request || (await ctx.ui.input(`${intake.label} issue key, URL or search words`)).trim();
  if (!request) throw new Error(`No ${intake.label} issue was given, so tracker intake stopped. No checkout or snapshot was created and no Goal stage ran.`);
  const intakeStage = trackerStage(intake, TRACKER_INTAKE_STAGE);
  const found = await runTrackerStage(
    ctx,
    intakeStage,
    intake,
    request,
    ctx.task(intakeStage, trackerStageOptions(intake, trackerPrompt(intake, { mode: "lookup", request }))),
  );
  if (found.kind === "fetched" && namesIssue(request, found.issue)) return found.issue;
  const choices: TrackerIssue[] = found.kind === "fetched" ? [found.issue] : found.candidates;
  const options = choices.map(issueChoice);
  const answer = await ctx.ui.select(`Choose the ${intake.label} issue for this run (request: ${request})`, [...options, STOP_CHOICE]);
  const chosen = choices[options.indexOf(answer)];
  if (!chosen) throw new Error(`No ${intake.label} issue was chosen for "${request}", so tracker intake stopped. No checkout or snapshot was created and no Goal stage ran.`);
  if (found.kind === "fetched") return found.issue;
  const fetchStage = trackerStage(intake, TRACKER_FETCH_STAGE);
  const fetched = await runTrackerStage(
    ctx,
    fetchStage,
    intake,
    chosen.key,
    ctx.task(fetchStage, trackerStageOptions(intake, trackerPrompt(intake, { mode: "fetch", request: chosen.key }))),
  );
  if (fetched.kind !== "fetched" || fetched.issue.key.toLowerCase() !== chosen.key.toLowerCase()) {
    throw new Error(`The ${intake.label} fetch for the chosen issue ${chosen.key} returned ${fetched.kind === "fetched" ? fetched.issue.key : "no issue"}. No checkout or snapshot was created and no Goal stage ran.`);
  }
  return fetched.issue;
}

export default workflow({
  name: "goal-select",
  description:
    "Builtin Goal Runner with three dials: the writer model, the orchestrator model, and a review tier (simple: one reviewer; standard: completion-and-evidence plus risk; complex: the three-role panel). The tier sets the reviewer models, the quorum and the round cap; the cap hands the work over with its open findings rather than stopping. Work comes typed in as objective and acceptance criteria, or from one tracker issue.",
  heartbeatIntervalMinutes: 15,
  inputs: {
    objective: Type.Optional(
      Type.String({
        description:
          "The objective or delta for this Goal Runner workflow run. Required when tracker is none; the run fails before any checkout or stage without it. With a tracker, the issue is the objective and any text here is added to it verbatim. Do not include PR/MR submission instructions here; strip them from the task text and request them via create_pr=true instead.",
      }),
    ),
    acceptance_criteria: Type.Optional(
      Type.String({
        description:
          "Original immutable task contract this run must remain consistent with. Defaults to objective, or with a tracker to the issue's own acceptance criteria. Text here replaces them. Orchestrators launching follow-up runs from reviewer findings should pass the ORIGINAL task text here.",
      }),
    ),
    tracker: Type.Union([Type.Literal("none"), Type.Literal("jira"), Type.Literal("linear")], {
      default: "none",
      description:
        "Where the work comes from. none (default) uses objective and acceptance_criteria as typed. jira or linear fetches one issue read-only through the tracker's MCP server, with the goal-select-tracker-guard extension blocking every call but allow-listed reads, and saves it to <checkout>/.atomic/goal-select/work/ before any Goal stage; the Goal objective and acceptance criteria then come from that snapshot. An unavailable tracker, a missing issue or a stopped choice ends the run without falling back to typed text.",
    }),
    tracker_issue: Type.Optional(
      Type.String({
        description:
          "Issue for tracker intake: a key or identifier such as PROJ-123, an issue URL, or search words. A key or URL is fetched directly, which suits headless runs. Search words, or a fetched issue the text does not name, open a choice of matches. Empty asks for it when the run starts. Ignored when tracker is none.",
      }),
    ),
    tracker_mcp_server: Type.Optional(
      Type.String({
        description:
          "MCP server name for tracker intake. Defaults to atlassian for jira and linear for linear. A server disabled in an MCP config file stops the run; one the config files do not list may still come from a package or extension, so the live connection check decides.",
      }),
    ),
    max_turns: Type.Optional(
      Type.Number({
        description:
          "Cap on orchestrator/review rounds. Leave empty for the review tier's cap (3 unless the policy says otherwise). At the cap the run hands over with its open findings listed; one extra round is granted when the last round left a P0 or P1 open.",
      }),
    ),
    base_branch: Type.String({
      default: "origin/main",
      description: "Optional branch reviewers compare the current code delta against (default origin/main).",
    }),
    branch_checkout_dir: Type.String({
      default: "auto",
      description:
        "Checkout every stage and delegated agent works in. 'auto' (default) runs git bc-add --offline to clone the invoking checkout's committed HEAD into a new sibling named from the objective, or from the issue key with a tracker, such as <seed>.goal-fix-login-1a2b3c4d on branch goal-fix-login-1a2b3c4d; it never switches the seed or reuses an unrelated path, and a failed clone stops the run before any Goal stage, with only a tracker's read-only intake stage able to run before it. Empty selects the invoking checkout. Any other value names an existing checkout or branch clone: a relative path resolves from the parent of the invoking directory, so a sibling clone's name selects it and '.' names that parent; a missing or non-Git path fails before any model stage and nothing is created.",
    }),
    create_pr: Type.Boolean({
      default: false,
      description:
        "Whether to run the final pull-request creation stage after reviewer/reducer approval. Defaults to false; prompt text alone does not opt in.",
    }),
    review_tier: Type.Union([Type.Literal("simple"), Type.Literal("standard"), Type.Literal("complex")], {
      default: prefill.review_tier ?? DEFAULT_REVIEW_TIER,
      description:
        "How the work is reviewed. simple: one reviewer owning contract, evidence and risk (quorum 1). standard: a completion-and-evidence reviewer plus a risk reviewer (both must approve). complex: completion, evidence and risk reviewers (two of three). Each tier's models, quorum and round cap come from the shared policy's review_tiers; a policy file's own top-level reviewer keys override them.",
    }),
    orchestrator_model: Type.String({
      default: prefill.orchestrator_model ?? "openai-codex/gpt-6.1-sol:medium",
      description:
        "Orchestrator model, with an optional :thinking suffix. Prefilled from the shared policy's orchestrator_model; otherwise openai-codex/gpt-6.1-sol:medium. A policy-file orchestrator_model replaces this before the turn.",
    }),
    reviewer_model: Type.Optional(
      Type.String({
        description:
          "Override for every reviewer role of the chosen tier. Leave empty to use the tier's models. A policy file's top-level reviewer keys still win over this.",
      }),
    ),
    completion_reviewer_model: Type.Optional(
      Type.String({
        ...prefilled(prefill.completion_reviewer_model),
        description: "Completion reviewer model. Overrides reviewer_model for that role. Prefilled from the shared policy's completion_reviewer_model when it has one.",
      }),
    ),
    evidence_reviewer_model: Type.Optional(
      Type.String({
        ...prefilled(prefill.evidence_reviewer_model),
        description: "Evidence reviewer model. Overrides reviewer_model for that role. Prefilled from the shared policy's evidence_reviewer_model when it has one.",
      }),
    ),
    risk_reviewer_model: Type.Optional(
      Type.String({
        ...prefilled(prefill.risk_reviewer_model),
        description: "Risk reviewer model. Overrides reviewer_model for that role. Prefilled from the shared policy's risk_reviewer_model when it has one.",
      }),
    ),
    writer_model: Type.Optional(
      Type.String({
        ...prefilled(prefill.writer_model),
        description:
          "Model the orchestrator must pass when it delegates implementation. Empty leaves the builtin worker pin unchanged. Prefilled from the shared policy's writer_model when it has one.",
      }),
    ),
    model_policy_path: Type.Optional(
      Type.String({
        default: defaultPolicyPath(),
        description:
          "JSONC file read before every turn: JSON plus // and /* */ comments and trailing commas. Its defaults block seeds the launch form, its review_tiers block defines the tiers, and any top-level model key or max_turns in it overrides every run that reads it. The default is the shared ~/.config/atomic/goal-select.jsonc. A relative path is read inside the checkout, so a project may keep its own file; a file without review_tiers or defaults inherits the shared ones.",
      }),
    ),
    resolve_only: Type.Boolean({
      default: false,
      description: "Resolve turn-1 models and stop. Does not run Goal. policy_source names the policy file turn 1 reads, or null when there is none. In auto mode it previews the planned clone path, branch and policy source without creating the clone. With a tracker it checks only the MCP config files and the guard extension; no intake stage runs and no issue is fetched.",
    }),
  },
  outputs: {
    result: Type.Optional(Type.String()),
    status: Type.Optional(
      Type.Union([
        Type.Literal("complete"),
        Type.Literal("handover"),
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
    markGoalSelectRun(ctx.runId);
    const intake = trackerIntake(ctx.inputs, invocationCwd);
    if (!intake && !ctx.inputs.objective?.trim()) throw new Error("goal requires an objective input.");
    const trackerConfig = intake
      ? await ctx.tool(
          "check-tracker-mcp",
          { tracker: intake.tracker, server: intake.server, cwd: invocationCwd },
          async () => trackerPreflight(intake, process.env, homedir()),
          { timeoutMs: 10_000 },
        )
      : undefined;
    const trackerPreview = intake && trackerConfig && {
      tracker: intake.tracker,
      server: intake.server,
      config_source: trackerConfig.config_source,
      guard: trackerConfig.guard,
      issue_request: intake.request || null,
      intake_ran: false,
    };
    const trackerPreviewLine = intake && trackerConfig
      ? `- Tracker intake (not run in preview): ${intake.label} issue ${intake.request ? `"${intake.request}"` : "asked for at launch"}; ${describeTrackerConfig(intake, trackerConfig)}. A real run checks the connection, fetches the issue read-only under ${trackerConfig.guard} and saves it in the checkout's .atomic/goal-select/work/ before any Goal stage.`
      : undefined;
    let issue: any;
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
      reviewTier: ctx.inputs.review_tier,
      maxTurns: typeof ctx.inputs.max_turns === "number" && ctx.inputs.max_turns >= 1 ? Math.floor(ctx.inputs.max_turns) : undefined,
    });
    let checkoutDir: string;
    if (isAutoCheckout(ctx.inputs.branch_checkout_dir)) {
      if (intake && !ctx.inputs.resolve_only) issue = await intakeTrackerIssue(ctx, intake);
      const slug = objectiveSlug(issue?.key ?? (intake ? intake.request || intake.tracker : ctx.inputs.objective));
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
            ...(trackerPreviewLine ? [trackerPreviewLine, "- The planned clone name is provisional: a real run names the clone from the fetched issue key."] : []),
          ].join("\n"),
          models: JSON.stringify({
            checkout: null,
            planned_checkout: { path: plan.target, branch: plan.branch, seed: plan.seed, seed_head: plan.seed_head, created: false },
            launch: selection,
            policy: preview.policy,
            policy_source: preview.source,
            ...(trackerPreview ? { tracker: trackerPreview } : {}),
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
        result: ["Resolved models for turn 1. No Goal stage ran.", ...(trackerPreviewLine ? [trackerPreviewLine] : [])].join("\n"),
        models: JSON.stringify({
          checkout: checkoutDir,
          launch: selection,
          policy: resolved.policy,
          policy_source: resolved.source,
          ...(trackerPreview ? { tracker: trackerPreview } : {}),
        }),
      };
    }
    if (intake && !issue) issue = await intakeTrackerIssue(ctx, intake);
    const workflowCtx = withSteeringPropagationContext(ctx);
    const goalInputs = intake && trackerConfig && issue
      ? await ctx.tool(
          "write-tracker-snapshot",
          { checkout: checkoutDir, tracker: intake.tracker, server: intake.server, issue: issue.key, run_id: ctx.runId ?? "" },
          async () => {
            const runId = ctx.runId ?? "";
            const path = trackerSnapshotPath(checkoutDir, intake.tracker, issue.key, runId);
            const snapshot = trackerSnapshot({
              intake,
              preflight: trackerConfig,
              issue,
              path,
              runId,
              savedAt: new Date().toISOString(),
              objective: ctx.inputs.objective,
              acceptanceCriteria: ctx.inputs.acceptance_criteria,
            });
            writeTrackerSnapshot(path, snapshot.markdown);
            return { path, objective: snapshot.objective, acceptance_criteria: snapshot.acceptance_criteria };
          },
          { timeoutMs: 10_000 },
        )
      : undefined;
    return await runGoalWorkflow(goalInputs ? withGoalInputs(workflowCtx, goalInputs) : workflowCtx, {
      createPr: workflowCtx.inputs.create_pr === true,
      workflowStartCwd: checkoutDir,
      modelSelection: selection,
    });
  },
});
