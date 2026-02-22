# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

**Email:** [datenschutz@malzi.me](mailto:datenschutz@malzi.me)

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact

We will acknowledge receipt within 48 hours and aim to provide a fix or mitigation within 7 days.

**Please do not open a public GitHub issue for security vulnerabilities.**

## Scope

malziME is a **workshop tool for media literacy education**. It is designed for supervised classroom use, not as a high-security production system.

## Known Accepted Risks

| Risk | Mitigation | Status |
|------|-----------|--------|
| In-memory rate limit (per instance, not global) | `maxInstances` cap + per-IP rate limit | Accepted for workshop scale |
| Public endpoint (`invoker: "public"`) | Rate limiting + CORS + honeypot + timing check | Accepted for workshop scale |
| No authentication required | By design — workshop participants should not need accounts | Accepted |
| Counter fail-open on Firestore errors (`counter.js`) | App stays available during DB outages; worst case: a few extra analyses beyond hourly limit | Accepted — availability over strict cost control |
| Nonce replay protection fail-open on Firestore errors (`auth.js`) | Admin actions remain functional during DB outages; nonces are short-lived (5 min TTL) and require valid HMAC | Accepted — admin availability over strict replay prevention |
| `minimatch` ReDoS in `@google-cloud/vision` transitive dependency (`vision → google-gax → rimraf → glob → minimatch <10.2.1`) | Not exploitable in this context (no user-controlled glob patterns reach minimatch). Vision API 5.3.4 is latest; fix requires upstream update by Google | Accepted — monitored via Dependabot |

## Security Measures

- **No data storage**: Images and profiles exist only in RAM during processing
- **No tracking**: No cookies, no analytics, no advertising
- **GPS stays in browser**: GPS coordinates are never sent to the server
- **Content Security Policy**: Strict whitelist (self + OpenStreetMap + Cloud Functions)
- **HSTS with preload**
- **Rate limiting**: Per-IP request limits
- **Prompt injection protection**: User data isolated in XML tags
- **Input validation**: File type, size, and format checks
- **Gemini output bounds**: Response size limits enforced server-side
