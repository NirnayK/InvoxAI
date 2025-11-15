# Invox AI

Invox AI is a desktop application that uses AI to automate invoice processing. Built with Next.js, Tauri, and Google's Gemini AI, it helps finance teams extract data from PDF and image invoices, validate entries, and prepare them for accounting software like Tally.

The application provides a local-first experience by storing all data in a SQLite database on your machine. You can create tasks, upload invoices, and let the AI process them in the background. Once processed, the extracted data can be reviewed and exported as a spreadsheet.

## Summary

- **Frontend:** Next.js 16 with App Router, Turbopack, and Tailwind CSS.
- **Desktop Shell:** Tauri 2 (Rust) with plugins for database access, dialogs, and local storage.
- **AI-Powered Extraction:** Uses Google's Gemini AI to parse and extract data from invoices.
- **Local Storage:** `tauri-plugin-sql` for SQLite database access, with automated schema migrations.

## Prerequisites

- [pnpm](https://pnpm.io)
- [Tauri CLI](https://tauri.app/v1/guides/getting-started/prerequisites)
- Rust toolchain (1.70+ recommended)

## Database Schema

The application uses a local SQLite database (`app.db`) with the following tables:

- `task`: Stores information about processing tasks, including the task name, status, and a list of associated file IDs.
- `files`: A content-addressable store for all uploaded files. It stores the file's SHA-256 hash, name, path, size, and MIME type.
- `sheets`: Stores information about the spreadsheets generated from the extracted data, including the path to the sheet and the task it's associated with.

Schema migrations are automatically applied at startup by the Tauri backend.

## Backend Commands

The Tauri backend exposes the following commands to the frontend:

- **Filesystem:** `list_directory`, `read_file`, `save_file`, `create_directory`
- **File Import:** `import_file`, `import_data`, `list_files`
- **Storage:** `get_storage_stats`, `clear_processed_files`
- **Sheet Generation:** `append_sheet_rows`, `generate_sheet_xlsx`

These commands allow the frontend to interact with the local filesystem, manage the file store, and generate spreadsheets from the extracted data.

## Local Development

1.  **Install dependencies:**
    ```bash
    pnpm install
    ```
2.  **Run the development server:**
    ```bash
    pnpm dev
    ```
    This will start the Next.js development server on `http://localhost:3000`.
3.  **Run the Tauri development shell:**
    ```bash
    pnpm tauri:dev
    ```
    This will launch the Tauri desktop application, which will load the Next.js development server.

## Building and Distributing

1.  **Build the application:**
    ```bash
    pnpm build
    ```
    This will build the Next.js frontend and export it as a static application.
2.  **Build the Tauri application:**
    ```bash
    pnpm tauri:build
    ```
    This will build the Tauri desktop application for your platform.

## Scripts

- `pnpm dev`: Start the Next.js development server with Turbopack.
- `pnpm build`: Build and export the Next.js application.
- `pnpm start`: Serve the exported application for preview.
- `pnpm tauri:dev`: Run the Tauri development shell.
- `pnpm tauri:build`: Build the Tauri desktop application.
- `pnpm lint`: Lint the codebase with ESLint.
- `pnpm format`: Format the codebase with Prettier.

## Repository Layout

- `app/`: Next.js App Router pages.
- `components/`: Shared React components.
- `hooks/`: Reusable React hooks.
- `lib/`: Application-specific libraries, including database access, AI processing, and filesystem wrappers.
- `src-tauri/`: The Rust crate for the Tauri desktop shell, including the database schema migrations and backend commands.
