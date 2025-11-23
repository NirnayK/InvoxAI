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

## 2. Windows & macOS (Automated CI/CD)

We have set up a GitHub Action to automatically build for both **Windows** and **macOS** whenever you push a version tag (e.g., `v0.1.0`).

### How to Trigger a Build
1.  Commit your changes.
2.  Tag the commit:
    ```bash
    git tag v0.1.0
    git push origin v0.1.0
    ```
3.  Go to the "Actions" tab in your GitHub repository to watch the build.
4.  Once complete, a new "Draft Release" will be created in the "Releases" section containing:
    - `Invox AI_0.1.0_x64_en-US.msi` (Windows Installer)
    - `Invox AI_0.1.0_x64.dmg` (macOS Installer)
    - `Invox AI.app.tar.gz` (macOS App Bundle)

### Configuration
The workflow file is located at `.github/workflows/release.yml`. It uses the `tauri-apps/tauri-action` to handle the build process.

> **Note:** We have skipped code signing for now. Windows users may see a "Windows protected your PC" warning (SmartScreen) when installing. They can click "More info" > "Run anyway" to install.

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
