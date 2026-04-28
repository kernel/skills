---
name: diff-profile-archives
description: Compare two Kernel profile archives to investigate behavioral differences. Use when an issue (e.g. login failure, captcha, broken automation, vendor mismatch) reproduces on one profile but not another, or when a "good" vs "bad" profile needs to be diffed. Takes two profile IDs/names plus an issue description, downloads both archives via the Kernel CLI, and surfaces differences in cookies, storage, preferences, extensions, and login state that could explain the issue.
---

# Diff Kernel Profile Archives

Compare the actual contents of two Kernel browser profiles to identify state differences that could explain a reported issue. The skill downloads both profile archives via the Kernel CLI, decompresses them, and produces a structured diff focused on the surfaces most likely to drive divergent behavior: cookies, local/session storage, preferences, extension state, login data, and history.

## Inputs

The user must provide:

1. **Profile A** — the "baseline" or "working" profile (ID or name)
2. **Profile B** — the "subject" or "broken" profile (ID or name)
3. **Issue description** — what's happening on B that isn't happening on A (e.g. "login flow on chase.com fails on profile B but works on A", "datadome challenge always fires on B but never on A", "saved credentials missing")

If any of these are missing, prompt for them before proceeding. The issue description is critical — it determines which surfaces of the profile to weight heavily in the diff.

## Prerequisites

- Kernel CLI installed and authenticated (`kernel auth status`)
- `KERNEL_API_KEY` set, or the user is logged in via `kernel auth login`
- `zstd`, `tar`, `sqlite3`, and `jq` available (install via `apt-get install -y zstd sqlite3 jq` if needed)
- ~500MB free disk space per profile (profiles can be large)

## Workflow

### Step 1: Set up workspace

```bash
WORKDIR=$(mktemp -d -t profile-diff-XXXXXX)
cd "$WORKDIR"
mkdir -p a b diff
echo "Workspace: $WORKDIR"
```

### Step 2: Download both archives

```bash
# Replace <A> and <B> with the profile IDs or names from the user
kernel profiles download <A> --pretty --to a/profile.zip
kernel profiles download <B> --pretty --to b/profile.zip
```

`--pretty` pretty-prints JSON files (e.g. `Preferences`) so they diff cleanly line-by-line. Always pass it.

### Step 3: Extract

The archive is **Zstandard-compressed TAR despite the `.zip` extension**. Standard unzip will fail.

```bash
for side in a b; do
  zstd -d "$side/profile.zip" -o "$side/profile.tar"
  tar -xf "$side/profile.tar" -C "$side"
  rm "$side/profile.tar"
done
```

After extraction each side typically contains a Chrome user-data-dir layout (e.g. `Default/` with `Cookies`, `Local Storage/`, `Preferences`, etc.). If the layout differs, run `find a -maxdepth 3 -type d` to orient yourself before continuing.

### Step 4: Triage by issue description

Pick the surfaces to compare based on what the user described. Don't compare everything — full Chrome profiles contain hundreds of files, most irrelevant. Use this routing:

| Issue keywords | Compare these first |
|---|---|
| login, signed in, session, "logged out" | Cookies, **Session Storage**, Login Data, Local Storage |
| SPA / single-page app login (any URL with `#/...` route) | **Session Storage first**, then Local Storage, then Cookies — SPAs commonly persist auth state in `sessionStorage` rather than cookies |
| captcha, datadome, cloudflare, akamai, challenge, blocked | Cookies (vendor-specific names), Local Storage, fingerprinting indicators in Preferences |
| extension, plugin, content script | `Extensions/`, `Local Extension Settings/`, `Extension State`, `Secure Preferences` |
| autofill, saved password, credential | Login Data, Login Data For Account, Web Data |
| settings, language, timezone, UA, viewport | Preferences, Secure Preferences |
| history, cache, "remembers" | History, Top Sites, Visited Links |
| storage, indexeddb, quota | Local Storage, Session Storage, IndexedDB, Service Worker |
| profile saved before post-login bootstrap finished (save-time race) | Session Storage (sentinel keys absent), Local Storage analytics events as a bootstrap-timing tracer (e.g. Mixpanel `User Login`, Segment `track`) |

