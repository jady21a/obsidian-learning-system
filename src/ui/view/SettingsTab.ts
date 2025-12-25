// SettingsTab.ts
import { App, PluginSettingTab, Setting } from 'obsidian';
import type LearningSystemPlugin from '../../main';

export class SettingsTab extends PluginSettingTab {
  plugin: LearningSystemPlugin;

  constructor(app: App, plugin: LearningSystemPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Learning System Settings' });

    new Setting(containerEl)
      .setName('Enable extraction')
      .setDesc('Enable automatic content extraction')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.extractionEnabled)
          .onChange(async value => {
            this.plugin.settings.extractionEnabled = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Auto scan')
      .setDesc('Automatically scan files when they are opened')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.autoScan)
          .onChange(async value => {
            this.plugin.settings.autoScan = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Default deck')
      .setDesc('Default deck name for new flashcards')
      .addText(text =>
        text
          .setPlaceholder('Default')
          .setValue(this.plugin.settings.defaultDeck)
          .onChange(async value => {
            this.plugin.settings.defaultDeck = value;
            await this.plugin.saveSettings();
          })
      );
  }
}