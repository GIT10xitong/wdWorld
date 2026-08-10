# WD World

A local-first worldbuilding workbench. Built for OC creators, novelists, and TRPG game masters to maintain characters, locations, organizations, events, and other lore entries locally and securely.

All data is stored locally. Works offline. The project directory can be copied, compressed, and migrated as a whole.

## Features

- **Project Management**: Create, open, recent projects list
- **Entry System**: 8 entry types — character, location, faction, item, event, lore, region, note
- **Markdown Editor**: Powered by TipTap, supports internal links `[[Entry Title]]`
- **Tags & Aliases**: Classification and quick retrieval
- **Relations**: Explicit relation management, backlinks, relationship graph visualization
- **Search**: Title search, tag filter, type filter, full-text search
- **Map View**: Custom base map, region annotation, anchor system, entry placement
- **Timeline**: Entry-level and world-level timelines
- **Wiki View**: Reading mode, directory navigation, context linkage
- **Export & Backup**: JSON import/export, static Wiki export, auto-save

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop Shell | Electron |
| Frontend | React 18 + TypeScript |
| Build Tool | Vite |
| Styling | TailwindCSS 3 |
| State Management | Zustand |
| Rich Text Editor | TipTap |
| Local Storage | sql.js (SQLite WASM) + localStorage |
| Icons | Lucide React |

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install & Run

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

### Build & Package

```bash
npm run build           # Build production bundle to dist/
npm run package         # Package to release/ directory
npm run electron:build  # Build Electron installer
```

### MVP Prototype

The project includes a vanilla JS MVP prototype (in the `mvp/` directory) that runs without Node.js:

```bash
# On Windows, double-click
run-mvp.bat
```

Open `http://127.0.0.1:4173` in your browser.

## Project Structure

```text
vvdWorld/
├── electron/           # Electron desktop shell
│   └── main.js
├── mvp/                # MVP prototype (vanilla JS)
│   ├── js/
│   ├── index.html
│   └── styles.css
├── scripts/            # Packaging and utility scripts
│   ├── package.js
│   └── check-encoding.ps1
├── src/                # React app source
│   ├── components/     # UI components
│   ├── lib/            # Storage and utilities
│   ├── store/          # Zustand state management
│   ├── types/          # TypeScript type definitions
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

## Data Storage

Project data is stored locally in the browser's localStorage. The desktop version uses SQLite (sql.js). No cloud dependency — no user data is ever uploaded.

The project directory can be copied, compressed, and migrated to another device as a whole.

## Entry Types

| Type | Description | Example |
|------|-------------|---------|
| Character | Roles, NPCs, creatures | Protagonist, villain |
| Location | Specific scenes, buildings | Castle, town |
| Faction | Forces, groups, institutions | Guild, kingdom |
| Item | Props, weapons, artifacts | Holy sword, relic |
| Event | Plot events, historical milestones | War, ritual |
| Lore | Rules, worldbuilding background | Magic system |
| Region | Geographic areas, map regions | Continent, forest |
| Note | Temporary ideas, to-dos | Inspiration notes |

## Internal Links

Use double-bracket syntax in entry content to create internal links:

```markdown
[[Entry Title]]
[[Entry Title|Display Text]]
```

Click a link to navigate to the corresponding entry.

## Encoding Convention

- All text files use UTF-8 encoding.
- If you encounter garbled text or BOM issues, run the encoding check script:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\check-encoding.ps1
```

## Documentation

- [QUICKSTART.md](./QUICKSTART.md) - Quick start guide (in Chinese)

## Notes

This project references the public product pages and demo structure of `vvd.world` for local product planning and prototyping. It does not involve any proprietary source code or unpublished assets.
