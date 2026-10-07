# Security Policy

## Supported version

The current `main` branch and the latest tagged release are the supported development line.

## Secrets

Do not commit live credentials to this repository. This includes:

- API keys and OAuth client secrets
- access/refresh tokens
- session cookies
- private keys
- database passwords
- production `.env` files
- cloud provider credentials

Use placeholders or environment-variable references in committed configuration:

```text
{{client_secret}}
{{apikey}}
${META_TOKEN}
${DAFTRA_CLIENT_SECRET}
```

Run before pushing:

```bash
pnpm verify:secrets
```

If a real credential is committed, removing it from the latest file is not sufficient. Rotate/revoke the credential at the provider and, when required, purge it from repository history.

## Runtime exposure

Production deployments should keep the Rust gateway bound to loopback and expose it through the configured TLS reverse proxy. Do not publish administrative or diagnostic endpoints directly to the Internet.

## Frappe

The Frappe integration must preserve Frappe permissions and site isolation. Do not bypass production guardrails through raw shell commands, `ignore_permissions=True`, unrestricted console execution or destructive Bench commands.

## Reporting

Do not open a public issue containing a live credential or exploit payload that exposes customer or production data. Revoke exposed credentials first and contact the repository owner through a private channel.
