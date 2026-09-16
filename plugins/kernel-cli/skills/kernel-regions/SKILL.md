---
name: kernel-regions
description: Use Kernel Regional Browsers when browser latency matters. Pick a region (us-east, eu-west, ap-southeast) at browser or pool creation to run the browser close to your automation code, the target site, or the human watching live view. Covers the region parameter, when to choose which region, what stays global, pairing with proxies, compliance caveats, and TypeScript, Python, and CLI snippets.
---

# Kernel Regional Browsers

Regional browsers let you choose where a Kernel browser runs. Region is set once at creation, on a browser or a browser pool, and cannot be changed afterward. It reduces round-trip latency between your code (or a human on live view) and the browser. It does not change the exit IP that websites see; that is what proxies are for.

## When to use this skill

Use this skill when you need to:

- Reduce Playwright/CDP or computer-action latency for code running outside the US
- Give a human in Europe or APAC a responsive live view (approvals, HITL, demos)
- Run several browsers in different regions in one project (price checks, localisation QA)
- Run a browser pool in a specific region
- Run managed auth (`kernel-auth`) logins and health checks in a specific region
- Decide whether region or a proxy solves a geo problem (usually you want both)

## Regions

| region | value | plan |
| --- | --- | --- |
| US East (default) | `us-east` | all plans |
| Europe West | `eu-west` | Start-Up, Enterprise |
| Asia Pacific Southeast | `ap-southeast` | Start-Up, Enterprise |

Omitting `region` gives `us-east`. Regional browsers cost the same as default browsers. Supported today: CPU browsers, browser pools, and managed auth. GPU browsers require `us-east`; Apps and Invocations are US-only for now.

## The `region` parameter

```typescript
import Kernel from "@onkernel/sdk";

const kernel = new Kernel();
const browser = await kernel.browsers.create({
  region: "eu-west",
  stealth: true,
  timeout_seconds: 300,
});
console.log(browser.region, browser.cdp_ws_url);
```

```python
from kernel import Kernel

kernel = Kernel()
browser = kernel.browsers.create(region="eu-west", stealth=True, timeout_seconds=300)
print(browser.region, browser.cdp_ws_url)
```

```bash
# Requires Kernel CLI v0.30.0 or later (`kernel --version`).
kernel browsers create --region eu-west --stealth -o json
kernel browsers list --region eu-west            # omit --region to list all regions
kernel browser-pools create apac-pool --size 5 --region ap-southeast   # pools take --region too
```

Connect with `cdp_ws_url` exactly as before. Existing Playwright or CDP code does not change, and live view connects to the selected region. The returned browser object includes its `region`; `get` and `delete` by ID need no region parameter.

Fan out across regions in one project; there is no account-wide region setting:

```typescript
const regions = ["us-east", "eu-west", "ap-southeast"] as const;
const browsers = await Promise.all(
  regions.map((region) => kernel.browsers.create({ region, timeout_seconds: 300 })),
);
try {
  // ... run the same task in each browser
} finally {
  await Promise.all(browsers.map((b) => kernel.browsers.deleteByID(b.session_id)));
}
```

## Regional browser pools

Every browser acquired from a pool runs in the pool's region. Region is not passed on acquire or release.

```typescript
const pool = await kernel.browserPools.create({ name: "checkout-sg", size: 5, region: "ap-southeast" });
```

```python
pool = kernel.browser_pools.create(name="checkout-sg", size=5, region="ap-southeast")
```

Pooled browsers cannot attach vaults; if a task needs `kernel-vault`, create the browser directly.

## Managed auth in a region

A managed auth connection stores a default browser region for its login, health checks, and auto-reauth. Override it for a single login with `--region` on `login`.

```bash
kernel auth connections create --domain example.com --profile-name example-main --region eu-west
kernel auth connections update "$CONNECTION_ID" --region ap-southeast
kernel auth connections login "$CONNECTION_ID" --region us-east   # this login only
```

The MCP server exposes this as `browser_region` on `manage_auth_connections`.

## List and filter by region

```typescript
const eu = await kernel.browsers.list({ region: "eu-west" });
```

```python
eu = kernel.browsers.list(region="eu-west")
```

Omit the filter to list across all regions. Browser pool lists accept the same filter.

## Choosing a region

Pick by where the latency-sensitive party sits, in this order:

