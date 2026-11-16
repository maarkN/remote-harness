## 1. Guide logic

- [x] 1.1 Tests first in `features/pairing/setup-guide.test.ts`: no command and no action before the choice; `curl` for macOS and Linux and `irm` for Windows, each with the copy and share actions carrying exactly that command; the Windows body mentions PowerShell and WSL2, the others a terminal; the intro names the three systems without "with WSL" in the three languages; the existing checks (steps, pair action, no iPhone / Mac wording) per system; verify they fail
- [x] 1.2 `setup-guide.ts`: `COMPUTER_SYSTEMS`, `installCommand`, `buildSetupGuide(t, system)` and the `copy` action; verify the tests pass

## 2. Screen

- [x] 2.1 `SetupGuideScreen`: the system choice first in step 1 (three chips, selected one highlighted, announced as selected), then the body, the code block and Copy / Send; Copy uses the clipboard and announces "Command copied"; the phone's OS no longer used; verify typecheck and Biome
- [x] 2.2 Texts (intro, the choice, the two bodies, Copy / copied, Send, the system names) in pt-BR, en-US and es-ES; verify the i18n parity test

## 3. Verification

- [x] 3.1 `turbo run typecheck test` (all packages but the Go relay), Biome and `expo export --platform ios` green
- [x] 3.2 On the iOS simulator (iPhone 17 Pro, pt-BR, development build, opened with `remoteharness:///setup-guide`): the intro reads "macOS, Linux ou Windows" and step 1 shows the three chips and the question with no command; Windows shows the PowerShell / WSL2 text and `irm https://remoteharness.app/install | iex`, and Copiar o comando put exactly that line on the simulator's clipboard; Linux switched to `curl -fsSL https://remoteharness.app/install | bash` (copied the same way); macOS shows the terminal text, and Enviar o comando para o computador opens the share sheet with the curl command
- [ ] 3.3 Pending: the same on Android, and running each copied command on a real computer of that system
