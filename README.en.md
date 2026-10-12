# WD World 1.7

English | [简体中文](README.md)

[![CI](https://github.com/actrox/wdWorld/actions/workflows/ci.yml/badge.svg)](https://github.com/actrox/wdWorld/actions/workflows/ci.yml)

A local-first desktop workbench for worldbuilding, novels, original characters, TRPG adventures and Tavern roleplay. Manual creation works offline. Connect your own model service for writing, consistency checks, world-change proposals and LAN narration.

## Download

Download **WDWorld-Desktop-1.7.0-win-x64.zip** from [GitHub Releases](https://github.com/actrox/wdWorld/releases), extract the entire archive and run `WD World.exe`. Keep the complete folder. Windows builds are unsigned and do not auto-update.

Choose Novel, OC, TRPG, Tavern or Free mode at startup. Specialized projects open their creator workspace; Free mode opens worldbuilding and exposes all tools. **File → Switch creation mode** (`Ctrl+Shift+M`) returns to mode selection. Simplified Chinese and English cover the interface and native menus while preserving authored text.

[Quick start](QUICKSTART.md), [user guide](docs/NOVEL-STUDIO.md) and [release notes](CHANGELOG.md) are available in Chinese.

## Features

| Mode                 | Tools                                                                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Worldbuilding / Free | Eight entry types, rich text, Wiki, relationships, maps, timeline, templates, static Wiki and JSON exports                                |
| Novel                | Idea → characters and rules → outline → chapters → writing → consistency checks → author approval; staged context, summaries and versions |
| OC                   | Concept, appearance, personality, motivation, background, relationships and character arcs                                                |
| TRPG                 | Random worlds, adventure library, imports, GM secrets, public handouts, session logs, automatic LAN narration and host intervention       |
| Tavern               | Complete worlds, character cards, worldbooks, scenario cards, opening messages and automatic AI replies                                   |

Generated settings appear as **AI pending review**. Accepting confirms them; world changes support individual approval, rejection and undo. Stale proposals cannot overwrite later author edits. Drafts save every ten seconds and support manual saving.

Three original system-neutral adventures cover fantasy exploration, mystery investigation and science-fiction survival. TRPG imports support WD World adventure JSON, exported world JSON, TXT and Markdown. Tavern supports V2 / legacy character JSON, worldbook JSON and WD World scenario JSON. PNG character cards, PDF and Word imports are not implemented.

## AI and LAN

Desktop settings support DeepSeek, MiMo, OpenAI / Codex, Gemini, custom endpoints and local services through Chat Completions, Responses or native Gemini protocols. Enter your endpoint and key, retrieve models, select one and test it. No API key or credits are included.

Generation sends selected context to the configured service; long inputs are processed in segments. With room automation enabled, player messages trigger model calls. Hosts can pause, take over, give guidance or edit a preview before publishing. TRPG automation uses public context and does not automatically receive unpublished GM secrets.

The desktop host opens a room; players join through browsers on the same trusted network using its URL and room code. Up to 16 players can use characters, chat, OOC, dice, public scenes and handouts. TRPG adds initiative and session logs. Rooms use HTTP and do not configure firewalls or public port forwarding.

## Data

Desktop projects, recovery backups, recent-project metadata, API settings and room archives are encrypted locally. Encryption depends on the OS account and application environment. Export a complete project JSON before moving computers or accounts. Exports are plaintext and exclude API keys.

The [browser demo](https://actrox.github.io/wdWorld/) supports manual creation and stores data in the current browser. Desktop AI, hosting and desktop encryption are unavailable in the browser build.

## Development

Requires Node.js 22.12+ and npm. Use `npm.cmd` on Windows PowerShell if needed.

```sh
npm ci
npm run desktop        # Build and launch Electron
npm run dev            # Browser development, usually localhost:5173
npm run package        # Windows portable directory
npm run electron:build # Windows NSIS installer
```

`start-desktop.cmd` opens `release/v1.7.0/WDWorld-Desktop-1.7.0/` when present, otherwise starts from source after dependencies have been installed. Packaging refuses to overwrite an existing version directory. Binaries are distributed as Release assets rather than committed to Git.

```sh
npm run format:check
npm run lint
npm run test:coverage
npm run build
npm run test:desktop
npm run test:studio
npm run test:world
npm run test:lan
npm run test:automation
```

Desktop tests run on Windows with isolated profiles and local mock models. Regular tests never call a real model. `scripts/test-live-ai.js` requires explicit `WDWORLD_LIVE_AI=1` and may incur API usage using locally saved credentials.

## Repository

`electron/` contains the desktop runtime, AI adapter, protected storage, LAN server and player web client. `src/features/` contains Novel, Studio and LAN host features; `src/components/` contains worldbuilding views. Storage and internationalization are in `src/lib/`, artwork in `src/assets/`, tests in `tests/`, scripts in `scripts/` and the guide in `docs/`.

Stack: Electron, React 18, TypeScript, Vite, Tailwind CSS, Zustand, TipTap, sql.js, Vitest and Playwright. SQLite WASM is bundled directly from the dependency. [CI](.github/workflows/ci.yml) checks formatting, lint, coverage and build; [Pages](.github/workflows/deploy-pages.yml) deploys the browser build from main. Generated builds, reports, screenshots, logs and local credentials are excluded from Git.
