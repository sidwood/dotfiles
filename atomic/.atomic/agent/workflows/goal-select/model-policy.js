import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// The shared policy: defaults for the orchestrator and tier, and the three
// review tiers. A project policy file may override any of it per run.
const SHARED_POLICY = [".config", "atomic", "goal-select.jsonc"];

export const REVIEW_TIERS = ["simple", "standard", "complex"];
export const DEFAULT_REVIEW_TIER = "complex";
export const DEFAULT_MAX_TURNS = 3;
// What each tier means when the policy file does not say: the panel is the
// reviewer roles that run, in this order, and quorum is how many must
// approve. Models come from the policy's tier entry or its launch inputs.
export const REVIEW_PANELS = {
  simple: { roles: ["reviewer"], quorum: 1 },
  standard: { roles: ["completion", "risk"], quorum: 2 },
  complex: { roles: ["completion", "evidence", "risk"], quorum: 2 },
};

export function sharedPolicyDir() {
  return join(homedir(), ".config", "atomic");
}

export function defaultPolicyPath() {
  return join(homedir(), ...SHARED_POLICY);
}

// The shared file's tier presets and defaults, which every policy file
// inherits unless it carries its own.
export function sharedPolicyLayers() {
  try {
    const parsed = parseModelPolicy(readFileSync(defaultPolicyPath(), "utf8"));
    return {
      defaults: parsed?.defaults !== null && typeof parsed?.defaults === "object" ? parsed.defaults : {},
      review_tiers: parsed?.review_tiers !== null && typeof parsed?.review_tiers === "object" ? parsed.review_tiers : {},
      // Left as written: writerFallbacksFor validates it where a run reads it.
      writer_fallbacks: parsed?.writer_fallbacks,
    };
  } catch {
    return { defaults: {}, review_tiers: {} };
  }
}

export function modelPolicyPaths(input) {
  return input === undefined ? [defaultPolicyPath()] : [input];
}

export function modelPolicyFile(policyPath, fallbackPath) {
  return fallbackPath === undefined || existsSync(policyPath) ? policyPath : fallbackPath;
}

export function readModelPolicyFile(policyPath, fallbackPath) {
  const file = modelPolicyFile(policyPath, fallbackPath);
  const source = existsSync(file) ? file : null;
  try {
    return { source, policy: parseModelPolicy(readFileSync(file, "utf8")) };
  } catch {
    return { source, policy: {} };
  }
}

const LAUNCH_MODEL_KEYS = [
  ["orchestrator_model", "orchestrator"],
  ["reviewer_model", "reviewer"],
  ["completion_reviewer_model", "completion_reviewer"],
  ["evidence_reviewer_model", "evidence_reviewer"],
  ["risk_reviewer_model", "risk_reviewer"],
  ["writer_model", "writer"],
];

export function launchDefaults() {
  const [policyPath] = modelPolicyPaths(undefined);
  const { policy } = readModelPolicyFile(policyPath);
  const defaults = {};
  const fallbacks = policy?.defaults ?? {};
  // Only the orchestrator and writer have a defaults layer; reviewer roles
  // come from the tier, so a prefilled role would silently beat it.
  const fallbackKeys = new Set(["orchestrator_model", "writer_model"]);
  for (const [key, alias] of LAUNCH_MODEL_KEYS) {
    const model = policyModel(policy?.[key]) ?? policyModel(policy?.[alias]) ?? (fallbackKeys.has(key) ? policyModel(fallbacks[key]) ?? policyModel(fallbacks[alias]) : undefined);
    if (model !== undefined) defaults[key] = model;
  }
  const maxTurns = policyMaxTurns(policy?.max_turns);
  if (maxTurns !== undefined) defaults.max_turns = maxTurns;
  const tier = policyTier(policy?.review_tier) ?? policyTier(fallbacks.review_tier);
  if (tier !== undefined) defaults.review_tier = tier;
  return defaults;
}

export function policyModel(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

export function policyMaxTurns(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 1 ? Math.floor(value) : undefined;
}

export function policyTier(value) {
  return typeof value === "string" && REVIEW_TIERS.includes(value.trim()) ? value.trim() : undefined;
}

// The review tier's entry from a parsed policy, with the roles its panel
// runs: `reviewer_model` serves any role without its own model.
export function policyReviewTier(policy, tier) {
  const entry = policy?.review_tiers?.[tier];
  const panel = REVIEW_PANELS[tier];
  const roles = entry?.panel === 1 || entry?.panel === 2 || entry?.panel === 3 ? REVIEW_PANELS[["simple", "standard", "complex"][entry.panel - 1]].roles : panel.roles;
  const reviewer = policyModel(entry?.reviewer_model) ?? policyModel(entry?.reviewer);
  return {
    tier,
    roles,
    quorum: typeof entry?.quorum === "number" && entry.quorum >= 1 && entry.quorum <= roles.length ? Math.floor(entry.quorum) : Math.min(panel.quorum, roles.length),
    models: {
      reviewer,
      completion: policyModel(entry?.completion_reviewer_model) ?? policyModel(entry?.completion_reviewer),
      evidence: policyModel(entry?.evidence_reviewer_model) ?? policyModel(entry?.evidence_reviewer),
      risk: policyModel(entry?.risk_reviewer_model) ?? policyModel(entry?.risk_reviewer),
      reverify: policyModel(entry?.reverify_model),
    },
    maxTurns: policyMaxTurns(entry?.max_turns),
  };
}

const MODEL_EFFORTS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];
// provider/model with no effort suffix; the model part may hold slashes.
const MODEL_LINE = /^[^\s/:]+\/[^\s:]+$/u;