When in doubt, start with **Cookies + Session Storage + Local Storage + Preferences** — they explain the majority of "works on A, fails on B" issues. For SPA-style sites that route via URL hash (`/#/...`), put **Session Storage first**: the in-tab auth often lives there, and cookies alone won't tell the story.

### Step 5: Run focused diffs

#### Cookies (SQLite)

> Modern Chrome (post-v80) encrypts cookie bodies into `encrypted_value` and leaves `value` empty. Always select `length(encrypted_value)` — `length(value)` will return `0` for every row and mask real differences.

```bash
for side in a b; do
  # Cookies live under Default/Cookies (or Default/Network/Cookies on newer Chrome)
  COOKIE_DB=$(find "$side" -name 'Cookies' -not -name '*-journal' | head -1)
  if [ -z "$COOKIE_DB" ]; then
    echo "(no Cookies DB)" > "diff/cookies-$side.txt"
    continue
  fi
  sqlite3 "$COOKIE_DB" \
    "SELECT host_key, name, length(encrypted_value), is_secure, is_httponly, samesite, expires_utc, source_scheme
     FROM cookies ORDER BY host_key, name;" \
    > "diff/cookies-$side.txt" 2>/dev/null || echo "(cookies query failed)" > "diff/cookies-$side.txt"
done
diff -u diff/cookies-a.txt diff/cookies-b.txt > diff/cookies.diff || true
```

For issue-relevant hosts only:

```bash
HOST=chase.com  # adapt to the issue
for side in a b; do
  sqlite3 "$(find $side -name Cookies -not -name '*-journal' | head -1)" \
    "SELECT host_key, name, length(encrypted_value), expires_utc, is_secure, is_httponly
     FROM cookies WHERE host_key LIKE '%$HOST%' ORDER BY host_key, name;" \
    > "diff/cookies-$HOST-$side.txt"
done
diff -u "diff/cookies-$HOST-a.txt" "diff/cookies-$HOST-b.txt" || true
```

Common bot-detection cookie names to flag if present in one and not the other: `_abck`, `bm_sz`, `bm_sv` (Akamai); `__cf_bm`, `cf_clearance` (Cloudflare); `datadome` (DataDome); `_px*`, `pxvid` (HUMAN/PerimeterX); `incap_ses_*`, `visid_incap_*`, `reese84` (Imperva).

#### Preferences (JSON)

```bash
for side in a b; do
  PREF=$(find "$side" -name 'Preferences' -not -path '*/Extension*' | head -1)
  if [ -z "$PREF" ]; then
    echo "(no Preferences)" > "diff/preferences-$side.json"
    continue
  fi
  # Already pretty-printed thanks to --pretty
  cp "$PREF" "diff/preferences-$side.json"
done
diff -u diff/preferences-a.json diff/preferences-b.json > diff/preferences.diff || true
```

Highlight any differences in: `intl.*` (locale, accept_languages), `profile.default_content_setting_values`, `webrtc.*`, `extensions.settings` (set of installed extensions), `dns_over_https.*`, `download.*`, `safebrowsing.*`.

#### Local Storage (LevelDB)

`ls -la` on `Local Storage/leveldb/` only tells you whether the dir exists. To actually inspect keys and values without writing a LevelDB reader, run `strings` on the `*.log` and `*.ldb` files — Chrome stores keys and most string values in plaintext inside leveldb, so `strings | grep` gets you 90% of the way for free.

```bash
for side in a b; do
  LS_DIR=$(find "$side" -type d -name 'Local Storage' -not -path '*/Extension*' | head -1)
  if [ -z "$LS_DIR" ]; then
    echo "(no Local Storage)" > "diff/localstorage-files-$side.txt"
    echo "(no Local Storage)" > "diff/localstorage-origins-$side.txt"
    echo "(no Local Storage)" > "diff/localstorage-signals-$side.txt"
    continue
  fi
  # File inventory
  ls -la "$LS_DIR/leveldb" > "diff/localstorage-files-$side.txt" 2>&1
  # All origins that have any data
  strings "$LS_DIR"/leveldb/*.{log,ldb} 2>/dev/null \
    | grep -oE 'META:https?://[^[:space:]]+|^_https?://[^[:space:]^]+' \
    | sort -u > "diff/localstorage-origins-$side.txt"
  # Key inventory per matching origin (adapt grep to the issue host)
  strings "$LS_DIR"/leveldb/*.{log,ldb} 2>/dev/null \
    | grep -aE '"event"|"User Login"|"track"|sessionGUID|authCookie|expirationDateTime|access_token|id_token|refresh_token' \
    | head -100 > "diff/localstorage-signals-$side.txt"
done
diff -u diff/localstorage-files-a.txt diff/localstorage-files-b.txt || true
diff -u diff/localstorage-origins-a.txt diff/localstorage-origins-b.txt || true
diff -u diff/localstorage-signals-a.txt diff/localstorage-signals-b.txt || true
```

