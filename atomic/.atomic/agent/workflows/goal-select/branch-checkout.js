import { execFile } from "node:child_process";
import { statSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { promisify } from "node:util";

const runGit = promisify(execFile);

export async function resolveBranchCheckout(input, invocationCwd, signal) {
  signal?.throwIfAborted();
  if (!input?.trim()) return invocationCwd;
  const dir = resolve(dirname(invocationCwd), input);
  const problem = `branch_checkout_dir "${input}" resolved to ${dir}`;
  const stats = statSync(dir, { throwIfNoEntry: false });
  if (stats === undefined) {
    throw new Error(`${problem}, which does not exist. Create the checkout first, for example with git bc-add; goal-select never creates clones or switches branches.`);
  }
  if (!stats.isDirectory()) throw new Error(`${problem}, which is not a directory.`);
  let insideWorkTree = "";
  try {
    const { stdout } = await runGit("git", ["-C", dir, "rev-parse", "--is-inside-work-tree"], {
      encoding: "utf8",
      timeout: 10_000,
      signal,
    });
    insideWorkTree = stdout.trim();
  } catch (error) {
    if (signal?.aborted) throw error;
  }
  if (insideWorkTree !== "true") throw new Error(`${problem}, which is not inside a Git checkout.`);
  return dir;
}

export function resolvePolicyPath(policyPath, checkoutDir) {
  return isAbsolute(policyPath) ? policyPath : resolve(checkoutDir, policyPath);
}
