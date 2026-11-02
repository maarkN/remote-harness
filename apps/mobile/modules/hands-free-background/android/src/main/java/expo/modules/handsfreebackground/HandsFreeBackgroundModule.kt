package expo.modules.handsfreebackground

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Android side of the hands-free keep-alive (#446): `start` runs [HandsFreeService] in the
 * foreground with its persistent notification, `stop` ends it, and the notification's Stop action
 * comes back as `onStop`. `release` does nothing (iOS gives the microphone back there) and `onTalk`
 * never fires (no headset mapping on Android).
 */
class HandsFreeBackgroundModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("HandsFreeBackground")

    Events("onStop", "onTalk")

    OnCreate {
      HandsFreeService.onStop = { sendEvent("onStop") }
    }

    OnDestroy {
      HandsFreeService.onStop = null
      appContext.reactContext?.let { HandsFreeService.stop(it) }
    }

    Function("start") { texts: Map<String, String> ->
      val context = appContext.reactContext ?: return@Function
      HandsFreeService.start(context, texts)
    }

    Function("release") { }

    Function("stop") {
      appContext.reactContext?.let { HandsFreeService.stop(it) }
    }
  }
}
