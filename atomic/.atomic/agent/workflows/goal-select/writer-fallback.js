import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { modelLine } from "./model-policy.js";

// The model lines that judge the writer this turn, each with why: the
// panel's roles, and the re-verifier, which can demote a reviewer's finding.
export function judgeLines(turnModels) {
  const lines = new Map();
  for (const role of turnModels.roles ?? []) {
    const model = turnModels[role]?.model;
    const line = modelLine(model);
    if (line !== undefined && !lines.has(line)) lines.set(line, `on the review panel as ${role} (${model})`);
  }
  const reverify = modelLine(turnModels.reverify);
  if (reverify !== undefined && !lines.has(reverify)) lines.set(reverify, `re-verifies findings (${turnModels.reverify})`);
  return lines;
}

// The lines a writer may not fall back onto, each with why: those that judge
// it, and the launching session's model when the policy names no
// reverify_model, because re-verification then runs on it. That line bars a
// fallback but does not close a run as a judging line does: a launch writer
// on the session's model has the same exposure, which naming a
// reverify_model settles for both.
export function fallbackBars(turnModels) {
  const lines = judgeLines(turnModels);
  const session = turnModels.reverify === undefined ? modelLine(turnModels.sessionModel) : undefined;
  if (session !== undefined && !lines.has(session)) lines.set(session, `re-verifies findings as the launching session's model, no reverify_model being set (${turnModels.sessionModel})`);
  return lines;
}

// The writer's fallbacks for this turn, in policy order, with the ones a
// reviewer's line rules out set aside: which tier is chosen decides whether
// a fallback may write.
export function writerFallbackChain(turnModels) {
  const judges = fallbackBars(turnModels);
  const declared = turnModels.writerFallbacks ?? [];
  const allowed = [];
  const refused = [];
  for (const model of declared) {
    const reason = judges.get(modelLine(model));
    if (reason === undefined) allowed.push(model);
    else refused.push({ model, reason });
  }
  return { declared, allowed, refused };
}

// The models that may write this turn, the launch writer first.
export function writerCandidates(turnModels) {
  return turnModels.writer === undefined ? [] : [turnModels.writer, ...writerFallbackChain(turnModels).allowed];
}

// Where one move leaves the writer: a fallback holds for the rest of the
// run; a stop the run was resumed from starts again from the launch writer.
export function writerAfterMove(move, candidates) {
  return move.kind === "fallback" && candidates.includes(move.to) ? move.to : candidates[0];
}

export function writerAfter(moves, candidates) {
  return moves.reduce((_writer, move) => writerAfterMove(move, candidates), candidates[0]);
}

// Atomic appends the launching session's model to the fallbacks of every
// agent a stage delegates to, and moves the agent there when its own model
// fails. A stage's isFallbackModelAllowed predicate is inherited by those
// agents and a candidate it rejects is skipped, not run. This one rejects
// the orchestrator's own model and every line a writer may not fall back
// onto; the workflow moves the writer itself, along the policy's chain.
export function delegatedFallbackGate(turnModels) {
  const refused = new Set(fallbackBars(turnModels).keys());
  const orchestrator = modelLine(turnModels.orchestrator?.model);
  if (orchestrator !== undefined) refused.add(orchestrator);
  return (model) => !refused.has(typeof model === "string" ? modelLine(model) : `${model?.provider}/${model?.id}`);
}

// A stop of the workflow's own that a later resume continues. Atomic keeps
// a failed exit marked resumable in its resume catalog whatever the reason
// says; a thrown error it classifies by its text, and kills the run when
// that text looks like a rejected credential.
export function stopResumable(ctx, reason) {
  if (typeof ctx.exit === "function") return ctx.exit({ status: "failed", resumable: true, reason });
  throw new Error(reason);
}

// A file's entries, or nothing when the file cannot be read or holds a line
// that is not JSON: a transcript read only in part is not evidence. A line
// that is JSON but no entry (null, a number, a string) is passed over.
function jsonLines(file) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return undefined;
  }
  const entries = [];
  for (const line of text.split("\n")) {
    if (line.trim() === "") continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      return undefined;
    }
    if (entry !== null && typeof entry === "object") entries.push(entry);
  }
  return entries;
}

