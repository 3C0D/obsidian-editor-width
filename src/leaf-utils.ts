import { MarkdownView } from 'obsidian';
import type { WorkspaceLeaf, FileView } from 'obsidian';
import type { EditorMode, EditorWidthSettings } from './interfaces.ts';

export function getLeafId(leaf: WorkspaceLeaf): string {
  return leaf.id ?? '';
}

/**
 * Gets the relative file path for a given leaf.
 * Handles both Markdown views and other File views.
 */
export function getFilePathForLeaf(leaf: WorkspaceLeaf): string | null {
  if (leaf.view instanceof MarkdownView) {
    return leaf.view.file?.path ?? null;
  }
  return (leaf.view as FileView).file?.path ?? null;
}

/**
 * Determines whether a leaf is currently in source (edit) or preview (reading) mode.
 * Uses MarkdownView.getMode(), never CSS class presence, since Obsidian's internal
 * class names are not part of the public API and may change without notice.
 * Non-Markdown views are treated as source mode since the distinction doesn't apply to them.
 */
export function getModeForLeaf(leaf: WorkspaceLeaf): EditorMode {
  if (leaf.view instanceof MarkdownView) {
    return leaf.view.getMode() === 'preview' ? 'preview' : 'source';
  }
  return 'source';
}

/**
 * Determines the effective width for a file path in a given mode.
 * Returns the local override if it exists, otherwise the global default for that mode.
 * In preview mode, a global default of null falls back to the edit mode's global width.
 */
export function getWidthForLeafPath(
  filePath: string | null,
  settings: EditorWidthSettings,
  mode: EditorMode = 'source'
): number {
  const localWidths =
    mode === 'preview' ? settings.localWidthsPreview : settings.localWidths;
  if (filePath && localWidths[filePath] !== undefined) {
    return localWidths[filePath];
  }
  if (mode === 'preview') {
    return settings.lineWidthPxPreview ?? settings.lineWidthPx;
  }
  return settings.lineWidthPx;
}

/**
 * Checks if a file has a "Local Width" (locked) override for a given mode.
 */
export function isFileLocked(
  filePath: string | null,
  settings: EditorWidthSettings,
  mode: EditorMode = 'source'
): boolean {
  const localWidths =
    mode === 'preview' ? settings.localWidthsPreview : settings.localWidths;
  return filePath !== null && localWidths[filePath] !== undefined;
}

/**
 * Generates the tooltip text for the width control icon.
 * Reflects the width and lock state for the leaf's current mode (source or preview).
 */
export function getTooltipForLeaf(
  leaf: WorkspaceLeaf,
  settings: EditorWidthSettings
): string {
  const filePath = getFilePathForLeaf(leaf);
  const mode = getModeForLeaf(leaf);
  const width = getWidthForLeafPath(filePath, settings, mode);
  const locked = isFileLocked(filePath, settings, mode);
  const modeLabel = mode === 'preview' ? ' [preview]' : '';
  return `Editor width: ${width}px${locked ? ' (local)' : ' (global)'}${modeLabel}`;
}
