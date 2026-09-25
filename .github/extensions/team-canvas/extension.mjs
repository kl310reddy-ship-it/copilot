import { createServer } from "node:http";
import { writeFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { joinSession, createCanvas } from "@github/copilot-sdk/extension";

const servers = new Map();

function loadDefaultState(documentId = "default") {
    return {
        documentId,
        projectName: "Launch sprint",
        status: "On track",
        health: "92%",
        updates: [
            { id: "u1", title: "Ship planning", owner: "Design", text: "Finalize landing-page messaging for the release candidate." },
            { id: "u2", title: "QA signoff", owner: "Engineering", text: "Close the last browser compatibility checks before handoff." },
            { id: "u3", title: "Ops review", owner: "Platform", text: "Validate the release checklist and deployment bump strategy." },
        ],
    };
}

async function getStateFile(documentId) {
    const workspaceRoot = (await import("node:process")).cwd();
    const hostDir = path.join(workspaceRoot, ".copilot", "team-canvas");
    const stateFile = path.join(hostDir, `${documentId}.json`);
    await mkdir(hostDir, { recursive: true });
    return stateFile;
}

async function readCanvasState(documentId = "default") {
    const stateFile = await getStateFile(documentId);
    try {
        const raw = await readFile(stateFile, "utf8");
        return JSON.parse(raw);
    } catch {
        const initialState = loadDefaultState(documentId);
        await writeFile(stateFile, JSON.stringify(initialState, null, 2));
        return initialState;
    }
}

async function writeCanvasState(documentId, nextState) {
    const stateFile = await getStateFile(documentId);
    await writeFile(stateFile, JSON.stringify(nextState, null, 2));
}

function renderHtml({ documentId, projectName, status, health, updates, nextMilestone = "Release walkthrough" }) {
    const rows = updates
        .map(
            (update) => `
                <li class="card">
                    <div class="meta-row">
                        <span class="pill">${update.owner}</span>
                        <span class="small">${update.title}</span>
                    </div>
                    <p>${update.text}</p>
                </li>`,
        )
        .join("");

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Team canvas</title>
    <style>
      :root {
        --background-color-default: #0f172a;
        --background-color-muted: #111827;
        --border-color-default: rgba(148,163,184,0.28);
        --text-color-default: #f8fafc;
        --text-color-muted: #cbd5e1;
        --color-focus-outline: #60a5fa;
        --color-white: #ffffff;
      }

      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: var(--background-color-default, #0f172a);
        color: var(--text-color-default, #f8fafc);
        font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
        line-height: 1.5;
        padding: 24px;
      }
      .shell {
        max-width: 1100px;
        margin: 0 auto;
      }
      .topbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--border-color-default);
        margin-bottom: 20px;
      }
      h1 {
        margin: 0;
        font-size: 2rem;
      }
      .status {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: rgba(59,130,246,0.16);
        border: 1px solid rgba(59,130,246,0.35);
        color: #dbeafe;
        border-radius: 999px;
        padding: 6px 10px;
        font-size: 0.82rem;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 16px;
        margin: 22px 0;
      }
      .card {
        background: rgba(15, 23, 42, 0.78);
        border: 1px solid var(--border-color-default);
        border-radius: 16px;
        padding: 16px;
      }
      .muted { color: var(--text-color-muted); }
      .value {
        font-size: 2rem;
        margin: 12px 0 0;
        font-weight: 700;
      }
      .list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 12px;
      }
      .meta-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 8px;
      }
      .pill {
        background: rgba(45,212,191,0.14);
        color: #a7f3d0;
        border: 1px solid rgba(45,212,191,0.4);
        border-radius: 999px;
        font-size: 0.72rem;
        padding: 4px 8px;
      }
      .small { font-size: 0.8rem; color: var(--text-color-muted); }
      textarea, button {
        font: inherit;
      }
      form {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-top: 8px;
      }
      textarea {
        width: 100%;
        min-height: 116px;
        border-radius: 12px;
        background: rgba(15,23,42,0.9);
        color: var(--text-color-default);
        border: 1px solid var(--border-color-default);
        padding: 12px;
      }
      button {
        border: none;
        border-radius: 10px;
        background: linear-gradient(135deg, #3b82f6, #2563eb);
        color: var(--color-white);
        padding: 10px 14px;
        cursor: pointer;
        transition: transform 0.15s ease;
      }
      button:hover { transform: translateY(-1px); }
      button:focus-visible, textarea:focus-visible {
        outline: 2px solid var(--color-focus-outline);
        outline-offset: 2px;
      }
      .footer-note {
        margin-top: 20px;
        color: var(--text-color-muted);
        font-size: 0.8rem;
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="topbar">
        <div>
          <div class="small">${documentId}</div>
          <h1>${projectName}</h1>
        </div>
        <div class="status">${status}</div>
      </div>

      <div class="grid">
        <section class="card">
          <div class="small">Health</div>
          <div class="value">${health}</div>
        </section>
        <section class="card">
          <div class="small">Next milestone</div>
          <div class="value">${nextMilestone}</div>
        </section>
      </div>

      <section class="card">
        <h2>Key updates</h2>
        <ul class="list">${rows}</ul>
      </section>

      <section class="card" style="margin-top: 18px;">
        <h2>Share a quick update</h2>
        <form id="update-form">
          <textarea id="update-text" placeholder="What changed for the team?"></textarea>
          <button type="submit">Save update</button>
        </form>
      </section>

      <div class="footer-note">Canvas state is stored alongside this session workspace so the team can reopen it without losing context.</div>
    </div>

    <script>
      const form = document.getElementById('update-form');
      const textarea = document.getElementById('update-text');
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const text = textarea.value.trim();
        if (!text) return;
        const response = await fetch('/api/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });
        if (response.ok) {
          textarea.value = '';
          window.location.reload();
        }
      });
    </script>
  </body>
</html>`;
}

async function startServer(documentId, instanceId) {
    const server = createServer(async (req, res) => {
        const url = new URL(req.url, "http://127.0.0.1");

        if (url.pathname === "/api/update" && req.method === "POST") {
            const chunks = [];
            for await (const chunk of req) {
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }
            const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
            const nextState = await readCanvasState(documentId);
            const item = {
                id: `u${Date.now()}`,
                title: "Team update",
                owner: "You",
                text: body.text || "Shared a team update.",
            };
            nextState.updates = [item, ...nextState.updates].slice(0, 6);
            await writeCanvasState(documentId, nextState);
            res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ ok: true, item }));
            return;
        }

        if (url.pathname === "/api/state") {
            const liveState = await readCanvasState(documentId);
            res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
            res.end(JSON.stringify(liveState));
            return;
        }

        const liveState = await readCanvasState(documentId);
        const html = renderHtml({ ...liveState, documentId: liveState.documentId || documentId, instanceId });
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);
    });

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;

    return { server, url: `http://127.0.0.1:${port}/` };
}

