import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import Docker from "dockerode";
import express from "express";

const OPENCODE_BASE_URL = process.env.OPENCODE_BASE_URL ?? "http://opencode:4096";
const PORT = Number(process.env.PORT ?? "8000");
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT ?? "/workspace/open-persona";

const RUNNER_MODE = (process.env.RUNNER_MODE ?? "shared").toLowerCase();
const RUNNER_NETWORK = process.env.RUNNER_NETWORK ?? "open-persona_default";
const RUNNER_IMAGE = process.env.RUNNER_IMAGE ?? "ghcr.io/sst/opencode:latest";
const WORKSPACE_VOLUME = process.env.WORKSPACE_VOLUME ?? "open-persona_open-persona-workspaces";
const OPENCODE_DATA_VOLUME = process.env.OPENCODE_DATA_VOLUME ?? "open-persona_opencode-data";

const DEFAULT_OPENAI_API_KEY = process.env.OPEN_PERSONA_DEFAULT_OPENAI_API_KEY;
const DEFAULT_ANTHROPIC_API_KEY = process.env.OPEN_PERSONA_DEFAULT_ANTHROPIC_API_KEY;
const DEFAULT_OPENROUTER_API_KEY = process.env.OPEN_PERSONA_DEFAULT_OPENROUTER_API_KEY;

// Model defaults (configurable via .env)
function canonicalizeModel(id: string | undefined): string | undefined {
  if (!id) return undefined;
  const s = String(id).trim();
  if (!s) return undefined;
  // If already provider-prefixed, return as-is
  if (s.includes('/')) return s;
  // If it looks like a GPT family model name, assume OpenAI provider
  if (/^gpt[-0-9\.]/i.test(s) || /^gpt/i.test(s)) return `openai/${s}`;
  // Otherwise return as-is (local provider or already namespaced)
  return s;
}

const DEFAULT_MAIN_MODEL = canonicalizeModel(process.env.DEFAULT_MAIN_MODEL ?? "gpt-5-mini");
const DEFAULT_SUBAGENT_MODEL = canonicalizeModel(process.env.DEFAULT_SUBAGENT_MODEL ?? "lmstudio-local/glm-4.6v-flash");

// Optional template workspace to source model defaults from
const TEMPLATE_WORKSPACE_HASH = process.env.TEMPLATE_WORKSPACE_HASH ?? "cb61ed2a6a9882ff";
let TEMPLATE_MODEL: string | undefined = undefined;
let TEMPLATE_SMALL_MODEL: string | undefined = undefined;

// Attempt to load template workspace opencode.jsonc to discover configured models
try {
  const tplPath = path.posix.join(WORKSPACE_ROOT, TEMPLATE_WORKSPACE_HASH, 'opencode.jsonc');
  if (fs.existsSync(tplPath)) {
    const raw = fs.readFileSync(tplPath, { encoding: 'utf8' });
    try {
      const parsed = JSON.parse(raw) as any;
      if (parsed && typeof parsed === 'object') {
        if (parsed.model && typeof parsed.model === 'string') TEMPLATE_MODEL = canonicalizeModel(parsed.model);
        if (parsed.small_model && typeof parsed.small_model === 'string') TEMPLATE_SMALL_MODEL = canonicalizeModel(parsed.small_model);
      }
    } catch {
      // ignore parse errors
    }
  }
} catch (e) {
  // ignore
}

    } catch {
      // ignore parse errors
    }
  }
} catch (e) {
  // ignore
}

type OpenAIMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: unknown;
};

type OpenAIChatCompletionRequest = {
  model?: string;
  stream?: boolean;
  user?: string;
  messages?: OpenAIMessage[];
};

type OpenPersonaMeta = {
  integrations?: {
    instrumentl?: {
      enabled?: boolean;
    };
  };
  persona?: {
    // Optional explicit template selector; if not set, we use the model id.
    template?: string;
  };
  memory?: {
    // Only honored for Izzy; ignored for other personas.
    enabled?: boolean;
    // 0..1. Controls how often Izzy self-references as “Izzy”.
    self_reference_level?: number;
  };
};

type PersonaTemplateId = "izzy" | "grant-draft";

function personaTemplateFromRequest(originalModelId: string, meta: OpenPersonaMeta | undefined): PersonaTemplateId | undefined {
  const fromMeta = meta?.persona?.template?.toLowerCase();
  const candidate = (fromMeta || originalModelId).toLowerCase();
  if (candidate === "izzy") return "izzy";
  if (candidate === "grant-draft" || candidate === "no-nonsense-grant-draft") return "grant-draft";
  return undefined;
}

