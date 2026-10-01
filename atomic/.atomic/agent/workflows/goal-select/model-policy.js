import { existsSync, readFileSync } from "node:fs";

const DEFAULT_POLICY_PATH = ".atomic/goal-select-models.json";
const DEFAULT_POLICY_FALLBACK_PATH = ".atomic/goal-select-models.jsonc";

export function modelPolicyPaths(input) {
  return input === undefined ? [DEFAULT_POLICY_PATH, DEFAULT_POLICY_FALLBACK_PATH] : [input];
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
