import { debounce } from 'obsidian';
import type { WorkspaceLeaf } from 'obsidian';
import type { EditorWidthSettings } from './interfaces.ts';
import { getFilePathForLeaf, getWidthForLeafPath } from './leaf-utils.ts';

export class WidthManager {
  private resizeObserver: ResizeObserver | null = null;
  private updateEditorWidthsDebounced: () => void;

  constructor(
    private getSettings: () => EditorWidthSettings,
    private lineWidthStyleEl: HTMLStyleElement,
    private iterateAllLeaves: (cb: (leaf: WorkspaceLeaf) => void) => void
  ) {
    this.updateEditorWidthsDebounced = debounce(
      () => this.updateEditorWidths(),
      100,
      false
    );
  }

  /**
   * Applies a specific width to a leaf container using a CSS variable.
   * This is used for "Local Width" (file-specific) settings.
   */
  applyWidthToLeaf(leaf: WorkspaceLeaf, px: number): void {
    const containerEl = leaf.containerEl as HTMLElement;
    containerEl.style.setProperty('--editor-width', `${px}px`);
  }

  /**
   * Injects global CSS rules and applies the default editor width.
   * Uses CSS variables to ensure styles persist during Obsidian view re-renders.
   */
  applyLineWidth(): void {
    const settings = this.getSettings();
    if (settings.enableLineWidth) {
      // We set --editor-width on .workspace-leaf as the default.
      // Individual leaves can override this via their own containerEl styles (applyWidthToLeaf).
      this.lineWidthStyleEl.textContent =
        `.workspace-leaf { --editor-width: ${settings.lineWidthPx}px; }` +
        `.cm-contentContainer { max-width: unset !important; }` +
        `.cm-content { max-width: unset !important; }` +
        `.cm-sizer { margin-left: auto !important; margin-right: auto !important; max-width: var(--editor-width) !important; }` +
        `.markdown-preview-view .markdown-preview-sizer { margin-left: auto !important; margin-right: auto !important; max-width: var(--editor-width) !important; width: var(--editor-width) !important; box-sizing: border-box !important; }` +
        `.markdown-preview-sizer .mermaid svg { max-width: 100% !important; height: auto !important; }`;
      this.setupResizeObserver();
      this.updateEditorWidths();
    } else {
      this.lineWidthStyleEl.textContent = '';
      this.cleanupResizeObserver();
      // Remove local overrides when the plugin or feature is disabled
      this.iterateAllLeaves((leaf) => {
        const containerEl = leaf.containerEl as HTMLElement;
        containerEl.style.removeProperty('--editor-width');
      });
    }
  }

  /**
   * Sets up a ResizeObserver on the workspace to trigger width updates when the window or sidebars are resized.
   */
  setupResizeObserver(): void {
    this.cleanupResizeObserver();
    this.resizeObserver = new ResizeObserver(() => this.updateEditorWidthsDebounced());
    const workspaceEl = document.querySelector('.workspace');
    if (workspaceEl) {
      this.resizeObserver.observe(workspaceEl);
    } else {
      console.warn('Workspace element not found for ResizeObserver');
    }
  }

  /**
   * Iterates through all open leaves and applies their respective widths (global or local).
   */
  updateEditorWidths(): void {
    this.iterateAllLeaves((leaf) => {
      const filePath = getFilePathForLeaf(leaf);
      const px = getWidthForLeafPath(filePath, this.getSettings());
      this.applyWidthToLeaf(leaf, px);
    });
  }

  cleanupResizeObserver(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }
}
