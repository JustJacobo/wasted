package app.wasted.android

import android.app.NotificationManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Puente entre la app (React Native) y lo nativo que sigue en Java: el widget,
 * el registro rápido y la lectura de notificaciones. Todos usan la clave wst_
 * guardada en Prefs, que la app entrega al iniciar sesión.
 */
class WastedAndroidModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "Sin contexto de Android" }.applicationContext

  override fun definition() = ModuleDefinition {
    Name("WastedAndroid")

    /** Servidor de la API (producción, o el computador en desarrollo). */
    Function("configure") { apiUrl: String ->
      Prefs.setApiUrl(context, apiUrl)
    }

    Function("getKey") { Prefs.key(context) }

    /** Guarda (o borra, con null) la clave del widget y de las notificaciones, y repinta el widget. */
    Function("setKey") { key: String? ->
      if (key.isNullOrBlank()) Prefs.clearKey(context) else Prefs.setKey(context, key)
      BalanceWidget.refreshAll(context)
    }

    Function("refreshWidget") { BalanceWidget.refreshAll(context) }

    Function("hasNotificationAccess") {
      val reader = ComponentName(context, NotificationReader::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
        context.getSystemService(NotificationManager::class.java)?.isNotificationListenerAccessGranted(reader) == true
      } else {
        Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners")?.contains(reader.flattenToString()) == true
      }
    }

    Function("readNotifications") { Prefs.readNotifications(context) }

    Function("setReadNotifications") { read: Boolean -> Prefs.setReadNotifications(context, read) }

    /** La pantalla de Android con el interruptor de Wasted (o la lista, si el fabricante no la tiene). */
    Function("openNotificationSettings") {
      val component = ComponentName(context, NotificationReader::class.java).flattenToString()
      val detail = Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS)
        .putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME, component)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) context.startActivity(detail)
        else throw IllegalStateException()
      } catch (_: Exception) {
        context.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      }
    }

    /** Información de la app: ahí está "Permitir ajustes restringidos" (Android 13 o superior). */
    Function("openAppDetails") {
      context.startActivity(
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}"))
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
      )
    }

    /** El cuadro "¿Qué registras?" con los botones fijos. */
    Function("openQuickAdd") {
      context.startActivity(Intent(context, QuickAddActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
  }
}
