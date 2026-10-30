import { registerWidgetTaskHandler, type WidgetTaskHandlerProps } from 'react-native-android-widget'
import { answerFromWidget } from '../refresh'
import { loadSnapshot } from '../store'
import { androidWidgetFor, WIDGET_CLICK } from './SessionsWidgetAndroid'

/**
 * Headless task of the Android widgets (run by WorkManager, also with the app closed): draws the
 * saved snapshot when a widget is added, resized or updated, and answers Allow / Deny taps. Session
 * and list taps are deep links the library opens by itself.
 */
async function widgetTask({
  widgetInfo,
  widgetAction,
  clickAction,
  clickActionData,
  renderWidget,
}: WidgetTaskHandlerProps) {
  if (widgetAction === 'WIDGET_DELETED') return
  if (
    widgetAction === 'WIDGET_CLICK' &&
    (clickAction === WIDGET_CLICK.allow || clickAction === WIDGET_CLICK.deny)
  ) {
    const requestId = typeof clickActionData?.requestId === 'string' ? clickActionData.requestId : ''
    const daemonId = typeof clickActionData?.daemonId === 'string' ? clickActionData.daemonId : ''
    if (requestId) {
      // Redraws every widget itself: "Sending…" at once, then the fresh state.
      await answerFromWidget(
        clickAction === WIDGET_CLICK.allow ? 'allow' : 'deny',
        requestId,
        daemonId || undefined,
      )
      return
    }
  }
  renderWidget(androidWidgetFor(widgetInfo.widgetName, await loadSnapshot()))
}

/** Registered by the entry file (`push/background.ts`), before the router. */
export function registerAndroidWidgetTask(): void {
  try {
    registerWidgetTaskHandler(widgetTask)
  } catch {
    // Builds without the widgets.
  }
}
