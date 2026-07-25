import type { WorkspaceLeaf } from 'obsidian';
import type { EditorMode } from './interfaces.ts';
import { getModeForLeaf } from './leaf-utils.ts';

export class WidthGuides {
  leftGuide: HTMLDivElement | null = null;
  rightGuide: HTMLDivElement | null = null;
  guideTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private getWidthForLeafPath: (filePath: string | null, mode: EditorMode) => number,
    private getFilePathForLeaf: (leaf: WorkspaceLeaf) => string | null
  ) {}

  /**
   * Shows vertical visual guides to indicate where the editor margins are.
   * Useful when adjusting the slider to see the impact in real-time.
   */
  showWidthGuidesForLeaf(leaf: WorkspaceLeaf): void {
    this.hideWidthGuides();

    const ownerDoc = leaf.containerEl.ownerDocument;
    const filePath = this.getFilePathForLeaf(leaf);
    const mode = getModeForLeaf(leaf);
    const px = this.getWidthForLeafPath(filePath, mode);
    const containerEl = leaf.containerEl as HTMLElement;

    // Handle Reading View. The branch is chosen via getModeForLeaf() (MarkdownView.getMode()),
    // not by testing for the presence of the .markdown-reading-view class: Obsidian's internal
    // class names are not part of the public API and may change. The class selector below is
    // only used to locate the DOM node to measure, once the mode is already known.
    if (mode === 'preview') {
      const readingContainer = containerEl.querySelector(
        '.markdown-reading-view'
      ) as HTMLElement | null;
      if (!readingContainer || readingContainer.offsetParent === null) return;
      const rect = readingContainer.getBoundingClientRect();
      if (rect.width === 0) return;
      const offsetX = Math.max(0, (rect.width - px) / 2);

      this.leftGuide = ownerDoc.createElement('div');
      this.leftGuide.classList.add('line-width-guide');
      this.leftGuide.style.left = `${rect.left + offsetX}px`;
      this.leftGuide.style.top = `${rect.top}px`;
      this.leftGuide.style.height = `${containerEl.getBoundingClientRect().bottom - rect.top}px`;

      this.rightGuide = ownerDoc.createElement('div');
      this.rightGuide.classList.add('line-width-guide');
      this.rightGuide.style.left = `${rect.left + px + offsetX}px`;
      this.rightGuide.style.top = `${rect.top}px`;
      this.rightGuide.style.height = `${containerEl.getBoundingClientRect().bottom - rect.top}px`;

      ownerDoc.body.appendChild(this.leftGuide);
      ownerDoc.body.appendChild(this.rightGuide);
      return;
    }

    // Handle Live Preview / Editing View
    const contentEl = containerEl.querySelector('.cm-sizer') as HTMLElement | null;
    if (!contentEl) return;
    if (contentEl.offsetParent === null) return;

    const rect = contentEl.getBoundingClientRect();
    if (rect.width === 0) return;

    this.leftGuide = ownerDoc.createElement('div');
    this.leftGuide.classList.add('line-width-guide');
    this.leftGuide.style.left = `${rect.left}px`;
    this.leftGuide.style.top = `${rect.top}px`;
    this.leftGuide.style.height = `${containerEl.getBoundingClientRect().bottom - rect.top}px`;

    this.rightGuide = ownerDoc.createElement('div');
    this.rightGuide.classList.add('line-width-guide');
    this.rightGuide.style.left = `${rect.right}px`;
    this.rightGuide.style.top = `${rect.top}px`;
    this.rightGuide.style.height = `${containerEl.getBoundingClientRect().bottom - rect.top}px`;

    ownerDoc.body.appendChild(this.leftGuide);
    ownerDoc.body.appendChild(this.rightGuide);
  }

  hideWidthGuides(): void {
    this.leftGuide?.remove();
    this.rightGuide?.remove();
    this.leftGuide = null;
    this.rightGuide = null;
  }

  /**
   * Smoothly fades out the guides using CSS transitions.
   */
  fadeOutWidthGuides(): void {
    if (this.leftGuide) this.leftGuide.classList.add('line-width-guide-fade');
    if (this.rightGuide) this.rightGuide.classList.add('line-width-guide-fade');
    setTimeout(() => this.hideWidthGuides(), 500);
  }

  /**
   * Schedules the guides to hide after a delay.
   */
  scheduleHide(delay: number): void {
    if (this.guideTimeout) clearTimeout(this.guideTimeout);
    this.guideTimeout = setTimeout(() => this.fadeOutWidthGuides(), delay);
  }

  cleanup(): void {
    this.hideWidthGuides();
    if (this.guideTimeout) clearTimeout(this.guideTimeout);
  }
}
