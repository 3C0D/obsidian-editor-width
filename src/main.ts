import { Plugin, debounce } from 'obsidian';
import { Settings } from './settings.ts';
import { DEFAULT_SETTINGS } from './variables.ts';
import type { EditorWidthSettings } from './interfaces.ts';
import { WidthGuides } from './guides.ts';
import { getFilePathForLeaf, getWidthForLeafPath } from './leaf-utils.ts';
import { WidthManager } from './width-manager.ts';
import { PopupManager } from './popup-manager.ts';
import { LeafIconManager } from './leaf-icon-manager.ts';

export default class EditorWidthPlugin extends Plugin {
  settings!: EditorWidthSettings;
  lineWidthStyleEl!: HTMLStyleElement;
  guides!: WidthGuides;
  widthManager!: WidthManager;
  popupManager!: PopupManager;
  leafIconManager!: LeafIconManager;

  saveDebounced = debounce(
    async () => {
      await this.saveData(this.settings);
    },
    500,
    false
  );

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new Settings(this.app, this));

    this.lineWidthStyleEl = document.createElement('style');
    document.head.appendChild(this.lineWidthStyleEl);

    this.widthManager = new WidthManager(
      () => this.settings,
      this.lineWidthStyleEl,
      (cb) => this.app.workspace.iterateAllLeaves(cb)
    );
    this.widthManager.applyLineWidth();

    this.guides = new WidthGuides(
      (filePath) => getWidthForLeafPath(filePath, this.settings),
      (leaf) => getFilePathForLeaf(leaf)
    );

    this.leafIconManager = new LeafIconManager(
      () => this.settings,
      (cb) => this.app.workspace.iterateAllLeaves(cb),
      this.registerDomEvent.bind(this)
    );

    this.popupManager = new PopupManager(
      this.app,
      () => this.settings,
      (data) => this.saveData(data),
      this.saveDebounced,
      this.widthManager,
      this.guides,
      (leaf) => this.leafIconManager.refresh(leaf),
      (leaf, opts) => this.app.workspace.setActiveLeaf(leaf, opts)
    );

    this.leafIconManager.setPopupManager(this.popupManager);

    this.registerEvent(
      this.app.workspace.on('layout-change', () => {
        this.widthManager.updateEditorWidths();
        this.leafIconManager.injectAll();
      })
    );

    this.registerDomEvent(document, 'click', (e) =>
      this.popupManager.onDocumentClick(e, this.leafIconManager.getLeafIcons())
    );

    this.app.workspace.onLayoutReady(() => {
      this.leafIconManager.injectAll();
    });
  }

  onunload(): void {
    this.lineWidthStyleEl.remove();
    this.leafIconManager.cleanup();
    this.popupManager.cleanup();
    this.guides.cleanup();
    this.widthManager.cleanupResizeObserver();
  }

  async loadSettings(): Promise<void> {
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...(await this.loadData())
    };
    if (!this.settings.localWidths) this.settings.localWidths = {};
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.widthManager.applyLineWidth();
    this.leafIconManager.refreshAll();
  }
}
