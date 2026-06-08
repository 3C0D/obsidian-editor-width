import { MarkdownView, setIcon, ToggleComponent } from 'obsidian';
import type { App, WorkspaceLeaf, EditorPosition, EventRef } from 'obsidian';
import type { EditorWidthSettings } from './interfaces.ts';
import {
  getLeafId,
  getFilePathForLeaf,
  getWidthForLeafPath,
  isFileLocked
} from './leaf-utils.ts';
import type { WidthManager } from './width-manager.ts';
import type { WidthGuides } from './guides.ts';

interface CursorState {
  from: EditorPosition;
  to: EditorPosition;
}

export class PopupManager {
  private activePopup: {
    leafId: string;
    el: HTMLDivElement;
    cleanup?: () => void;
  } | null = null;
  private savedCursor: { leafId: string; state: CursorState } | null = null;

  constructor(
    private app: App,
    private getSettings: () => EditorWidthSettings,
    private saveData: (data: EditorWidthSettings) => Promise<void>,
    private saveDebounced: () => void,
    private widthManager: WidthManager,
    private guides: WidthGuides,
    private refreshLeafIcon: (leaf: WorkspaceLeaf) => void,
    private setActiveLeaf: (leaf: WorkspaceLeaf, opts: { focus: boolean }) => void
  ) {}

  /**
   * Restores the editor cursor and selection to where they were before the popup was opened.
   */
  restoreCursor(leafId: string, leaf: WorkspaceLeaf): void {
    if (!this.getSettings().restoreCursorOnClose) return;
    const cursor = this.savedCursor?.leafId === leafId ? this.savedCursor.state : null;
    if (!cursor) return;
    this.setActiveLeaf(leaf, { focus: true });
    const view = leaf.view instanceof MarkdownView ? leaf.view : null;
    view?.editor?.setSelection(cursor.from, cursor.to);
    this.savedCursor = null;
  }

  /**
   * Handles clicks outside the popup to close it.
   * This is registered as a global document listener.
   */
  onDocumentClick(e: MouseEvent, leafIcons: Map<string, HTMLDivElement>): void {
    if (!this.activePopup) return;
    const clickDoc = (e.target as Node).ownerDocument;
    const { leafId, el, cleanup } = this.activePopup;
    const icon = leafIcons.get(leafId);
    // If click is not inside the popup and not on the icon itself, close it.
    if (!el.contains(e.target as Node) && !(icon && icon.contains(e.target as Node))) {
      el.remove();
      if (cleanup) cleanup();
      this.activePopup = null;
      const leaf = this.findLeafById(leafId);
      // If we clicked back into the editor area of the same tab, restore focus/cursor.
      if (
        leaf &&
        leaf.containerEl.ownerDocument === clickDoc &&
        leaf.containerEl.contains(e.target as Node)
      ) {
        this.restoreCursor(leafId, leaf);
      }
    }
  }

  private findLeafById(leafId: string): WorkspaceLeaf | null {
    let found: WorkspaceLeaf | null = null;
    this.app.workspace.iterateAllLeaves((leaf: WorkspaceLeaf) => {
      if (getLeafId(leaf) === leafId) found = leaf;
    });
    return found;
  }

  /**
   * Toggles the "Lock" state (local width) for the current file.
   * If locked, changes to the slider only affect this file.
   */
  private toggleLock(
    leaf: WorkspaceLeaf,
    filePath: string | null,
    updateLockState: () => void
  ): void {
    if (!filePath) return;
    const s = this.getSettings();
    if (isFileLocked(filePath, s)) {
      // Unlock: Remove the local override and revert to global width
      delete s.localWidths[filePath];
      void this.saveData(s);
      this.widthManager.applyWidthToLeaf(leaf, s.lineWidthPx);
    } else {
      // Lock: Create a local override starting with the current global width
      s.localWidths[filePath] = s.lineWidthPx;
      void this.saveData(s);
    }
    updateLockState();
  }

  private guidesUpdateScheduled = false;
  /**
   * Updates the vertical width guides shown in the background while sliding.
   * Uses requestAnimationFrame for smooth performance.
   */
  private scheduleGuidesUpdate(leaf: WorkspaceLeaf): void {
    if (this.guidesUpdateScheduled) return;
    this.guidesUpdateScheduled = true;
    requestAnimationFrame(() => {
      this.guides.showWidthGuidesForLeaf(leaf);
      this.guidesUpdateScheduled = false;
    });
  }

  togglePopupForLeaf(leaf: WorkspaceLeaf, iconEl: HTMLDivElement): void {
    const leafId = getLeafId(leaf);
    const existing =
      this.activePopup && this.activePopup.leafId === leafId ? this.activePopup.el : null;
    if (existing) {
      this.closePopupForLeaf(leafId);
    } else {
      this.showPopupForLeaf(leaf, iconEl);
    }
  }

