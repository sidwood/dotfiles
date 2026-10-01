// Automatic branch_checkout_dir: plan and create a new git bc-add branch clone
// beside the invoking checkout. Manual paths stay in branch-checkout.js.
import { execFile, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { constants, copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";

const runFile = promisify(execFile);

export const AUTO_CHECKOUT = "auto";
export const CLONE_TIMEOUT_MS = 15 * 60_000;
const GIT_TIMEOUT_MS = 10_000;
const KILL_GRACE_MS = 5_000;
const SLUG_MAX = 40;
const NAME_MAX_BYTES = 255;
const MAX_SYMLINKS = 32;
const STOP_WORDS = new Set(["a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in", "into", "is", "it", "its", "of", "on", "or", "so", "that", "the", "then", "this", "to", "with"]);
const NO_FALLBACK = "No model stage ran, and goal-select did not fall back to the invoking checkout.";
// Local config key a clone gets only once git bc-add has exited 0 and the policy copy is done.
// Its value is the owner (run id) of the plan that created the clone.
const COMPLETION_MARK = "goal-select.completed-run";

export function isAutoCheckout(input) {
  return input === undefined || input.trim() === AUTO_CHECKOUT;
}

// Readable, Git-safe words from the objective: markup tags dropped, accents
// folded, only [a-z0-9] words joined by '-', capped at a word boundary.
export function objectiveSlug(objective) {
  const words = String(objective ?? "")
    .replace(/<\/?[A-Za-z][^<>]*>/g, " ")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word !== "" && !STOP_WORDS.has(word));
  let slug = "";
  for (const word of words) {
    const next = slug === "" ? word : `${slug}-${word}`;
    if (next.length > SLUG_MAX) {
      if (slug === "") slug = word.slice(0, SLUG_MAX);
      break;
    }
    slug = next;
  }
  return slug === "" ? "task" : slug;
}

// Branch goal-<slug>-<id> and directory <seed>.goal-<slug>-<id>, git bc-add's own
// naming. The branch is flat, so a seed on a branch named goal cannot block it. The
// id is the first 8 hex digits of sha256(owner), owner being the run id.
export function branchCloneName(seed, slug, owner) {
  const branch = `goal-${slug}-${createHash("sha256").update(owner).digest("hex").slice(0, 8)}`;
  let budget = NAME_MAX_BYTES - Buffer.byteLength(`.${branch}`);
  let prefix = "";
  for (const char of basename(seed)) {
    budget -= Buffer.byteLength(char);
    if (budget < 0) break;
    prefix += char;
  }
  return { branch, target: join(dirname(seed), `${prefix}.${branch}`) };
}

async function git(args, signal) {
  const { stdout } = await runFile("git", args, { encoding: "utf8", timeout: GIT_TIMEOUT_MS, signal });
  return stdout.trim();
}

async function gitOrEmpty(args, signal) {
  try {
    return await git(args, signal);
  } catch (error) {
    if (signal?.aborted) throw error;
    return "";
  }
}

// The clone must get a branch of its own: an existing seed branch would make git bc-add
// check it out in the seed, and git clone gives the clone the seed's current branch, so
// a planned branch nested with that one (goal and goal/x) cannot be created there.
async function assertNewBranch(seed, branch, signal) {
  try {
    await git(["-C", seed, "show-ref", "--verify", "--quiet", `refs/heads/${branch}`], signal);
    throw new Error(`The seed ${seed} already has branch ${branch}. goal-select only clones onto a new branch, because git bc-add would check an existing one out in the seed. ${NO_FALLBACK}`);
  } catch (error) {
    if (error.code !== 1) throw error;
  }
  const current = await gitOrEmpty(["-C", seed, "symbolic-ref", "--quiet", "--short", "HEAD"], signal);
  if (current !== "" && (current.startsWith(`${branch}/`) || branch.startsWith(`${current}/`))) {
    throw new Error(`The planned branch ${branch} conflicts with the seed's current branch ${current} (refs/heads/${current}), which the clone would also get, so git bc-add was not run. Start a new goal-select run to plan a branch name that does not conflict. ${NO_FALLBACK}`);
  }
}

function sameDirectory(a, b) {
  if (a === b) return true;
  if (!isAbsolute(a) || !isAbsolute(b)) return false;
  try {
    const [x, y] = [a, b].map((path) => statSync(path, { bigint: true }));
    return x.isDirectory() && y.isDirectory() && x.dev === y.dev && x.ino === y.ino;
  } catch {
    return false;
  }
}

// "absent", "owned" (this run's finished clone: its own Git toplevel, bc.source is the
// seed, on the planned branch, completion mark naming this plan's owner), "unfinished"
// (all of that but the mark, only when acceptUnfinished), or an error. Unrelated and
// unfinished paths are never touched.
async function inspectTarget(plan, signal, { acceptUnfinished = false } = {}) {
  const { seed, branch, target } = plan;
  const stats = lstatSync(target, { throwIfNoEntry: false });
  if (stats === undefined) return "absent";
  const refuse = (what) =>
    new Error(`${target} already exists and ${what}. goal-select never reuses, overwrites or deletes an unrelated path; move it aside and rerun. ${NO_FALLBACK}`);
  if (!stats.isDirectory()) throw refuse("is not a directory");
  const toplevel = await gitOrEmpty(["-C", target, "rev-parse", "--show-toplevel"], signal);
  if (toplevel === "" || !sameDirectory(toplevel, target)) throw refuse("is not its own Git checkout");
  const source = await gitOrEmpty(["-C", target, "config", "--local", "--get", "bc.source"], signal);
  const current = await gitOrEmpty(["-C", target, "symbolic-ref", "--quiet", "--short", "HEAD"], signal);
  if (!sameDirectory(source, seed) || current !== branch) {
    throw refuse(`is not this run's branch clone (bc.source ${source || "unset"}, branch ${current || "none"})`);
  }
  const mark = await gitOrEmpty(["-C", target, "config", "--local", "--get", COMPLETION_MARK], signal);
  if (typeof plan.owner === "string" && plan.owner !== "" && mark === plan.owner) return "owned";
  if (acceptUnfinished && mark === "") return "unfinished";
  throw new Error(
    `${target} already exists and has bc.source ${seed} and branch ${branch} but no completion mark from this run (${COMPLETION_MARK} ${mark || "unset"}). An earlier attempt may have stopped before git bc-add and its setup (bc.postadd) finished, or something else made it. goal-select does not rerun setup, adopt, overwrite or delete it: inspect it, then move it aside or remove it and rerun. ${NO_FALLBACK}`,
  );
}

export async function planBranchClone({ invocationCwd, slug, runId, signal }) {
  signal?.throwIfAborted();
  const toplevel = await gitOrEmpty(["-C", invocationCwd, "rev-parse", "--show-toplevel"], signal);
  if (toplevel === "") {
    throw new Error(`branch_checkout_dir is auto, but ${invocationCwd} is not inside a Git checkout, so there is no seed to clone. Run goal-select from a checkout or pass an existing checkout path. ${NO_FALLBACK}`);
  }
  const seed = realpathSync(toplevel);
  const seedHead = await gitOrEmpty(["-C", seed, "rev-parse", "--verify", "--quiet", "HEAD^{commit}"], signal);
  if (seedHead === "") throw new Error(`The seed ${seed} has no commit to clone. ${NO_FALLBACK}`);
  if ((await gitOrEmpty(["-C", seed, "remote", "get-url", "origin"], signal)) === "") {
    throw new Error(`The seed ${seed} has no origin remote, which git bc-add needs to point the clone upstream. Add one or pass an existing checkout path. ${NO_FALLBACK}`);
  }
  try {
    await git(["bc-add", "-h"], signal);
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error(`git bc-add is not available, so goal-select cannot create a branch clone. Put git-bc-add on PATH or pass an existing checkout path. ${NO_FALLBACK}`);
  }
  const owner = runId || randomUUID();
  const plan = { seed, seed_head: seedHead, owner, ...branchCloneName(seed, slug, owner) };
  await assertNewBranch(seed, plan.branch, signal);
  await inspectTarget(plan, signal);
  return plan;
}

// Runs a command in its own process group so abort or timeout stops everything it
// started, including bc.postadd children. Resolves on exit code 0.
function runGroup(argv, { cwd, signal, timeoutMs }) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(argv[0], argv.slice(1), { cwd, detached: true, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    const keep = (chunk) => {
      output = (output + chunk).slice(-2000);
    };
    child.stdout.setEncoding("utf8").on("data", keep);
    child.stderr.setEncoding("utf8").on("data", keep);
    let stopped;
    let killTimer;
    const signalGroup = (name) => {
      try {
        process.kill(-child.pid, name);
      } catch {
        // The group has already exited.
      }
    };
    const stop = (reason) => {
      if (stopped !== undefined) return;
      stopped = reason;
      signalGroup("SIGTERM");
      killTimer = setTimeout(() => signalGroup("SIGKILL"), KILL_GRACE_MS);
    };
    const deadline = setTimeout(() => stop(new Error(`timed out after ${Math.round(timeoutMs / 1000)}s`)), timeoutMs);
    const onAbort = () => stop(signal.reason);
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) onAbort();
    const finish = (error) => {
      clearTimeout(deadline);
      signal?.removeEventListener("abort", onAbort);
      if (error === undefined) resolveRun();
      else rejectRun(error);
    };
    child.once("error", finish);
    // After a stop, killTimer still sends SIGKILL to any straggler in the group.
    child.once("exit", (code) => {
      if (stopped !== undefined) finish(stopped);
      else if (code === 0) finish();
      else finish(new Error(`exit ${code ?? "by signal"}: ${output.replace(/\x1b\[[0-9;]*m/g, "").trim().split("\n").slice(-6).join(" | ")}`));
    });
  });
}