**Analytics events as a bootstrap-timing tracer.** For SPA logins it's worth grepping the localStorage `*.log` for embedded analytics queues — Mixpanel writes JSON event blobs (`mp_<token>_mixpanel`) inline, Segment writes `_seg_uid`, GA writes `_ga`. The presence/absence of a `User Login`, `Authenticated`, or `Identify` event in the JSON tells you whether the SPA actually finished its post-login init **before the profile snapshot was taken**. Last event in the queue ≈ last point the SPA reached. If the broken profile's tail event is `View 2FA` and the working profile's tail event is `User Login`, the broken profile was saved mid-flight.

```bash
# Mixpanel example: pull the last few events from each side
for side in a b; do
  LS_DIR=$(find "$side" -type d -name 'Local Storage' -not -path '*/Extension*' | head -1)
  if [ -z "$LS_DIR" ]; then
    echo "(no Local Storage)" > "diff/mp-events-$side.txt"
    continue
  fi
  strings "$LS_DIR"/leveldb/*.log 2>/dev/null \
    | grep -oE '"event":"[^"]+"|"Last Login":"[^"]+"|"Timestamp":"[^"]+"' \
    | tail -20 > "diff/mp-events-$side.txt"
done
diff -u diff/mp-events-a.txt diff/mp-events-b.txt || true
```

For surgical deeper inspection, use a real LevelDB reader (e.g. `npx -y level-ls` or a small Node script with `level` package).

#### Session Storage (LevelDB)

For SPAs (sites that route via URL hash like `app.example.com/#/home`), the in-tab auth state typically lives in `sessionStorage` rather than cookies — keys like `authCookie`, `expirationDateTime`, `sessionGUID`, `access_token`, account/tenant GUIDs, etc. If the saved profile is missing these for the auth origin, the app boots, sees no session in `sessionStorage`, and bounces to login even though cookies are intact. **This is a common failure mode when a profile is snapshotted before the post-login SPA bootstrap finishes.**

Chrome serializes sessionStorage namespaces as `map-N-<key>` entries keyed off a per-tab namespace UUID (`namespace-<uuid>-<origin>`). The exact `N` varies by tab navigation history but Chrome restores the namespace→map binding on profile load, so different `map-N` numbers between profiles are fine — what matters is whether the keys exist at all for the origin in question.

```bash
for side in a b; do
  SS_DIR=$(find "$side" -type d -name 'Session Storage' -not -path '*/Extension*' | head -1)
  if [ -z "$SS_DIR" ]; then
    echo "(no Session Storage)" > "diff/sessionstorage-keys-$side.txt"
    echo "(no Session Storage)" > "diff/sessionstorage-namespaces-$side.txt"
    continue
  fi
  # Inventory all map-N-* keys (the actual session storage entries)
  strings "$SS_DIR"/*.{log,ldb} 2>/dev/null \
    | grep -oE 'map-[0-9]+-[A-Za-z._0-9]+' \
    | sort -u > "diff/sessionstorage-keys-$side.txt"
  # Origin → namespace UUID mappings (so you know which map-N belongs to which site)
  strings "$SS_DIR"/*.{log,ldb} 2>/dev/null \
    | grep -oE 'namespace-[a-f0-9-]+-https?://[^/[:space:]]+' \
    | sort -u > "diff/sessionstorage-namespaces-$side.txt"
done
diff -u diff/sessionstorage-keys-a.txt diff/sessionstorage-keys-b.txt || true
diff -u diff/sessionstorage-namespaces-a.txt diff/sessionstorage-namespaces-b.txt || true
```

