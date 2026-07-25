---
name: profile-website-bot-detection
description: Profile a website for bot detection vendors using stealth vs non-stealth Kernel browsers. Use when analyzing bot detection on a website, comparing stealth effectiveness, identifying anti-bot vendors and products, or detecting challenge types.
---

# Profile Website for Bot Detection Vendors

Analyzes a target website to identify bot detection vendors, their specific products, and challenge types. Supports comparative analysis between stealth and non-stealth browser modes.

## Prerequisites

- Kernel CLI installed and authenticated
- Bash, Node.js 22+, and `jq` installed
- `KERNEL_API_KEY` exported for the analysis script; never print it or ask the user to paste it into chat

## Comparative Workflow (Recommended)

Compare bot detection behavior between stealth and non-stealth browsers while controlling the network path. Run Steps 1-7 in the same Bash process so the cleanup trap remains armed. Do not run Step 2 as a standalone non-interactive shell: its EXIT trap will delete the sessions when that shell returns.

### Step 1: Prepare the Analyzer

Install dependencies before creating billable browser sessions:

```bash
cd scripts
npm install  # first run only
export TARGET_URL='https://example.com'
test -n "${KERNEL_API_KEY:-}" || { echo "KERNEL_API_KEY is not set" >&2; exit 1; }
```

### Step 2: Create Both Browser Types and Arm Cleanup

Use JSON output to capture exact session IDs. The EXIT trap cleans up the first session if the second creation or a later analysis fails.

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

A stealth session otherwise uses Kernel's default stealth proxy, while a normal session connects directly. Without the update, the result measures **stealth plus proxy** versus **normal plus direct**, not stealth alone. Apply `--disable-default-proxy` only to the stealth session; the API rejects it for non-stealth sessions.

Choose one network design before navigating:

- **Browser-mode comparison (recommended):** Keep the update above so both sessions connect directly.
- **Platform-default comparison:** Omit the update and report the stealth result as `stealth + default proxy`; do not attribute differences solely to stealth.
- **Explicit-proxy comparison:** Optionally validate a configured proxy with `kernel proxies check "$PROXY_ID" --url https://example.com --output json`, add `--proxy-id "$PROXY_ID"` to both create commands, and omit the update. This controls proxy configuration, though provider rotation can still produce different exit IPs.

### Step 3: Run Analysis on Both Browsers

```bash
KERNEL_BROWSER_ID="$STEALTH_ID" TARGET_URL="$TARGET_URL" BROWSER_MODE=stealth npm run analyze
KERNEL_BROWSER_ID="$NORMAL_ID" TARGET_URL="$TARGET_URL" BROWSER_MODE=normal npm run analyze
```

Each analyzer run disconnects its local CDP client after writing the report; it leaves the Kernel session active for comparison and cleanup.

### Step 4: Compare Results

Compare the newest report from each mode rather than concatenating multiple JSON documents:

```bash
# Set the hostname folder (e.g., chase-com for chase.com).
HOST=chase-com
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

### Step 5: Interpret Comparison

| Scenario | Stealth | Normal | Meaning |
|----------|---------|--------|---------|
| No vendors detected | 0 | 0 | No signals observed; do not assume the site has no bot detection |
| Same vendors, no blocks | N | N | Bot detection present, both pass |
| Normal blocked, stealth passes | 0 blocks | Blocked | With a controlled network, stealth is effective |
| Both blocked | Blocked | Blocked | Both tested configurations are blocked |
| Different challenge types | Lighter | Harder | With a controlled network, stealth likely reduces suspicion |

### Step 6: Provide Summary

After running the comparative analysis, state the network design explicitly. Claim stealth effectiveness only when both sessions used the same network class.

**Summary Report Template:**

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

Use the JSON reports to populate this template:
- `summary.verdict` - The final verdict string
- `summary.isBlocked` - Whether the browser was blocked
- `summary.blockedPages` - Details about blocked pages
- `summary.vendorNames` - List of detected vendors
- `vendorDetections` - Detailed vendor/product information

### Step 7: Cleanup

Delete both sessions immediately after collecting reports. `browsers delete` is non-interactive and accepts multiple IDs; it has no `-y` flag.

```bash
cleanup
trap - EXIT INT TERM
```

If the shell was interrupted or the variables were lost, use `kernel browsers list` to find the created sessions and delete each with `kernel browsers delete <session-id>`.

---

## Interpreting Results

The analysis detects vendors and their specific products:

| Vendor | Products Detected |
|--------|-------------------|
| **Akamai** | Bot Manager, Bot Manager Premier, mPulse RUM, Sensor Script, Edge DNS |
| **Cloudflare** | Bot Management, Turnstile, Challenge Platform, JS Challenge, Managed Challenge |
| **DataDome** | Interstitial Challenge, Slider Challenge, Device Check, Picasso Fingerprint |
| **HUMAN/PerimeterX** | Bot Defender, Sensor SDK, Press & Hold Challenge |
| **Imperva/Incapsula** | Advanced Bot Protection (utmvc), Advanced Bot Protection (reese84), WAF |
| **Kasada** | IPS (Initial Page Security), FP (Fingerprint Endpoint), Telemetry, POW Challenge |
| **Google** | reCAPTCHA v2, reCAPTCHA v3, reCAPTCHA Enterprise |
| **hCaptcha** | Widget, Enterprise |
| **FingerprintJS** | Fingerprint Pro, BotD |
| **Arkose Labs** | FunCaptcha |

Detection methods:
- URL pattern matching for vendor scripts and endpoints
- Cookie analysis (e.g., `_abck`, `__cf_bm`, `datadome`, `_px*`)
- Header detection (e.g., `cf-ray`, `x-kpsdk-*`, `x-d-token`)
- Challenge detection from response status codes

Vendor-specific checks:
- **DataDome**: Hard IP block detection (`dd.t === 'bv'`)
- **Akamai**: Cookie validity check (`~0~` indicator)
- **Kasada**: Flow type detection (IPS vs FP)

### Pages Analyzed

The script automatically analyzes:
1. **Homepage** - Initial page load and bot detection scripts
2. **Login page** - Automatically discovered via link detection or common paths (`/login`, `/signin`, etc.)

Login pages often have more aggressive bot detection due to credential stuffing prevention.

### Output Files

Results are organized by target hostname in `scripts/output/<hostname>/<mode>/`:
- `report-<timestamp>.json` - Full JSON report with vendor detections
- `screenshot-homepage-<timestamp>.png` - Homepage screenshot
- `screenshot-login-<timestamp>.png` - Login page screenshot (if found)

Example structure for comparative test on chase.com:
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

The JSON report includes:
- `summary`: Quick access to verdict, block status, and vendor names
  - `verdict`: Human-readable result (e.g., "BLOCKED - homepage (Error Page)")
  - `isBlocked`: Boolean - true if any page was blocked
  - `vendorNames`: Array of detected vendor names
  - `blockedPages`: Details of blocked pages with evidence
- `vendorDetections`: Map of detected vendors with products, URLs, cookies, headers
- `blockDetections`: Detailed block analysis for each page
- `vendorScriptsDetected`: URLs of detected vendor scripts (not saved to disk)
- `networkRequests/networkResponses`: All requests with vendor matching
- `cookies`: All cookies with vendor attribution

## Vendor-Specific Detection Notes

### Akamai
- Cookies: `_abck` (core validation), `bm_sz`, `bm_sv`
- Cookie `~0~` in `_abck` value = valid session

### Cloudflare
- Cookies: `__cf_bm`, `cf_clearance`
- Challenge: `/cdn-cgi/challenge-platform/`
- Turnstile: `challenges.cloudflare.com/turnstile`

### DataDome
- Cookie: `datadome`
- `dd.t === 'bv'` = hard IP block (changing IP required, solving captcha won't help)

### HUMAN/PerimeterX
- Cookies: `_px2`, `_px3`, `_pxhd`
- Press & Hold challenge requires behavioral simulation

### Imperva/Incapsula
- **utmvc**: Script via `/_Incapsula_Resource`
- **reese84**: Cookie or `x-d-token` header

### Kasada
- Headers: `x-kpsdk-ct`, `x-kpsdk-cd`
- Flow 1 (IPS): 429 on initial page load, must solve `ips.js` first
- Flow 2 (FP): Background `/fp` fingerprint requests
