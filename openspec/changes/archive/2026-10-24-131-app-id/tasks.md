## 1. Identifier

- [x] 1.1 `APP_ID` = `com.alvyntech.remoteharness` in `app.config.ts` (bundle identifier and package), with a note on the old id
- [x] 1.2 `make install-ios` launches the new id; CONTRIBUTING's Firebase step names it; test fixtures follow

## 2. Docs

- [x] 2.1 Troubleshooting (en-US, pt-BR, es-ES): the store build is a separate app, both ids named

## 3. Verify

- [x] 3.1 `pnpm check` and `openspec validate --strict`; `expo config` shows the new id for iOS and Android
