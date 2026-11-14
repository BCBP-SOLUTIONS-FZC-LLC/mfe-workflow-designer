# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| Unreleased `0.0.0` | The only line. No tag has been cut |

There is no supported release image yet. See [VERSIONING.md](../VERSIONING.md).

## Reporting a vulnerability

**Do not open a public GitHub issue for a security vulnerability.**

Email: vijay@bcbpsolutions.com
Subject: `[mfe-workflow-designer] Security vulnerability`

Include:

- What is affected (the studio UI, BPMN export, catalogue storage, the remote entry, or nginx)
- Steps to reproduce
- Impact (a connector secret in BPMN or storage, XSS, an unauthorized write, a substituted `remoteEntry.js`)
- A suggested fix, if you have one

### Response timeline

| Step | Target |
|---|---|
| Initial acknowledgement | 48 hours |
| Severity assessment | 5 business days |
| Patch for a critical or high issue | 14 days |
| Public disclosure | After a fix is available |

## Scope

- **Connector secrets.** They stay in memory for the open page. They must not appear in BPMN, in `storage('workflows')`, in logs, or on metric labels.
- **Authorization.** Writes require `update:tender` and a workspace that is not read-only. Sign-in and tokens belong to the shell and the platform SDK.
- **Runtime config.** `/config/runtime.json` is public. It must not contain secrets.
- **The remote entry.** `remoteEntry.js` executes in the shell origin once the shell loads it.
