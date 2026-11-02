## Why

Commands the agent ran or suggested sit right in the conversation (the `Bash` tool call card, and `sh` / `bash` / `zsh` code blocks in its messages), but running one on the computer means copying it and opening the Run command sheet by hand (#477). A press-and-hold on the command should offer "Run on the computer" with the sheet filled in and the usual confirmation.

## What Changes

- Long press on the command of a `Bash` tool call and on a shell code block shows a menu with **Copy** and **Run on the computer**; the latter opens the Run command sheet with the command filled in (multi-line commands whole, #475), where the user confirms as usual. A plain tap keeps doing what it does today.
- Only when the daemon offers `command.run` and commands are on (`hello.commands.enabled`); otherwise the action is absent (Copy stays as it was).
- Reachable without a long press: an accessibility action on the card and on the block (VoiceOver / TalkBack).
- A pure helper says which blocks count as shell (`sh`, `bash`, `zsh`, `shell`) and strips console prompts (`$ ` at the start of every line); tests. Texts in pt-BR, en-US and es-ES.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `shell-commands`: new requirement "Run from the conversation".

## Impact

- `apps/mobile/src/features/commands/` (logic, a run context, the menu helper, `CommandSheet` with an initial command), `conversation/components/ToolCallCard.tsx` and `Markdown.tsx`, the session screen (provider and prefill), the three app catalogs, the web docs. No daemon or protocol change.
