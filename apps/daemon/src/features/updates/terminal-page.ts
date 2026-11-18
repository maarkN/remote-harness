/**
 * The page of the computer's terminal window (#614): xterm.js like the app's Terminal tab, but it
 * takes input and follows the system appearance. The tray helper loads it in a `WKWebView`, calls
 * `window.writeFrame(write)` with what `frameWrite` computed, and gets `{type:'ready'}` and
 * `{type:'input', data}` on the `terminal` message handler.
 */

/** xterm.js `ITheme` colors: the page, the cursor, the selection and the 16 ANSI colors. */
type XtermTheme = Record<string, string>

/** The app's `dark` and `light` terminal palettes (`apps/mobile/src/core/theme/palettes.ts`). */
export const TERMINAL_THEMES: { dark: XtermTheme; light: XtermTheme } = {
  dark: {
    background: '#0D0D0D',
    foreground: '#E8E6E3',
    cursor: '#E8A33D',
    selectionBackground: '#E8A33D29',
    black: '#161616',
    red: '#E06C75',
    green: '#7FB069',
    yellow: '#E5C07B',
    blue: '#61AFEF',
    magenta: '#C678DD',
    cyan: '#56B6C2',
    white: '#E8E6E3',
    brightBlack: '#5E5A56',
    brightRed: '#E06C75',
    brightGreen: '#98C379',
    brightYellow: '#E5C07B',
    brightBlue: '#61AFEF',
    brightMagenta: '#C678DD',
    brightCyan: '#56B6C2',
    brightWhite: '#FFFFFF',
  },
  light: {
    background: '#F3F3F1',
    foreground: '#1B1A19',
    cursor: '#E8A33D',
    selectionBackground: '#E8A33D2E',
    black: '#1B1A19',
    red: '#C0392B',
    green: '#3F8A3A',
    yellow: '#B88A0E',
    blue: '#2B6FD6',
    magenta: '#8E44AD',
    cyan: '#1A8A8A',
    white: '#CBC9C4',
    brightBlack: '#66635F',
    brightRed: '#C0392B',
    brightGreen: '#3F8A3A',
    brightYellow: '#B88A0E',
    brightBlue: '#2B6FD6',
    brightMagenta: '#8E44AD',
    brightCyan: '#1A8A8A',
    brightWhite: '#E1E0DC',
  },
}

/** The whole page, self-contained: the xterm.js UMD build and its CSS inline, nothing loaded. */
export function terminalPageHtml(xterm: { js: string; css: string }): string {
  return `<!doctype html>
<html><head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'">
<style>${xterm.css}
html,body{margin:0;padding:0;height:100%;overflow:hidden}
#term{padding:4px;height:100%;box-sizing:border-box}
</style>
</head><body><div id="term"></div>
<script>${xterm.js}</script>
<script>
(function(){
  var THEMES = ${JSON.stringify(TERMINAL_THEMES)};
  var appearance = window.matchMedia('(prefers-color-scheme: dark)');
  function theme(){ return appearance.matches ? THEMES.dark : THEMES.light; }
  function paint(colors){
    document.documentElement.style.background = colors.background;
    document.body.style.background = colors.background;
    var viewport = document.querySelector('.xterm-viewport');
    if (viewport) viewport.style.background = colors.background;
  }
  function post(message){
    if (window.webkit && window.webkit.messageHandlers.terminal) window.webkit.messageHandlers.terminal.postMessage(message);
  }
  var term = new Terminal({
    cursorBlink: false, convertEol: true, scrollback: 0, fontSize: 13,
    fontFamily: 'Menlo, monospace', theme: theme()
  });
  term.open(document.getElementById('term'));
  paint(theme());
  appearance.addEventListener('change', function(){
    var colors = theme();
    term.options.theme = colors;
    paint(colors);
  });
  // What is typed goes to the session as the terminal's bytes (Return is \\r, arrows are escapes).
  term.onData(function(data){ post({ type: 'input', data: data }); });
  // The pane keeps its size: the font scales so its columns and rows fit the window.
  var size = null;
  function fit(){
    if (!size) return;
    var byWidth = (window.innerWidth - 8) / (size.cols * 0.6);
    var byHeight = (window.innerHeight - 8) / (size.rows * 1.2);
    var px = Math.max(8, Math.min(18, Math.floor(Math.min(byWidth, byHeight) * 10) / 10));
    if (term.options.fontSize !== px) term.options.fontSize = px;
  }
  window.addEventListener('resize', fit);
  // The daemon computes the write (frameWrite): the whole screen after a resize, else the changed rows.
  window.writeFrame = function(write){
    if (write.full) {
      size = { cols: write.cols, rows: write.rows };
      fit();
      if (term.cols !== write.cols || term.rows !== write.rows) term.resize(write.cols, write.rows);
      term.reset();
      // The agents draw their own cursor in the pane: xterm's would sit after the last write.
      term.write('\\x1b[?25l');
    }
    term.write(write.data);
  };
  term.focus();
  post({ type: 'ready' });
})();
</script></body></html>`
}
