import type { EditorWidthSettings } from './interfaces.ts';

export const DEFAULT_SETTINGS: EditorWidthSettings = {
  enableLineWidth: true,
  lineWidthPx: 800,
  lineWidthPxPreview: null,
  lineWidthColor: '#d84c42',
  localWidths: {},
  localWidthsPreview: {},
  restoreCursorOnClose: true
};
