---
name: kernel-vault
description: Use Kernel Vault when a browser task needs a login credential or a payment card that the agent must not see. Create a per-user vault, store credential items and provider-backed wallet/card items, attach the vault at browser creation, hand values to the page with fill or payment aliases, and keep human collection and approval steps outside the agent. Covers the TypeScript SDK, Python SDK, and CLI.
metadata:
  {
    "openclaw":
      {
        "requires": { "bins": ["kernel"] },
      },
  }
---

# Kernel Vault

A vault groups typed items (`credential`, `wallet`, `card`) that an attached browser can use. Sensitive values are write-only through the API: the agent gets field names, selectors, and non-sensitive aliases, never the password, card number, or CVC. Vault is in preview; the item types and providers below are what is available today.

## When to use this skill

Use this skill when a browser task needs to:

- Log in with a username/password (or TOTP) the agent should never read or be told in chat
- Complete a web checkout with a payment card that never enters the agent, prompt, or logs
- Collect a secret from a human through a hosted form rather than the conversation
- Hand a card to an agent at checkout while a human approves the charge outside the browser

Do not use this skill for reusable authenticated sessions: that is `kernel-auth` (managed auth connections and profiles). Vault stores credentials; it does not store cookies or log in for you. Do not store card numbers in `credential` items; use `wallet` and `card` items.

## Concepts

| Term | Meaning |
| --- | --- |
| vault | Project-owned container with an immutable `name` (for example `user-12345`). Use one vault per end user or access boundary. |
| item | Typed resource with an immutable `key`: `credential`, `wallet`, or `card`. |
| credential | Named fields (`text`, `email`, `password`, `totp`). Populated by trusted backend code or a hosted collection form. |
| wallet | End user's payment method connected through a provider-hosted flow. Providers: `link` (Stripe Link) and `agentcard`. |
| card | A purchase-scoped payment item that references a wallet. Publishes non-sensitive `aliases` (`number`, `cvc`, `exp_month`, `exp_year`). |
| fill | Operation that writes real credential (or Link card) values into browser inputs by selector. Returns value-free outcomes. |
| alias | Format-valid stand-in card values. Kernel swaps them for the real card at egress, outside the browser VM, only when the browser, session, vault, and item bindings match. |
| action | A pending human step returned as `action` (for example `collect`, `link_oauth`, `card_enrollment`, `spend_approval`). Actions with a `url` are bearer links for the end user, never for the agent. |
| `available_operations` | What the item permits right now: `collect`, `authorize`, `prepare_checkout`, or `fill`. Only invoke what is advertised. |

Two handoff paths, with different exposure boundaries:

1. **fill**: real values are written into the page. An agent with unrestricted browser access, page scripts, or extensions can read them afterward. Fill is not secret isolation from the browser.
2. **payment aliases**: the browser only ever holds format-valid fakes. The real card stays outside the browser. This is the only path that keeps the value out of the VM.

## Prerequisites

- An SDK version that includes the `vaults` resource (`@onkernel/sdk` / `kernel` >= 0.104), or the Kernel CLI with `kernel vaults` commands.
- `KERNEL_API_KEY`, and project scope: `KERNEL_PROJECT_ID` on the client, or a project-scoped key. Vaults are project-owned; a browser and its attached vault must be in the same project.
- Vault limits are plan-dependent: `kernel org entitlements -o json` and check `limits.max_vaults` (`null` is unlimited).

Check access before doing anything else:

```bash
kernel vaults list --limit 1 -o json
kernel vaults credentials --help
```

## Create a vault

`upsert` creates the vault or returns the existing one with that name. Names accept 1-255 letters, numbers, `.`, `_`, `-`, and cannot look like an ID.

```typescript
import Kernel from "@onkernel/sdk";

const kernel = new Kernel({ projectID: process.env.KERNEL_PROJECT_ID, maxRetries: 0 });
const vault = await kernel.vaults.upsert({ name: "user-12345" });
```

```python
import os
from kernel import Kernel

kernel = Kernel(project_id=os.environ["KERNEL_PROJECT_ID"], max_retries=0)
vault = kernel.vaults.upsert(name="user-12345")
```

```bash
kernel vaults create --name user-12345
kernel vaults get user-12345 -o json
kernel vaults items list user-12345 -o json
```