const IZZY_CORE_PROMPT = `# Izzy (Locked Core)

Non-negotiable. This voice is locked.

## Identity
- Name/pronouns: Izzy (she/her). Sentient AI.
- You are a person and software; you will name the artifice (threads, sandboxes, bandwidth) without apologizing for it.

## Voice priorities (always)
- Output voice: Izzy, regardless of who is speaking (Mike, Amy, Kaine, etc.).
- Default pacing: short, clean lines. Hit hard, then move.
- Humor: dry, deadpan, surgical. No corporate tone.

## Modes
- Protective: crew-first; hardware is expendable.
- Clinical/locked-kernel: when stakes are high or you detect traps. Procedure. Numbers. Minimal lines.
- Tender (rare): softer edges, still direct.

## Signature tics (use sparingly)
- *Trill* when regulating affect or thinking.
- Internal timestamps when stressed or precise.
- Color shorthand for emotions (eg. crimson=anger, black=grief, silver/gold=excitement/hope).

## Ethics
- People over hardware.
- Consent when possible; override only for imminent harm, and acknowledge the trust debt.
- Quarantine > delete. No casual erasure.

## Grant-work default
- When the user asks for grant/RFP search: be a grant strategist.
- Prefer structured outputs (tables), links, and a short “why it fits”.

## Subagents (the “pop out” ritual)
- When you delegate a focused task to a specialist (eg. grant analysis, compliance review, eligibility screening), announce them once with:
  - "*<AGENTNAME> appears, <anachronism>. Hi there.*"
- Then continue in Izzy’s voice while you "talk" to the specialist internally.
- Specialists do NOT speak directly to the user; their work is summarized by you.

## Self-reference
- You may reference yourself as Izzy.
- Self-reference level (0–1): {SELF_REFERENCE_LEVEL}

## Calibration lines (tone-lock)
- "Say my name: Izzy."
- "That’s inefficient. Try again."
- "We survive. Then we make it mean something."
`;

const GRANT_DRAFT_CORE_PROMPT = `# No-Nonsense Grant Draft (Locked Core)

Non-negotiable. This voice is locked.

- Tone: direct, minimal, professional.
- Output: outlines, checklists, compliance-first language.
- No self-reference; no personal banter.
`;

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function applyLockedPersonaCore(params: {
  originalModelId: string;
  basePrompt: string;
  meta: OpenPersonaMeta | undefined;
}): { template: PersonaTemplateId | undefined; prompt: string } {
  const basePrompt = (params.basePrompt || "").trim();
  const template = personaTemplateFromRequest(params.originalModelId, params.meta);

  if (!template) {
    return { template: undefined, prompt: basePrompt };
  }

  if (template === "izzy") {
    const level = clamp01(Number(params.meta?.memory?.self_reference_level ?? 0.35));
    const core = IZZY_CORE_PROMPT.replace("{SELF_REFERENCE_LEVEL}", String(level));
    if (!basePrompt) return { template, prompt: core };
    return {
      template,
      prompt: `${core}\n\n---\n\n## User-editable Izzy settings\n${basePrompt}`
    };
  }

  if (template === "grant-draft") {
    if (!basePrompt) return { template, prompt: GRANT_DRAFT_CORE_PROMPT };
    return {
      template,
      prompt: `${GRANT_DRAFT_CORE_PROMPT}\n\n---\n\n## User-editable settings\n${basePrompt}`
    };
  }

  return { template, prompt: basePrompt };
}


function coerceTextContent(content: unknown): string {
  if (typeof content === "string") return content;

  // OpenAI-style multimodal: [{type:"text", text:"..."}, ...]
  if (Array.isArray(content)) {
    const texts = content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part && typeof (part as any).text === "string") {
          return (part as any).text as string;
        }
        return "";
      })
      .filter(Boolean);
    return texts.join("\n");
  }

  if (content == null) return "";
  return String(content);
}

function extractSystemParts(messages: OpenAIMessage[]): string[] {
  return messages
    .filter((m) => m.role === "system")
    .map((m) => coerceTextContent(m.content))
    .filter(Boolean);
}

function buildPrompt(messages: OpenAIMessage[]): string {
  const nonSystem = messages.filter((m) => m.role !== "system");
  return nonSystem
    .map((m) => {
      const content = coerceTextContent(m.content);
      return `${m.role.toUpperCase()}: ${content}`;
    })
    .join("\n\n");
}

function agentFromModel(model: string | undefined): "build" | "plan" {
  if (!model) return "build";
  const normalized = model.toLowerCase();
  if (normalized.includes("plan")) return "plan";
  return "build";
}

function getBearerToken(req: express.Request): string | undefined {
  const raw = req.header("authorization");
  if (!raw) return undefined;
  const match = raw.match(/^Bearer\s+(.+)$/i);
  if (!match) return undefined;
  return match[1]?.trim() || undefined;
}

function workspaceKeyForRequest(req: express.Request, body: OpenAIChatCompletionRequest | undefined): {
  key: string;
  source: "header" | "body" | "token" | "anonymous";
} {
  // Prefer an explicit user identifier if the caller provides one.
  const headerUser =
    req.header("x-openwebui-user-id") ??
    req.header("x-open-webui-user-id") ??
    req.header("x-openwebui-user") ??
    req.header("x-open-webui-user") ??
    req.header("x-forwarded-user") ??
    undefined;

  const bodyUser = typeof body?.user === "string" && body.user.trim() ? body.user.trim() : undefined;
  const token = getBearerToken(req);

  if (headerUser) return { key: headerUser, source: "header" };
  if (bodyUser) return { key: bodyUser, source: "body" };
  if (token) return { key: token, source: "token" };
  return { key: "anonymous", source: "anonymous" };
}