const _session = await joinSession({
    canvases: [
        createCanvas({
            id: "team-canvas",
            displayName: "Team canvas",
            description: "A lightweight team planning board for sprint updates and milestones.",
            inputSchema: {
                type: "object",
                properties: {
                    documentId: {
                        type: "string",
                        description: "Stable identifier for the team board you want to reopen.",
                    },
                },
                additionalProperties: false,
            },
            actions: [
                {
                    name: "list_updates",
                    description: "Read the current team snapshot and recent updates.",
                    handler: async (ctx) => {
                        const documentId = ctx.input?.documentId || "default";
                        return await readCanvasState(documentId);
                    },
                },
                {
                    name: "add_update",
                    description: "Append a short team update to the shared canvas state.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            documentId: { type: "string" },
                            text: { type: "string", minLength: 1 },
                        },
                        required: ["text"],
                        additionalProperties: false,
                    },
                    handler: async (ctx) => {
                        const documentId = ctx.input?.documentId || "default";
                        const nextState = await readCanvasState(documentId);
                        const update = {
                            id: `u${Date.now()}`,
                            title: "Team update",
                            owner: "You",
                            text: String(ctx.input?.text || "Shared a quick update."),
                        };
                        nextState.updates = [update, ...nextState.updates].slice(0, 6);
                        await writeCanvasState(documentId, nextState);
                        return nextState;
                    },
                },
            ],
            open: async (ctx) => {
                const documentId = ctx.input?.documentId || "default";
                let entry = servers.get(`${documentId}:${ctx.instanceId}`);
                if (!entry) {
                    entry = await startServer(documentId, ctx.instanceId);
                    servers.set(`${documentId}:${ctx.instanceId}`, entry);
                }

                await readCanvasState(documentId);

                return {
                    title: "Team canvas",
                    status: `Board: ${documentId}`,
                    url: entry.url,
                };
            },
            onClose: async (ctx) => {
                const documentId = ctx.input?.documentId || "default";
                const key = `${documentId}:${ctx.instanceId}`;
                const entry = servers.get(key);
                if (entry) {
                    servers.delete(key);
                    await new Promise((resolve) => entry.server.close(() => resolve()));
                }
            },
        }),
    ],
});
