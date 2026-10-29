package expo.modules.voiceassistant

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.content.pm.ShortcutInfoCompat
import androidx.core.content.pm.ShortcutManagerCompat
import androidx.core.graphics.drawable.IconCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray

/** Launcher shortcuts per live session; their labels stay on the device. */
private const val MAX_SHORTCUTS = 4

/**
 * Android side of the voice assistant module: Google Assistant (App Actions) opens the app on a
 * `remoteharness://assistant/…` link, so nothing is bridged here. `setSessions` publishes the most
 * recent live sessions as dynamic launcher shortcuts; `onRequest` never fires and `complete` does
 * nothing (they serve the iOS intents).
 */
class VoiceAssistantModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("VoiceAssistant")

    Events("onRequest")

    Function("complete") { _: String, _: Map<String, Any?> -> }

    Function("setSessions") { json: String ->
      val context = appContext.reactContext ?: return@Function
      publishShortcuts(context, json)
    }
  }

  private fun publishShortcuts(context: Context, json: String) {
    val sessions = try {
      JSONArray(json)
    } catch (_: Exception) {
      return
    }
    val max = minOf(MAX_SHORTCUTS, ShortcutManagerCompat.getMaxShortcutCountPerActivity(context))
    val icon = IconCompat.createWithResource(context, context.applicationInfo.icon)
    val shortcuts = (0 until sessions.length()).mapNotNull { index ->
      val session = sessions.optJSONObject(index) ?: return@mapNotNull null
      val id = session.optString("id")
      val title = session.optString("title")
      if (id.isEmpty() || title.isEmpty()) return@mapNotNull null
      val link = Uri.parse("remoteharness://assistant/reply?sessionId=${Uri.encode(id)}")
      ShortcutInfoCompat.Builder(context, "session-$id")
        .setShortLabel(title.take(25))
        .setLongLabel(title.take(50))
        .setIcon(icon)
        .setIntent(Intent(Intent.ACTION_VIEW, link).setPackage(context.packageName))
        .setRank(index)
        .build()
    }.take(max)
    ShortcutManagerCompat.setDynamicShortcuts(context, shortcuts)
  }
}
