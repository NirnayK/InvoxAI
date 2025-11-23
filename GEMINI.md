# Project Overview

**Invox AI** is a desktop application that uses AI to automate invoice processing. Built with Next.js, Tauri, and Google's Gemini AI, it helps finance teams extract data from PDF and image invoices, validate entries, and prepare them for accounting software like Tally.

The application provides a local-first, file-centric experience by storing all data in a SQLite database on your machine. Users can upload invoice files, process them with AI, and generate XML exports for accounting software.

## Technologies Used

- **Frontend:** Next.js 16 with App Router, Turbopack, React 19, and Tailwind CSS 4
- **Backend:** Tauri 2 (Rust) with plugins for database access, dialogs, and local storage
- **Database:** SQLite via `tauri-plugin-sql` with automated schema migrations
- **AI:** Google Gemini AI (via `@google/genai` package)
- **UI Components:** Radix UI primitives with custom styling
- **Data Layer:** Repository Pattern with CQRS (Command Query Responsibility Segregation)
- **Additional Libraries:**
  - `react-hook-form` + `zod` for form validation
  - `@tanstack/react-table` for data tables
  - `rust_xlsxwriter` for spreadsheet generation
  - `blake3` for file hashing

# Database Schema

The application uses a local SQLite database (`app.db`) stored in the system's application data directory (`~/Library/Application Support/com.invox.ai` on macOS).

## Tables

### `files`

Content-addressable store for uploaded files:

- `id` (TEXT PRIMARY KEY) - UUID v4
- `hash_sha256` (TEXT NOT NULL UNIQUE) - BLAKE3 hash for deduplication
- `file_name` (TEXT NOT NULL) - Original filename
- `stored_path` (TEXT NOT NULL) - Absolute path to stored file
- `size_bytes` (INTEGER NOT NULL) - File size
- `mime_type` (TEXT) - MIME type
- `status` (TEXT NOT NULL DEFAULT 'Unprocessed') - Processing status (Unprocessed, Processing, Processed, Failed)
- `parsed_details` (TEXT) - JSON data extracted by AI
- `created_at` (TEXT DEFAULT CURRENT_TIMESTAMP)
- `processed_at` (TEXT) - Timestamp when file was processed
- `updated_at` (TEXT DEFAULT CURRENT_TIMESTAMP) - Auto-updated via trigger

### `xml_files`

Stores information about generated XML exports:

- `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
- `xml_name` (TEXT NOT NULL) - User-facing XML export name
- `file_ids` (TEXT NOT NULL DEFAULT '[]') - JSON array of file IDs included in this export
- `xml_path` (TEXT NOT NULL) - Sanitized filename for the export
- `xml_file_path` (TEXT) - Absolute path to generated XML file
- `created_at` (TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)
- `updated_at` (TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP) - Auto-updated via trigger

# Backend Commands

The Tauri backend (`src-tauri/src/commands/`) exposes the following commands to the frontend:

## Filesystem Commands (`filesystem.rs`)

- `list_directory(path: String)` - List directory contents
- `read_file(path: String)` - Read text file
- `read_binary_file(path: String)` - Read binary file as base64
- `save_file(path: String, content: String)` - Write text file
- `create_directory(path: String)` - Create directory

## File Operations (`file_operations.rs`)

- `import_file(path: String)` - Import file from filesystem path
- `import_data(file_name: String, bytes: Vec<u8>)` - Import file from bytes
- `list_files()` - List recent files (limit 50)
- `list_files_paginated(query: FileListQuery)` - List files with pagination, filtering, and sorting
- `update_file_status(file_id: String, status: String)` - Update file processing status
- `update_file_parsed_details(file_id: String, parsed_details: String)` - Update extracted data
- `update_files_status(file_ids: Vec<String>, status: String)` - Batch update file statuses
- `delete_files(file_ids: Vec<String>)` - Delete files from database and disk

## Storage Operations (`storage_operations.rs`)

- `get_storage_stats()` - Get storage directory stats (path, total bytes, file count)

## XML Operations (`xml_operations.rs`)

- `create_xml_for_files(file_ids: Vec<String>, xml_name: String)` - Create XML export record
- `list_xml_files()` - List all XML exports
- `append_xml_file(xml_id: i64, file_ids: Vec<String>)` - Add files to existing XML export
- `generate_xml_file(xml_id: i64)` - Generate XML content from processed files

## Logging Operations (`logging_operations.rs`)

- `append_log_entry(level: &str, message: &str, context: Option<String>, metadata: Option<String>)` - Append to `invox.log`

# Project Structure

```
invox-ai/
├── app/                    # Next.js App Router pages
│   ├── account/           # Account settings page
│   ├── dashboard/         # Main dashboard (file-centric)
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Landing page
├── components/            # React components
│   ├── files/            # File management components (data table, upload, actions)
│   ├── layout/           # Layout components
│   ├── theme/            # Theme provider and toggle
│   └── ui/               # Radix UI-based components
├── lib/                   # Application libraries
│   ├── files/            # File repository (CQRS pattern)
│   │   ├── commands.ts   # Write operations
│   │   ├── queries.ts    # Read operations
│   │   ├── repository.ts # Repository interface
│   │   ├── types.d.ts    # TypeScript types
│   │   ├── file-import.ts # File import utilities
│   │   └── file-processing.ts # File processing orchestration
│   ├── invoice/          # Invoice processing logic
│   │   ├── batch.ts      # Batch processing with retry
│   │   ├── constants.ts  # Invoice schema and constants
│   │   ├── helpers.ts    # Helper functions
│   │   ├── process.ts    # AI processing logic
│   │   └── types.d.ts    # Invoice types
│   ├── xml/              # XML generation and management
│   │   └── index.ts      # XML operations
│   ├── constants.ts      # Shared constants (file statuses)
│   ├── database.ts       # Database connection wrapper
│   ├── filesystem.ts     # Filesystem command wrappers
│   ├── logger.ts         # Logging utilities
│   ├── preferences.ts    # User preferences (Gemini API key)
│   ├── storage.ts        # Storage management
│   └── utils.ts          # Utility functions
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── commands/     # Modular command implementations
│   │   │   ├── file_operations.rs
│   │   │   ├── xml_operations.rs
│   │   │   ├── storage_operations.rs
│   │   │   ├── logging_operations.rs
│   │   │   └── mod.rs
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
- **Frontend-Backend Communication:** The frontend communicates with the Tauri backend by invoking commands defined in `src-tauri/src/commands/`. These commands are exposed to the frontend via the `@tauri-apps/api` library.
- **File Storage:** Files are stored in a content-addressable manner using BLAKE3 hashes. Duplicate files are automatically detected and deduplicated.
- **Logging:** Only `info`, `warn`, and `error` levels are persisted to `invox.log` by default. Set `NEXT_PUBLIC_PERSIST_LOG_LEVEL=debug` to enable debug logging.
- **API Keys:** The Gemini API key is stored via the desktop Account preferences page or can be provided through `NEXT_PUBLIC_GEMINI_API_KEY` environment variable.