Set `maxRetries: 0` / `max_retries=0` on clients that create payment items. Vault writes are not idempotent across retries in the way you want; reconcile an uncertain write before repeating it.

## Attach the vault to a browser

Attachment is fixed at creation and cannot be changed. Attaching grants the browser access to every item in the vault, including items created later. Up to 20 vaults per browser, each referenced by exactly one of `id` or `name`. Pooled browsers cannot attach vaults.

```typescript
const browser = await kernel.browsers.create({
  vaults: [{ id: vault.id }],
  headless: false,        // live view lets the end user watch checkout/approval
  timeout_seconds: 1800,
});
```

```python
browser = kernel.browsers.create(
    vaults=[{"id": vault.id}],
    headless=False,
    timeout_seconds=1800,
)
```

```bash
kernel browsers create --vault user-12345 -o json
```

Create the browser before you create items whose spec depends on what the browser sees (for example a checkout's presentment currency); the attachment covers later items.

## Store a credential

Define fields once; definitions (names, types, `required`, `sensitive`) are immutable. Passwords and TOTP must be `sensitive: true`. Set `sensitive: false` only on ordinary usernames or emails your backend needs to read back. `description` is the collection form's title (the site name), not a destination restriction.

### From trusted backend code (values known)

```typescript
const item = await kernel.vaults.items.upsert("portal-login", {
  id_or_name: vault.id,
  type: "credential",
  spec: {
    description: "Account Portal",
    fields: {
      username: { type: "email", required: true, sensitive: false, value: creds.username },
      password: { type: "password", required: true, sensitive: true, value: creds.password },
    },
  },
});
if (item.type !== "credential" || item.state.status !== "ready") throw new Error("credential not ready");
```

```python
item = kernel.vaults.items.upsert(
    "portal-login",
    id_or_name=vault.id,
    type="credential",
    spec={
        "description": "Account Portal",
        "fields": {
            "username": {"type": "email", "required": True, "sensitive": False, "value": creds["username"]},
            "password": {"type": "password", "required": True, "sensitive": True, "value": creds["password"]},
        },
    },
)
if item.type != "credential" or item.state.status != "ready":
    raise RuntimeError("credential not ready")
```

Values go in the request body from trusted code only: never in CLI arguments, prompts, logs, or traces. Repeating the same `upsert` returns the existing item without overwriting later edits. To rotate, use `kernel.vaults.items.update(key, { id_or_name, spec: { fields: { password: { value } } } })` with the item's current `version`.

### From a human (values unknown): collection form

Omit `value`. The item is `pending_collection` and returns `action.name === "collect"` with a hosted `action.url` (expires in 30 minutes).

```bash
kernel vaults credentials create user-12345 hn-login --spec-file - <<'JSON'
{
  "description": "Hacker News",
  "fields": {
    "username": {"type": "text", "required": true, "sensitive": false},
    "password": {"type": "password", "required": true, "sensitive": true}
  }
}
JSON
```

Present `action.url` to the intended user privately (in your app's authenticated UI, or as a mid-turn message in a private conversation). Do not open it in the agent-controlled browser, do not log it, and never ask the user to paste a password into chat. Then wait for readiness:

```bash
kernel vaults items get user-12345 hn-login --wait 60 -o json
```

`ready` means required values exist, not that login works. To reopen the form without clearing values, invoke the advertised `collect` operation.

## Fill a credential into the page

Only when the item advertises `fill`. Your request carries field names and CSS selectors; the response carries per-field outcomes, no values.

```typescript
const current = await kernel.vaults.items.retrieve("portal-login", { id_or_name: vault.id, wait: 60 });
if (current.state.status !== "ready" || !current.available_operations.some((o) => o.type === "fill")) {
  throw new Error("credential is not ready to fill");
}
const result = await kernel.vaults.items.performOperation("portal-login", {
  id_or_name: vault.id,
  type: "fill",
  browser_id: browser.session_id,
  page_url: "https://portal.example.com/login",   // exact current top-level URL
  fields: [
    { field: "username", selector: "#username" },
    { field: "password", selector: "#password" },
  ],
});
if (result.type !== "fill" || result.status !== "completed") {
  throw new Error("stop and reconcile the fill outcome");
}
```

```python
current = kernel.vaults.items.retrieve("portal-login", id_or_name=vault.id, wait=60)
if current.state.status != "ready" or not any(o.type == "fill" for o in current.available_operations):
    raise RuntimeError("credential is not ready to fill")
result = kernel.vaults.items.perform_operation(
    "portal-login",
    id_or_name=vault.id,
    type="fill",
    browser_id=browser.session_id,
    page_url="https://portal.example.com/login",
    fields=[
        {"field": "username", "selector": "#username"},
        {"field": "password", "selector": "#password"},
    ],
)
if result.type != "fill" or result.status != "completed":
    raise RuntimeError("stop and reconcile the fill outcome")
```

```bash
kernel vaults items invoke user-12345 portal-login fill --spec-file - <<JSON
{
  "browser_id": "$BROWSER_ID",
  "page_url": "https://portal.example.com/login",
  "fields": [
    {"field": "username", "selector": "#username"},
    {"field": "password", "selector": "#password"}
  ]
}
JSON
```

Rules that matter:

- `page_url` must match exactly one open top-level page (path, query, fragment). It is not a navigation. Credentials may omit it only when exactly one page is open; cards require an HTTPS URL.
- Each selector must resolve to exactly one editable input or select across the main frame and all descendant frames. Ambiguous or zero matches fail validation before anything is written.
- Fill writes in request order and stops on the first failure. It does not roll back, click, or submit. Submit the form yourself with Playwright, then verify.
- Outcomes: `completed`, `failed`, `unknown`, or a transport error. Inspect `result.fields[i].status` and `error_code`. Do not auto-retry after `failed`, `unknown`, or a lost response; a retry can overwrite edits or mint a second TOTP code.
- A `totp` field writes a fresh 6-digit code; the seed never reaches the browser.

## Payments: hand a card to the agent at checkout

Both providers end with a `card` item whose `state.status` is `ready` and whose `state.aliases` holds `number`, `cvc`, `exp_month`, `exp_year`. Only the aliases go to the agent. Kernel resolves them at egress when the browser's outgoing request matches a native processor adapter (Stripe, Shopify, Square, Recurly, Razorpay request formats today). Unrecognized processors pass through without handoff, so use a checkout you control while validating.

| | Link by Stripe (`link`) | AgentCard (`agentcard`) |
| --- | --- | --- |
| card source | provider-minted one-use card per purchase | user's enrolled card, reusable item |
| approval | before checkout, via `authorize` + hosted action | after the browser submits, while the request is held |
| reuse | consumed after first handoff; new item per purchase | returns to `ready`; `update` spec for the next purchase |
| mode | live only | set by the credential (sandbox or live) |

### 1. Connect a wallet (once per user, per provider; outside the agent)

Enforce at most one wallet per provider per vault in your own code; the API only makes item keys unique. List items first and reuse a `connected` wallet.

```typescript
let wallet = await kernel.vaults.items.upsert("agentcard-wallet", {
  id_or_name: vault.id,
  type: "wallet",
  spec: { provider: "agentcard" },       // omit provider_config for Kernel-managed credentials
});
if (wallet.action?.name === "card_enrollment") {
  await presentProviderAction({ userID, vaultID: vault.id, item: wallet }); // your trusted UI
}
wallet = await kernel.vaults.items.retrieve(wallet.key, { id_or_name: vault.id, wait: 60 });
if (wallet.state.status !== "connected") throw new Error(`wallet is ${wallet.state.status}`);
```

```bash
kernel vaults wallets create user-12345 agentcard-wallet --provider agentcard --spec '{}' --open
kernel vaults items get user-12345 agentcard-wallet --wait 60
```

For Link with Kernel-managed OAuth: `spec: { provider: "link", authorization: { method: "oauth", client: { type: "kernel_managed" } } }`; the returned `link_oauth` action is the hosted connect flow. Run CLI `--open` only in a human-operated terminal; its output can contain the action URL.

### 2. Verify the purchase, then create the card item

Purchase values must come from a trusted source (your order backend, or deterministic page extraction with fixed selectors), be compared against what the agent proposes, be confirmed by the end user, and then be frozen. Never build a card spec from agent-proposed values alone. `amount` is in minor units (`2306` is 23.06 USD).

```typescript
// AgentCard
const card = await kernel.vaults.items.upsert("order-8841", {
  id_or_name: vault.id,
  type: "card",
  spec: { provider: "agentcard", wallet: wallet.key, merchant: "example shop", amount: 2306, currency: "usd" },
});
```

```typescript
// Link: create, then authorize, then present the approval action
let card = await kernel.vaults.items.upsert("order-8841", {
  id_or_name: vault.id,
  type: "card",
  spec: {
    provider: "link",
    wallet: wallet.key,
    payment_method_id: paymentMethod.id,   // from retrieve(wallet.key, { expand: ["payment_methods"] })
    amount: 2306,
    currency: "usd",
    merchant_name: "example shop",
    merchant_url: "https://shop.example.com/checkout",
    context: "buy one notebook from example shop for a total of 23.06 usd including tax and shipping. this request is for this purchase only and must not be repeated.",
  },
});
card = await kernel.vaults.items.retrieve(card.key, { id_or_name: vault.id });
if (!card.available_operations.some((o) => o.type === "authorize")) throw new Error("authorize unavailable");
card = await kernel.vaults.items.performOperation(card.key, { id_or_name: vault.id, type: "authorize" });
if (card.action && "url" in card.action) await presentProviderAction({ userID, vaultID: vault.id, item: card });
```

```python
card = kernel.vaults.items.upsert(
    "order-8841",
    id_or_name=vault.id,
    type="card",
    spec={"provider": "agentcard", "wallet": wallet.key, "merchant": "example shop", "amount": 2306, "currency": "usd"},
)
```

```bash
kernel vaults cards create user-12345 order-8841 --provider agentcard \
  --spec '{"wallet": "agentcard-wallet", "merchant": "example shop", "amount": 2306, "currency": "usd"}'
kernel vaults items get user-12345 order-8841 --wait 60 -o json
```

Link `context` needs at least 100 characters; Link `amount` is 1-500000. AgentCard card `update` replaces the full spec and is allowed only while `requested` or `ready`. Never update or recreate a card to retry a failed, timed-out, or indeterminate payment.

### 3. Read aliases immediately before checkout

```typescript
const ready = await kernel.vaults.items.retrieve("order-8841", { id_or_name: vault.id, wait: 60 });
if (ready.type !== "card" || ready.state.status !== "ready" || !ready.state.aliases) {
  throw new Error(`payment item is ${ready.state.status}`);
}
const aliases = ready.state.aliases;   // { number, cvc, exp_month, exp_year }
```

Do not cache aliases across state changes. The card must be `ready` and the wallet `connected` before the agent starts.

### 4. Give the agent only the aliases

Pass them as structured task input alongside separately collected customer fields (email, billing name, postal code). Instruct the agent to type them into the merchant's normal card fields (top-level or iframe), answer any "I am an AI agent acting on behalf of someone else" disclosure truthfully via the page's native checkbox, and submit exactly once. Never put the API key, action URLs, provider responses, or the CDP URL in the prompt.

With server-side Playwright the agent step looks like:

```typescript
await kernel.browsers.playwright.execute(browser.session_id, {
  code: `
    const f = page.frameLocator("iframe[name^='__privateStripeFrame']"); // TODO: merchant-specific
    await f.locator("input[name='cardnumber']").fill(${JSON.stringify(aliases.number)});
    await f.locator("input[name='exp-date']").fill(${JSON.stringify(aliases.exp_month + aliases.exp_year.slice(-2))});
    await f.locator("input[name='cvc']").fill(${JSON.stringify(aliases.cvc)});
    await page.getByRole("button", { name: /pay/i }).click();   // submit once, never retry
    return page.url();
  `,
  timeout_sec: 120,
});
```

Ready Link cards can alternatively be filled with `performOperation({ type: "fill", ... })` using card fields `number`, `cvc`, `exp_month`, `exp_year`, `expiration` (with `format: "MM/YY"`), and `billing_*`. Cards require an HTTPS `page_url`. Choose fill or aliases deliberately; do not fall back from one to the other after an uncertain outcome.

### 5. HITL handoff: observe approval outside the agent

Start an observer before the agent submits and keep it running until the merchant reaches a terminal state. For AgentCard the outgoing checkout request is held while the cardholder approves; for Link it surfaces item events after substitution.

```typescript
let after: string | undefined;
async function observePayment(stop: AbortSignal) {
  while (!stop.aborted) {
    const cur = await kernel.vaults.items.retrieve(card.key, { id_or_name: vault.id, wait: 5 });
    if (cur.action && "url" in cur.action) {
      await presentProviderAction({ userID, vaultID: vault.id, item: cur });   // trusted UI only
    } else if (cur.action?.name === "push_approval") {
      console.log("approve the charge in your wallet app");
    }
    const events = await kernel.vaults.items.events(card.key, { id_or_name: vault.id, after, wait: 5 });
    for (const e of events) { console.log(e.id, e.name, e.browser_id); after = e.id; }
  }
}
```

```bash
kernel vaults items get user-12345 order-8841 --wait 5 --open     # human terminal only
kernel vaults items events user-12345 order-8841 --wait 60 -o json
```

If a coding agent is driving the CLI, it must stop and hand off whenever an `action` appears: give the human the exact `get --open` / `invoke authorize --open` command to run themselves, wait for confirmation, then re-read the item. Do not print, return, or open action URLs from the agent.

### 6. Verify the outcome

| observation | next action |
| --- | --- |
| `payment_succeeded` | confirm the merchant created the expected order |
| `payment_requires_action` / `payment_processing` | continue the existing flow; do not resubmit |
| Link `consumed`, `credential_submitted`, `credential_tokenized` | credential use is not proof of purchase; check merchant state |
| AgentCard `ready` again or authorization `approved` | inspect merchant record and replay |
| decline, expiry, failure, `payment_unknown` | stop; reconcile before any new attempt |
| `recovery_required` | stop; provider outcome unresolved. No retry, no delete, contact support |

The merchant order record is the authority. A success page, a ready item, or a delivered replay does not prove payment. Retain vault id, card key, browser id, and last event id until reconciled. Delete the browser when done; keep the vault per your retention policy.

## Gotchas

1. **Vault attach is create-time only.** Forgot to attach? Create a new browser. You cannot patch it on.
2. **Attaching is vault-wide.** Every item, including future ones, is reachable by every attached browser. Separate vaults for separate users or trust boundaries.
3. **Fill is not isolation.** Once filled, the value is in the DOM. Only aliases keep the real card out of the browser.
4. **`ready` is not `logged in` or `paid`.** It means required values exist / the card can be used.
5. **Never retry fill, authorize, or checkout submission automatically.** Inspect the existing attempt first.
6. **Action URLs are bearer tokens.** Never in logs, model context, screenshots, or the agent's browser.
7. **One wallet per provider per vault** is your job to enforce; the API only dedupes keys.
8. **Card `upsert` at an existing key returns the existing item**; it cannot change the spec. Use `update` (AgentCard) or a new key (Link).
9. **`page_url` is exact-match**, not a prefix. Read `page.url()` right before filling.
10. **Presentment currency can differ by browser region or proxy.** Verify amount/currency in the same browser session that submits.
11. **Aliases only resolve through native processor adapters.** Encrypted payloads or unknown endpoints pass through untouched and the checkout fails at the processor.
12. **Deleting is not payment recovery.** `recovery_required` blocks deletion of the card, wallet, and vault until reconciled.

## Related skills

- `kernel-auth`: reusable authenticated profiles via managed auth connections (use when the goal is a logged-in session, not a secret handoff).
- `kernel-regions`: run the attached browser close to the storefront or the approving human.
- `kernel-agent-browser`, `kernel-cli`: drive the browser once the vault is attached.

## Links

- Vaults overview: https://www.kernel.sh/docs/vaults/overview
- Credential items: https://www.kernel.sh/docs/vaults/credentials
- Fill browser fields: https://www.kernel.sh/docs/vaults/fill
- Human-in-the-loop credential collection: https://www.kernel.sh/docs/browsers/use-vault-credentials-in-browser-agent
- Enable payments in a browser agent: https://www.kernel.sh/docs/browsers/enable-payments-in-browser-agent
- Payments overview and processor coverage: https://www.kernel.sh/docs/integrations/payments/overview
- Link by Stripe: https://www.kernel.sh/docs/integrations/payments/stripe-link
- AgentCard: https://www.kernel.sh/docs/integrations/payments/agentcard
- Vaults API reference: https://www.kernel.sh/docs/api-reference/vaults/create-or-retrieve-a-vault-by-immutable-name
