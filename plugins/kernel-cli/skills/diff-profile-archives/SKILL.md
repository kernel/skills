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
| login, signed in, session, "logged out" | Cookies, Login Data, Local Storage, Session Storage |
| captcha, datadome, cloudflare, akamai, challenge, blocked | Cookies (vendor-specific names), Local Storage, fingerprinting indicators in Preferences |
| extension, plugin, content script | `Extensions/`, `Local Extension Settings/`, `Extension State`, `Secure Preferences` |
| autofill, saved password, credential | Login Data, Login Data For Account, Web Data |
| settings, language, timezone, UA, viewport | Preferences, Secure Preferences |
| history, cache, "remembers" | History, Top Sites, Visited Links |
| storage, indexeddb, quota | Local Storage, Session Storage, IndexedDB, Service Worker |

When in doubt, start with **Cookies + Preferences + Local Storage** — they explain the majority of "works on A, fails on B" issues.

### Step 5: Run focused diffs

#### Cookies (SQLite)

```bash
for side in a b; do
  # Cookies live under Default/Cookies (or Default/Network/Cookies on newer Chrome)
  COOKIE_DB=$(find "$side" -name 'Cookies' -not -name '*-journal' | head -1)
  sqlite3 "$COOKIE_DB" \
    "SELECT host_key, name, length(value), is_secure, is_httponly, samesite, expires_utc
     FROM cookies ORDER BY host_key, name;" \
    > "diff/cookies-$side.txt"
done
diff -u diff/cookies-a.txt diff/cookies-b.txt > diff/cookies.diff || true
```

For issue-relevant hosts only:

```bash
HOST=chase.com  # adapt to the issue
for side in a b; do
  sqlite3 "$(find $side -name Cookies -not -name '*-journal' | head -1)" \
    "SELECT host_key, name, length(value), expires_utc, is_secure, is_httponly
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
  # Already pretty-printed thanks to --pretty
  cp "$PREF" "diff/preferences-$side.json"
done
diff -u diff/preferences-a.json diff/preferences-b.json > diff/preferences.diff || true
```

Highlight any differences in: `intl.*` (locale, accept_languages), `profile.default_content_setting_values`, `webrtc.*`, `extensions.settings` (set of installed extensions), `dns_over_https.*`, `download.*`, `safebrowsing.*`.

#### Local Storage (LevelDB)

```bash
for side in a b; do
  LS_DIR=$(find "$side" -type d -name 'Local Storage' | head -1)
  # Inventory keys per origin without touching binary values
  ls -la "$LS_DIR/leveldb" > "diff/localstorage-$side.txt" 2>&1
done
diff -u diff/localstorage-a.txt diff/localstorage-b.txt || true
```

For deeper inspection, use a LevelDB reader (e.g. `level` CLI or a small Node script) — but inventory diff is usually enough to spot "origin X has data on A but not B."

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
    "SELECT origin_url, username_value IS NOT NULL AS has_user, length(password_value) AS pw_len, date_created
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
- **Bot-detection vendor cookie (`_abck`, `datadome`, `cf_clearance`) only on one side** → the "good" profile already cleared the challenge; the other will be re-challenged.
- **`intl.accept_languages` or `intl.selected_languages` differs** → server-side localization or geo heuristics will branch.
- **Extension installed on one side but not the other** → ad blocker, anti-fingerprint, or password manager altering page behavior.
- **`webrtc.ip_handling_policy` differs** → WebRTC IP leak posture changes, can flip fingerprints.
- **`safebrowsing` or `dns_over_https` differs** → request-path differences.
- **Login Data row present on A, absent on B** → autofill won't fire on B.
- **Local Storage origin has keys on A but not B** → site-managed session state (JWT in localStorage, feature flags, A/B bucket) won't apply.

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
- **Privacy**: never echo cookie values, password fields, or `Login Data` user/password columns into the report. Use lengths, presence booleans, and host/name only.
