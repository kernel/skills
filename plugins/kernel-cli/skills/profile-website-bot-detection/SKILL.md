---
name: profile-website-bot-detection
description: profile a website for bot detection vendors using stealth vs non-stealth KERNEL browsers. use when analyzing bot detection on a website, comparing stealth effectiveness, identifying anti-bot vendors and products, or detecting challenge types.
---

# profile website for bot detection vendors

analyzes a target website to identify bot detection vendors, their specific products, and challenge types. supports comparative analysis between stealth and non-stealth browser modes.

## prerequisites

- KERNEL cli installed and authenticated
- Bash, Node.js 22+, and `jq` installed
- `KERNEL_API_KEY` exported for the analysis script; never print it or ask the user to paste it into chat

## comparative workflow (recommended)

compare bot detection behavior between stealth and non-stealth browsers while controlling the network path. run steps 1-7 in the same Bash process so the cleanup trap remains armed. do not run step 2 as a standalone non-interactive shell: its EXIT trap will delete the sessions when that shell returns.

### step 1: prepare the analyzer

install dependencies before creating billable browser sessions:

```bash
cd scripts
npm install  # first run only
export TARGET_URL='https://example.com'
test -n "${KERNEL_API_KEY:-}" || { echo "KERNEL_API_KEY is not set" >&2; exit 1; }
```

### step 2: create both browser types and arm cleanup

use json output to capture exact session ids. the EXIT trap cleans up the first session if the second creation or a later analysis fails.

```bash
set -euo pipefail
STEALTH_ID=
NORMAL_ID=

cleanup() {
  local ids=()
  [[ -n "${STEALTH_ID:-}" ]] && ids+=("$STEALTH_ID")
  [[ -n "${NORMAL_ID:-}" ]] && ids+=("$NORMAL_ID")
  if ((${#ids[@]})); then
    kernel browsers delete "${ids[@]}" || true
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

STEALTH_ID=$(kernel browsers create --stealth --viewport 1920x1080@25 --timeout 300 --output json | jq -er '.session_id')
NORMAL_ID=$(kernel browsers create --viewport 1920x1080@25 --timeout 300 --output json | jq -er '.session_id')

# Isolate browser stealth behavior: route the stealth session directly, like the normal session.
kernel browsers update "$STEALTH_ID" --disable-default-proxy >/dev/null
```

a stealth session otherwise uses KERNEL's default stealth proxy, while a normal session connects directly. without the update, the result measures **stealth plus proxy** versus **normal plus direct**, not stealth alone. apply `--disable-default-proxy` only to the stealth session; the api rejects it for non-stealth sessions.

choose one network design before navigating:

- **browser-mode comparison (recommended):** keep the update above so both sessions connect directly.
- **platform-default comparison:** omit the update and report the stealth result as `stealth + default proxy`; do not attribute differences solely to stealth.
- **explicit-proxy comparison:** optionally validate a configured proxy with `kernel proxies check "$PROXY_ID" --url https://example.com --output json`, add `--proxy-id "$PROXY_ID"` to both create commands, and omit the update. this controls proxy configuration, though provider rotation can still produce different exit ips.

### step 3: run analysis on both browsers

```bash
KERNEL_BROWSER_ID="$STEALTH_ID" TARGET_URL="$TARGET_URL" BROWSER_MODE=stealth npm run analyze
KERNEL_BROWSER_ID="$NORMAL_ID" TARGET_URL="$TARGET_URL" BROWSER_MODE=normal npm run analyze
```

each analyzer run disconnects its local cdp client after writing the report; it leaves the KERNEL session active for comparison and cleanup.

### step 4: compare results

compare the newest report from each mode rather than concatenating multiple json documents:

```bash
# Derive the same hostname folder used by the analyzer (e.g., chase.com -> chase-com).
HOST=$(node -e 'const host = new URL(process.env.TARGET_URL).hostname; console.log(host.replace(/^www\./, "").replace(/\./g, "-"))')
latest_report() {
  local reports=("$1"/report-*.json)
  [[ -e "${reports[0]}" ]] || return 1
  printf '%s\n' "${reports[@]}" | sort | tail -n 1
}
STEALTH_REPORT=$(latest_report "output/$HOST/stealth")
NORMAL_REPORT=$(latest_report "output/$HOST/normal")

echo "=== STEALTH VERDICT ===" && jq '.summary.verdict' "$STEALTH_REPORT"
echo "=== NORMAL VERDICT ===" && jq '.summary.verdict' "$NORMAL_REPORT"

echo "=== STEALTH BLOCKED ===" && jq '.summary | {isBlocked, blockedPages, blockedVendors}' "$STEALTH_REPORT"
echo "=== NORMAL BLOCKED ===" && jq '.summary | {isBlocked, blockedPages, blockedVendors}' "$NORMAL_REPORT"

echo "=== STEALTH VENDORS ===" && jq '.summary.vendorNames' "$STEALTH_REPORT"
echo "=== NORMAL VENDORS ===" && jq '.summary.vendorNames' "$NORMAL_REPORT"
```

### step 5: interpret comparison

| scenario | stealth | normal | meaning |
|----------|---------|--------|---------|
| no vendors detected | 0 | 0 | no signals observed; do not assume the site has no bot detection |
| same vendors, no blocks | N | N | bot detection present, both pass |
| normal blocked, stealth passes | 0 blocks | blocked | with a controlled network, stealth is effective |
| both blocked | blocked | blocked | both tested configurations are blocked |
| different challenge types | lighter | harder | with a controlled network, stealth likely reduces suspicion |

### step 6: provide summary

after running the comparative analysis, state the network design explicitly. claim stealth effectiveness only when both sessions used the same network class.

**summary report template:**