1. **Human on live view** (HITL approvals, demos, manual login): the human's continent.
2. **Automation loop** (CDP, computer actions, screenshot-driven agents): where your controller code runs. Server-side `kernel.browsers.playwright.execute()` already runs next to the browser, so region matters less there than for a remote CDP loop.
3. **Target website**: only if the site is slow from far away. Page-load latency is usually smaller than a chatty CDP loop crossing an ocean.

Rules of thumb:

- Controller in Frankfurt driving Playwright over CDP: `eu-west`.
- Agent swarm on US infra hitting a Singapore storefront: `us-east` unless the site is the bottleneck; use an SG proxy for the storefront's geo logic.
- Operator in Sydney approving a checkout on live view: `ap-southeast` regardless of where the code runs.
- Price-check the same product from three markets: three browsers, one per region, each paired with a matching-country proxy so both latency and exit IP are local.

## Pairing with proxies

Region chooses where the browser runs. Proxy chooses the exit IP the website sees. They are independent and can be reused across regions. For a "local shopper" you want both aligned:

```typescript
const proxy = await kernel.proxies.create({ type: "residential", config: { country: "SG" }, name: "sg-residential" });
const browser = await kernel.browsers.create({
  region: "ap-southeast",
  proxy: { id: proxy.id },      // preferred over the deprecated proxy_id
  stealth: true,
});
```

```bash
PROXY_ID=$(kernel proxies create --type residential --country SG --name "SG Residential" -o json | jq -r '.id')
kernel browsers create --region ap-southeast --proxy-id "$PROXY_ID" --stealth -o json
```

Notes:

- A stealth browser without an explicit proxy uses Kernel's default stealth proxy, whose exit location is not tied to the browser's region. Set `proxy` explicitly when the site's geo behaviour matters.
- `proxy: { mode: "direct" }` forces direct egress from the region's own IP space. Fine for latency tests, weak for bot-sensitive sites.
- Mismatched region and proxy country (browser in `eu-west`, proxy in JP) works, but adds a hop and can look inconsistent to sites that compare timezone, language, and IP. Align them unless you have a reason not to.
- Attaching a proxy to a browser requires a paid plan; region selection requires Start-Up or Enterprise.

## What stays global

- **Profiles and extensions** are project-wide and work in any region.
- **Proxy configurations** are reusable across regions.
- **Vaults** are project-owned and attach to a browser in any region.
- **Concurrency and rate limits** are counted across all regions combined, including pool capacity. Three regional browsers use three concurrency slots.

## Latency and compliance notes

- Expect the biggest win on interaction-heavy loops (CDP round trips, computer-use screenshot cycles, live view). A single `page.goto` from the wrong region is usually tolerable.
- Regional browsers are a latency feature, not a data residency guarantee. Profiles, replays, telemetry, and session metadata are not confined to the browser's region and may be stored or processed in the US. Do not present `eu-west` as GDPR data residency without confirming with Kernel.
- Sites with adaptive pricing or currency detection key off the exit IP (proxy), not the region. When a purchase amount must be verified (see `kernel-vault`), verify and submit in the same browser session so region and proxy cannot change between the two.

## Gotchas

1. **Region is immutable.** Wrong region means delete and recreate; there is no update.
2. **Default is `us-east`**, silently. Set it explicitly in multi-region code so a missing value is a bug, not a fallback.
3. **Plan gating.** `eu-west` and `ap-southeast` return an error on Hobby plans; handle it rather than assuming success.
4. **GPU requires `us-east`.** `gpu: true` with another region fails.
5. **Pools are single-region.** One pool per region if you need several.
6. **Region does not change the IP.** Geo-blocked or geo-priced content needs a proxy.
7. **Limits are shared.** Fanning out across regions does not buy extra concurrency.

## Related skills

- `kernel-cli` (proxies, browser pools references), `kernel-auth` (connection `--region`), `kernel-vault` (checkout in a regional browser), `kernel-agent-browser`.

## Links

- Regional Browsers: https://www.kernel.sh/docs/browsers/regions
- Browser pools: https://www.kernel.sh/docs/browsers/pools
- Proxies overview: https://www.kernel.sh/docs/proxies/overview
- Managed auth configuration (browser region): https://www.kernel.sh/docs/auth/configuration#browser-region
- Pricing and concurrency limits: https://www.kernel.sh/docs/info/pricing
- Create a browser (API reference): https://www.kernel.sh/docs/api-reference/browsers/create-a-browser-session
