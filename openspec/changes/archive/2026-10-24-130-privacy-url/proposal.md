## Why

Issue #336: the store listings (Google Play has a single privacy policy field) need a short, stable URL for the privacy policy, and the policy itself lags behind v0.19.0. It still says the live status carries a "step category", does not mention Run command or Polish dictation, names no publisher and offers no direct contact or way to ask for the deletion of the data sent to Firebase, which the store data safety forms ask about.

## What Changes

- `/privacy` (and `/privacy/`) serves the privacy policy page in the language negotiated from `Accept-Language`, the same page as `/docs/privacy/`, with `https://remoteharness.app/privacy` as its canonical URL. The language paths (`/<locale>/docs/privacy/`) stay as they are.
- Privacy policy (en-US, pt-BR, es-ES): published by Alvyn Tech, its short address, the live status' current step (tool and short target, never arguments, file contents or search terms) and todo progress, Run command output only going to the phone that started it, Polish dictation sending the transcript text (never the audio) to the session's own `claude` command, a section on how data is protected in transit and on the devices, a section on choices and requests (turning reporting off, deleting local data, asking `privacy@remoteharness.app` to delete what was sent to Firebase), and the contact address. Last updated 2026-10-24.
- Security & privacy page: the live status line describes the current step and the todo progress instead of the step category.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `web-docs`: the privacy policy is also served at `/privacy`, and names its publisher and a privacy contact.

## Impact

`apps/web/src/routes.ts` (`PRIVACY_PATH`, the `path` of a doc route), `apps/web/src/app.ts`, `content/*/privacy.md`, `content/*/security.md`, tests (`routes.test.ts`, `server.test.ts`). The store listing texts keep their per-language privacy URLs (App Store); `/privacy` is the address for Google Play's single field. Ops: `privacy@remoteharness.app` must receive mail (email routing on the domain) before the listing goes out.
