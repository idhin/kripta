# Kripta OTP API

A small, read-only HTTP API so other apps can fetch your current OTP codes automatically (for example, a CI pipeline or a CLI helper).

Creating or editing accounts is intentionally not part of the API. That still happens in the browser, where your vault key exists.

## Security model

Kripta is zero-knowledge: the server only stores ciphertext and never has your vault key at rest.

An API token embeds a wrapping key `K`:

```
kripta_<tid>.<K>
```

- When you generate a token in the browser, it wraps your `vaultKey` with a random `K` and sends only `{ name, sha256(tid), wrappedVaultKey }` to the server. `K` never leaves your browser except inside the token string shown to you once.
- On each API request, the server uses `K` from the token to unwrap `vaultKey` in memory, decrypts your items, generates the codes, and discards the key. `K` is never stored.

Implications:

- A token grants full read access to all your OTP codes. Treat it like a password.
- Always use HTTPS.
- Server sees your decrypted secrets only transiently, per request. Nothing decryptable is stored without a token.
- Revoke a token any time from Settings. Lost tokens cannot be recovered, only revoked.

## Authentication

Send the token in the `Authorization` header:

```
Authorization: Bearer kripta_<tid>.<K>
```

## Endpoints

Base URL is your Kripta install, e.g. `https://kripta.example.com`.

### GET /api/v1/otp

Returns the current code for every account.

```bash
curl -H "Authorization: Bearer kripta_XXXX.YYYY" \
  https://kripta.example.com/api/v1/otp
```

```json
{
  "items": [
    {
      "id": "clx...",
      "issuer": "GitHub",
      "label": "you@example.com",
      "type": "totp",
      "code": "123456",
      "remaining": 17,
      "period": 30
    }
  ]
}
```

### GET /api/v1/otp/{id}

Returns the current code for a single account by its `id`.

```bash
curl -H "Authorization: Bearer kripta_XXXX.YYYY" \
  https://kripta.example.com/api/v1/otp/clx0abc123
```

```json
{
  "item": {
    "id": "clx0abc123",
    "issuer": "GitHub",
    "label": "you@example.com",
    "type": "totp",
    "code": "123456",
    "remaining": 17,
    "period": 30
  }
}
```

## Response fields

| Field       | Description                                        |
| ----------- | -------------------------------------------------- |
| `id`        | Account id, stable, use it with `/api/v1/otp/{id}` |
| `issuer`    | Service name                                       |
| `label`     | Account or email                                   |
| `type`      | `totp` or `hotp`                                   |
| `code`      | Current one-time code                              |
| `remaining` | Seconds left before a TOTP code rotates            |
| `period`    | TOTP period in seconds                             |

## Errors

| Status | Meaning                                    |
| ------ | ------------------------------------------ |
| `401`  | Missing, malformed, revoked, expired token |
| `404`  | Account id not found (single-item route)   |
| `429`  | Rate limit exceeded (60 requests / minute) |

## Notes

- Accounts you add after creating a token are included automatically, no need to regenerate the token.
- The API is meant for server-to-server or CLI use. Cross-origin browser calls are not enabled (no CORS headers).
- New accounts can only be created from the web UI.
- The API never returns raw TOTP secrets, only the current codes. To get the secrets themselves, use **Settings > Export vault** in the browser.