// The path relative to checkout when it lies strictly inside it, else undefined.
function insideCheckout(checkout, path) {
  const rel = relative(checkout, path);
  return rel === "" || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel) ? undefined : rel;
}

function copySeedPolicy(plan, policyPath) {
  if (!policyPath || isAbsolute(policyPath)) return null;
  const destination = resolve(plan.target, policyPath);
  if (insideCheckout(plan.target, destination) === undefined || lstatSync(destination, { throwIfNoEntry: false }) !== undefined) return null;
  const source = resolve(plan.seed, policyPath);
  if (!statSync(source, { throwIfNoEntry: false })?.isFile()) return null;
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination, constants.COPYFILE_EXCL);
  return source;
}

// What a failed, cancelled or timed-out create leaves behind. Nothing is ever deleted.
function leftBehind(plan) {
  return existsSync(plan.target)
    ? `${plan.target} was left in place for inspection; goal-select never deletes it, and a rerun refuses it because it has no completion mark from this run. Inspect it, then move it aside or remove it before rerunning.`
    : `Nothing was created at ${plan.target}.`;
}

function cancelledError(plan, cause) {
  const error = new Error(`Creating branch clone ${plan.target} was cancelled. ${leftBehind(plan)} ${NO_FALLBACK}`, { cause });
  error.name = "AbortError";
  return error;
}

