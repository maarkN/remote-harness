package expo.modules.voiceassistant

import android.app.Activity
import android.content.Intent
import android.os.Bundle

/**
 * Target of the Google Assistant App Actions (`shortcuts.xml`). With an alternate app icon on,
 * `MainActivity` is disabled and only the active icon alias opens links, so App Actions cannot name
 * it: this activity re-sends the `remoteharness://assistant/…` link to the app's package, where
 * whichever activity is enabled opens it, and finishes. It forwards nothing else.
 */
class AssistantLinkActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val link = intent?.data
    if (link != null && link.scheme == "remoteharness" && link.host == "assistant") {
      try {
        startActivity(Intent(Intent.ACTION_VIEW, link).setPackage(packageName))
      } catch (_: Exception) {
        // No enabled activity takes the link (should not happen): nothing to open.
      }
    }
    finish()
  }
}
