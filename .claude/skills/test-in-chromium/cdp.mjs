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
  static async open(wsUrl, targetId) {
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => {
      ws.addEventListener("open", res, { once: true });
      ws.addEventListener("error", rej, { once: true });
    });
    const conn = new Conn(ws);
    conn.wsUrl = wsUrl;
    conn.targetId = targetId;
    return conn;
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

  // Actually CLOSE the browser tab (not just this WebSocket). Uses Target.closeTarget,
  // which force-closes past the editor's "unsaved changes" beforeunload prompt — so tabs
  // never pile up and never hang. Call this (not close()) when a test script is done with
  // a tab it opened. Safe to call even if the targetId is unknown (it's looked up).
  async closeTab() {
    let id = this.targetId;
    if (!id) {
      const t = (await listTargets()).find((x) => x.webSocketDebuggerUrl === this.wsUrl);
      id = t && t.id;
    }
    if (id) {
      const browser = await Conn.open(await browserWs());
      await browser.send("Target.closeTarget", { targetId: id }).catch(() => {});
      browser.close();
    }
    this.close();
  }

  // Evaluate an expression in this target's (main-world) context.
  async eval(expression, { awaitPromise = true, returnByValue = true } = {}) {
    await this.send("Runtime.enable");
    const res = await this.send("Runtime.evaluate", { expression, awaitPromise, returnByValue });
    if (res.exceptionDetails) {
      throw new Error(
        "EVAL: " + JSON.stringify(res.exceptionDetails.exception?.description || res.exceptionDetails.text)
      );
    }
    return res.result.value;
  }

  // Auto-accept any JS dialog (alert/confirm/beforeunload) so navigation/reload never hangs.
  // The Scratch editor installs a beforeunload "unsaved changes" prompt that otherwise
  // blocks Page.navigate/reload indefinitely. Safe to call multiple times.
  async autoAcceptDialogs() {
    await this.send("Page.enable");
    this.onEvent((m) => {
      if (m.method === "Page.javascriptDialogOpening") {
        this.send("Page.handleJavaScriptDialog", { accept: true }).catch(() => {});
      }
    });
  }

  // Navigate and resolve once the load event fires (or after timeoutMs).
  async navigate(url, timeoutMs = 30000) {
    await this.send("Page.enable");
    await this.autoAcceptDialogs();
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
  return Conn.open(pt.webSocketDebuggerUrl, pt.id);
}

// Cleanup helper: force-close every open Scratch tab (bypassing beforeunload).
// Call at the end of a test run so editor tabs don't accumulate across runs and
// waste resources. Returns the number of tabs closed.
export async function closeAllScratchTabs() {
  const browser = await Conn.open(await browserWs());
  let n = 0;
  for (const t of await listTargets()) {
    if (t.type === "page" && /scratch\.mit\.edu/.test(t.url)) {
      await browser.send("Target.closeTarget", { targetId: t.id }).catch(() => {});
      n++;
    }
  }
  browser.close();
  return n;
}

// Open a FRESH editor tab and (by default) force-close existing Scratch tabs.
//
// Prefer this over `page.navigate()` when you've just edited addon files: a brand-new tab
// loads the latest code from disk, and creating one never triggers the current editor tab's
// "unsaved changes" beforeunload prompt (which blocks navigate/reload). Old tabs are closed
// with Target.closeTarget, which force-closes without running beforeunload.
// Returns a Conn already wired with autoAcceptDialogs(); wait for the VM yourself.
export async function openFreshScratchTab(
  url = "https://scratch.mit.edu/projects/editor/",
  { closeOthers = true } = {}
) {
  const browser = await Conn.open(await browserWs());
  const { targetId } = await browser.send("Target.createTarget", { url });
  if (closeOthers) {
    for (const t of await listTargets()) {
      if (t.type === "page" && t.id !== targetId && t.url.includes("scratch.mit.edu")) {
        await browser.send("Target.closeTarget", { targetId: t.id }).catch(() => {});
      }
    }
  }
  browser.close();
  const pt = (await listTargets()).find((t) => t.id === targetId);
  if (!pt) throw new Error("Failed to open fresh Scratch tab");
  const conn = await Conn.open(pt.webSocketDebuggerUrl, targetId);
  await conn.autoAcceptDialogs();
  return conn;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
