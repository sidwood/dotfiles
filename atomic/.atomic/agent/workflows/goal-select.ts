import { workflow } from "@bastani/atomic/workflows";
import { Type } from "typebox";
import { withSteeringPropagationContext2 } from "/Users/sidwood/.local/share/atomic/node_modules/@bastani/atomic/dist/builtin/workflows/builtin/chunk-kspvwc24.js";
import { runGoalWorkflow } from "./goal-select/goal-engine.js";

function cleanModel(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export default workflow({
  name: "goal-select",
  description:
    "Builtin Goal Runner, including its ledger, three reviewer roles, quorum of 2, and reducer, with a model choice for the orchestrator, each reviewer, and the implementation agent. A policy file is read before every turn for models and max_turns. A stage that has already started keeps its model.",
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
    git_worktree_dir: Type.String({
      default: "",
      description:
        "Optional Git worktree path. Leave at the default unless the user explicitly requested worktree isolation. Must be outside the invoking checkout.",
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
    model_policy_path: Type.String({
      default: ".atomic/goal-select-models.json",
      description:
        "JSON file read before every turn. Model keys: orchestrator_model, reviewer_model, completion_reviewer_model, evidence_reviewer_model, risk_reviewer_model, writer_model. A present model key replaces the launch input for that turn. A positive max_turns replaces the turn cap before the next turn starts; omit it to keep the current cap.",
    }),
    resolve_only: Type.Boolean({
      default: false,
      description: "Resolve turn-1 models and stop. Does not run Goal.",
    }),
  },
  worktreeFromInputs: {
    gitWorktreeDir: "git_worktree_dir",
    baseBranch: "base_branch",
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
    const selection = {
      policyPath: ctx.inputs.model_policy_path,
      orchestrator: cleanModel(ctx.inputs.orchestrator_model),
      reviewer: cleanModel(ctx.inputs.reviewer_model),
      completionReviewer: cleanModel(ctx.inputs.completion_reviewer_model),
      evidenceReviewer: cleanModel(ctx.inputs.evidence_reviewer_model),
      riskReviewer: cleanModel(ctx.inputs.risk_reviewer_model),
      writer: cleanModel(ctx.inputs.writer_model),
    };
    if (ctx.inputs.resolve_only) {
      const models = await ctx.tool(
        "resolve-models-1",
        { path: selection.policyPath, turn: 1 },
        async () => {
          const { readFileSync } = await import("node:fs");
          try {
            return JSON.parse(readFileSync(selection.policyPath, "utf8"));
          } catch {
            return {};
          }
        },
        { timeoutMs: 10_000 },
      );
      return {
        status: "complete" as const,
        result: "Resolved models for turn 1. No Goal stage ran.",
        models: JSON.stringify({ launch: selection, policy: models }),
      };
    }
    const workflowCtx = withSteeringPropagationContext2(ctx);
    const workflowStartCwd = workflowCtx.cwd ?? process.cwd();
    return await runGoalWorkflow(workflowCtx, {
      createPr: workflowCtx.inputs.create_pr === true,
      workflowStartCwd,
      modelSelection: selection,
    });
  },
});
