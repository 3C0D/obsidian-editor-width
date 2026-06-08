export interface EditorWidthSettings {
  enableLineWidth: boolean;
  lineWidthPx: number;
  lineWidthColor: string;
  localWidths: Record<string, number>;
  restoreCursorOnClose: boolean;
}
