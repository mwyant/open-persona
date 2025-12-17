import { randomUUID } from "node:crypto";

import express, { type Request, type Response } from "express";
import * as z from "zod/v4";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

const MCP_PORT = Number(process.env.MCP_PORT ?? "7000");

function getServer() {
  const server = new McpServer(
    {
      name: "instrumentl-mcp",
      version: "0.2.0",
      websiteUrl: "https://www.instrumentl.com/"
    },
    {
      capabilities: {
        logging: {}
      }
    }
  );

  server.registerTool(
    "search_grants",
    {
      title: "Search grants",
      description: "Search Instrumentl for grants matching criteria.",
      inputSchema: {
        criteria: z.string().describe("Search criteria (free text)."),
        limit: z.number().int().min(1).max(50).default(10).describe("Max results to return")
      }
    },
    async ({ criteria, limit }): Promise<CallToolResult> => {
      // Placeholder until API keys are available.
      // When wired to the real API, this will call https://www.instrumentl.com/api-docs endpoints.
      const results = Array.from({ length: Math.min(3, limit) }).map((_, i) => ({
        id: `mock-${i + 1}`,
        title: `Mock Grant Result ${i + 1}`,
        link: "https://www.instrumentl.com/",
        rationale: `Matched criteria: ${criteria}`
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ criteria, results }, null, 2)
          }
        ]
      };
    }
  );

  server.registerTool(
    "get_grant",
    {
      title: "Get grant",
      description: "Retrieve details for a specific Instrumentl grant by id.",
      inputSchema: {
        id: z.string().describe("Grant id")
      }
    },
    async ({ id }): Promise<CallToolResult> => {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                id,
                title: "Mock Grant Details",
                link: "https://www.instrumentl.com/",
                focus: ["environmental justice"],
                notes: "Placeholder response; wire to real Instrumentl API later."
              },
              null,
              2
            )
          }
        ]
      };
    }
  );

  return server;
}

const app = createMcpExpressApp();

const transports: Record<string, StreamableHTTPServerTransport> = {};

async function mcpPostHandler(req: Request, res: Response) {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  try {
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId];
      await transport.handleRequest(req, res, req.body);
      return;
    }

    // Initialization request (creates a new session)
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sid) => {
        transports[sid] = transport;
      }
    });

    transport.onclose = () => {
      const sid = transport.sessionId;
      if (sid) delete transports[sid];
    };

    const server = getServer();
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: err instanceof Error ? err.message : String(err) },
        id: null
      });
    }
  }
}

async function mcpGetHandler(req: Request, res: Response) {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }
  await transports[sessionId].handleRequest(req, res);
}

async function mcpDeleteHandler(req: Request, res: Response) {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }
  await transports[sessionId].handleRequest(req, res);
}

app.use(express.json({ limit: "2mb" }));
app.post("/mcp", mcpPostHandler);
app.get("/mcp", mcpGetHandler);
app.delete("/mcp", mcpDeleteHandler);

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

app.listen(MCP_PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`instrumentl-mcp listening on :${MCP_PORT}`);
});
