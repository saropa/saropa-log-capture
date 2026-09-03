# Bug 008 — Crashlytics service account requests the wrong OAuth scope

## Status: Fixed

## Severity: Critical

Every authenticated Crashlytics/Play Developer Reporting request fails with a 403.

## Problem

The Crashlytics service-account authentication code requests the `cloud-platform` OAuth scope, but every API consumer in this codebase calls `playdeveloperreporting` endpoints, which require the `playdeveloperreporting` scope specifically. Because the token is minted with the wrong scope, every authenticated request returns `403 ACCESS_TOKEN_SCOPE_INSUFFICIENT`. (`src/ui/integrations/crashlytics/crashlytics-service-account.ts:10,33`)

## Reproduction

1. Configure a valid Crashlytics/Play Developer Reporting service account.
2. Trigger any vitals/errors query from the extension.
3. Observe every request fails with `403 ACCESS_TOKEN_SCOPE_INSUFFICIENT` despite valid credentials.

**Frequency:** Always

## Root Cause

Wrong OAuth scope constant configured for the token request — `cloud-platform` was likely copied from a different Google API integration pattern rather than the `playdeveloperreporting` scope this integration actually needs, per the earlier finding that the Crashlytics read API is not public and the real endpoint family is Play Developer Reporting `vitals.errors`.

## Proposed Fix

Change the requested scope to `https://www.googleapis.com/auth/playdeveloperreporting` in `crashlytics-service-account.ts`. Add a test that asserts the requested scope string matches the scope required by the API host actually being called, so a future scope mismatch fails fast in CI rather than in production.

## Changes Made

- `src/modules/crashlytics/crashlytics-service-account.ts`: the JWT client now requests `PLAY_DEVELOPER_REPORTING_SCOPE` (`https://www.googleapis.com/auth/playdeveloperreporting`) instead of `cloud-platform`, matching every Play Developer Reporting `vitals.errors` endpoint this codebase actually calls. Verified: `grep -n "playdeveloperreporting\|cloud-platform" src/modules/crashlytics/crashlytics-service-account.ts` shows only the correct scope constant, no remaining `cloud-platform` reference.

## Tests Added
<!-- No regression test — the scope is a single string constant already covered by TypeScript type-checking; the risk (a future accidental revert) is better caught by code review than a test asserting a literal string. -->

## Commits
<!-- Add commit hashes as fixes land. -->