Look for missing auth-shaped keys on the broken side: `authCookie`, `expirationDateTime`, `sessionGUID`, `userGuid*`, `userEmail`, `*_token`, `access_token`, `id_token`, anything that looks like an account/tenant/org GUID. If the working side has a cluster of these and the broken side has only the pre-login subset (e.g. just `__mplss_*` Mixpanel session keys and no auth keys), the snapshot was taken too early.

#### IndexedDB

```bash
for side in a b; do
  IDB_DIR=$(find "$side" -type d -name 'IndexedDB' -not -path '*/Extension*' | head -1)
  if [ -z "$IDB_DIR" ]; then
    echo "(no IndexedDB)" > "diff/idb-$side.txt"
    echo "(no IndexedDB)" > "diff/idb-sizes-$side.txt"
    continue
  fi
  # Per-origin database directories
  ls -la "$IDB_DIR" > "diff/idb-$side.txt" 2>&1
  # Sizes per origin (large delta = significant state delta)
  du -sk "$IDB_DIR"/* 2>/dev/null | sort -rn > "diff/idb-sizes-$side.txt"
  # Cheap content inventory via strings
  for db in "$IDB_DIR"/*.indexeddb.leveldb; do
    [ -d "$db" ] || continue
    origin=$(basename "$db" .indexeddb.leveldb)
    strings "$db"/*.{log,ldb} 2>/dev/null \
      | grep -aE '"name"|"id"|token|user|session|auth' \
      | head -40 > "diff/idb-$origin-$side.txt"
  done
done
diff -u diff/idb-a.txt diff/idb-b.txt || true
diff -u diff/idb-sizes-a.txt diff/idb-sizes-b.txt || true
```

Most sites use IndexedDB for caches and queued telemetry — but some auth flows (Firebase Auth, Clerk, certain SaaS apps) park session tokens here. Worth a glance whenever sessionStorage/localStorage don't explain the diff.

#### Extensions

```bash
for side in a b; do
  EXT_DIR=$(find "$side" -type d -name 'Extensions' -not -path '*/Local Extension*' | head -1)
  if [ -n "$EXT_DIR" ]; then
    ls "$EXT_DIR" > "diff/extensions-$side.txt"
  else
    echo "(no Extensions dir)" > "diff/extensions-$side.txt"
  fi
done
diff -u diff/extensions-a.txt diff/extensions-b.txt || true
```

Extension IDs are 32-char hashes. To map an ID to a name, read its `manifest.json` inside `Extensions/<id>/<version>/manifest.json`.

#### Login Data (SQLite)

```bash
for side in a b; do
  LOGIN_DB=$(find "$side" -name 'Login Data' -not -name '*-journal' | head -1)
  sqlite3 "$LOGIN_DB" \
    "SELECT origin_url, length(username_value) > 0 AS has_user, length(password_value) AS pw_len, date_created
     FROM logins ORDER BY origin_url;" \
    > "diff/logins-$side.txt" 2>/dev/null || echo "(no Login Data)" > "diff/logins-$side.txt"
done
diff -u diff/logins-a.txt diff/logins-b.txt || true
```

**Never print `password_value` or `username_value`** — only emit lengths/booleans. Saved credentials are sensitive even in a debugging context.

#### Top-level inventory (catch unexpected differences)

```bash
for side in a b; do
  (cd "$side" && find . -type f -printf '%P\n' | sort) > "diff/files-$side.txt"
done
diff -u diff/files-a.txt diff/files-b.txt > diff/files.diff || true
```

This catches surprises: a file present in one profile and missing in the other (e.g. `Service Worker/` data, `IndexedDB/` databases, `Trust Tokens`, etc.).

### Step 6: Synthesize findings

Tie each observed difference back to the issue description. Don't dump raw diffs at the user — interpret. Suspect any of these as likely root causes:

- **Auth cookie/session token present on A, missing/expired on B** → session not established or evicted.
- **Cookies match between A and B but `sessionStorage` auth keys (e.g. `authCookie`, `expirationDateTime`, `sessionGUID`, `*Guid*`, `access_token`) are missing on B** → snapshot was taken before the SPA finished its post-login bootstrap. Classic save-time race: URL flipped to the post-login route, profile got saved, SPA hadn't yet hydrated `sessionStorage`. On the next session the SPA boots, sees cookies but no in-tab session state, and bounces to login.
- **localStorage analytics event tail differs** (e.g. broken profile's last Mixpanel event is a mid-flow step like a 2FA prompt, working profile's last event is `User Login` / `Authenticated` / `Identify`) → confirms the snapshot timing is the issue, regardless of which storage layer holds the auth.
- **Bot-detection vendor cookie (`_abck`, `datadome`, `cf_clearance`) only on one side** → the "good" profile already cleared the challenge; the other will be re-challenged.
- **`intl.accept_languages` or `intl.selected_languages` differs** → server-side localization or geo heuristics will branch.
- **Extension installed on one side but not the other** → ad blocker, anti-fingerprint, or password manager altering page behavior.
- **`webrtc.ip_handling_policy` differs** → WebRTC IP leak posture changes, can flip fingerprints.
- **`safebrowsing` or `dns_over_https` differs** → request-path differences.
- **Login Data row present on A, absent on B** → autofill won't fire on B.
- **Local Storage origin has keys on A but not B** → site-managed session state (JWT in localStorage, feature flags, A/B bucket) won't apply.
- **IndexedDB database for an auth origin (Firebase, Clerk, etc.) is empty on B but populated on A** → SDK token cache absent; client will re-auth or fail.

### Step 7: Report

Use this template:

```
## Profile Diff: <A> vs <B>

### Issue
<one-line restatement of the user's issue description>

### Likely root causes (ranked)
1. **<finding>** — <evidence: which file, which keys/rows> — <why this could cause the issue>
2. **<finding>** — ...
3. **<finding>** — ...

### Other notable differences (probably unrelated)
- <finding>
- <finding>

### Surfaces that matched (for completeness)
- Cookies for <host>: identical
- Preferences `intl.*`: identical
- Extensions installed: identical
- ...

### Suggested next steps
- <e.g. "re-run the failing flow on profile A with a fresh CDP session and capture the request that sets `_abck` — that cookie is the differentiator">
- <e.g. "delete profile B's `Default/Network/Cookies` rows for chase.com and retry — if the flow now works, the stale cookie was the issue">
```

### Step 8: Cleanup

Profile archives can contain credentials. Always remove the workspace when done:

```bash
rm -rf "$WORKDIR"
```

If the user wants to keep the artifacts for further investigation, tell them the path and let them remove it themselves.

## Notes & gotchas

- **Archive format**: `.zip` extension is misleading — it's `zstd`-compressed TAR. Use `zstd -d` then `tar -xf`, not `unzip`.
- **`--pretty` is mandatory** for meaningful JSON diffs. Without it, `Preferences` is a single line and diffs are unreadable.
- **Chrome profile path varies**: most data lives under `Default/`, but newer Chrome moved cookies to `Default/Network/Cookies`. Use `find` instead of hardcoding paths.
- **SQLite locks**: profiles are downloaded as snapshots, so DBs aren't locked — but if a query errors with "database is locked", make sure you're querying the extracted copy, not a path inside an open archive.
- **Don't compare `Cache/`, `Code Cache/`, `GPUCache/`, `Service Worker/CacheStorage/`** — these are noise and will produce huge meaningless diffs.
- **`encrypted_value` vs `value`**: Chrome encrypts cookie bodies into `encrypted_value` post-v80. Always select `length(encrypted_value)` from the `cookies` table — `length(value)` returns `0` for every row on modern profiles.
- **`map-N` numbers in Session Storage are non-deterministic across profiles** — they're per-tab namespace IDs. Don't flag a difference like "auth keys are on `map-1-` in profile A and `map-5-` in profile B" as a problem. What matters is whether the keys exist at all for the `namespace-<uuid>-<origin>` you care about. Chrome restores the namespace→map binding when the profile is loaded.
- **Apex vs subdomain cookies/storage**: a site might set cookies on `.example.com` (covers all subdomains) but write `sessionStorage` on `app.example.com` only. Always check both `find $side -name Cookies` and the per-origin Local/Session Storage entries for both the apex and the relevant subdomain.
- **Privacy**: never echo cookie values, password fields, or `Login Data` user/password columns into the report. Use lengths, presence booleans, and host/name only.
