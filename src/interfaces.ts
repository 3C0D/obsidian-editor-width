export type EditorMode = 'source' | 'preview';

export interface EditorWidthSettings {
  enableLineWidth: boolean;
  lineWidthPx: number;
  /** Preview mode global width in px. Null means "inherit lineWidthPx" until explicitly set by the user. */
  lineWidthPxPreview: number | null;
  lineWidthColor: string;
  localWidths: Record<string, number>;
  /** Preview mode local (per-file) width overrides, independent from localWidths. */
  localWidthsPreview: Record<string, number>;
  restoreCursorOnClose: boolean;
}