// Creates the planned clone and marks it finished, or adopts this run's finished clone
// when a resumed run already made it. An unfinished clone is refused, not completed.
export async function createBranchClone(plan, { policyPath, signal, timeoutMs = CLONE_TIMEOUT_MS } = {}) {
  signal?.throwIfAborted();
  if (typeof plan.owner !== "string" || plan.owner === "") {
    throw new Error(`The branch clone plan for ${plan.target} names no owning run, so goal-select could not mark or recognise its clone. Start a new goal-select run. ${NO_FALLBACK}`);
  }
  const result = async (adopted, policyCopiedFrom) => ({
    checkout: plan.target,
    branch: plan.branch,
    seed: plan.seed,
    head: await git(["-C", plan.target, "rev-parse", "HEAD"], signal),
    adopted,
    policy_copied_from: policyCopiedFrom,
  });
  if ((await inspectTarget(plan, signal)) === "owned") return result(true, null);
  await assertNewBranch(plan.seed, plan.branch, signal);
  try {
    await runGroup(["git", "bc-add", "--offline", plan.seed, plan.branch, plan.target], { cwd: dirname(plan.seed), signal, timeoutMs });
  } catch (error) {
    if (signal?.aborted) throw cancelledError(plan, error);
    throw new Error(`git bc-add could not create ${plan.target} on ${plan.branch} (${error.message}). ${leftBehind(plan)} ${NO_FALLBACK}`);
  }
  const after = await inspectTarget(plan, signal, { acceptUnfinished: true });
  if (after === "absent") throw new Error(`git bc-add did not create ${plan.target}. ${NO_FALLBACK}`);
  let policyCopiedFrom;
  try {
    policyCopiedFrom = copySeedPolicy(plan, policyPath);
    if (after === "unfinished") await git(["-C", plan.target, "config", "--local", COMPLETION_MARK, plan.owner], signal);
  } catch (error) {
    if (signal?.aborted) throw cancelledError(plan, error);
    throw error;
  }
  return result(false, policyCopiedFrom);
}

