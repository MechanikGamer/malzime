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
| Public endpoint (`invoker: "public"`) | Rate limiting + CORS + honeypot + timing check | Under review for hardening options |
| No authentication required | By design — workshop participants should not need accounts | Accepted |

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
