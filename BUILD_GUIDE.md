# Build Guide

This guide outlines the steps to build Invox AI for macOS, Windows, and Android.

## 1. macOS (Native Build)

Since you are developing on macOS, this is the most straightforward build.

### Prerequisites
- Xcode Command Line Tools (`xcode-select --install`)
- Rust toolchain
- Node.js & pnpm

### Build Steps
Run the following command in the project root:

```bash
pnpm tauri build
```

### Output
The build artifacts (DMG, App bundle) will be located in:
`src-tauri/target/release/bundle/macos/`

---

## 2. Windows

Building for Windows from macOS is complex due to cross-compilation challenges with C dependencies (like SQLite). The recommended approaches are:

### Option A: Build on a Windows Machine (Recommended)
1.  Clone the repository on a Windows machine.
2.  Install [Rust](https://www.rust-lang.org/tools/install).
3.  Install [Node.js](https://nodejs.org/) and `pnpm`.
4.  Install "C++ build tools" via Visual Studio Build Tools.
5.  Run `pnpm tauri build`.

### Option B: GitHub Actions (CI/CD)
You can set up a GitHub Action to build for Windows automatically when you push code.

Create `.github/workflows/release.yml`:

```yaml
name: Release
on:
  push:
    tags:
      - 'v*'

jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
      - name: Install pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 9
      - name: Install dependencies
        run: pnpm install
      - name: Build
        run: pnpm tauri build
        env:
          # You'll need to set up signing secrets if you want signed builds
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
```

---

## 3. Android

Tauri v2 supports mobile targets, but it requires specific setup.

### Prerequisites
1.  **Java Development Kit (JDK) 17**: Install via brew or download from Oracle/OpenJDK.
    ```bash
    brew install openjdk@17
    ```
2.  **Android Studio**: Download and install.
    - Open SDK Manager (More Actions > SDK Manager).
    - **SDK Platforms**: Install "Android 14.0 (UpsideDownCake)" or newer.
    - **SDK Tools**: Install "Android SDK Build-Tools", "Android SDK Command-line Tools", "Android SDK Platform-Tools", and "NDK (Side by side)".
3.  **Environment Variables**:
    Add these to your shell profile (`~/.zshrc`):
    ```bash
    export JAVA_HOME="/opt/homebrew/opt/openjdk@17"
    export ANDROID_HOME="$HOME/Library/Android/sdk"
    export NDK_HOME="$ANDROID_HOME/ndk/<your-ndk-version>"
    ```

### Initialization
Initialize Android support in your project:

```bash
pnpm tauri android init
```
This will create `src-tauri/gen/android`.

### Code Adjustments for Mobile
**Important**: Mobile apps have stricter filesystem permissions.
- The current usage of the `dirs` crate in `src-tauri/src/db.rs` to find the data directory might need adjustment.
- Tauri provides `app.path().app_data_dir()` which handles platform-specific paths correctly.
- You may need to refactor `db.rs` to accept an `AppHandle` to resolve paths instead of hardcoding `dirs::data_dir()`.

### Build Steps
To run on a connected device or emulator:
```bash
pnpm tauri android dev
```

To build an APK/AAB for release:
```bash
pnpm tauri android build
```

### Output
The APKs will be located in:
`src-tauri/gen/android/app/build/outputs/apk/universal/release/`
