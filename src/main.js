/*
 * GitHub Link – Obsidian Plugin
 * Shows a clickable status-bar link to the current note on GitHub.
 */

'use strict';

const { Plugin, PluginSettingTab, Setting, Notice } = require('obsidian');

const DEFAULT_SETTINGS = {
  repoUrl: '',       // e.g. https://github.com/owner/repo  (no trailing slash)
  branch: '',        // e.g. main  — leave blank to auto-detect from .git/HEAD
  vaultSubPath: '',  // if the vault lives in a sub-directory of the repo, set that relative path here
};

// ---------------------------------------------------------------------------
// Git helpers (vault adapter — no raw Node.js fs/path)
// ---------------------------------------------------------------------------

async function readGitConfig(adapter) {
  try {
    if (!(await adapter.exists('.git/config'))) return null;
    return await adapter.read('.git/config');
  } catch {
    return null;
  }
}

function parseRemoteUrl(gitConfigContent) {
  // Look for [remote "origin"] url = ...
  const match = gitConfigContent.match(/\[remote\s+"origin"\][\s\S]*?url\s*=\s*(.+)/);
  if (!match) return null;
  let url = match[1].trim();
  // Convert SSH to HTTPS: git@github.com:owner/repo.git → https://github.com/owner/repo
  url = url.replace(/^git@github\.com:/, 'https://github.com/');
  // Strip .git suffix
  url = url.replace(/\.git$/, '');
  return url;
}

async function readCurrentBranch(adapter) {
  try {
    if (!(await adapter.exists('.git/HEAD'))) return null;
    const content = (await adapter.read('.git/HEAD')).trim();
    // "ref: refs/heads/main"
    const match = content.match(/^ref:\s*refs\/heads\/(.+)$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

class GitHubLinkPlugin extends Plugin {
  async onload() {
    await this.loadSettings();

    // Status bar item
    this.statusBarItem = this.addStatusBarItem();
    this.statusBarItem.addClass('github-link-status');

    // Update on file switch / open
    this.registerEvent(
      this.app.workspace.on('file-open', () => this.updateStatusBar())
    );

    // Command: open current file on GitHub
    this.addCommand({
      id: 'open-on-github',
      name: 'Open current file on GitHub',
      callback: () => this.openOnGitHub(),
    });

    // Settings tab
    this.addSettingTab(new GitHubLinkSettingTab(this.app, this));

    this.updateStatusBar();
  }

  // -------------------------------------------------------------------------

  async resolveRepoUrl() {
    if (this.settings.repoUrl) return this.settings.repoUrl;
    const gitConfig = await readGitConfig(this.app.vault.adapter);
    if (!gitConfig) return null;
    return parseRemoteUrl(gitConfig);
  }

  async resolveBranch() {
    if (this.settings.branch) return this.settings.branch;
    return (await readCurrentBranch(this.app.vault.adapter)) || 'main';
  }

  async buildGitHubUrl(activeFile) {
    if (!activeFile) return null;
    const repoUrl = await this.resolveRepoUrl();
    if (!repoUrl) return null;

    const branch = await this.resolveBranch();

    // Build the file path within the repo
    // vaultSubPath allows for vaults that live in a sub-directory of the repo
    const sub = this.settings.vaultSubPath
      ? this.settings.vaultSubPath.replace(/^\/|\/$/g, '') + '/'
      : '';
    const filePath = sub + activeFile.path;

    return `${repoUrl}/blob/${branch}/${filePath}`;
  }

  async updateStatusBar() {
    const file = this.app.workspace.getActiveFile();
    const url = await this.buildGitHubUrl(file);
    this._currentUrl = url || null;

    // Rebuild child spans each update
    this.statusBarItem.empty();

    const iconSpan = this.statusBarItem.createSpan();
    iconSpan.setText('⎈ ');
    iconSpan.style.cursor = 'pointer';
    iconSpan.title = 'Copy GitHub URL to clipboard';
    iconSpan.addEventListener('click', () => this.copyUrlToClipboard());

    const textSpan = this.statusBarItem.createSpan();
    textSpan.setText('GitHub');
    textSpan.style.cursor = 'pointer';
    textSpan.title = 'Open this file on GitHub';
    textSpan.addEventListener('click', () => this.openOnGitHub());

    this.statusBarItem.style.opacity = url ? '1' : '0.4';
  }

  copyUrlToClipboard() {
    const url = this._currentUrl;
    if (!url) {
      new Notice('GitHub Link: no repo configured or no file open.');
      return;
    }
    navigator.clipboard.writeText(url).then(() => {
      new Notice('GitHub URL copied to clipboard.');
    });
  }

  openOnGitHub() {
    const url = this._currentUrl;
    if (!url) {
      new Notice('GitHub Link: no repo configured or no file open.');
      return;
    }
    window.open(url, '_blank');
  }

  // -------------------------------------------------------------------------

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.updateStatusBar();
  }
}

// ---------------------------------------------------------------------------
// Settings tab
// ---------------------------------------------------------------------------

class GitHubLinkSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'GitHub Link settings' });

    // Auto-detected values — fetched async and inserted once resolved
    const adapter = this.plugin.app.vault.adapter;
    const info = containerEl.createEl('p');
    info.style.color = 'var(--text-muted)';
    info.style.fontSize = '0.85em';
    info.setText('Detecting repo info…');

    Promise.all([readGitConfig(adapter), readCurrentBranch(adapter)]).then(([gitConfig, detectedBranch]) => {
      const detectedUrl = gitConfig ? parseRemoteUrl(gitConfig) : null;
      if (detectedUrl || detectedBranch) {
        info.setText(
          `Auto-detected from .git — repo: ${detectedUrl || '(none)'}, branch: ${detectedBranch || '(none)'}`
        );
      } else {
        info.remove();
      }
    });

    new Setting(containerEl)
      .setName('GitHub repository URL')
      .setDesc(
        'Base URL of your GitHub repo, e.g. https://github.com/owner/repo. ' +
        'Leave blank to auto-detect from .git/config.'
      )
      .addText(text =>
        text
          .setPlaceholder('https://github.com/owner/repo')
          .setValue(this.plugin.settings.repoUrl)
          .onChange(async value => {
            this.plugin.settings.repoUrl = value.trim().replace(/\/$/, '');
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Branch')
      .setDesc(
        'Branch to link to, e.g. main. Leave blank to auto-detect from .git/HEAD.'
      )
      .addText(text =>
        text
          .setPlaceholder('main')
          .setValue(this.plugin.settings.branch)
          .onChange(async value => {
            this.plugin.settings.branch = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Vault sub-path in repo')
      .setDesc(
        'If your vault is not at the root of the repo, enter the relative path here. ' +
        'E.g. "notes" if the vault lives at <repo>/notes/.'
      )
      .addText(text =>
        text
          .setPlaceholder('notes')
          .setValue(this.plugin.settings.vaultSubPath)
          .onChange(async value => {
            this.plugin.settings.vaultSubPath = value.trim().replace(/^\/|\/$/g, '');
            await this.plugin.saveSettings();
          })
      );
  }
}

module.exports = GitHubLinkPlugin;