```
## Bot Detection Comparative Analysis: [TARGET_URL]

### Verdict
- **Network Design**: [both direct / same explicit proxy config / platform defaults]
- **Stealth Browser**: [verdict from summary.verdict]
- **Normal Browser**: [verdict from summary.verdict]
- **Stealth Effectiveness**: [Effective/Ineffective/Inconclusive; use Inconclusive for mixed network paths]

### Block Status
| Browser | Blocked | Block Type | Evidence |
|---------|---------|------------|----------|
| Stealth | [Yes/No] | [blockType or N/A] | [first evidence item] |
| Normal  | [Yes/No] | [blockType or N/A] | [first evidence item] |

### Detected Vendors
| Vendor | Stealth | Normal | Products |
|--------|---------|--------|----------|
| [vendor] | ✓/✗ | ✓/✗ | [product list] |

### Analysis
- [Explain what the results mean]
- [Note any differences between stealth and normal]
- [Recommend next steps if blocked]

### Key Findings
1. [Finding 1]
2. [Finding 2]
3. [Finding 3]
```

use the json reports to populate this template:
- `summary.verdict` - the final verdict string
- `summary.isBlocked` - whether the browser was blocked
- `summary.blockedPages` - details about blocked pages
- `summary.vendorNames` - list of detected vendors
- `vendorDetections` - detailed vendor/product information

### step 7: cleanup

delete both sessions immediately after collecting reports. `browsers delete` is non-interactive and accepts multiple ids; it has no `-y` flag.

```bash
cleanup
trap - EXIT INT TERM
```

if the shell was interrupted or the variables were lost, use `kernel browsers list` to find the created sessions and delete each with `kernel browsers delete <session-id>`.

---

## interpreting results

the analysis detects vendors and their specific products:

| vendor | products detected |
|--------|-------------------|
| **Akamai** | Bot Manager, Bot Manager Premier, mPulse RUM, Sensor Script, Edge DNS |
| **Cloudflare** | Bot Management, Turnstile, Challenge Platform, JS Challenge, Managed Challenge |
| **DataDome** | Interstitial Challenge, Slider Challenge, Device Check, Picasso Fingerprint |
| **HUMAN/PerimeterX** | Bot Defender, Sensor SDK, Press & Hold Challenge |
| **Imperva/Incapsula** | Advanced Bot Protection (utmvc), Advanced Bot Protection (reese84), waf |
| **Kasada** | IPS (Initial Page Security), FP (Fingerprint Endpoint), telemetry, POW Challenge |
| **Google** | reCAPTCHA v2, reCAPTCHA v3, reCAPTCHA Enterprise |
| **hCaptcha** | widget, enterprise |
| **FingerprintJS** | Fingerprint Pro, BotD |
| **Arkose Labs** | FunCaptcha |

detection methods:
- url pattern matching for vendor scripts and endpoints
- cookie analysis (e.g., `_abck`, `__cf_bm`, `datadome`, `_px*`)
- header detection (e.g., `cf-ray`, `x-kpsdk-*`, `x-d-token`)
- challenge detection from response status codes

vendor-specific checks:
- **DataDome**: hard ip block detection (`dd.t === 'bv'`)
- **Akamai**: cookie validity check (`~0~` indicator)
- **Kasada**: flow type detection (IPS vs FP)

### pages analyzed

the script automatically analyzes:
1. **homepage** - initial page load and bot detection scripts
2. **login page** - automatically discovered via link detection or common paths (`/login`, `/signin`, etc.)

login pages often have more aggressive bot detection due to credential stuffing prevention.

### output files

results are organized by target hostname in `scripts/output/<hostname>/<mode>/`:
- `report-<timestamp>.json` - full json report with vendor detections
- `screenshot-homepage-<timestamp>.png` - homepage screenshot
- `screenshot-login-<timestamp>.png` - login page screenshot (if found)

example structure for comparative test on chase.com:
```
output/chase-com/
├── stealth/
│   ├── report-*.json
│   ├── screenshot-homepage-*.png
│   └── screenshot-login-*.png
└── normal/
    ├── report-*.json
    ├── screenshot-homepage-*.png
    └── screenshot-login-*.png
```

the json report includes:
- `summary`: quick access to verdict, block status, and vendor names
  - `verdict`: human-readable result (e.g., "BLOCKED - homepage (Error Page)")
  - `isBlocked`: boolean - true if any page was blocked
  - `vendorNames`: array of detected vendor names
  - `blockedPages`: details of blocked pages with evidence
- `vendorDetections`: map of detected vendors with products, urls, cookies, headers
- `blockDetections`: detailed block analysis for each page
- `vendorScriptsDetected`: urls of detected vendor scripts (not saved to disk)
- `networkRequests/networkResponses`: all requests with vendor matching
- `cookies`: all cookies with vendor attribution

## vendor-specific detection notes

### Akamai
- cookies: `_abck` (core validation), `bm_sz`, `bm_sv`
- cookie `~0~` in `_abck` value = valid session

### Cloudflare
- cookies: `__cf_bm`, `cf_clearance`
- challenge: `/cdn-cgi/challenge-platform/`
- Turnstile: `challenges.cloudflare.com/turnstile`

### DataDome
- cookie: `datadome`
- `dd.t === 'bv'` = hard ip block (changing ip required, solving captcha won't help)

### HUMAN/PerimeterX
- cookies: `_px2`, `_px3`, `_pxhd`
- press & hold challenge requires behavioral simulation

### Imperva/Incapsula
- **utmvc**: script via `/_Incapsula_Resource`
- **reese84**: cookie or `x-d-token` header

### Kasada
- headers: `x-kpsdk-ct`, `x-kpsdk-cd`
- flow 1 (IPS): 429 on initial page load, must solve `ips.js` first
- flow 2 (FP): background `/fp` fingerprint requests
