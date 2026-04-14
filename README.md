# GitHub Link

An [Obsidian](https://obsidian.md) plugin that shows a status bar link to the current note on GitHub.

## Usage

A small `⎈ GitHub` indicator appears in the status bar when you have a file open:

- **Click `⎈`** — copies the GitHub URL to your clipboard
- **Click `GitHub`** — opens the file on GitHub in your browser

## Configuration

The plugin auto-configures itself from your vault's `.git` folder — no setup required if your vault is a git repository with a GitHub remote.

If you need to override anything, go to **Settings → GitHub Link**:

| Setting | Description |
|---|---|
| GitHub repository URL | Base URL, e.g. `https://github.com/owner/repo`. Leave blank to auto-detect from `.git/config`. |
| Branch | Branch to link to, e.g. `main`. Leave blank to auto-detect from `.git/HEAD`. |
| Vault sub-path in repo | Set this if your vault lives in a sub-directory of the repo, e.g. `notes`. |

## Installation

This plugin is not yet in the Obsidian community plugin registry. To install manually:

1. Download `main.js` and `manifest.json` from the [latest release](../../releases/latest).
2. Copy them into your vault at `.obsidian/plugins/github-link/`.
3. Enable the plugin in **Settings → Community plugins**.

## Development

```bash
npm install
npm run dev      # watch mode with sourcemaps
npm run build    # production build
```

Requires Node.js. Desktop only.

## Author

Frank Lämmer
