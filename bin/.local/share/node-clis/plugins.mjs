import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const kind = process.argv[2];
const runtime = process.argv[3];

function resolves(anchor, name) {
  const req = createRequire(anchor);
  return (req.resolve.paths(name) || []).some((base) =>
    fs.existsSync(path.join(base, name, "package.json")),
  );
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (kind === "atomic") {
  const anchor = path.join(runtime, "node_modules/@bastani/pi-ai/package.json");
  if (!fs.existsSync(anchor)) fail(`missing ${anchor}`);
  // Do not realpath. pnpm's global layout symlinks the package into a store
  // directory whose parent does not contain this provider.
  if (!resolves(anchor, "@google/genai")) {
    fail("Atomic cannot see @google/genai beside @bastani/pi-ai");
  }
} else if (kind === "harness") {
  const anchor = path.join(
    runtime,
    "node_modules/@deepseek-ai/dsh-web-app/package.json",
  );
  if (!fs.existsSync(anchor)) fail(`missing ${anchor}`);
  if (!resolves(anchor, "@deepseek-ai/dsh-client-ui-settings-plugins")) {
    fail("Harness cannot see plugins beside @deepseek-ai/dsh-web-app");
  }
} else {
  fail(`unknown plugin check ${kind}`);
}
