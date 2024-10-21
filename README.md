# Readest

Readest is an open-source ebook reading software designed for immersive and deep reading experiences. It supports EPUB and PDF document formats, and with Tauri v2, Readest is cross-platform, running seamlessly on macOS, Windows, and Linux.

## Features

- **EPUB and PDF Support**: Enjoy both EPUB and PDF formats, making Readest versatile for all your reading needs.
- **Cross-Platform Compatibility**: Runs on macOS, Windows, and Linux with Tauri v2.
- **Immersive Reading Experience**: Supports advanced reading features like note-taking, highlighting, and progress syncing.
- **Optimized Performance**: Readest is lightweight, ensuring smooth performance even with large files.
- **Customizable Interface**: Built with daisyUI for a modern and user-friendly UI.

## Screenshots

## Requirements

- **Node.js** and **pnpm** for Next.js development
- **Rust and Cargo** for Tauri development

It is recommended to use a recent version of Node.js and Rust.

```bash
nvm use v22
rustup update
```

## Getting Started

To get started with Readest, follow these steps to clone and build the project.

### 1. Clone the Repository

```bash
git clone https://github.com/chrox/readest.git
cd readest
git submodule update --init --recursive
```

### 2. Install Dependencies

```bash
pnpm install
# copy pdfjs-dist to Next.js public directory
pnpm --filter @readest/readest-app setup-pdfjs
```

### 3. Build the Development

```bash
pnpm tauri dev
```

### 4. Build for Production

```bash
pnpm tauri build
```

## Contributing

Readest is open-source, and contributions are welcome! Feel free to open issues, suggest features, or submit pull requests. Please review our contributing guidelines before you start.

## License

This project is licensed under the MIT License. See the LICENSE file for details.

---

Happy reading with Readest!
