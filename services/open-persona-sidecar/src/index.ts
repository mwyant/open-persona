import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import express from "express";

const OPENCODE_BASE_URL = process.env.OPENCODE_BASE_URL ?? "http://opencode:4096";
const PORT = Number(process.env.PORT ?? "8000");
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT ?? "/workspace/open-persona";

type OpenAIMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: unknown;
};

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

function extractSystem(messages: OpenAIMessage[]): string | undefined {
  const systemParts = messages
    .filter((m) => m.role === "system")
    .map((m) => coerceTextContent(m.content))
    .filter(Boolean);
  if (!systemParts.length) return undefined;
  return systemParts.join("\n\n");
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

function workspaceDirectoryForRequest(req: express.Request): string {
  const token = getBearerToken(req) ?? "anonymous";
  const hash = crypto.createHash("sha256").update(token, "utf8").digest("hex").slice(0, 16);
  return path.posix.join(WORKSPACE_ROOT, hash);
}

function ensureDirectoryExists(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function opencodeUrl(pathname: string, directory: string): string {
  const url = new URL(pathname, OPENCODE_BASE_URL);
  url.searchParams.set("directory", directory);
  return url.toString();
}

async function opencodeCreateSession(directory: string): Promise<{ id: string }> {
  const res = await fetch(opencodeUrl("/session", directory), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "Open WebUI" })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`opencode session create failed: ${res.status} ${text}`);
  }

  return (await res.json()) as { id: string };
}

async function opencodePrompt(directory: string, sessionID: string, agent: "build" | "plan", prompt: string, system?: string) {
  const res = await fetch(opencodeUrl(`/session/${encodeURIComponent(sessionID)}/message`, directory), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      agent,
      system,
      parts: [{ type: "text", text: prompt }]
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`opencode prompt failed: ${res.status} ${text}`);
  }

  return (await res.json()) as { info: unknown; parts: Array<any> };
}

function renderOpencodeParts(parts: Array<any>): string {
  // Prefer assistant text; include tool outputs in a readable markdown form.
  const textParts = parts.filter((p) => p?.type === "text" && typeof p.text === "string");
  const toolParts = parts.filter((p) => p?.type === "tool");

  const out: string[] = [];

  for (const p of textParts) out.push(p.text);

  for (const p of toolParts) {
    const tool = typeof p.tool === "string" ? p.tool : "tool";
    const state = p.state;
    if (state?.status === "completed") {
      const title = typeof state.title === "string" ? state.title : tool;
      const output = typeof state.output === "string" ? state.output : "";
      if (output) {
        out.push(`\n\n---\n\n**${title}**\n\n\`\`\`\n${output}\n\`\`\``);
      }
    }
  }

  return out.join("\n").trim();
}

const app = express();
app.use(express.json({ limit: "10mb" }));

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
    const model = typeof req.body?.model === "string" ? (req.body.model as string) : undefined;
    const agent = agentFromModel(model);
    const stream = Boolean(req.body?.stream);

    const rawMessages = Array.isArray(req.body?.messages) ? (req.body.messages as OpenAIMessage[]) : [];
    const system = extractSystem(rawMessages);
    const prompt = buildPrompt(rawMessages);

    const directory = workspaceDirectoryForRequest(req);
    ensureDirectoryExists(directory);

    const { id: sessionID } = await opencodeCreateSession(directory);
    const opencodeResult = await opencodePrompt(directory, sessionID, agent, prompt, system);

    const content = renderOpencodeParts(opencodeResult.parts);

    const created = Math.floor(Date.now() / 1000);
    const responseID = `chatcmpl_${sessionID}`;

    if (!stream) {
      res.json({
        id: responseID,
        object: "chat.completion",
        created,
        model: model ?? `open-persona/${agent}`,
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

    const chunkEnvelope = (delta: Record<string, unknown>, finish_reason: string | null) => ({
      id: responseID,
      object: "chat.completion.chunk",
      created,
      model: model ?? `open-persona/${agent}`,
      choices: [{ index: 0, delta, finish_reason }]
    });

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
  // eslint-disable-next-line no-console
  console.log(`open-persona-sidecar listening on :${PORT}`);
});
