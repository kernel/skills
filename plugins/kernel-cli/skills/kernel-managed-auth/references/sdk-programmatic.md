# Managed Auth SDK & Programmatic Flow

## SDK Methods

| Method | Description |
|--------|-------------|
| `kernel.auth.connections.create({...})` | Create connection |
| `kernel.auth.connections.retrieve(id)` | Get connection state |
| `kernel.auth.connections.list({...})` | List connections |
| `kernel.auth.connections.delete(id)` | Delete connection |
| `kernel.auth.connections.login(id, {...})` | Start login session |
| `kernel.auth.connections.submit(id, {...})` | Submit fields/SSO/MFA |
| `kernel.auth.connections.follow(id)` | SSE event stream |

## Create Options

```typescript
await kernel.auth.connections.create({
  domain: 'example.com',           // required
  profile_name: 'my-profile',      // required
  credential: {
    name: 'my-cred',               // Kernel credential by name
    // OR external provider:
    // provider: 'my-1p',
    // path: 'VaultName/ItemName',  // explicit path
    // auto: true,                  // auto-lookup by domain
  },
  login_url: 'https://example.com/signin',
  allowed_domains: ['accounts.google.com'],
  proxy: { id: 'proxy-id' },       // or { name: 'proxy-name' }
  health_check_interval: 300,       // seconds (300-86400)
  save_credentials: false,          // default true
});
```

## Hosted UI Flow

Simplest integration. Redirect user to hosted page, poll for completion.

```typescript
const auth = await kernel.auth.connections.create({
  domain: 'linkedin.com',
  profile_name: 'linkedin-profile',
});

const login = await kernel.auth.connections.login(auth.id);
// Redirect user to login.hosted_url

let state = await kernel.auth.connections.retrieve(auth.id);
while (state.flow_status === 'IN_PROGRESS') {
  await new Promise(r => setTimeout(r, 2000));
  state = await kernel.auth.connections.retrieve(auth.id);
}
// state.status === 'AUTHENTICATED'
```

## Programmatic Flow

Build custom UI or headless auth. Poll for fields, submit credentials via API.

```typescript
const auth = await kernel.auth.connections.create({
  domain: 'github.com',
  profile_name: 'gh-profile',
});

await kernel.auth.connections.login(auth.id);

let state = await kernel.auth.connections.retrieve(auth.id);
while (state.flow_status === 'IN_PROGRESS') {
  if (state.flow_step === 'AWAITING_INPUT') {
    // Login fields or 2FA code
    if (state.discovered_fields?.length) {
      const fields = mapFieldsToValues(state.discovered_fields);
      await kernel.auth.connections.submit(auth.id, { fields });
    }
    // SSO buttons
    if (state.pending_sso_buttons?.length) {
      const btn = state.pending_sso_buttons[0];
      await kernel.auth.connections.submit(auth.id, {
        sso_button_selector: btn.selector,
      });
    }
    // MFA selection
    if (state.mfa_options?.length) {
      await kernel.auth.connections.submit(auth.id, {
        mfa_option_id: 'totp',
      });
    }
  }

  await new Promise(r => setTimeout(r, 2000));
  state = await kernel.auth.connections.retrieve(auth.id);
}
```

### discovered_fields format

```typescript
// Login fields
[{ name: 'username', type: 'text' }, { name: 'password', type: 'password' }]
// 2FA
[{ name: 'otp', type: 'totp' }]
```

### SSO buttons format

```typescript
[{ provider: 'google', label: 'Sign in with Google', selector: '...' }]
```

### MFA options format

```typescript
[{ type: 'totp', label: 'Authenticator app' }, { type: 'sms', label: 'Text message' }]
```

## SSE Streaming

Real-time events instead of polling:

```typescript
const stream = await kernel.auth.connections.follow(auth.id);
for await (const evt of stream) {
  if (evt.event === 'managed_auth_state') {
    console.log(evt.flow_status, evt.flow_step);
    if (evt.flow_status === 'SUCCESS') break;
  }
}
```

## Login Response

```typescript
{
  id: string;              // connection ID
  flow_type: 'LOGIN' | 'REAUTH';
  hosted_url: string;      // hosted login page
  handoff_code: string;    // for exchange flow
  flow_expires_at: string; // ISO timestamp (5 min)
  live_view_url?: string;  // browser live view
}
```

## Connection State

Key fields on `retrieve()`:

| Field | Description |
|-------|-------------|
| `status` | `AUTHENTICATED` or `NEEDS_AUTH` |
| `flow_status` | `IN_PROGRESS`, `SUCCESS`, `FAILED`, `EXPIRED`, `CANCELED` |
| `flow_step` | `DISCOVERING`, `AWAITING_INPUT`, `SUBMITTING`, `AWAITING_EXTERNAL_ACTION`, `COMPLETED` |
| `discovered_fields` | Fields the login form needs |
| `pending_sso_buttons` | SSO buttons on the page |
| `mfa_options` | Available MFA methods |
| `external_action_message` | Message for push/security key |
| `error_message` | Error details on failure |
| `post_login_url` | URL where login landed |
| `can_reauth` | Whether auto-reauth is possible |
| `can_reauth_reason` | Why reauth is/isn't possible |
| `live_view_url` | Browser live view during login |
| `hosted_url` | Hosted UI URL during active flow |

## Credential Providers

External credential sources (e.g., 1Password):

```typescript
// List providers
const providers = await kernel.credentialProviders.list();

// List items from a provider
const items = await kernel.credentialProviders.listItems(provider.id);

// Use in connection
await kernel.auth.connections.create({
  domain: 'example.com',
  profile_name: 'my-profile',
  credential: { provider: 'my-1p', auto: true },
});
```

## Using Authenticated Profiles

After authentication, create browsers with the profile:

```typescript
const browser = await kernel.browsers.create({
  profile: { name: 'my-profile' },
  stealth: true,  // recommended for managed auth profiles
});
// Browser is already logged in
```