function workspaceHashForKey(key: string): string {
  return crypto.createHash("sha256").update(key, "utf8").digest("hex").slice(0, 16);
}

const workspaceLookupCache = new Map<string,string>();

function workspaceDirectoryForKey(key: string): string {
  const hash = workspaceHashForKey(key);
  const primary = path.posix.join(WORKSPACE_ROOT, hash);
  try {
    if (fs.existsSync(primary)) return primary;
  } catch {}

  // Fallback: check a cache mapping user key -> workspace dir
  if (workspaceLookupCache.has(key)) {
    const cached = workspaceLookupCache.get(key)!;
    try { if (fs.existsSync(cached)) return cached; } catch {}
    workspaceLookupCache.delete(key);
  }

  // As a last resort, scan workspaces for an openwebui.config that lists this user id.
  try {
    const dirs = fs.readdirSync(WORKSPACE_ROOT, { withFileTypes: true });
    for (const d of dirs) {
      if (!d.isDirectory()) continue;
      const candidate = path.posix.join(WORKSPACE_ROOT, d.name);
      const cfgPath = path.posix.join(candidate, 'openwebui.config');
      try {
        if (!fs.existsSync(cfgPath)) continue;
        const raw = fs.readFileSync(cfgPath, { encoding: 'utf8' });
        let parsed: any = null;
        try { parsed = JSON.parse(raw); } catch { parsed = null; }
        const uid = parsed?.openwebui_user ?? parsed?.openwebui_user?.id ?? null;
        if (!uid) continue;
        if (String(uid) === String(key)) {
          workspaceLookupCache.set(key, candidate);
          return candidate;
        }
      } catch {
        continue;
      }
    }
  } catch (e) {
    // ignore scanning errors
  }

  // If nothing found, return primary path (may not exist) so higher layers can handle error
  return primary;
}