  /**
   * Creates and displays the width control popup near the icon.
   */
  showPopupForLeaf(leaf: WorkspaceLeaf, iconEl: HTMLDivElement): void {
    const leafId = getLeafId(leaf);

    // Save cursor position so we can restore it later
    const view = leaf.view instanceof MarkdownView ? leaf.view : null;
    const editor = view?.editor;
    if (editor) {
      this.savedCursor = {
        leafId,
        state: {
          from: editor.getCursor('anchor'),
          to: editor.getCursor('head')
        }
      };
    }

    if (this.activePopup && this.activePopup.leafId !== leafId) {
      this.closePopupForLeaf(this.activePopup.leafId);
    }

    const filePath = getFilePathForLeaf(leaf);
    const ownerDoc = iconEl.ownerDocument;
    const ownerWin = ownerDoc.defaultView;
    if (!ownerWin) return;

    // Create the popup elements
    const popup = ownerDoc.createElement('div');
    popup.classList.add('line-width-slider-popup');

    const headerRow = ownerDoc.createElement('div');
    headerRow.classList.add('line-width-slider-header');

    const label = ownerDoc.createElement('div');
    label.classList.add('line-width-slider-label');

    const lockBtn = ownerDoc.createElement('button');
    lockBtn.classList.add('line-width-lock-btn');

    const slider = ownerDoc.createElement('input');
    slider.type = 'range';
    slider.min = '300';
    slider.max = '1600';
    slider.classList.add('line-width-slider');

    /**
     * Refreshes the popup UI based on current settings (lock icon, label text).
     */
    const updateLockState = (): void => {
      const settings = this.getSettings();
      const width = getWidthForLeafPath(filePath, settings);
      label.textContent = `${width}px`;
      slider.value = `${width}`;
      lockBtn.innerHTML = '';
      if (isFileLocked(filePath, settings)) {
        setIcon(lockBtn, 'lock');
        lockBtn.style.color = 'var(--interactive-accent)';
        lockBtn.setAttribute('aria-label', 'Local width (this file only)');
      } else {
        setIcon(lockBtn, 'unlock');
        lockBtn.style.color = 'var(--text-muted)';
        lockBtn.setAttribute('aria-label', 'Global width (all files)');
      }
      this.refreshLeafIcon(leaf);
    };

    // Close on Escape key
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.closePopupForLeaf(leafId);
        const leaf = this.findLeafById(leafId);
        if (leaf) {
          this.restoreCursor(leafId, leaf);
        }
      }
    };
    ownerDoc.addEventListener('keydown', onKeyDown);

    let cssChangeRef: EventRef | null = null;
    // Cleanup logic for the popup destruction
    const cleanup = (): void => {
      ownerDoc.removeEventListener('keydown', onKeyDown);
      if (cssChangeRef) this.app.workspace.offref(cssChangeRef);
    };

    lockBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleLock(leaf, filePath, updateLockState);
    });

    slider.addEventListener('input', () => {
      const value = parseInt(slider.value, 10);
      label.textContent = `${value}px`;
      const s = this.getSettings();
      if (isFileLocked(filePath, s)) {
        // Update local width only
        if (filePath) s.localWidths[filePath] = value;
        this.widthManager.applyWidthToLeaf(leaf, value);
      } else {
        // Update global width
        s.lineWidthPx = value;
        this.widthManager.applyLineWidth();
      }
      this.saveDebounced();
      this.refreshLeafIcon(leaf);
      this.scheduleGuidesUpdate(leaf);
      this.guides.scheduleHide(2000);
    });

    // Create the readable line length toggle row (reuses existing flex-row classes, no new CSS needed)
    const readableRow = ownerDoc.createElement('div');
    readableRow.classList.add('line-width-slider-header');

    const readableLabel = ownerDoc.createElement('span');
    readableLabel.classList.add('line-width-slider-label');
    readableLabel.textContent = 'Readable line length';
    readableLabel.setAttribute(
      'aria-label',
      'Toggle Obsidian\'s built-in "Readable line length" setting'
    );

    const toggleWrapper = ownerDoc.createElement('div');

    const readableToggle = new ToggleComponent(toggleWrapper)
      .setValue(Boolean(this.app.vault.getConfig('readableLineLength')))
      .onChange((checked) => {
        this.app.vault.setConfig('readableLineLength', checked);
        // Trigger css-change so Obsidian re-applies the setting to all editors
        this.app.workspace.trigger('css-change');
      });

    // Keep the toggle in sync if the user changes the setting from Obsidian's own settings panel
    cssChangeRef = this.app.workspace.on('css-change', () => {
      readableToggle.setValue(Boolean(this.app.vault.getConfig('readableLineLength')));
    });

    headerRow.appendChild(label);
    headerRow.appendChild(lockBtn);
    popup.appendChild(headerRow);
    popup.appendChild(slider);
    popup.appendChild(readableRow);
    readableRow.appendChild(readableLabel);
    readableRow.appendChild(toggleWrapper);

    updateLockState();

    // Position the popup below the icon
    const rect = iconEl.getBoundingClientRect();
    popup.style.position = 'fixed';
    popup.style.top = `${rect.bottom + 5}px`;
    popup.style.right = `${ownerWin.innerWidth - rect.right}px`;

    ownerDoc.body.appendChild(popup);
    this.activePopup = { leafId, el: popup, cleanup };
  }

  closePopupForLeaf(leafId: string): void {
    if (this.activePopup?.leafId === leafId) {
      this.activePopup.el.remove();
      if (this.activePopup.cleanup) this.activePopup.cleanup();
      this.activePopup = null;
    }
  }

  cleanup(): void {
    if (this.activePopup) {
      this.closePopupForLeaf(this.activePopup.leafId);
    }
    this.savedCursor = null;
  }
}