// A model id without its effort suffix: `:high` and `:xhigh` of one model
// are the same line, and two models of one provider are different lines.
export function modelLine(model) {
  return typeof model === "string" ? model.trim().replace(/:[a-z]+$/u, "") : undefined;
}

// `writer_fallbacks`: for each writer model line, the models the writer
// moves to, in order, when its provider fails. A mistake here would send
// work to the wrong model or to none, so it stops the run instead of being
// skipped like a mistyped model key.
export function policyWriterFallbacks(value, where = "the model policy") {
  if (value === undefined) return {};
  const fail = (detail) => {
    throw new Error(`${where}: writer_fallbacks ${detail}`);
  };
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail('must be an object keyed by writer model line, such as { "xai/grok-4.7": ["kimi-coding/k3:max"] }.');
  }
  const chains = {};
  for (const [key, entries] of Object.entries(value)) {
    if (!MODEL_LINE.test(key)) fail(`key "${key}" is not a model line: write provider/model without an effort suffix.`);
    if (!Array.isArray(entries)) fail(`"${key}" must list its fallback models in order, as an array.`);
    const seen = new Set([key]);
    chains[key] = entries.map((entry, index) => {
      const model = typeof entry === "string" ? entry.trim() : "";
      const [, line, effort] = /^(.*?)(?::([a-z]+))?$/u.exec(model);
      if (!MODEL_LINE.test(line)) fail(`"${key}" entry ${index + 1} must be a model id such as "kimi-coding/k3:max", not ${JSON.stringify(entry)}.`);
      if (effort !== undefined && !MODEL_EFFORTS.includes(effort)) fail(`"${key}" entry "${model}" has an unknown effort "${effort}"; use one of ${MODEL_EFFORTS.join(", ")}.`);
      if (line === key) fail(`"${key}" lists its own model line ("${model}") as a fallback.`);
      if (seen.has(line)) fail(`"${key}" lists the model line ${line} twice.`);
      seen.add(line);
      return model;
    });
  }
  return chains;
}

// The chains a parsed policy file runs with: its own map, or the shared
// file's when it has none, as with review_tiers and defaults. An empty map
// of its own switches the shared chains off.
export function writerFallbacksFor(policy, source) {
  const own = policy !== null && typeof policy === "object" && Object.hasOwn(policy, "writer_fallbacks");
  return own ? policyWriterFallbacks(policy.writer_fallbacks, source ?? "the model policy") : policyWriterFallbacks(sharedPolicyLayers().writer_fallbacks, defaultPolicyPath());
}

const JSON_WHITESPACE = new Set([" ", "\t", "\n", "\r"]);

export function parseModelPolicy(text) {
  let json = "";
  let comma = -1;
  let previous = "";
  let at = 0;
  while (at < text.length) {
    const char = text[at];
    if (char === "/" && (text[at + 1] === "/" || text[at + 1] === "*")) {
      json += " ";
      at = commentEnd(text, at);
      continue;
    }
    if (!JSON_WHITESPACE.has(char)) {
      if ((char === "}" || char === "]") && comma !== -1) json = `${json.slice(0, comma)} ${json.slice(comma + 1)}`;
      comma = char === "," && previous !== "{" && previous !== "[" ? json.length : -1;
      previous = char;
    }
    const end = char === '"' ? stringEnd(text, at) : at + 1;
    json += text.slice(at, end);
    at = end;
  }
  return JSON.parse(json);
}

function commentEnd(text, at) {
  if (text[at + 1] === "/") {
    let end = at + 2;
    while (end < text.length && text[end] !== "\n" && text[end] !== "\r") end += 1;
    return end;
  }
  const end = text.indexOf("*/", at + 2);
  if (end === -1) throw new SyntaxError(`Unterminated /* comment at position ${at} in model policy`);
  return end + 2;
}

function stringEnd(text, at) {
  let end = at + 1;
  while (end < text.length && text[end] !== '"') end += text[end] === "\\" ? 2 : 1;
  return end + 1;
}
