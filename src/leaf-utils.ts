import { MarkdownView } from 'obsidian';
import type { WorkspaceLeaf, FileView } from 'obsidian';
import type { EditorWidthSettings } from './interfaces.ts';

export function getLeafId(leaf: WorkspaceLeaf): string {
  return leaf.id ?? '';
}

export function getFilePathForLeaf(leaf: WorkspaceLeaf): string | null {
  if (leaf.view instanceof MarkdownView) {
    return leaf.view.file?.path ?? null;
  }
  return (leaf.view as FileView).file?.path ?? null;
}

export function getWidthForLeafPath(
  filePath: string | null,
  settings: EditorWidthSettings
): number {
  if (filePath && settings.localWidths[filePath] !== undefined) {
    return settings.localWidths[filePath];
  }
  return settings.lineWidthPx;
}

export function isFileLocked(
  filePath: string | null,
  settings: EditorWidthSettings
): boolean {
  return filePath !== null && settings.localWidths[filePath] !== undefined;
}

export function getTooltipForLeaf(
  leaf: WorkspaceLeaf,
  settings: EditorWidthSettings
): string {
  const filePath = getFilePathForLeaf(leaf);
  const width = getWidthForLeafPath(filePath, settings);
  const locked = isFileLocked(filePath, settings);
  return `Editor width: ${width}px${locked ? ' (local)' : ' (global)'}`;
}
