import { Platform } from 'react-native'
import { requestWidgetUpdate } from 'react-native-android-widget'
import { ANDROID_WIDGETS, androidWidgetFor } from './android/SessionsWidgetAndroid'
import type { WidgetSnapshot } from './logic'
import { SessionsWidget } from './SessionsWidget'
import { saveSnapshot } from './store'

/** Draws the snapshot on every widget the user added and keeps it for later redraws. */
export async function publishWidgets(snapshot: WidgetSnapshot): Promise<void> {
  await saveSnapshot(snapshot)
  if (Platform.OS === 'ios') {
    try {
      SessionsWidget.updateSnapshot(snapshot)
    } catch {
      // Builds without the widget (an over-the-air update).
    }
    return
  }
  // Rejects on builds without the native module (an over-the-air update): nothing to draw then.
  await Promise.all(
    Object.values(ANDROID_WIDGETS).map((widgetName) =>
      requestWidgetUpdate({ widgetName, renderWidget: () => androidWidgetFor(widgetName, snapshot) }).catch(
        () => undefined,
      ),
    ),
  )
}
