#!/usr/bin/env bash
# Launch Chromium with the Scratch Addons extension loaded for testing, working
# around the fresh-profile "developer mode is off" block that otherwise disables
# unpacked MV3 extensions (so no content scripts inject and nothing works).
#
# Always runs HEADFUL (visible on $DISPLAY): the real GPU matters for WebGL/rendering
# addons, and a human can watch. Don't add headless here.
#
# Usage:
#   ./launch.sh [repo_dir] [url]
# Env:
#   SA_TEST_PROFILE  user-data-dir (default /tmp/sa-test-profile)
#   SA_TEST_PORT     remote debugging port (default 9222)
#   SA_TEST_KEEP_PROFILE  set to 1 to keep the profile dir even when launching a
#                         fresh instance (default: wipe it on a fresh launch)
#   SA_TEST_FRESH    set to 1 to force a clean relaunch even if an instance is
#                    already running (kills it, wipes the profile, relaunches)
#   SA_TEST_WINDOW_SIZE   window size W,H (default 1920,1080 — 16:9)
#
# REUSE WITHIN A SESSION: if a Chromium is already running on $PORT, this script
# reuses it (profile kept, just opens $URL in a new tab) instead of wiping and
# relaunching — so repeated launches mid-session are cheap and don't lose state.
# It only starts FRESH (kill + wipe profile + relaunch) when nothing is running,
# which is the normal state at the start of a new, unrelated session because the
# previous session's cleanup (pkill, see SKILL.md) closed its Chromium. That's
# how the profile stays unshared across unrelated sessions while being reused
# within one. Force a clean slate anytime with SA_TEST_FRESH=1.
set -euo pipefail

REPO="${1:-$(git -C "$(dirname "$0")" rev-parse --show-toplevel 2>/dev/null || pwd)}"
URL="${2:-https://scratch.mit.edu/projects/editor/}"
PROFILE="${SA_TEST_PROFILE:-/tmp/sa-test-profile}"
PORT="${SA_TEST_PORT:-9222}"
WINDOW_SIZE="${SA_TEST_WINDOW_SIZE:-1920,1080}"
LOG="/tmp/sa-test-chromium.log"

CHROME="$(command -v chromium || command -v chromium-browser || command -v google-chrome || true)"
[ -z "$CHROME" ] && { echo "No chromium/chrome binary found"; exit 1; }
[ -f "$REPO/manifest.json" ] || { echo "No manifest.json in $REPO — is that the extension root?"; exit 1; }

common_args=(
  --remote-debugging-port="$PORT"
  --user-data-dir="$PROFILE"
  --load-extension="$REPO"
  --disable-extensions-except="$REPO"
  --no-first-run --no-default-browser-check
  --window-position=0,0
  --window-size="$WINDOW_SIZE"
)

launch() { DISPLAY="${DISPLAY:-:0}" nohup "$CHROME" "${common_args[@]}" "$@" >"$LOG" 2>&1 & echo $!; }

kill_profile() { pkill -f "user-data-dir=$PROFILE" 2>/dev/null || true; sleep 2; }

cdp_up() { curl -s --max-time 2 "http://localhost:$PORT/json/version" >/dev/null 2>&1; }

print_targets() {
  echo "Targets:"
  curl -s --max-time 5 "http://localhost:$PORT/json/list" \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{for(const x of JSON.parse(s))console.log(" ",x.type,"|",(x.url||"").slice(0,80))})'
  echo
  echo "Enable the addon you're testing via the Scratch Addons settings UI:"
  echo "  chrome-extension://<EXTENSION_ID>/webpages/settings/index.html   (id from the service_worker target above)"
  echo "DevTools endpoint: http://localhost:$PORT  — drive it with cdp.mjs."
}

# Reuse a Chromium already running on this port (same session) instead of wiping
# the profile. Opening $URL in a NEW tab makes Chrome read the latest extension
# files from disk, so edits are picked up without a relaunch.
if [ "${SA_TEST_FRESH:-0}" != "1" ] && cdp_up; then
  echo "Reusing the Chromium already running on port $PORT (profile kept)."
  curl -s --max-time 5 -X PUT "http://localhost:$PORT/json/new?$URL" >/dev/null 2>&1 \
    || echo "(couldn't open a new tab automatically — open $URL via cdp.mjs)"
  sleep 2
  print_targets
  exit 0
fi

patched() {
  node -e 'const fs=require("fs");try{const j=JSON.parse(fs.readFileSync(process.argv[1]));process.exit(j.extensions?.ui?.developer_mode?0:1)}catch(e){process.exit(1)}' "$PROFILE/Default/Preferences" 2>/dev/null
}

# Nothing is running on the port (or SA_TEST_FRESH=1): start a fresh instance.
# Kill any leftover Chromium on this profile and, unless SA_TEST_KEEP_PROFILE=1,
# delete the profile so we begin from a clean slate.
kill_profile
if [ "${SA_TEST_KEEP_PROFILE:-0}" != "1" ]; then
  echo "Starting fresh: removing existing profile at $PROFILE…"
  rm -rf "$PROFILE"
fi

if ! patched; then
  echo "First run: materialising profile, then enabling developer mode…"
  pid=$(launch about:blank)
  for _ in $(seq 1 30); do sleep 1; [ -f "$PROFILE/Default/Preferences" ] && grep -q '"settings"' "$PROFILE/Default/Preferences" && break; done
  kill_profile
  node -e '
    const fs=require("fs"); const p=process.argv[1];
    const j=JSON.parse(fs.readFileSync(p,"utf8"));
    j.extensions=j.extensions||{}; j.extensions.ui=j.extensions.ui||{};
    j.extensions.ui.developer_mode=true;            // turn on Developer mode
    const DEV_BIT=16777216;                          // DISABLE_UNSUPPORTED_DEVELOPER_EXTENSION
    for(const [id,e] of Object.entries(j.extensions.settings||{})){
      if(Array.isArray(e.disable_reasons) && e.disable_reasons.includes(DEV_BIT)){
        e.disable_reasons=e.disable_reasons.filter(r=>r!==DEV_BIT);
        if(e.disable_reasons.length===0) e.state=1;   // ENABLED
        console.log("force-enabled extension", id);
      }
    }
    fs.writeFileSync(p, JSON.stringify(j));
    console.log("developer_mode=true written");
  ' "$PROFILE/Default/Preferences"
fi

echo "Launching Chromium (profile=$PROFILE port=$PORT, headful on ${DISPLAY:-:0})…"
launch --new-window "$URL" >/dev/null
sleep 5

print_targets
