# Project Overview

**Invox AI** is a desktop application that uses AI to automate invoice processing. Built with Next.js, Tauri, and Google's Gemini AI, it helps finance teams extract data from PDF and image invoices, validate entries, and prepare them for accounting software like Tally.

The application provides a local-first experience by storing all data in a SQLite database on your machine. Users can create tasks, upload invoices, and let the AI process them in the background. Once processed, the extracted data can be reviewed and exported as a spreadsheet.

## Technologies Used

- **Frontend:** Next.js 16 with App Router, Turbopack, React 19, and Tailwind CSS 4
- **Backend:** Tauri 2 (Rust) with plugins for database access, dialogs, and local storage
- **Database:** SQLite via `tauri-plugin-sql` with automated schema migrations
- **AI:** Google Gemini AI (via `@google/genai` package)
- **UI Components:** Radix UI primitives with custom styling
- **Additional Libraries:**
  - `react-hook-form` + `zod` for form validation
  - `@tanstack/react-table` for data tables
  - `rust_xlsxwriter` for spreadsheet generation
  - `blake3` for file hashing

# Database Schema

The application uses a local SQLite database (`app.db`) stored in the system's application data directory (`~/Library/Application Support/com.invox.ai` on macOS).

## Tables

### `task`

Stores information about processing tasks:

- `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
- `name` (TEXT NOT NULL) - Task name
- `files_associated` (TEXT NOT NULL DEFAULT '[]') - JSON array of file IDs
- `file_count` (INTEGER NOT NULL DEFAULT 0) - Number of associated files
- `status` (TEXT NOT NULL DEFAULT 'Pending') - Task status (Pending, Processing, Completed, Failed, Cancelled)
- `created_at` (TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)
- `updated_at` (TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP) - Auto-updated via trigger

### `files`

Content-addressable store for uploaded files:

- `id` (TEXT PRIMARY KEY) - UUID v4
- `hash_sha256` (TEXT NOT NULL UNIQUE) - BLAKE3 hash for deduplication
- `file_name` (TEXT NOT NULL) - Original filename
- `stored_path` (TEXT NOT NULL) - Absolute path to stored file
- `size_bytes` (INTEGER NOT NULL) - File size
- `mime_type` (TEXT) - MIME type
- `status` (TEXT NOT NULL DEFAULT 'Unprocessed') - Processing status
- `parsed_details` (TEXT) - JSON data extracted by AI
- `created_at` (TEXT DEFAULT CURRENT_TIMESTAMP)

### `sheets`

Stores information about generated spreadsheets:

- `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
- `task_id` (INTEGER) - Foreign key to task (nullable, ON DELETE SET NULL)
- `sheet_path` (TEXT NOT NULL) - User-facing sheet name
- `sheet_file_path` (TEXT) - Absolute path to CSV file
- `created_at` (TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)
- `updated_at` (TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP) - Auto-updated via trigger

# Backend Commands

The Tauri backend (`src-tauri/src/`) exposes the following commands to the frontend:

## Filesystem Commands (`filesystem.rs`)

- `list_directory(path: String)` - List directory contents
- `read_file(path: String)` - Read text file
- `read_binary_file(path: String)` - Read binary file as base64
- `save_file(path: String, content: String)` - Write text file
- `create_directory(path: String)` - Create directory

## File Import Commands (`commands.rs`)

- `import_file(path: String)` - Import file from filesystem path
- `import_data(file_name: String, bytes: Vec<u8>)` - Import file from bytes
- `list_files()` - List recent files (limit 50)

## Storage Commands (`commands.rs`)

- `get_storage_stats()` - Get storage directory stats (path, total bytes, file count)
- `clear_processed_files()` - Delete files from completed tasks (if not used by active tasks)

## Sheet Generation Commands (`commands.rs`)

- `append_sheet_rows(task_id: i64, rows: Vec<SheetRowInput>)` - Append rows to task's CSV sheet
- `generate_sheet_xlsx(task_id: i64)` - Generate XLSX file from CSV and save to Downloads

## Logging Command (`commands.rs`)

- `append_log_entry(level: &str, message: &str, context: Option<String>, metadata: Option<String>)` - Append to `invox.log`

# Project Structure

```
invox-ai/
├── app/                    # Next.js App Router pages
│   ├── account/           # Account settings page
│   ├── dashboard/         # Main dashboard
│   ├── new-task/          # Task creation page
│   ├── task/              # Task detail pages
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Landing page
├── components/            # React components
│   ├── files/            # File management components
│   ├── layout/           # Layout components
│   ├── task-details/     # Task detail components
│   ├── tasks/            # Task list components
│   ├── theme/            # Theme provider and toggle
│   └── ui/               # Radix UI-based components
├── lib/                   # Application libraries
│   ├── invoice/          # Invoice processing logic
│   ├── database.ts       # Database connection wrapper
│   ├── file-import.ts    # File import utilities
│   ├── filesystem.ts     # Filesystem command wrappers
│   ├── logger.ts         # Logging utilities
│   ├── preferences.ts    # User preferences (Gemini API key)
│   ├── sheets.ts         # Sheet generation utilities
│   ├── storage.ts        # Storage management
│   ├── task-processing.ts # Task processing orchestration
│   └── tasks.ts          # Task CRUD operations
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── commands.rs   # Tauri command implementations
│   │   ├── db.rs         # Database schema and migrations
│   │   ├── filesystem.rs # Filesystem command implementations
│   │   └── main.rs       # Tauri app entry point
│   └── Cargo.toml        # Rust dependencies
└── package.json          # Node.js dependencies
```

# Building and Running

## Prerequisites

- [pnpm](https://pnpm.io) - Package manager
- [Tauri CLI](https://tauri.app/v1/guides/getting-started/prerequisites) - Desktop app framework
- Rust toolchain (1.70+ recommended)
- Google Gemini API key (required for invoice processing)

## Development

1.  Install dependencies:
    ```bash
    pnpm install
    ```
2.  Run the Next.js development server:
    ```bash
    pnpm dev
    ```
3.  Run the Tauri development shell:
    ```bash
    pnpm tauri:dev
    # or use the alias:
    pnpm local
    ```

## Building

1.  Build the Next.js frontend:
    ```bash
    pnpm build
    ```
2.  Build the Tauri application:
    ```bash
    pnpm tauri:build
    ```

## Useful Scripts

- `pnpm del` - Delete application data directory (useful for testing)
- `pnpm lint` - Run ESLint
- `pnpm format` - Format code with Prettier

# Development Conventions

- **Code Style:** The project uses ESLint and Prettier to enforce a consistent code style. Run `pnpm lint` and `pnpm format` to check and format the code.
- **Database Migrations:** Database schema migrations are defined in `src-tauri/src/db.rs` in the `schema_migrations()` function and are automatically applied when the Tauri application starts via the SQL plugin.
- **Frontend-Backend Communication:** The frontend communicates with the Tauri backend by invoking commands defined in `src-tauri/src/main.rs`. These commands are exposed to the frontend via the `@tauri-apps/api` library.
- **File Storage:** Files are stored in a content-addressable manner using BLAKE3 hashes. Duplicate files are automatically detected and deduplicated.
- **Logging:** Only `info`, `warn`, and `error` levels are persisted to `invox.log` by default. Set `NEXT_PUBLIC_PERSIST_LOG_LEVEL=debug` to enable debug logging.
- **API Keys:** The Gemini API key is stored via the desktop Account preferences page or can be provided through `NEXT_PUBLIC_GEMINI_API_KEY` environment variable.
