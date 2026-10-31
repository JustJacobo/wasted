package app.wasted.android;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

/**
 * Lee las notificaciones de pagos de las apps de {@link Packages#WATCHED} y las
 * manda a Wasted, que decide si son un gasto, un ingreso o nada (transferencias
 * propias, publicidad). Las de cualquier otra app ni se miran.
 */
public class NotificationReader extends NotificationListenerService {
    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        String pkg = sbn.getPackageName();
        if (!Packages.WATCHED.containsKey(pkg)) return;
        if (!Prefs.readNotifications(this) || Prefs.key(this) == null) return;

        Notification n = sbn.getNotification();
        // El resumen de un grupo repite a las demás; lo que sigue en curso (un viaje) aún no es un pago.
        if ((n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;
        if ((n.flags & Notification.FLAG_ONGOING_EVENT) != 0) return;

        Bundle extras = n.extras;
        String title = text(extras.getCharSequence(Notification.EXTRA_TITLE));
        String body = text(extras.getCharSequence(Notification.EXTRA_BIG_TEXT));
        if (body.isEmpty()) body = text(extras.getCharSequence(Notification.EXTRA_TEXT));
        if (title.isEmpty() && body.isEmpty()) return;
        // Una app puede volver a publicar la misma notificación (al actualizarla).
        if (!Prefs.markSeen(this, pkg + "\n" + title + "\n" + body)) return;

        NotificationQueue.add(this, pkg, title, body, sbn.getPostTime());
        NotificationQueue.flushAsync(this);
    }

    private static String text(CharSequence value) {
        return value == null ? "" : value.toString().trim();
    }
}
