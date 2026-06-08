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

  applyWidthToLeaf(leaf: WorkspaceLeaf, px: number): void {
    const containerEl = leaf.containerEl as HTMLElement;
    containerEl.style.setProperty('--editor-width', `${px}px`);
  }

  applyLineWidth(): void {
    const settings = this.getSettings();
    if (settings.enableLineWidth) {
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
      this.iterateAllLeaves((leaf) => {
        const containerEl = leaf.containerEl as HTMLElement;
        containerEl.style.removeProperty('--editor-width');
      });
    }
  }

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
