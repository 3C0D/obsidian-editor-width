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

  /**
   * Debounced save function to prevent excessive disk I/O when the slider is moved rapidly.
   */
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

    // Create a style element in the document head to host our global CSS overrides.
    // This allows us to apply width constraints that persist even when Obsidian
    // recreates internal editor components.
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

    // Watch for layout changes (e.g., opening new panes) to inject icons and update widths
    this.registerEvent(
      this.app.workspace.on('layout-change', () => {
        this.widthManager.updateEditorWidths();
        this.leafIconManager.injectAll();
      })
    );

    // Watch for active tab changes to ensure icons and widths are synced for the current file
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', () => {
        this.widthManager.updateEditorWidths();
        this.leafIconManager.injectAll();
      })
    );

    // Global click listener to handle closing the width popup when clicking outside
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

  /**
   * Loads plugin settings and ensures the localWidths object is initialized.
   */
  async loadSettings(): Promise<void> {
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...(await this.loadData())
    };
    if (!this.settings.localWidths) this.settings.localWidths = {};
  }

  /**
   * Saves settings and triggers a UI refresh across all leaves.
   */
  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.widthManager.applyLineWidth();
    this.leafIconManager.refreshAll();
  }
}
