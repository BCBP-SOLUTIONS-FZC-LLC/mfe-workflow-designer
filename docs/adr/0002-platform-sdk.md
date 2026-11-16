# ADR 0002 — Keep the platform SDK as the shared framework

## Status

Accepted

## Decision

This remote keeps `@bcbp-solutions-fzc-llc/frontend-sdk` for localization, sign-in, permissions, storage, logging, metrics, and the error boundary.

The constitution allows an approved platform localization framework in place of i18next. The SDK is that framework. The shell owns login, logout, token refresh, and session. This remote reads `useCurrentUser`, `useSignOut`, `useHasPermission`, and `useReadOnly`. It does not start Keycloak.

Tracing and metrics start in the shell. Standalone calls `initializeCore` from `/config/runtime.json`. A second `TelemetryProvider` would duplicate that.

`platform-design-system` is not published to this registry. Buttons stay in this remote until that package exists.

## Consequences

A future design-system package replaces `presentation/components/ui.tsx`. It does not replace the SDK.
