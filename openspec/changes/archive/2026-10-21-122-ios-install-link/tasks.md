## 1. Configuration

- [x] 1.1 `SiteConfig` and `siteConfig(env)` in `site.ts` (path on the site or https URL, else ignored), read in `main.ts` and passed through `createApp` to `renderLanding`; tests

## 2. Landing and docs

- [x] 2.1 iPhone & iPad card: install link, "over the air · registered devices" detail and the registration note when configured; docs and "Build from source" otherwise; `LINKS.ios` removed
- [x] 2.2 Catalogs in en-US, pt-BR and es-ES (`install.ios.source`, `install.ios.note`, `appLink.ios.registered` with the docs link)
- [x] 2.3 Getting started: the iPhone & iPad bullet and the "Registering an iPhone or iPad" section in the three languages

## 3. Deploy

- [x] 3.1 `deploy.sh` sets `APP_INSTALL_URL` in the server's `.env` when given (validated), Makefile and compose headers document it

## 4. Verify

- [x] 4.1 Tests: card with and without the link, the server passing it through, `siteConfig`, the docs anchors the texts link to; `pnpm check` and `openspec validate --strict`
