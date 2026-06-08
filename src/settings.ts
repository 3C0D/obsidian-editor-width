import { PluginSettingTab, Setting } from 'obsidian';
import type { App } from 'obsidian';
import type EditorWidthPlugin from './main.ts';

export class Settings extends PluginSettingTab {
  constructor(
    app: App,
    public plugin: EditorWidthPlugin
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h3', { text: 'Editor Line Width' });

    new Setting(containerEl)
      .setName('Enable Line Width')
      .setDesc('Enable the editor width control and width icons in markdown tabs')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.enableLineWidth).onChange(async (value) => {
          this.plugin.settings.enableLineWidth = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName('Line Width Color')
      .setDesc('Choose the color of the width control icons')
      .addColorPicker((color) =>
        color.setValue(this.plugin.settings.lineWidthColor).onChange(async (value) => {
          this.plugin.settings.lineWidthColor = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName('Restore cursor on close')
      .setDesc('Restore the cursor and selection when closing the width popup')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.restoreCursorOnClose)
          .onChange(async (value) => {
            this.plugin.settings.restoreCursorOnClose = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