function cleanModel(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function sawModel(task, model, thinking) {
  if (cleanModel(model) === undefined) return;
  task.resolved = model.trim();
  task.thinking = typeof thinking === "string" ? thinking : undefined;
}

// What a launch asked of one of its tasks: `count` repeats a parallel task.
function requestOf(args, index) {
  if (!Array.isArray(args.tasks)) return args;
  const expanded = args.tasks.flatMap((task) => Array.from({ length: Number.isInteger(task?.count) && task.count > 1 ? task.count : 1 }, () => task));
  return expanded[index] ?? {};
}

// The files a tool call writes. Atomic's two file-writing tools name
// theirs: `write` in its path, `edit` at the head of each section of its
// input. Nothing is read from the text of a shell command: a command that
// mentions a commit need not make one, and making one is not writing what
// it holds. So writing done only through the shell (a redirect, sed -i, a
// formatter, git apply) is not seen.
const EDIT_SECTION = /^\[(.+)#[0-9A-Fa-f]{4}\]\s*$/gmu;
function writtenBy(call) {
  if (call?.name === "write") return typeof call.arguments?.path === "string" ? [call.arguments.path] : [];
  if (call?.name === "edit") return typeof call.arguments?.input === "string" ? [...call.arguments.input.matchAll(EDIT_SECTION)].map((match) => match[1]) : [];
  return undefined;
}

function realPath(path) {
  try {
    return realpathSync(path);
  } catch {
    return undefined;
  }
}

// The paths, relative to a checkout, that Git ignores there. A checkout
// Git cannot answer for ignores none, so every file inside it counts.
function gitIgnored(root, paths) {
  try {
    return new Set(execFileSync("git", ["-C", root, "check-ignore", "-z", "--stdin"], { input: paths.join("\0"), encoding: "utf8", stdio: ["pipe", "pipe", "ignore"], timeout: 10_000 }).split("\0"));
  } catch (error) {
    // Exit 1 says none of them is ignored, which is an answer too.
    return new Set(error?.status === 1 && typeof error.stdout === "string" ? error.stdout.split("\0") : []);
  }
}

// Whether each path is a file of the checkout that Git does not ignore.
// Agents also write their progress notes, evidence and scratch files:
// outside the checkout, or inside it where Git ignores them. None of that
// is work a reviewer judges. Without a checkout to ask, every path counts.
function reviewable(paths, cwd, checkout, ignored = gitIgnored) {
  if (checkout === undefined) return paths.map(() => true);
  const root = realPath(checkout) ?? resolve(checkout);
  const inside = paths.map((path) => {
    const lexical = resolve(cwd ?? checkout, path);
    const parent = realPath(dirname(lexical));
    const within = relative(root, parent === undefined ? lexical : join(parent, basename(lexical)));
    // Outside is the parent folder and what lies under it, not a name that begins with two dots.
    const outside = within === "" || within === ".." || within.startsWith(`..${sep}`) || isAbsolute(within);
    return !outside && within !== ".git" && !within.startsWith(`.git${sep}`) ? within : undefined;
  });
  const asked = [...new Set(inside.filter((path) => path !== undefined))];
  const skipped = asked.length === 0 ? new Set() : ignored(root, asked);
  return inside.map((path) => path !== undefined && !skipped.has(path));
}

// What an agent's own transcript shows: the model its first turn went to,
// the models whose turns ran, those whose turns wrote reviewable files, and
// the error it ended on. Atomic reports an agent whose model failed as
// completed, so the transcript is the only record of the failure; and a
// launch's task records name the model at the time they were written,
// which after a foreground wait is the last one, not the first.
function transcriptOutcome(sessionFile, checkout, ignored) {
  const entries = jsonLines(sessionFile);
  if (entries === undefined) return { unread: `its transcript could not be read (${sessionFile})` };
  const cwd = entries[0]?.type === "session" && typeof entries[0].cwd === "string" ? entries[0].cwd : undefined;
  // A forked agent's transcript opens with its parent's turns. Its own
  // begin at the entry that names it, or failing that at its creation time.
  const named = entries.findLastIndex((entry) => entry.type === "session_info" && typeof entry.name === "string" && entry.name.startsWith("subagent-"));
  const created = entries[0]?.type === "session" && typeof entries[0].timestamp === "string" ? entries[0].timestamp : "";
  const own = (entry, index) => (named === -1 ? typeof entry.timestamp !== "string" || entry.timestamp >= created : index >= named);
  const models = [];
  const calls = new Map();
  const writes = [];
  let started;
  let last;
  for (const [index, entry] of entries.entries()) {
    if (!own(entry, index)) continue;
    const message = entry.type === "message" ? entry.message : undefined;
    if (message?.role === "toolResult") {
      // A write counts once its result is in and is not an error.
      const call = calls.get(message.toolCallId);
      if (call !== undefined && message.isError !== true) writes.push(call);
      continue;
    }
    if (message?.role !== "assistant") continue;
    last = message;
    if (cleanModel(message.provider) === undefined || cleanModel(message.model) === undefined) continue;
    const model = `${message.provider}/${message.model}`;
    started ??= model;
    if (message.stopReason === "error") continue;
    if (!models.includes(model)) models.push(model);
    for (const part of Array.isArray(message.content) ? message.content : []) {
      const paths = part?.type === "toolCall" ? writtenBy(part) : undefined;
      if (paths !== undefined) calls.set(part.id, { model, paths });
    }
  }
  if (last === undefined) return { unread: "its transcript holds no turn of its own" };
  const counted = reviewable(writes.flatMap((write) => write.paths), cwd, checkout, ignored);
  const wrote = [];
  let at = 0;
  for (const write of writes) {
    const files = write.paths.map(() => counted[at++]);
    if (files.includes(true) && !wrote.includes(write.model)) wrote.push(write.model);
  }
  return { started, models, wrote, error: last.stopReason === "error" ? cleanModel(last.errorMessage) ?? "the model returned an error" : undefined };
}

// The agents a stage's transcript shows it launching through the subagent
// tool, with the model each launch asked for and the last one its task
// records name. A stage forked from another opens with that stage's
// launches. Nothing when the transcript cannot be read.
function launchedTasks(sessionFile) {
  const entries = jsonLines(sessionFile);
  if (entries === undefined) return undefined;
  const launches = new Map();
  const tasks = new Map();
  for (const entry of entries) {
    const message = entry.type === "message" ? entry.message : undefined;
    if (message?.role === "assistant") {
      for (const part of Array.isArray(message.content) ? message.content : []) {
        if (part?.type === "toolCall" && part.name === "subagent" && part.arguments?.action === undefined) launches.set(part.id, part.arguments ?? {});
      }
      continue;
    }
    if (message?.role !== "toolResult" || message.toolName !== "subagent") continue;
    const args = launches.get(message.toolCallId);
    for (const record of Array.isArray(message.details?.taskRecords) ? message.details.taskRecords : []) {
      const id = record?.launchOperationId;
      if (typeof id !== "string") continue;
      if (!tasks.has(id)) {
        // A status or wait call for a launch this transcript does not hold.
        if (args === undefined) continue;
        const request = requestOf(args, Number(id.split(":")[1] ?? 0));
        tasks.set(id, { task: id, agent: cleanModel(record.agentName) ?? cleanModel(request?.agent) ?? "agent", requested: cleanModel(request?.model), models: [], wrote: [] });
      }
      sawModel(tasks.get(id), record.model, record.thinking);
    }
  }
  return tasks;
}

export function delegatedTaskIds(sessionFile) {
  return typeof sessionFile === "string" && sessionFile !== "" ? [...(launchedTasks(sessionFile)?.keys() ?? [])] : [];
}

// One entry per agent a stage launched: the model the stage asked for, the
// one its first turn went to, the models that ran, those that wrote files
// of the checkout and the one it ended on. Read from the stage's
// transcript, each agent's delivery record and the agent's own transcript,
// because the stage's result names only the stage's model. `unread` says
// what of a task's outcome could not be read; a stage whose own transcript
// cannot be read returns nothing. `ignored` stands in for Git's answer about
// a checkout that is no longer there.
export function delegatedTasks(sessionFile, checkout, ignored) {
  if (typeof sessionFile !== "string" || sessionFile === "") return [];
  const tasks = launchedTasks(sessionFile);
  if (tasks === undefined) return undefined;
  if (tasks.size === 0) return [];
  const artifacts = join(dirname(sessionFile), "subagent-artifacts");
  let delivered = [];
  try {
    delivered = readdirSync(artifacts).filter((name) => name.endsWith("_meta.json"));
  } catch {
    // No agent has delivered a result yet.
  }
  for (const task of tasks.values()) {
    const [launch, index = "0"] = task.task.split(":");
    const name = delivered.find((file) => file.startsWith(`${launch}_`) && file.endsWith(`_${index}_meta.json`));
    let transcript;
    if (name === undefined) {
      // Atomic writes the record when the agent ends. Without one, an
      // agent started afresh still has its transcript in the stage's folder.
      task.unread = "it has no delivery record: it had not ended when the stage returned";
      transcript = join(sessionFile.replace(/\.jsonl$/u, ""), launch, `run-${index}`, "session.jsonl");
    } else {
      let meta;
      try {
        meta = JSON.parse(readFileSync(join(artifacts, name), "utf8"));
      } catch {
        task.unread = `its delivery record could not be read (${name})`;
        continue;
      }
      sawModel(task, meta?.model, meta?.thinking);
      if (typeof meta?.sessionFile !== "string") {
        task.unread = `its delivery record names no transcript (${name})`;
        continue;
      }
      transcript = meta.sessionFile;
    }
    const outcome = transcriptOutcome(transcript, checkout, ignored);
    if (outcome.unread !== undefined) {
      task.unread ??= outcome.unread;
      continue;
    }
    task.started = outcome.started;
    task.models = outcome.models;
    task.wrote = outcome.wrote;
    if (outcome.error !== undefined) task.error = outcome.error;
  }
  return [...tasks.values()];
}

function endedOn(task) {
  if (task.resolved === undefined) return undefined;
  return task.thinking === undefined || task.thinking === "off" ? task.resolved : `${task.resolved}:${task.thinking}`;
}

// One line for a receipt: who was asked, who ran, who wrote.
export function describeDelegatedTask(task) {
  const asked = task.requested ?? "no model (the agent's own)";
  const ran = task.models.length > 0 ? `ran on ${task.models.join(" then ")}` : "produced no turn";
  const wrote = task.wrote.length === 0 ? "wrote no file" : `wrote files on ${task.wrote.join(" and ")}`;
  const ended = endedOn(task);
  return `${task.agent} ${task.task.split(":")[0]} asked for ${asked}, ${ran}, ${wrote}${ended === undefined ? "" : `, ended on ${ended}`}${task.error === undefined ? "" : ` with a model error (${task.error})`}${task.unread === undefined ? "" : `; outcome not established: ${task.unread}`}`;
}
