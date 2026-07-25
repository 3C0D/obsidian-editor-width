import { MarkdownView, setIcon, ToggleComponent } from 'obsidian';
import type { App, WorkspaceLeaf, EditorPosition, EventRef } from 'obsidian';
import type { EditorMode, EditorWidthSettings } from './interfaces.ts';
import {
  getLeafId,
  getFilePathForLeaf,
  getModeForLeaf,
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
    mode: EditorMode,
    updateLockState: () => void
  ): void {
    if (!filePath) return;
    const s = this.getSettings();
    const localWidths = mode === 'preview' ? s.localWidthsPreview : s.localWidths;
    // In preview mode, the global width falls back to lineWidthPx as long as
    // lineWidthPxPreview has never been touched by the user.
    const globalWidth =
      mode === 'preview' ? (s.lineWidthPxPreview ?? s.lineWidthPx) : s.lineWidthPx;
    if (isFileLocked(filePath, s, mode)) {
      // Unlock: Remove the local override and revert to global width
      delete localWidths[filePath];
      void this.saveData(s);
      this.widthManager.applyWidthToLeaf(leaf, globalWidth);
    } else {
      // Lock: Create a local override starting with the current global width
      localWidths[filePath] = globalWidth;
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
    // Mode is captured once when the popup opens; the popup always edits the
    // width settings for the mode the leaf was in at that moment.
    const mode = getModeForLeaf(leaf);
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
      const width = getWidthForLeafPath(filePath, settings, mode);
      label.textContent = `${width}px`;
      slider.value = `${width}`;
      lockBtn.innerHTML = '';
      if (isFileLocked(filePath, settings, mode)) {
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
      this.toggleLock(leaf, filePath, mode, updateLockState);
    });

    slider.addEventListener('input', () => {
      const value = parseInt(slider.value, 10);
      label.textContent = `${value}px`;
      const s = this.getSettings();
      if (isFileLocked(filePath, s, mode)) {
        // Update local width only, for this mode
        if (filePath) {
          if (mode === 'preview') s.localWidthsPreview[filePath] = value;
          else s.localWidths[filePath] = value;
        }
        this.widthManager.applyWidthToLeaf(leaf, value);
      } else {
        // Update global width for this mode. Touching the preview slider detaches
        // it from lineWidthPx, so from now on it changes independently.
        if (mode === 'preview') s.lineWidthPxPreview = value;
        else s.lineWidthPx = value;
        this.widthManager.applyLineWidth();
      }
      this.saveDebounced();
      this.refreshLeafIcon(leaf);
      this.scheduleGuidesUpdate(leaf);
      this.guides.scheduleHide(2000);
    });

    headerRow.appendChild(label);
    headerRow.appendChild(lockBtn);
    popup.appendChild(headerRow);
    popup.appendChild(slider);

    // "Readable line length" is an Obsidian editor-only setting, it has no effect in
    // Reading view, so the toggle is only shown in source mode.
    if (mode === 'source') {
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

      popup.appendChild(readableRow);
      readableRow.appendChild(readableLabel);
      readableRow.appendChild(toggleWrapper);
    }

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
