---
name: profile-website-bot-detection
description: Profile a website for bot detection vendors using stealth vs non-stealth Kernel browsers. Use when analyzing bot detection on a website, comparing stealth effectiveness, identifying anti-bot vendors and products, or detecting challenge types.
---

# Profile Website for Bot Detection Vendors

Analyzes a target website to identify bot detection vendors, their specific products, and challenge types. Supports comparative analysis between stealth and non-stealth browser modes.

## Prerequisites

- Kernel CLI installed and authenticated
- Node.js 22+ installed
- `jq` installed (`brew install jq` or `apt install jq`)
- `KERNEL_API_KEY` environment variable set. If it is not set, prompt the user to supply.

## Comparative Workflow (Recommended)

Compare bot detection behavior between stealth and non-stealth browsers to evaluate stealth effectiveness.

### Step 1: Create Both Browser Types

```bash
# Create stealth browser (with -s flag)
kernel browsers create -s --viewport 1920x1080@25 -t 300
# Save session_id as STEALTH_ID

# Create non-stealth headful browser (no -s flag)
kernel browsers create --viewport 1920x1080@25 -t 300
# Save session_id as NORMAL_ID
```

### Step 2: Run Analysis on Both Browsers

```bash
cd scripts
npm install  # first run only

# Test with stealth browser
KERNEL_API_KEY=$KERNEL_API_KEY KERNEL_BROWSER_ID=$STEALTH_ID TARGET_URL=<url> BROWSER_MODE=stealth npm run analyze

# Test with non-stealth browser
KERNEL_API_KEY=$KERNEL_API_KEY KERNEL_BROWSER_ID=$NORMAL_ID TARGET_URL=<url> BROWSER_MODE=normal npm run analyze
```

### Step 3: Compare Results

Compare the vendor detections and blocking behavior:

```bash
# Set the hostname folder (e.g., chase-com for chase.com)
HOST=chase-com

# Quick verdict comparison
echo "=== STEALTH VERDICT ===" && cat output/$HOST/stealth/report-*.json | jq '.summary.verdict'
echo "=== NORMAL VERDICT ===" && cat output/$HOST/normal/report-*.json | jq '.summary.verdict'

# Compare block status
echo "=== STEALTH BLOCKED ===" && cat output/$HOST/stealth/report-*.json | jq '.summary | {isBlocked, blockedPages, blockedVendors}'
echo "=== NORMAL BLOCKED ===" && cat output/$HOST/normal/report-*.json | jq '.summary | {isBlocked, blockedPages, blockedVendors}'

# Compare detected vendors
echo "=== STEALTH VENDORS ===" && cat output/$HOST/stealth/report-*.json | jq '.summary.vendorNames'
echo "=== NORMAL VENDORS ===" && cat output/$HOST/normal/report-*.json | jq '.summary.vendorNames'
```

### Step 4: Interpret Comparison

| Scenario | Stealth | Normal | Meaning |
|----------|---------|--------|---------|
| No vendors detected | 0 | 0 | Site has no bot detection |
| Same vendors, no blocks | N | N | Bot detection present, both pass |
| Normal blocked, stealth passes | 0 blocks | Blocked | Stealth mode is effective |
| Both blocked | Blocked | Blocked | Bot detection defeats stealth |
| Different challenge types | Lighter | Harder | Stealth reduces suspicion |

### Step 5: Provide Summary

After running the comparative analysis, provide a detailed summary report to the user that includes:

**Summary Report Template:**

```
## Bot Detection Comparative Analysis: [TARGET_URL]

### Verdict
- **Stealth Browser**: [verdict from summary.verdict]
- **Normal Browser**: [verdict from summary.verdict]
- **Stealth Effectiveness**: [Effective/Ineffective/Inconclusive]

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

### Step 6: Cleanup

```bash
kernel browsers delete -y $STEALTH_ID
kernel browsers delete -y $NORMAL_ID
```

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

## Example: Comparative Session

```bash
# Create both browsers
STEALTH_ID=$(kernel browsers create -s --viewport 1920x1080@25 -t 300 -o json | jq -r '.session_id')
NORMAL_ID=$(kernel browsers create --viewport 1920x1080@25 -t 300 -o json | jq -r '.session_id')

echo "Stealth: $STEALTH_ID"
echo "Normal: $NORMAL_ID"

# Run analysis on both
cd scripts
KERNEL_API_KEY=$KERNEL_API_KEY KERNEL_BROWSER_ID=$STEALTH_ID TARGET_URL=chase.com BROWSER_MODE=stealth npm run analyze
KERNEL_API_KEY=$KERNEL_API_KEY KERNEL_BROWSER_ID=$NORMAL_ID TARGET_URL=chase.com BROWSER_MODE=normal npm run analyze

# Output structure:
# ./output/chase-com/stealth/report-*.json
# ./output/chase-com/stealth/screenshot-*.png
# ./output/chase-com/normal/report-*.json
# ./output/chase-com/normal/screenshot-*.png

# Quick comparison - check verdicts
echo "--- Stealth verdict ---"
cat output/chase-com/stealth/report-*.json | jq '.summary.verdict'

echo "--- Normal verdict ---"
cat output/chase-com/normal/report-*.json | jq '.summary.verdict'

# Detailed vendor comparison
echo "--- Stealth vendors ---"
cat output/chase-com/stealth/report-*.json | jq '.summary.vendorNames'

echo "--- Normal vendors ---"
cat output/chase-com/normal/report-*.json | jq '.summary.vendorNames'

# Cleanup
kernel browsers delete -y $STEALTH_ID
kernel browsers delete -y $NORMAL_ID
```

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
