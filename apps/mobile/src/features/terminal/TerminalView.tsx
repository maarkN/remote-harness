import type { ServerMessageOf } from '@remote-harness/protocol'
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { StyleSheet } from 'react-native'
import { WebView } from 'react-native-webview'
import { useTheme } from '@/core/theme'
import { frameWrite, type PaneFrame } from './frame-write'
import { XTERM_HTML } from './xterm-html.generated'
import { xtermTheme } from './xterm-theme'

export type TerminalViewHandle = {
  render(frame: Pick<ServerMessageOf<'pane.frame'>, 'text' | 'cols' | 'rows'>): void
}

/**
 * Read-only xterm.js mirror of a tmux pane, drawn with the app theme (updated live on a switch).
 * Frames are drawn at most once per display frame (the latest wins), and only the rows that changed
 * are written.
 */
export const TerminalView = forwardRef<TerminalViewHandle, { onReady?: () => void }>(function TerminalView(
  { onReady },
  ref,
) {
  const webview = useRef<WebView>(null)
  const theme = useTheme()
  // What the page shows, the frame waiting for the next display frame, and that frame's callback.
  const drawn = useRef<PaneFrame | null>(null)
  const pending = useRef<PaneFrame | null>(null)
  const scheduled = useRef<number | null>(null)
  useEffect(
    () => () => {
      if (scheduled.current !== null) cancelAnimationFrame(scheduled.current)
    },
    [],
  )
  const xterm = useMemo(() => JSON.stringify(xtermTheme(theme)), [theme])
  useImperativeHandle(ref, () => ({
    render(frame) {
      pending.current = { text: frame.text, cols: frame.cols, rows: frame.rows }
      if (scheduled.current !== null) return
      scheduled.current = requestAnimationFrame(() => {
        scheduled.current = null
        const next = pending.current
        pending.current = null
        if (!next) return
        const write = frameWrite(drawn.current, next)
        drawn.current = next
        if (!write.full && write.data === '') return
        webview.current?.injectJavaScript(
          `window.writeFrame && window.writeFrame(${JSON.stringify(write)});true;`,
        )
      })
    },
  }))
  useEffect(() => {
    webview.current?.injectJavaScript(`window.setTheme && window.setTheme(${xterm});true;`)
  }, [xterm])
  return (
    <WebView
      ref={webview}
      source={{ html: XTERM_HTML }}
      // The page reads the theme before its own scripts run, so the first paint has the colors.
      injectedJavaScriptBeforeContentLoaded={`window.__theme = ${xterm};true;`}
      // Inline HTML loads as about:blank; allow it, but never navigate anywhere else.
      originWhitelist={['*']}
      onShouldStartLoadWithRequest={(request) => request.url === 'about:blank'}
      style={[styles.web, { backgroundColor: theme.colors.background }]}
      scrollEnabled={false}
      javaScriptEnabled
      // Android: the page is self-contained, so no file/content access, popups or mixed content.
      allowFileAccess={false}
      allowFileAccessFromFileURLs={false}
      allowUniversalAccessFromFileURLs={false}
      setSupportMultipleWindows={false}
      mixedContentMode="never"
      overScrollMode="never"
      onMessage={(e) => {
        if (e.nativeEvent.data !== 'ready') return
        // A (re)loaded page is empty: the next frame is drawn in full.
        drawn.current = null
        onReady?.()
      }}
    />
  )
})

const styles = StyleSheet.create({ web: { flex: 1 } })