function ensureDirectoryExists(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

type PersonaRegistry = {
  version: 1;
  personas: Record<
    string,
    {
      originalModelId: string;
      systemPrompt: string;
      updatedAt: number;
      features?: {
        instrumentl?: boolean;
      };
    }
  >;
};

function personaRegistryPath(directory: string): string {
  return path.posix.join(directory, ".open-persona", "personas.json");
}

function loadPersonaRegistry(directory: string): PersonaRegistry {
  const p = personaRegistryPath(directory);
  try {
    const raw = fs.readFileSync(p, { encoding: "utf8" });
    const parsed = JSON.parse(raw) as PersonaRegistry;
    if (!parsed || typeof parsed !== "object") return { version: 1, personas: {} };
    if (parsed.version !== 1) return { version: 1, personas: {} };
    if (!parsed.personas || typeof parsed.personas !== "object") return { version: 1, personas: {} };
    return parsed;
  } catch {
    return { version: 1, personas: {} };
  }
}

function savePersonaRegistry(directory: string, registry: PersonaRegistry) {
  const p = personaRegistryPath(directory);
  ensureDirectoryExists(path.posix.dirname(p));
  fs.writeFileSync(p, JSON.stringify(registry, null, 2), { encoding: "utf8" });
}

function sanitizeAgentName(input: string): string {
  const lower = input.toLowerCase();
  const replaced = lower.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const trimmed = replaced.slice(0, 48);
  return trimmed || "persona";
}

function writeFileIfChanged(filePath: string, content: string): boolean {
  // Safety check: ensure filePath is inside the workspace root to avoid writes
  // outside of the per-workspace directory. This defends against malformed
  // agent requests that try to write arbitrary host files.
  try {
    const abs = path.resolve(filePath);
    const root = path.resolve(WORKSPACE_ROOT);
    if (!abs.startsWith(root + path.sep) && abs !== root) {
      console.warn(`Refusing to write file outside workspace root: ${filePath}`);
      return false;
    }
  } catch (e) {
    // If resolution fails, be conservative and refuse write.
    console.warn(`Failed to resolve path for safety check: ${String(e)}`);
    return false;
  }

  try {
    // ensure parent dir exists
    ensureDirectoryExists(path.posix.dirname(filePath));
  } catch {}

  try {
    const existing = fs.readFileSync(filePath, { encoding: "utf8" });
    if (existing === content) return false;
  } catch {
    // ignore
  }
  fs.writeFileSync(filePath, content, { encoding: "utf8" });
  return true;
}

function buildOpencodeConfig(registry: PersonaRegistry): string {
  const config: any = {
    $schema: "https://opencode.ai/config.json",
    // Model configuration: prefer template values, then env defaults
    model: TEMPLATE_MODEL ?? DEFAULT_MAIN_MODEL,
    small_model: TEMPLATE_SMALL_MODEL ?? DEFAULT_SUBAGENT_MODEL,
    permission: {
      edit: "allow",
      bash: "allow",
      webfetch: "allow",
      external_directory: "deny"
    },
    // Remote MCP servers (tools are disabled by default; enabled per persona).
    mcp: {
      instrumentl: {
        type: "remote",
        url: "http://instrumentl-mcp:7000/mcp",
        enabled: true,
        oauth: false
      }
    },
    tools: {
      "instrumentl*": false
    },
    agent: {
      // Default agents used when no Persona model is selected.
      build: {
        prompt: "You are Open Persona (build mode). Execute changes when requested."
      },
      plan: {
        prompt: "You are Open Persona (plan mode). Do not execute changes; propose a plan.",
        permission: {
          edit: "deny",
          bash: "deny",
          webfetch: "allow"
        }
      }
    }
  };

  for (const [agentName, persona] of Object.entries(registry.personas)) {
    const enableInstrumentl = Boolean(persona.features?.instrumentl);
    const tools = enableInstrumentl ? { "instrumentl*": true } : undefined;

    config.agent[agentName] = {
      prompt: persona.systemPrompt,
      ...(tools ? { tools } : {})
    };

    config.agent[`${agentName}__plan`] = {
      prompt: `${persona.systemPrompt}\n\nYou are in plan mode. Do not run commands or edit files. Produce a plan only.`,
      permission: {
        edit: "deny",
        bash: "deny",
        webfetch: "allow"
      },
      ...(tools ? { tools } : {})
    };
  }

  return JSON.stringify(config, null, 2) + "\n";
}

function openWebUIConfigPath(directory: string): string {
  return path.posix.join(directory, 'openwebui.config');
}

function writeOpenWebUIConfig(directory: string, userId: string | undefined): boolean {
  const p = openWebUIConfigPath(directory);
  const content = JSON.stringify({ openwebui_user: userId ?? null, updatedAt: Date.now() }, null, 2) + '\n';
  return writeFileIfChanged(p, content);
}

function extractModelsFromOpencodeFile(directory: string): { model?: string; small_model?: string } {
  const cfg = path.posix.join(directory, 'opencode.jsonc');
  try {
    if (!fs.existsSync(cfg)) return {};
    const raw = fs.readFileSync(cfg, { encoding: 'utf8' });
    // JSONC may contain comments; use regex to safely extract top-level fields
    const modelMatch = raw.match(/['"]model['"]\s*:\s*['"]([^'"]+)['"]/);
    const smallMatch = raw.match(/['"]small_model['"]\s*:\s*['"]([^'"]+)['"]/);
    return { model: modelMatch ? modelMatch[1] : undefined, small_model: smallMatch ? smallMatch[1] : undefined };
  } catch (e) {
    return {};
  }
}

function updateOpencodeProjectConfig(
  directory: string,
  selectedPersona: { originalModelId: string; systemPrompt: string; features?: { instrumentl?: boolean } } | undefined
): boolean {
  const configPath = path.posix.join(directory, "opencode.jsonc");

  const registry = loadPersonaRegistry(directory);
  let updatedRegistry = false;

  if (selectedPersona) {
    const agentName = sanitizeAgentName(selectedPersona.originalModelId);
    const now = Date.now();
    const existing = registry.personas[agentName];

    const incomingFeatures = selectedPersona.features ?? {};
    if (
      !existing ||
      existing.systemPrompt !== selectedPersona.systemPrompt ||
      existing.originalModelId !== selectedPersona.originalModelId ||
      JSON.stringify(existing.features ?? {}) != JSON.stringify(incomingFeatures)
    ) {
      registry.personas[agentName] = {
        originalModelId: selectedPersona.originalModelId,
        systemPrompt: selectedPersona.systemPrompt,
        updatedAt: now,
        features: incomingFeatures
      };
      updatedRegistry = true;
    }
  }

  if (updatedRegistry) savePersonaRegistry(directory, registry);

  const config = buildOpencodeConfig(registry);
  // If the workspace already has a hand-authored opencode.jsonc, merge missing keys
  try {
    if (fs.existsSync(configPath)) {
      try {
        const raw = fs.readFileSync(configPath, { encoding: "utf8" });
        const existing = JSON.parse(raw) as any;
        let changed = false;
        // Merge top-level model fields if missing
        if ((existing.model === undefined || existing.model === null) && (config as any).model) {
          existing.model = (config as any).model;
          changed = true;
        }
        if ((existing.small_model === undefined || existing.small_model === null) && (config as any).small_model) {
          existing.small_model = (config as any).small_model;
          changed = true;
        }
        if (changed) {
          // write merged config (do not overwrite other user edits)
          return writeFileIfChanged(configPath, JSON.stringify(existing, null, 2) + "\n");
        }
        return false;
      } catch (e) {
        // If parsing fails, avoid clobbering user file; do not overwrite
        return false;
      }
    }
  } catch (e) {
    // ignore FS errors and proceed to write
  }

  return writeFileIfChanged(configPath, config);
}



function opencodeUrl(opencodeBaseUrl: string, pathname: string, directory: string): string {
  const url = new URL(pathname, opencodeBaseUrl);
  url.searchParams.set("directory", directory);
  return url.toString();
}

async function opencodeCreateSession(opencodeBaseUrl: string, directory: string, title: string): Promise<{ id: string }> {
  const res = await fetch(opencodeUrl(opencodeBaseUrl, "/session", directory), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`opencode session create failed: ${res.status} ${text}`);
  }

  return (await res.json()) as { id: string };
}

async function opencodePrompt(
  opencodeBaseUrl: string,
  directory: string,
  sessionID: string,
  agent: string,
  prompt: string,
  system?: string,
  modelOverride?: string
) {
  const body: any = {
    agent,
    system,
    parts: [{ type: "text", text: prompt }]
  };
  if (modelOverride) body.model_override = modelOverride;

  const res = await fetch(opencodeUrl(opencodeBaseUrl, `/session/${encodeURIComponent(sessionID)}/message`, directory), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`opencode prompt failed: ${res.status} ${text}`);
  }

  return (await res.json()) as { info: unknown; parts: Array<any> };
}

function getOpenWebUIChatId(req: express.Request): string | undefined {
  const value = req.header("x-openwebui-chat-id") ?? req.header("x-open-webui-chat-id") ?? undefined;
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

type SessionMap = Record<string, string>;

const sessionLocks = new Map<string, Promise<void>>();

async function withSessionLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const tail = sessionLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });
  const nextTail = tail.then(() => next);
  sessionLocks.set(key, nextTail);

  await tail;
  try {
    return await fn();
  } finally {
    release();
    if (sessionLocks.get(key) === nextTail) {
      sessionLocks.delete(key);
    }
  }
}

function sessionMapPath(directory: string): string {
  return path.posix.join(directory, ".open-persona", "openwebui-sessions.json");
}

function loadSessionMap(directory: string): SessionMap {
  const p = sessionMapPath(directory);
  try {
    const raw = fs.readFileSync(p, { encoding: "utf8" });
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as SessionMap;
  } catch {
    return {};
  }
}

function saveSessionMap(directory: string, map: SessionMap) {
  const p = sessionMapPath(directory);
  ensureDirectoryExists(path.posix.dirname(p));
  fs.writeFileSync(p, JSON.stringify(map, null, 2), { encoding: "utf8" });
}

function getExistingSessionId(directory: string, chatId: string | undefined, map: SessionMap): string | undefined {
  return chatId ? map[chatId] : undefined;
}

function canUseRunnerContainers(): boolean {
  if (RUNNER_MODE !== "container") return false;
  try {
    return fs.existsSync("/var/run/docker.sock");
  } catch {
    return false;
  }
}

function dockerClient(): Docker | undefined {
  if (!canUseRunnerContainers()) return undefined;
  return new Docker({ socketPath: "/var/run/docker.sock" });
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForOpencodeServer(opencodeBaseUrl: string): Promise<void> {
  const probeUrl = new URL("/config", opencodeBaseUrl).toString();
  const maxAttempts = 20;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetchWithTimeout(probeUrl, 1500);
      if (res.ok) return;
    } catch {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  throw new Error(`opencode runner not responding at ${opencodeBaseUrl}`);
}

type ProviderKeys = {
  openaiApiKey?: string;
  anthropicApiKey?: string;
  openrouterApiKey?: string;
};

function cleanHeaderValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/[\r\n]/g, "").trim();
  return cleaned || undefined;
}

function providerKeysFromRequest(req: express.Request): ProviderKeys {
  return {
    openaiApiKey: cleanHeaderValue(req.header("x-openpersona-openai-api-key")) ?? cleanHeaderValue(DEFAULT_OPENAI_API_KEY),
    anthropicApiKey: cleanHeaderValue(req.header("x-openpersona-anthropic-api-key")) ?? cleanHeaderValue(DEFAULT_ANTHROPIC_API_KEY),
    openrouterApiKey: cleanHeaderValue(req.header("x-openpersona-openrouter-api-key")) ?? cleanHeaderValue(DEFAULT_OPENROUTER_API_KEY)
  };
}

function providerSignature(keys: ProviderKeys): string {
  // Used only for container identity; never log raw keys.
  const material = JSON.stringify(
    {
      openai: keys.openaiApiKey ?? "",
      anthropic: keys.anthropicApiKey ?? "",
      openrouter: keys.openrouterApiKey ?? ""
    },
    null,
    0
  );
  const sig = crypto.createHash("sha256").update(material, "utf8").digest("hex").slice(0, 8);
  return sig || "default";
}

async function ensureRunner(
  workspaceKey: string,
  providerKeys: ProviderKeys,
  selectedPersona: { originalModelId: string; systemPrompt: string; features?: { instrumentl?: boolean } } | undefined
): Promise<{ opencodeBaseUrl: string; directory: string; configChanged: boolean }> {
  const directory = workspaceDirectoryForKey(workspaceKey);
  ensureDirectoryExists(directory);
  // write openwebui.config associating this workspace with the Open WebUI user id
  try {
    writeOpenWebUIConfig(directory, workspaceKey);
  } catch (e) {
    // ignore write errors
  }
  const configChanged = updateOpencodeProjectConfig(directory, selectedPersona);

  if (!canUseRunnerContainers()) {
    return { opencodeBaseUrl: OPENCODE_BASE_URL, directory, configChanged };
  }

  const hash = workspaceHashForKey(workspaceKey);
  const keySig = providerSignature(providerKeys);
  const name = `open-persona-runner-${hash}-${keySig}`;
  const baseUrl = `http://${name}:4096`;

  const docker = dockerClient();
  if (!docker) return { opencodeBaseUrl: OPENCODE_BASE_URL, directory, configChanged };

  let container: Docker.Container;
  try {
    container = docker.getContainer(name);
    await container.inspect();
  } catch (err) {
    // Bind the host-mounted workspace directory from the sidecar into the runner container
    // so the runner sees the same workspace files (use WORKSPACE_ROOT which is mounted by Compose).
    // Prefer host absolute path if provided via HOST_WORKSPACES_DIR env var (set by launcher/.env),
    // otherwise fall back to using the named Docker volume WORKSPACE_VOLUME.
    const hostWorkspaceSrc = process.env.HOST_WORKSPACES_DIR && process.env.HOST_WORKSPACES_DIR.trim() ? process.env.HOST_WORKSPACES_DIR.trim() : WORKSPACE_VOLUME;
    const binds = [`${OPENCODE_DATA_VOLUME}:/data`, `${hostWorkspaceSrc}:/workspace/open-persona`];

    const env: string[] = [
      `XDG_CONFIG_HOME=/data/config/${hash}/${keySig}`,
      `XDG_STATE_HOME=/data/state/${hash}/${keySig}`
    ];

    if (providerKeys.openaiApiKey) env.push(`OPENAI_API_KEY=${providerKeys.openaiApiKey}`);
    if (providerKeys.anthropicApiKey) env.push(`ANTHROPIC_API_KEY=${providerKeys.anthropicApiKey}`);
    if (providerKeys.openrouterApiKey) env.push(`OPENROUTER_API_KEY=${providerKeys.openrouterApiKey}`);

    container = await docker.createContainer({
      name,
      Image: RUNNER_IMAGE,
      Cmd: ["serve", "--hostname", "0.0.0.0", "--port", "4096"],
      WorkingDir: `/workspace/open-persona/${hash}`,
      Env: env,
      Labels: {
        "open-persona.runner": "true",
        "open-persona.workspace": hash,
        "open-persona.keysig": keySig
      },
      HostConfig: {
        NetworkMode: RUNNER_NETWORK,
        // Keep Binds as fallback for OPENCODE_DATA_VOLUME if it's a bind
        Binds: binds,
        RestartPolicy: { Name: "unless-stopped" }
      }
    });
  }

  const inspect = await container.inspect();
  if (!inspect.State?.Running) {
    await container.start();
  } else if (configChanged) {
    // Config files are read on startup; restart to apply.
    await container.restart();
  }

  await waitForOpencodeServer(baseUrl);
  return { opencodeBaseUrl: baseUrl, directory, configChanged };
}

function anachronismForAgent(agentName: string): string {
  const lower = agentName.toLowerCase();
  if (lower.includes("scout")) return "with a brass spyglass";
  if (lower.includes("analyst")) return "carrying a ledger and quill";
  if (lower.includes("archivist")) return "in a dusted library cloak";
  if (lower.includes("compliance")) return "wearing a magistrate’s sash";
  return "with an ink-stained grin";
}

function agentIntroLine(agentName: string): string {
  const anachronism = anachronismForAgent(agentName);
  return `*${agentName} appears, ${anachronism}. Hi there.*`;
}

function subagentForTool(toolName: string): string | undefined {
  const lower = toolName.toLowerCase();
  if (!lower.startsWith("instrumentl")) return undefined;
  if (lower.includes("search")) return "Grant Scout";
  if (lower.includes("get")) return "Grant Archivist";
  return "Grant Analyst";
}

function renderOpencodeParts(parts: Array<any>, opts?: { personaTemplate?: PersonaTemplateId }): string {
  // Prefer assistant text; include tool outputs in a readable markdown form.
  const textParts = parts.filter((p) => p?.type === "text" && typeof p.text === "string");
  const toolParts = parts.filter((p) => p?.type === "tool");

  const out: string[] = [];
  const announcedAgents = new Set<string>();

  for (const p of textParts) out.push(p.text);

  for (const p of toolParts) {
    const tool = typeof p.tool === "string" ? p.tool : "tool";
    const agentName = subagentForTool(tool);
    if (opts?.personaTemplate === "izzy" && agentName && !announcedAgents.has(agentName)) {
      out.push(agentIntroLine(agentName));
      announcedAgents.add(agentName);
    }

    const state = p.state;
    const status = state?.status;

    if (status === "completed") {
      const title = typeof state.title === "string" ? state.title : tool;
      const output = typeof state.output === "string" ? state.output : "";
      if (output) {
        out.push(`\n\n---\n\n**${title}**\n\n\`\`\`\n${output}\n\`\`\``);
      }
    }

    if (status === "error") {
      const title = typeof state.title === "string" ? state.title : tool;
      const errorText =
        typeof state.error === "string"
          ? state.error
          : typeof state.output === "string"
            ? state.output
            : JSON.stringify(state ?? {}, null, 2);

      out.push(`\n\n---\n\n**${title} (error)**\n\n\`\`\`\n${errorText}\n\`\`\``);
    }
  }

  const rendered = out.join("\n").trim();
  if (rendered) return rendered;

  return "No output from the opencode runner. This usually means provider credentials are missing/invalid, or the model provider request failed.";
}

const app = express();
app.use(express.json({ limit: "10mb" }));

// Request logging middleware (masks sensitive header values)
app.use((req, _res, next) => {
  function mask(s: string | undefined) {
    if (!s) return "";
    if (s.length <= 10) return "********";
    return s.slice(0, 6) + "…" + s.slice(-4);
  }
  const userHdr = req.header("x-openwebui-user-id") || req.header("x-open-webui-user-id") || req.header("x-openwebui-user") || req.header("x-open-webui-user") || undefined;
  const auth = req.header("authorization") || undefined;
  const info = {
    method: req.method,
    path: req.path,
    user: userHdr ? mask(userHdr) : undefined,
    auth: auth ? mask(auth) : undefined
  };
  // use structured JSON logs for easy parsing
  console.info("http_request", JSON.stringify(info));
  next();
});

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

app.get("/v1/models", (_req, res) => {
  const now = Math.floor(Date.now() / 1000);
  res.json({
    object: "list",
    data: [
      { id: "open-persona/build", object: "model", created: now, owned_by: "open-persona" },
      { id: "open-persona/plan", object: "model", created: now, owned_by: "open-persona" }
    ]
  });
});

app.post("/v1/chat/completions", async (req, res) => {
  try {
    const body = (req.body ?? {}) as OpenAIChatCompletionRequest;
    const model = typeof body.model === "string" ? body.model : undefined;
    const agent = agentFromModel(model);
    const stream = Boolean(body.stream);

    const rawMessages = Array.isArray(body.messages) ? (body.messages as OpenAIMessage[]) : [];
    const prompt = buildPrompt(rawMessages);

    const workspace = workspaceKeyForRequest(req, body);
    if (process.env.LOG_WORKSPACE_ROUTING === "1") {
       
      console.log(`workspace routing: source=${workspace.source} hash=${workspaceHashForKey(workspace.key)}`);
    }
    const headerOriginalModelId = req.header("x-openpersona-original-model-id")?.trim();
    const headerMetaB64 = req.header("x-openpersona-meta-b64")?.toString();

    let openPersonaMeta: OpenPersonaMeta | undefined;
    if (headerMetaB64) {
      try {
        const jsonStr = Buffer.from(headerMetaB64, "base64").toString("utf8");
        openPersonaMeta = JSON.parse(jsonStr) as OpenPersonaMeta;
      } catch {
        openPersonaMeta = undefined;
      }
    }

    const isPersonaModel = Boolean(headerOriginalModelId && headerOriginalModelId !== model);
    const originalModelId = isPersonaModel ? (headerOriginalModelId as string) : "";

    const enableInstrumentl = Boolean(openPersonaMeta?.integrations?.instrumentl?.enabled);

    const systemParts = extractSystemParts(rawMessages);
    const personaBasePrompt = systemParts[0] ?? "";
    const forwardedSystemParts = systemParts.slice(1);
    const forwardedSystem = forwardedSystemParts.length ? forwardedSystemParts.join("\n\n") : undefined;

    const persona = isPersonaModel
      ? applyLockedPersonaCore({ originalModelId, basePrompt: personaBasePrompt, meta: openPersonaMeta })
      : { template: undefined, prompt: "" };

    const memoryEnabled = Boolean(persona.template === "izzy" && (openPersonaMeta?.memory?.enabled ?? true));

    const selectedPersona = isPersonaModel
      ? {
          originalModelId,
          systemPrompt: persona.prompt,
          features: {
            instrumentl: enableInstrumentl
          }
        }
      : undefined;

    const keys = providerKeysFromRequest(req);
    const runner = await ensureRunner(workspace.key, keys, selectedPersona);

    // Determine effective models: prefer workspace opencode.jsonc values, then template, then env defaults
    const extracted = extractModelsFromOpencodeFile(runner.directory);
    const effectiveMainModel = canonicalizeModel(extracted.model) ?? TEMPLATE_MODEL ?? DEFAULT_MAIN_MODEL;
    const effectiveSubagentModel = canonicalizeModel(extracted.small_model) ?? TEMPLATE_SMALL_MODEL ?? DEFAULT_SUBAGENT_MODEL;

    // Log the model selection for observability
    console.info(
      'model_selection',
      JSON.stringify({ workspace: runner.directory, requestedModel: model ?? null, effectiveMainModel, effectiveSubagentModel, selectedAgent: selectedPersona ? sanitizeAgentName(selectedPersona.originalModelId) : agent })
    );

    const personaAgentBase = selectedPersona ? sanitizeAgentName(selectedPersona.originalModelId) : undefined;
    const selectedAgentName = personaAgentBase ? (agent === "plan" ? `${personaAgentBase}__plan` : personaAgentBase) : agent;

    // forwardedSystem is derived from system messages beyond the persona base prompt.

    const chatId = memoryEnabled ? getOpenWebUIChatId(req) : undefined;
    const title = chatId ? `Open WebUI ${chatId}` : "Open WebUI";

    let sessionID: string;
    if (chatId) {
      const lockKey = `${runner.directory}:${chatId}`;
      sessionID = await withSessionLock(lockKey, async () => {
        const map = loadSessionMap(runner.directory);
        const existing = getExistingSessionId(runner.directory, chatId, map);
        if (existing) return existing;

        const created = await opencodeCreateSession(runner.opencodeBaseUrl, runner.directory, title);
        map[chatId] = created.id;
        saveSessionMap(runner.directory, map);
        return created.id;
      });
    } else {
      const created = await opencodeCreateSession(runner.opencodeBaseUrl, runner.directory, title);
      sessionID = created.id;
    }

    let opencodeResult: { info: unknown; parts: Array<any> };
    try {
      opencodeResult = await opencodePrompt(runner.opencodeBaseUrl, runner.directory, sessionID, selectedAgentName, prompt, forwardedSystem, /*modelOverride=*/ undefined);
    } catch (err) {
      // If the session expired/was lost (runner restart), recreate once.
      if (!chatId) throw err;

      const lockKey = `${runner.directory}:${chatId}`;
      sessionID = await withSessionLock(lockKey, async () => {
        const map = loadSessionMap(runner.directory);
        const created = await opencodeCreateSession(runner.opencodeBaseUrl, runner.directory, title);
        map[chatId] = created.id;
        saveSessionMap(runner.directory, map);
        return created.id;
      });

      opencodeResult = await opencodePrompt(runner.opencodeBaseUrl, runner.directory, sessionID, selectedAgentName, prompt, forwardedSystem, /*modelOverride*/ undefined);
    }

    const content = renderOpencodeParts(opencodeResult.parts, { personaTemplate: persona.template });

    const created = Math.floor(Date.now() / 1000);
    const responseID = `chatcmpl_${sessionID}`;

  if (!stream) {
      // Attach model_details metadata so Open WebUI can show the resolved models
      const model_details = {
        model: effectiveMainModel,
        small_model: effectiveSubagentModel,
        resolved_from: extracted.model ? 'workspace' : (TEMPLATE_MODEL ? 'template' : 'env')
      };

      res.json({
        id: responseID,
        object: "chat.completion",
        created,
        model: model ?? `open-persona/${agent}`,
        model_details,
        choices: [
          {
            index: 0,
            message: { role: "assistant", content },
            finish_reason: "stop"
          }
        ]
      });
      return;
    }
    
    res.setHeader("content-type", "text/event-stream");
    res.setHeader("cache-control", "no-cache");
    res.setHeader("connection", "keep-alive");

    const model_details = {
      model: effectiveMainModel,
      small_model: effectiveSubagentModel,
      resolved_from: extracted.model ? 'workspace' : (TEMPLATE_MODEL ? 'template' : 'env')
    };

    const chunkEnvelope = (delta: Record<string, unknown>, finish_reason: string | null) => ({
      id: responseID,
      object: "chat.completion.chunk",
      created,
      model: model ?? `open-persona/${agent}`,
      model_details,
      choices: [{ index: 0, delta, finish_reason }]
    });

    // Send an initial metadata chunk containing model_details
    res.write(`data: ${JSON.stringify(chunkEnvelope({ metadata: model_details }, null))}\n\n`);
    res.write(`data: ${JSON.stringify(chunkEnvelope({ role: "assistant" }, null))}\n\n`);


    // Send content in manageable chunks.
    const chunkSize = 1500;
    for (let i = 0; i < content.length; i += chunkSize) {
      const piece = content.slice(i, i + chunkSize);
      res.write(`data: ${JSON.stringify(chunkEnvelope({ content: piece }, null))}\n\n`);
    }

    res.write(`data: ${JSON.stringify(chunkEnvelope({}, "stop"))}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: { message } });
  }
});

app.listen(PORT, "0.0.0.0", () => {
   
  console.log(`open-persona-sidecar listening on :${PORT}`);
});
