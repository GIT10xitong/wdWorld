# WD World 1.10.2

1.10.2 is a source update dated 2026-10-18, focused on world book editing, workspace navigation, translated file controls and smaller windows. See the [1.10.2 notes](docs/RELEASE-NOTES-1.10.2.md) (Chinese). No 1.10.2 installer was built or published in this update; packaging and installation checks follow the [candidate workflow](docs/RELEASE-CANDIDATE.md).

The latest source adds section navigation to Tavern, TRPG and OC, a searchable two-column world book editor, and search in saved card and module libraries. Home, save and AI settings share the plugin center's application bar; returning from another module restores the editing location. Run from source to see these changes; existing candidate installers are unchanged.

The bookshelf now focuses on book management, writing progress and shared ideas. Open a book to access chapters, references and AI tools in the writing desk, with collapsible chapter notes and a wider focus view. OC, TRPG, Tavern, worldbuilding, LAN and plugin screens share a restrained blue-gray day/night theme. See the [interface guide](docs/UI-GUIDE.md) (Chinese).

1.10.0 adds consistent day/night styling, reviewed links from novel material to its own world lore, author-approved agent drafts, and a WD WORLD home button in every mode. The outer plugin center installs full Tavern/TRPG modes; add-ons belong in each mode’s extensions. Existing official add-ons target Tavern; other modes can import compatible packages with explicit targets.

OC, TRPG and Tavern have dedicated project libraries and creative home screens, with live counts, preparation checklists, draft previews and editor shortcuts. TRPG and Tavern require their mode plugins. See [mode home guide](docs/MODE-HOMES.md) (Chinese).

English | [简体中文](README.md)

[![CI](https://github.com/actrox/wdWorld/actions/workflows/ci.yml/badge.svg)](https://github.com/actrox/wdWorld/actions/workflows/ci.yml)

A local-first desktop workbench for worldbuilding, novels, original characters, TRPG adventures and Tavern roleplay. Manual creation works offline. Connect your own model service for writing, consistency checks, world-change proposals and LAN narration.

## Download

The current source version is **1.10.2**. Run `npm run desktop`, build a portable folder with `npm run package`, or an NSIS installer with `npm run electron:build`. NSIS builds can download, verify and restart into updates after saving; portable builds only check versions. This round did not upload or publish a GitHub Release; check the actual version on the [release page](https://github.com/actrox/wdWorld/releases). Builds remain unsigned.

Free, OC and Novel are available by default. Install TRPG and Tavern through the plugin center to add their modes. Specialized projects open their creator workspace; Free mode combines built-in tools and installed plugins. **File → Switch creation mode** (`Ctrl+Shift+M`) returns to mode selection. Simplified Chinese and English cover the interface and native menus while preserving authored text.

[Quick start](QUICKSTART.md), [user guide](docs/NOVEL-STUDIO.md) and [release notes](CHANGELOG.md) are available in Chinese.

## Features

Novel mode opens a dashboard with books, writing progress and ideas. Opening a book enters the chapter writing desk. Tools include story cards, text resources, per-book author preferences, custom note panels, editable planner/writer/reviewer workflows, prose revision, TXT/Markdown analysis and lore checks. Material can be synced to its own world after review; AI tool output appears as pending notes. Agent drafts can be appended to a chapter after approval, preserving a snapshot. The seven-stage journey remains available. See [writing desk](docs/NOVEL-DESK.md), [themes and extensions](docs/THEMES-AND-EXTENSIONS.md) and [update distribution](docs/UPDATES.md).

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

TRPG supports coordinated rounds, away/return, GM advancement and d20/d100 checks. Tavern supports optional story state, suggested actions and host corrections. See the [guide](docs/NOVEL-STUDIO.md) for behavior and rule limits.

Desktop settings support DeepSeek, MiMo, OpenAI / Codex, Gemini, custom endpoints and local services through Chat Completions, Responses or native Gemini protocols. Enter your endpoint and key, retrieve models, select one and test it. No API key or credits are included.

Generation sends selected context to the configured service; long inputs are processed in segments. With room automation enabled, player messages trigger model calls. Hosts can pause, take over, give guidance or edit a preview before publishing. TRPG automation uses public context and does not automatically receive unpublished GM secrets.

The desktop host opens a room; players join through browsers on the same trusted network using its URL and room code. Up to 16 players can use characters, chat, OOC, dice, public scenes and handouts. TRPG adds initiative and session logs. Rooms use HTTP and do not configure firewalls or public port forwarding.

## Mode packages and per-mode extensions

The outer plugin center installs only full Tavern/TRPG modes. Install add-ons through each mode’s extensions and its “Manage and download extensions” button. Imported packages are checked against the selected mode too. Existing official add-ons primarily target Tavern; other modes accept packages declaring compatible targets.

The [independent plugin repository](https://github.com/actrox/wdWorld-plugins) provides mode packs, memory, text-to-image and text-to-speech extensions. The host retains common editing, storage, LAN and capability engines; downloadable mode packs provide declarations, instructions and resources. Review permissions before installing. Disable or uninstall without deleting projects; end a running room before changing plugins.

Tavern extensions use per-project encrypted memory and separate encrypted service settings. Images and speech receive only user-reviewed text. Third-party authors can publish WDWorld v1 JSON packages and HTTP adapters. Native SillyTavern JavaScript requires adaptation; it cannot run directly. See the [API specification](https://github.com/actrox/wdWorld-plugins/blob/main/docs/API.md). Project backups do not include plugin memory or credentials; copy memory text manually before moving computers.

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

When source files and Electron dependencies are available, `start-desktop.cmd` builds and launches the current source so an older packaged build cannot hide UI updates. Otherwise it tries `release/v1.10.2/WDWorld-Desktop-1.10.2/`, then the older `release/v1.10.1/WDWorld-Desktop-1.10.1/`. The older package does not include these fixes. Packaging refuses to overwrite an existing version directory. Binaries are not committed to Git.

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
npm run test:plugins
npm run test:novel-desk
npm run test:mode-homes
npm run test:theme      # Day/night surfaces, actual pointer hover and dialog colors
npm run test:ui-layout  # Translated file controls, repeat imports and four window sizes
npm run test:desktop:all # Build once and run all nine desktop suites in sequence
```

Desktop tests run on Windows with isolated profiles and local mock models. Regular tests never call a real model. `scripts/test-live-ai.js` requires explicit `WDWORLD_LIVE_AI=1` and may incur API usage using locally saved credentials.

## Repository

`electron/` contains the desktop runtime, AI adapter, protected storage, LAN server and player web client. `src/features/` contains Novel, Studio and LAN host features; `src/components/` contains worldbuilding views. Storage and internationalization are in `src/lib/`, artwork in `src/assets/`, tests in `tests/`, scripts in `scripts/` and the guide in `docs/`.

Stack: Electron, React 18, TypeScript, Vite, Tailwind CSS, Zustand, TipTap, sql.js, Vitest and Playwright. SQLite WASM is bundled directly from the dependency. [CI](.github/workflows/ci.yml) checks formatting, lint, coverage and build; [Pages](.github/workflows/deploy-pages.yml) deploys the browser build from main. Generated builds, reports, screenshots, logs and local credentials are excluded from Git.

## Local cleanup

Run `./scripts/clean-generated.ps1` in PowerShell to preview candidates; add `-Apply` after reviewing. It removes only recognized old builds/installers, test reports, startup logs and the retired WASM copy. It preserves the current package.json version, source, dependencies and dist, and stops on user ciphertext or directory links. Packaged documentation lives in docs, alongside root-level getting-started and release notes.
