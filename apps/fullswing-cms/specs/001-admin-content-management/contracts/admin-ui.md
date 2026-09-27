# Admin UI Contract

## Routes

| Method | Path | Access | Behavior |
|---|---|---|---|
| `GET` | `/login` | Anonymous | Render compact Entra sign-in entry point. |
| `GET` | `/auth/callback` | Entra redirect only | Validate OAuth state, establish session only for an allowlisted identity, then redirect to the saved local destination or Dashboard. |
| `POST` | `/auth/logout` | Authenticated + CSRF | End CMS session and clear protected token-cache association. |
| `GET` | `/dashboard` | Admin | List blogs/pages and filter by type, title, date range, author, and category. |
| `GET` | `/blogs/new` | Admin | Render Markdown and metadata editor. |
| `GET` | `/blogs/{id}/edit` | Admin | Load a blog pair and its opaque version/config revision. |
| `POST` | `/blogs` or `/blogs/{id}` | Admin + CSRF | Validate metadata and Markdown, compare expected version/config revision, save complete logical pair, and report saved/conflict/partial status. |
| `GET` | `/pages/new` or `/pages/{id}` | Admin | Render the HTML authoring placeholder; do not expose edit/save controls or render stored HTML. |
| `GET` | `/configuration` | Admin | Show selected provider, provider settings, GitHub Action settings, missing configuration, and masked secrets. |
| `POST` | `/configuration` | Admin + CSRF | Validate candidate provider configuration before activating it; preserve the current active source on failure. |

OAuth callback is a protocol endpoint, not a protected page; it must validate the correlation/state generated for the sign-in attempt. All other non-Login routes are guarded before loading protected content.

## Common Response Rules

- Anonymous protected-route requests redirect to Login without returning page data.
- Authenticated but non-allowlisted identities receive access denied; no CMS content/config is rendered.
- Input and validation errors preserve safe draft values, identify invalid fields, and never echo secret values.
- Dashboard filters combine with AND semantics, have a clear action, and produce an explicit empty state.
- Provider errors, partial writes, conflicts, and invalid configurations are distinct visible states and are not displayed as success.
- Markdown preview is sanitized server-side before insertion into the response. Client-side validation may enhance the experience but does not replace server validation.
- Forms use CSRF protection; internal navigation uses local relative destinations only.
- Optional Svelte web components may enhance controls but cannot be required for route access or form completion.