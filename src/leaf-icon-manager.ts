import { setIcon } from 'obsidian';
import type { WorkspaceLeaf, Plugin } from 'obsidian';
import type { EditorWidthSettings } from './interfaces.ts';
import {
  getLeafId,
  getFilePathForLeaf,
  isFileLocked,
  getTooltipForLeaf
} from './leaf-utils.ts';
import type { PopupManager } from './popup-manager.ts';

export class LeafIconManager {
  private leafIcons: Map<string, HTMLDivElement> = new Map();
  private docsWithClickListener: Set<Document> = new Set();
  private popupManager: PopupManager | null = null;
  private iconClickHandlers: Map<string, (e: MouseEvent) => void> = new Map();

  constructor(
    private getSettings: () => EditorWidthSettings,
    private iterateAllLeaves: (cb: (leaf: WorkspaceLeaf) => void) => void,
    private registerDomEvent: Plugin['registerDomEvent']
  ) {}

  setPopupManager(popupManager: PopupManager): void {
    this.popupManager = popupManager;
  }

  getLeafIcons(): Map<string, HTMLDivElement> {
    return this.leafIcons;
  }

  updateAllColors(): void {
    this.leafIcons.forEach((iconEl) => {
      iconEl.style.color = this.getSettings().lineWidthColor;
    });
  }

  /**
   * Main logic for injecting the width control icon into all markdown tabs.
   * Handles creation, display toggling, and cleanup of icons across multiple windows.
   */
  injectAll(): void {
    const activeLeafIds = new Set<string>();

    this.iterateAllLeaves((leaf) => {
      const settings = this.getSettings();
      // Only show the icon for markdown views
      const viewType = leaf.view?.getViewType();
      if (viewType !== 'markdown') return;

      const leafId = getLeafId(leaf);
      if (!leafId) return;

      activeLeafIds.add(leafId);
      const ownerDoc = leaf.containerEl.ownerDocument;
      // .view-actions is the standard Obsidian container for tab header icons (close, more, etc.)
      const actionsEl = leaf.view.containerEl.querySelector(
        '.view-actions'
      ) as HTMLElement | null;
      if (!actionsEl) return;

      const existing = this.leafIcons.get(leafId);
      // Case 1: Icon already exists and is in the correct document
      if (existing && existing.isConnected && existing.ownerDocument === ownerDoc) {
        existing.style.display = settings.enableLineWidth ? 'flex' : 'none';
        this.refresh(leaf);
        // Ensure the global click listener is registered for this document (handles popups in side windows)
        if (!this.docsWithClickListener.has(ownerDoc) && this.popupManager) {
          this.docsWithClickListener.add(ownerDoc);
          this.registerDomEvent(ownerDoc, 'click', (e) =>
            this.popupManager!.onDocumentClick(e, this.leafIcons)
          );
        }
        return;
      } else if (existing) {
        // Case 2: Icon exists but is disconnected (e.g., tab was moved or UI refreshed)
        // Cleanup old handler to prevent memory leaks before recreating
        const oldHandler = this.iconClickHandlers.get(leafId);
        if (oldHandler) {
          existing.removeEventListener('click', oldHandler);
        }
        existing.remove();
        this.iconClickHandlers.delete(leafId);
      }

      // Case 3: Create a new icon
      if (!this.docsWithClickListener.has(ownerDoc) && this.popupManager) {
        this.docsWithClickListener.add(ownerDoc);
        this.registerDomEvent(ownerDoc, 'click', (e) =>
          this.popupManager!.onDocumentClick(e, this.leafIcons)
        );
      }

      const iconEl = ownerDoc.createElement('div');
      iconEl.classList.add('lw-leaf-icon');
      const iconSpan = ownerDoc.createElement('span');
      iconSpan.classList.add('lw-icon');
      setIcon(iconSpan, 'chevrons-left-right-ellipsis');
      iconEl.appendChild(iconSpan);

      // Prepend the icon to the start of the action buttons
      actionsEl.prepend(iconEl);
      this.leafIcons.set(leafId, iconEl);

      iconEl.style.color = settings.lineWidthColor;
      iconEl.style.display = settings.enableLineWidth ? 'flex' : 'none';
      this.refresh(leaf);

      const clickHandler = (e: MouseEvent): void => {
        e.stopPropagation(); // Prevent Obsidian from handling the click on the tab header
        this.popupManager?.togglePopupForLeaf(leaf, iconEl);
      };
      iconEl.addEventListener('click', clickHandler);
      this.iconClickHandlers.set(leafId, clickHandler);
    });

    // Cleanup phase: Remove icons for tabs that no longer exist
    const toDelete: string[] = [];
    this.leafIcons.forEach((el, id) => {
      if (!activeLeafIds.has(id)) {
        toDelete.push(id);
      }
    });

    toDelete.forEach((id) => {
      const el = this.leafIcons.get(id);
      const handler = this.iconClickHandlers.get(id);
      if (el && handler) {
        el.removeEventListener('click', handler);
      }
      el?.remove();
      this.leafIcons.delete(id);
      this.iconClickHandlers.delete(id);
      if (this.popupManager) {
        this.popupManager.closePopupForLeaf(id);
      }
    });
  }

  /**
   * Refreshes the visual state of a specific leaf icon (e.g., updating the lock badge and tooltip).
   */
  refresh(leaf: WorkspaceLeaf): void {
    const leafId = getLeafId(leaf);
    const iconEl = this.leafIcons.get(leafId);
    if (!iconEl) return;

    const settings = this.getSettings();
    const filePath = getFilePathForLeaf(leaf);
    const locked = isFileLocked(filePath, settings);

    // Add or remove the small lock badge on the icon
    const existingBadge = iconEl.querySelector('.lw-lock-badge');
    if (locked && !existingBadge) {
      const b = iconEl.ownerDocument.createElement('span');
      b.classList.add('lw-lock-badge');
      setIcon(b, 'lock');
      iconEl.appendChild(b);
    } else if (!locked && existingBadge) {
      existingBadge.remove();
    }

    iconEl.setAttribute('aria-label', getTooltipForLeaf(leaf, settings));
  }

  cleanup(): void {
    this.leafIcons.forEach((el, leafId) => {
      const handler = this.iconClickHandlers.get(leafId);
      if (handler) {
        el.removeEventListener('click', handler);
      }
      el.remove();
    });
    this.leafIcons.clear();
    this.iconClickHandlers.clear();
    this.docsWithClickListener.clear();
  }

  refreshAll(): void {
    this.injectAll();
    this.updateAllColors();
  }
}
