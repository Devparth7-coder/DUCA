/* Monaco subset: base editor + Monarch grammars only (no language services) —
   small bundle, full editor ergonomics (line numbers, indent, find, multi-cursor). */
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';

self.MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
};

import 'monaco-editor/esm/vs/basic-languages/python/python';
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript';
import 'monaco-editor/esm/vs/basic-languages/typescript/typescript';
import 'monaco-editor/esm/vs/basic-languages/cpp/cpp';
import 'monaco-editor/esm/vs/basic-languages/java/java';

export const ARENA_THEME = 'codearena-dark';
monaco.editor.defineTheme(ARENA_THEME, {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '565f6e', fontStyle: 'italic' },
    { token: 'keyword', foreground: '97a5ff' },
    { token: 'string', foreground: '7fe3c4' },
    { token: 'number', foreground: 'e8c56a' },
    { token: 'type', foreground: '79b8ff' },
    { token: 'delimiter', foreground: 'a8afc2' },
  ],
  colors: {
    'editor.background': '#0a0c11',
    'editorGutter.background': '#0a0c11',
    'editor.lineHighlightBackground': '#11141c',
    'editorLineNumber.foreground': '#3a4152',
    'editorLineNumber.activeForeground': '#8b9bff',
    'editor.selectionBackground': '#2a3450',
    'editorWidget.background': '#0d0f15',
    'editorWidget.border': '#1c2130',
    'editorSuggestWidget.background': '#0d0f15',
    'editorIndentGuide.background1': '#161a24',
    'editorCursor.foreground': '#7c8cff',
    'scrollbarSlider.background': '#1a1f2b88',
  },
});

export { monaco };
