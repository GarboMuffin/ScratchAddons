// Minimal zero-dependency Chrome DevTools Protocol driver.
// Requires Node 18+ (uses global fetch + WebSocket; Node 24 confirmed working).
// Assumes Chromium is listening on --remote-debugging-port=9222 (override via SA_TEST_PORT).
const PORT = process.env.SA_TEST_PORT || "9222";
const BASE = `http://localhost:${PORT}`;

export async function listTargets() {
  const r = await fetch(`${BASE}/json/list`);
  return r.json();
}

export async function browserWs() {
  const r = await fetch(`${BASE}/json/version`);
  return (await r.json()).webSocketDebuggerUrl;
}

// Find the Scratch page (editor/player/embed). Returns the target object or undefined.
export async function scratchPage() {
  return (await listTargets()).find((t) => t.type === "page" && t.url.includes("scratch.mit.edu"));
}

// Find the Scratch Addons service worker. Returns undefined if it has idled out
// (MV3 workers stop when idle — re-list a moment later or poke the extension to wake it).
export async function serviceWorker() {
  return (await listTargets()).find((t) => t.type === "service_worker" && t.url.includes("/background/"));
}

export class Conn {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = [];
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id != null && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method) {
        for (const l of this.listeners) l(msg);
      }
    });
  }
  static async open(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => {
      ws.addEventListener("open", res, { once: true });
      ws.addEventListener("error", rej, { once: true });
    });
    return new Conn(ws);
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(payload));
    });
  }
  onEvent(fn) {
    this.listeners.push(fn);
  }
  close() {
    this.ws.close();
  }

  // Evaluate an expression in this target's (main-world) context.
  async eval(expression, { awaitPromise = true, returnByValue = true } = {}) {
    await this.send("Runtime.enable");
    const res = await this.send("Runtime.evaluate", { expression, awaitPromise, returnByValue });
    if (res.exceptionDetails) {
      throw new Error("EVAL: " + JSON.stringify(res.exceptionDetails.exception?.description || res.exceptionDetails.text));
    }
    return res.result.value;
  }

  // Navigate and resolve once the load event fires (or after timeoutMs).
  async navigate(url, timeoutMs = 30000) {
    await this.send("Page.enable");
    await this.send("Page.navigate", { url });
    await new Promise((resolve) => {
      const t = setTimeout(resolve, timeoutMs);
      this.onEvent((m) => m.method === "Page.loadEventFired" && (clearTimeout(t), resolve()));
    });
  }

  // Save a PNG screenshot. Pass clip = {x,y,width,height,scale} to crop/zoom.
  async screenshot(path, clip) {
    const params = { format: "png" };
    if (clip) params.clip = { scale: 2, ...clip };
    const s = await this.send("Page.captureScreenshot", params);
    const fs = await import("node:fs");
    fs.writeFileSync(path, Buffer.from(s.data, "base64"));
    return path;
  }
}

// Open a Conn directly to the first Scratch page target.
export async function openScratchPage() {
  const pt = await scratchPage();
  if (!pt) throw new Error("No scratch.mit.edu page target open");
  return Conn.open(pt.webSocketDebuggerUrl);
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
