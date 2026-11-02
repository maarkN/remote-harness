package expo.modules.handsfreebackground

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.net.Uri
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat

/**
 * Foreground service that keeps the app alive while hands-free is on (#446), with the ongoing
 * notification Android requires: the texts JavaScript passes (translated there), a Stop action that
 * ends the mode and a tap that opens the session. Its type is microphone (listening) and media
 * playback (speech); without the microphone permission, media playback only.
 */
class HandsFreeService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      onStop?.invoke()
      ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
      stopSelf()
      return START_NOT_STICKY
    }
    val title = intent?.getStringExtra(EXTRA_TITLE) ?: ""
    val subtitle = intent?.getStringExtra(EXTRA_SUBTITLE) ?: ""
    val stopLabel = intent?.getStringExtra(EXTRA_STOP) ?: ""
    val channelName = intent?.getStringExtra(EXTRA_CHANNEL) ?: title
    val link = intent?.getStringExtra(EXTRA_LINK)
    ensureChannel(channelName)
    try {
      ServiceCompat.startForeground(
        this,
        NOTIFICATION_ID,
        notification(title, subtitle, stopLabel, link),
        serviceTypes(),
      )
    } catch (_: Exception) {
      // Android 14 refuses a microphone service started from the background: nothing keeps the app
      // alive then, and hands-free works as with the app open.
      stopSelf()
    }
    return START_NOT_STICKY
  }

  private fun serviceTypes(): Int {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return 0
    val playback = ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
    val microphone =
      ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
    return if (microphone && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      playback or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
    } else {
      playback
    }
  }

  /** A quiet channel: the notification only says the mode is on and offers Stop. */
  private fun ensureChannel(name: String) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val channel = NotificationChannel(CHANNEL_ID, name, NotificationManager.IMPORTANCE_LOW).apply {
      setShowBadge(false)
      setSound(null, null)
    }
    getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
  }

  private fun notification(title: String, subtitle: String, stopLabel: String, link: String?): Notification {
    val flags = PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    val openIntent = link?.let { Intent(Intent.ACTION_VIEW, Uri.parse(it)).setPackage(packageName) }
      ?: packageManager.getLaunchIntentForPackage(packageName)
    val open = openIntent?.let { PendingIntent.getActivity(this, 0, it, flags) }
    val stop = PendingIntent.getService(
      this,
      1,
      Intent(this, HandsFreeService::class.java).setAction(ACTION_STOP),
      flags,
    )
    val builder = NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(smallIcon())
      .setContentTitle(title)
      .setContentText(subtitle)
      .setOngoing(true)
      .setSilent(true)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
      .addAction(0, stopLabel, stop)
    if (open != null) builder.setContentIntent(open)
    return builder.build()
  }

  /** The app's notification icon (the `expo-notifications` resource), else its launcher icon. */
  private fun smallIcon(): Int {
    val id = resources.getIdentifier("notification_icon", "drawable", packageName)
    return if (id != 0) id else applicationInfo.icon
  }

  companion object {
    /** Set by the module: called when the user taps Stop on the notification. */
    var onStop: (() -> Unit)? = null

    private const val CHANNEL_ID = "hands-free"
    private const val NOTIFICATION_ID = 4460
    private const val ACTION_STOP = "expo.modules.handsfreebackground.STOP"
    private const val EXTRA_TITLE = "title"
    private const val EXTRA_SUBTITLE = "subtitle"
    private const val EXTRA_STOP = "stop"
    private const val EXTRA_CHANNEL = "channel"
    private const val EXTRA_LINK = "link"

    /** Starts (or updates) the service with the translated texts; called from the foreground. */
    fun start(context: Context, texts: Map<String, String>) {
      val intent = Intent(context, HandsFreeService::class.java)
        .putExtra(EXTRA_TITLE, texts["title"])
        .putExtra(EXTRA_SUBTITLE, texts["subtitle"])
        .putExtra(EXTRA_STOP, texts["stop"])
        .putExtra(EXTRA_CHANNEL, texts["channel"])
        .putExtra(EXTRA_LINK, texts["link"])
      try {
        ContextCompat.startForegroundService(context, intent)
      } catch (_: Exception) {
        // Not allowed right now (background start): hands-free works as with the app open.
      }
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, HandsFreeService::class.java))
    }
  }
}