function readPolicy(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

function leadsIntoClone(target, path) {
  const clone = target.normalize("NFC").toLowerCase();
  let at = sep;
  let pending = path.split(sep);
  try {
    for (let links = 0; pending.length > 0; ) {
      const name = pending.shift();
      if (name === "" || name === ".") continue;
      if (name === "..") {
        at = dirname(at);
        continue;
      }
      const next = join(at, name);
      if (next.normalize("NFC").toLowerCase() === clone) return true;
      if (!lstatSync(next).isSymbolicLink()) {
        at = next;
        continue;
      }
      if (++links > MAX_SYMLINKS) return false;
      const text = readlinkSync(next);
      if (isAbsolute(text)) at = sep;
      pending = [...text.split(sep), ...pending];
    }
  } catch {
    return false;
  }
  return false;
}

const intoClone = (target, path) => !existsSync(path) && leadsIntoClone(target, path);
const UNAVAILABLE = "which leads back into the planned clone before it exists, so the policy is not previewed";

async function treeEntry(plan, rel, signal) {
  const listing = await gitOrEmpty(["--literal-pathspecs", "-C", plan.seed, "ls-tree", "-z", "--full-tree", plan.seed_head, "--", rel], signal);
  const record = listing.split("\0")[0];
  const tab = record.indexOf("\t");
  if (tab === -1 || record.slice(tab + 1) !== rel) return undefined;
  const [mode, , oid] = record.slice(0, tab).split(" ");
  return { mode, oid };
}

const TREE = { mode: "040000" };

async function followCommitted(plan, done, pending, signal) {
  let entry = TREE;
  let links = 0;
  while (pending.length > 0) {
    const name = pending.shift();
    if (entry.mode !== TREE.mode) return { rel: done.join("/"), blocked: true, links };
    if (name === "" || name === ".") continue;
    let escaped;
    if (name === "..") {
      if (done.length > 0) {
        done.pop();
        continue;
      }
      escaped = [dirname(plan.target), ...pending].join("/");
    } else {
      const rel = [...done, name].join("/");
      entry = await treeEntry(plan, rel, signal);
      if (entry?.mode !== "120000") {
        done.push(name);
        if (entry === undefined) return { rel, links };
        continue;
      }
      links += 1;
      if (links > MAX_SYMLINKS) return { loop: true, links };
      const { stdout: text } = await runFile("git", ["-C", plan.seed, "cat-file", "blob", entry.oid], { encoding: "utf8", timeout: GIT_TIMEOUT_MS, signal });
      entry = TREE;
      if (!isAbsolute(text)) {
        pending = [...text.split("/"), ...pending];
        continue;
      }
      escaped = [text, ...pending].join("/");
    }
    const back = resolve(escaped);
    if (back !== plan.target && insideCheckout(plan.target, back) === undefined) return { outside: escaped, links };
    done = [];
    pending = back === plan.target ? [] : relative(plan.target, back).split(sep);
  }
  return { rel: done.join("/"), entry, links };
}

// What the clone will read for a policy path, without the clone existing.
export async function previewBranchClonePolicy(plan, policyPath, signal) {
  const planned = isAbsolute(policyPath) ? policyPath : resolve(plan.target, policyPath);
  const inside = isAbsolute(policyPath) ? undefined : insideCheckout(plan.target, planned);
  if (inside === undefined) {
    if (intoClone(plan.target, planned)) return { source: `${planned}, ${UNAVAILABLE}`, policy: null };
    return { source: planned, policy: readPolicy(planned) };
  }
  const uncommitted = () => {
    const seedFile = resolve(plan.seed, policyPath);
    if (statSync(seedFile, { throwIfNoEntry: false })?.isFile()) {
      return { source: `${seedFile} (not committed; copied into the clone when it is created)`, policy: readPolicy(seedFile) };
    }
    return { source: null, policy: {} };
  };
  const at = `${inside} at seed commit ${plan.seed_head.slice(0, 12)}`;
  const parts = inside.split(sep);
  const name = parts.pop();
  const parent = await followCommitted(plan, [], parts, signal);
  let found = parent;
  let final = false;
  if (parent.outside !== undefined) {
    found = { outside: `${parent.outside}/${name}`, links: parent.links };
    final = true;
  } else if (parent.entry?.mode === TREE.mode) {
    const rel = parent.rel === "" ? name : `${parent.rel}/${name}`;
    const entry = await treeEntry(plan, rel, signal);
    if (entry?.mode === "120000") {
      found = await followCommitted(plan, parent.rel === "" ? [] : parent.rel.split("/"), [name], signal);
      found.links += parent.links;
    } else {
      found = { rel, entry, links: parent.links };
      final = true;
    }
  }
  if (found.loop) return { source: `${at} is a loop of committed symlinks, so the clone reads no policy there`, policy: {} };
  if (found.outside !== undefined) {
    const resolved = `${at}, resolved through committed symlinks to ${found.outside}, outside the clone`;
    if (intoClone(plan.target, found.outside)) return { source: `${resolved}, ${UNAVAILABLE}`, policy: null };
    if (final && lstatSync(found.outside, { throwIfNoEntry: false }) === undefined) return uncommitted();
    return { source: resolved, policy: readPolicy(found.outside) };
  }
  if (found.entry?.mode?.startsWith("100")) {
    let policy = {};
    try {
      policy = JSON.parse(await git(["-C", plan.seed, "cat-file", "blob", found.entry.oid], signal));
    } catch (error) {
      if (signal?.aborted) throw error;
    }
    const source = found.links === 0 ? `${at} (the clone gets this committed file)` : `${at}, resolved through committed symlinks to ${found.rel} (the clone gets these committed files)`;
    return { source, policy };
  }
  if (found.blocked === undefined && found.entry === undefined && !final && found !== parent) {
    if (statSync(join(plan.seed, found.rel), { throwIfNoEntry: false })?.isFile()) {
      return {
        source: `${at}, resolved through committed symlinks to ${found.rel}, which is not committed and which goal-select does not copy; the clone has it only if git bc-add copies it as an ignored extra, so the policy is not previewed`,
        policy: null,
      };
    }
    return { source: `${at}, resolved through committed symlinks to ${found.rel}, which is not committed, so the clone reads no policy there`, policy: {} };
  }
  if (found.entry === undefined || found.links === 0) return uncommitted();
  return { source: null, policy: {} };
}
