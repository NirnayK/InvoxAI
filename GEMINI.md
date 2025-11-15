# Project Overview

This project is a desktop application for processing invoices using AI. It is built with a Next.js frontend and a Tauri backend. The application allows users to upload invoice files (PDFs or images), and then uses the Gemini AI to extract information from them. The extracted data is then stored in a local SQLite database and can be used to generate spreadsheets.

## Technologies Used

*   **Frontend:** Next.js, React, Tailwind CSS
*   **Backend:** Tauri (Rust)
*   **Database:** SQLite
*   **AI:** Google Gemini

# Building and Running

## Prerequisites

*   Install [pnpm](https://pnpm.io)
*   Install the [Tauri CLI](https://tauri.app/v1/guides/getting-started/prerequisites)
*   Ensure the Rust toolchain is up to date

## Development

1.  Install dependencies:
    ```bash
    pnpm install
    ```
2.  Run the Next.js development server:
    ```bash
    pnpm dev
    ```
3.  Run the Tauri development server:
    ```bash
    pnpm tauri:dev
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

# Development Conventions

*   **Code Style:** The project uses ESLint and Prettier to enforce a consistent code style. You can run `pnpm lint` and `pnpm format` to check and format the code.
*   **Database Migrations:** Database schema migrations are defined in `src-tauri/src/sql.rs` and are automatically applied when the Tauri application starts.
*   **Frontend-Backend Communication:** The frontend communicates with the Tauri backend by invoking commands defined in `src-tauri/src/main.rs`. These commands are exposed to the frontend via the `@tauri-apps/api` library.
