This is the Invox AI workspace shell: a [Next.js 16](https://nextjs.org) frontend wrapped in a Tauri 2 desktop shell powered by `tauri-plugin-sql` and SQLite.

## Summary

- **Frontend:** App router (`app/`) with `turbopack`, Tailwind-inspired utilities, and shared UI primitives under `components/ui/`.
- **Desktop shell:** `src-tauri/` hosts the Rust application that boots Tauri, registers the SQL plugin, and runs migrations before launching the renderer.
- **Local storage:** `@tauri-apps/plugin-sql` exposes SQLite via `lib/database.ts`, and the Rust migrations ensure `task`, `file`, and `sheets` tables exist with timestamp triggers, default metadata, and simple associations.

## Prerequisites

- Install [pnpm](https://pnpm.io) (this repo assumes it is available).
- Install the [Tauri CLI](https://tauri.app/v1/guides/getting-started/prerequisites) (`pnpm add -g @tauri-apps/cli` or via cargo).
- Ensure Rust toolchain (`cargo`, `rustc`) is up to date (1.70+ recommended for Tauri 2).

## Supporting tables (SQLite)

- `task`: stores workflow names, JSON list of associated files (`files_associated` defaults to `[]`), `file_count`, and automatic `created_at`/`updated_at` timestamps.
- `files`: stores UUID primary key, unique SHA-256 hash, file name, stored path, size, optional MIME type, and `created_at`; an index on `hash_sha256` keeps lookups fast.
- `sheets`: lightweight storage for sheet paths (`sheet_path`) and their originating file locations (`sheet_file_path`) linked to tasks while keeping timestamp triggers for `created_at`/`updated_at`.
- `lib/database.ts` guards access to the SQL plugin so it only runs inside Tauri (`window.__TAURI_INTERNALS__`), loads `sqlite:app.db`, and caches the connection promise for reuse.

## Filesystem integration

- `src-tauri/src/main.rs` now exposes `list_directory`, `read_file`, `save_file`, and `create_directory`, each of which uses `std::fs` and returns safe DTOs so the renderer can navigate, read, and write local storage without bundling Node APIs into the browser bundle.
- `lib/filesystem.ts` wraps those commands through `@tauri-apps/api/tauri.invoke`, guards them with `isTauriRuntime()`, and exposes helper functions that front-end code can call when it needs to probe the workspace directory, surface file contents, or persist parsed artifacts.

## File-import commands

- `src-tauri/src/db.rs` calculates the Tauri data directory, creates an `app.db` plus a `files` storage directory, and hands back a `rusqlite::Connection`.
- `src-tauri/src/commands.rs` adds `import_file` and `list_files`. `import_file` digests a file from disk, hashes it with BLAKE3, deduplicates, copies it into the `files/` storage folder, and inserts tracking rows; `list_files` streams the most recent 50 rows back to the renderer so the UI can show what’s already imported.

## Local development

```bash
pnpm install
pnpm dev          # start Next.js + Turbopack on http://localhost:3000
pnpm tauri:dev    # launches the Tauri desktop shell (runs `pnpm dev` first)
```

- The desktop shell automatically runs the Rust migrations defined in `src-tauri/src/main.rs`, so the three tables above are created/kept in sync before the renderer runs.
- If you prefer to iterate in the browser, stop the Tauri CLI and reload `http://localhost:3000`.

## Building and distributing

```bash
pnpm build         # runs `next build` and `next export` so `out/` contains the static bundle
pnpm start         # serves the exported bundle on port 3000 for preview
pnpm tauri:build   # builds the Rust binary (reruns the export via the before-build hook)
```

- The Tauri config (`src-tauri/tauri.conf.json`) instructs the CLI to reuse the `out/` folder, set up a 1280×800 window, and bundle for `all` targets with the default icons squeezed into `icons/`.
- `pnpm start` uses `serve` via `pnpm dlx` so you can preview what the desktop shell will load locally.

## Scripts

- `pnpm dev` — start turbopack-dev Next.js server.
- `pnpm build` — prepare `out/` as a fully exported static app.
- `pnpm start` — run a simple server hosting the static export.
- `pnpm tauri:dev` — spins up Tauri, running the Next.js dev server beforehand.
- `pnpm tauri:build` — packages the desktop app (runs `pnpm build` first).
- `pnpm lint` / `pnpm format` — keep code style consistent via ESLint and Prettier.

## Repository layout

- `app/` — Next.js App Router entry points, including `app/account` with workspace settings.
- `components/` — shared UI primitives, layout helpers, and domain-specific features (`files/`, `tasks/`, etc.).
- `hooks/` — reusable React hooks for mutating state and business logic.
- `lib/` — runtime helpers (`database.ts`, etc.) that orchestrate platform-specific APIs.
- `src-tauri/` — Rust crate for the Tauri shell plus migration logic.

## Notes

- The project uses `next export` to satisfy Tauri’s static frontend requirement, so avoid Next.js-only features that need server runtimes (API routes, edge middleware, etc.).
- You can run `pnpm lint`/`pnpm format` directly or rely on the workspace file for the configured VS Code formatter.

## Learn more

- [Tauri documentation](https://tauri.app) – desktop packaging, plugin APIs, and configuration.
- [tauri-plugin-sql](https://docs.rs/tauri-plugin-sql/latest/tauri_plugin_sql/) – how migrations and the plugin APIs behave.
- [Next.js App Router](https://nextjs.org/docs/app) – details on server components, loading, and layouts.
