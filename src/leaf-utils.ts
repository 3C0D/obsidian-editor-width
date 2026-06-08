import { MarkdownView } from 'obsidian';
import type { WorkspaceLeaf, FileView } from 'obsidian';
import type { EditorWidthSettings } from './interfaces.ts';

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
 * Determines the effective width for a file path.
 * Returns the local override if it exists, otherwise the global default.
 */
export function getWidthForLeafPath(
  filePath: string | null,
  settings: EditorWidthSettings
): number {
  if (filePath && settings.localWidths[filePath] !== undefined) {
    return settings.localWidths[filePath];
  }
  return settings.lineWidthPx;
}

/**
 * Checks if a file has a "Local Width" (locked) override.
 */
export function isFileLocked(
  filePath: string | null,
  settings: EditorWidthSettings
): boolean {
  return filePath !== null && settings.localWidths[filePath] !== undefined;
}

/**
 * Generates the tooltip text for the width control icon.
 */
export function getTooltipForLeaf(
  leaf: WorkspaceLeaf,
  settings: EditorWidthSettings
): string {
  const filePath = getFilePathForLeaf(leaf);
  const width = getWidthForLeafPath(filePath, settings);
  const locked = isFileLocked(filePath, settings);
  return `Editor width: ${width}px${locked ? ' (local)' : ' (global)'}`;
}
