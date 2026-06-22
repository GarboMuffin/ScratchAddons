export default async function ({ addon, console }) {
  // Scratch's project comment API. Comments are public, so reading them needs no
  // login. We merge new ones into scratch-www's own Redux store, which means
  // React re-renders them as fully functional comments (reply/delete/report) and
  // other comment addons (op-badge, ctrl-enter-post, …) keep working.
  const REPLY_FETCH_LIMIT = 25; // matches scratch-www's own limit

  const topLevelUrl = (author, projectId) =>
    `https://api.scratch.mit.edu/users/${author}/projects/${projectId}/comments?offset=0&limit=20`;
  const repliesUrl = (author, projectId, commentId) =>
    `https://api.scratch.mit.edu/users/${author}/projects/${projectId}/comments/${commentId}/replies?offset=0&limit=${REPLY_FETCH_LIMIT}`;

  addon.tab.redux.initialize();

  const getIntervalMs = () => Math.max(10, Number(addon.settings.get("interval")) || 30) * 1000;

  let timer = null;
  let busy = false;

  const getContext = () => {
    const state = addon.tab.redux.state;
    if (!state || !state.scratchGui || !state.comments) return null;
    // Only the project player page has a comment section.
    if (!state.scratchGui.mode.isPlayerOnly) return null;
    // Wait until the comments have actually been fetched (user scrolled to them).
    if (state.comments.status.comments !== "FETCHED") return null;
    const info = state.preview && state.preview.projectInfo;
    if (!info || !info.author || !info.author.username || !info.id) return null;
    return { author: info.author.username, projectId: info.id };
  };

  const addNewTopLevelComments = async ({ author, projectId }) => {
    const res = await fetch(topLevelUrl(author, projectId));
    if (!res.ok) return;
    const items = await res.json(); // newest first
    if (!Array.isArray(items)) return;
    const known = new Set(addon.tab.redux.state.comments.comments.map((c) => c.id));
    const fresh = items.filter((c) => !known.has(c.id));
    if (!fresh.length) return;
    // Dispatch oldest-first so the newest comment ends up at the very top, exactly
    // like scratch-www does when you post a comment yourself.
    for (const comment of fresh.reverse()) {
      addon.tab.redux.dispatch({ type: "ADD_NEW_COMMENT", comment, topLevelCommentId: null });
    }
    console.log(`Added ${fresh.length} new comment${fresh.length === 1 ? "" : "s"}`);
  };

  const addNewReplies = async ({ author, projectId }) => {
    if (!addon.settings.get("replies")) return;
    const state = addon.tab.redux.state;
    for (const top of state.comments.comments) {
      const loaded = state.comments.replies[top.id];
      // Only refresh threads the user has actually opened (replies loaded), and
      // only when the project says there are more replies than we're showing.
      if (!Array.isArray(loaded)) continue;
      if (typeof top.reply_count === "number" && top.reply_count <= loaded.length) continue;
      try {
        const res = await fetch(repliesUrl(author, projectId, top.id));
        if (!res.ok) continue;
        const replies = await res.json();
        if (!Array.isArray(replies) || !replies.length) continue;
        const have = new Set(loaded.map((r) => r.id));
        if (replies.every((r) => have.has(r.id))) continue;
        // SET_REPLIES merges + de-dupes by id, so passing the full list is safe.
        addon.tab.redux.dispatch({ type: "SET_REPLIES", replies: { [top.id]: replies } });
      } catch (err) {
        console.warn("Failed to refresh replies", err);
      }
    }
  };

  const poll = async () => {
    if (addon.self.disabled || busy) return;
    const context = getContext();
    if (!context) return;
    busy = true;
    try {
      await addNewTopLevelComments(context);
      await addNewReplies(context);
    } catch (err) {
      console.warn("Live comment refresh failed", err);
    } finally {
      busy = false;
    }
  };

  const start = () => {
    stop();
    timer = setInterval(poll, getIntervalMs());
  };
  const stop = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };

  addon.settings.addEventListener("change", start); // re-arm with the new interval
  addon.self.addEventListener("disabled", stop);
  addon.self.addEventListener("reenabled", start);

  start();
}
