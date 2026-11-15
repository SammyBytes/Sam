# Security Policy

## Supported versions

Security fixes target the latest released minor line.

| Version | Supported |
| :--- | :--- |
| 0.5.x | ✅ |
| < 0.5 | ❌ |

## Reporting a vulnerability

Please do not open a public issue for security problems.

Use GitHub's private vulnerability reporting:

https://github.com/SammyBytes/Sam/security/advisories/new

Include as much detail as you can:

- A description of the issue and its impact.
- The affected version, commit, or release artifact.
- Reproduction steps or a proof of concept.
- Any suggested fix or mitigation.

## Scope

In scope:

- The compiler, runtime, and CLI.
- Release binaries and their build pipeline.
- Provider request handling, credential usage, and generated code.

Out of scope:

- Vulnerabilities in third-party providers, models, or infrastructure.
- Issues that require an already compromised local environment.
- Denial-of-service reports based only on intentionally large programs.

## Response

This is a volunteer project, so there is no formal SLA. I aim to acknowledge reports within 7 days and will coordinate a fix and disclosure timeline with you. Please allow time for a release before publishing details.
