package app.wasted.android;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;

import app.wasted.android.kit.R;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * "¿Qué fue? Enviaste $15.000 a Juan Pérez" con un botón por categoría (las 3
 * más usadas, las elige el servidor). Tocar el aviso abre la lista en la app
 * (wasted://clasificar). Sin el permiso de notificaciones no se muestra nada:
 * la transferencia igual aparece "por clasificar" en el inicio.
 */
final class ClassifyNotifier {
    static final String CHANNEL = "classify";
    static final String EXTRA_TRANSACTION = "transaction";
    static final String EXTRA_CATEGORY = "category";
    static final String EXTRA_CATEGORY_NAME = "categoryName";
    static final String EXTRA_NOTIFICATION = "notification";

    private ClassifyNotifier() {}

    static void show(Context context, JSONObject question) {
        String id = question.optString("id");
        String text = question.optString("texto");
        JSONArray options = question.optJSONArray("opciones");
        if (id.isEmpty() || text.isEmpty() || !allowed(context)) return;

        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;
        ensureChannel(context, manager);
        int notificationId = id.hashCode();

        Intent open = new Intent(Intent.ACTION_VIEW, Uri.parse("wasted://clasificar")).setPackage(context.getPackageName());
        Notification.Builder builder = new Notification.Builder(context, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_classify)
                .setContentTitle(context.getString(R.string.classify_title))
                .setContentText(text)
                .setAutoCancel(true)
                .setCategory(Notification.CATEGORY_REMINDER)
                .setContentIntent(PendingIntent.getActivity(context, notificationId, open,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));

        if (options != null) {
            for (int i = 0; i < options.length() && i < 3; i++) {
                JSONObject option = options.optJSONObject(i);
                if (option == null) continue;
                String name = option.optString("nombre");
                Intent choose = new Intent(context, ClassifyReceiver.class)
                        .putExtra(EXTRA_TRANSACTION, id)
                        .putExtra(EXTRA_CATEGORY, option.optString("id"))
                        .putExtra(EXTRA_CATEGORY_NAME, name)
                        .putExtra(EXTRA_NOTIFICATION, notificationId);
                PendingIntent pending = PendingIntent.getBroadcast(context, notificationId * 31 + i, choose,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                builder.addAction(new Notification.Action.Builder(null, name, pending).build());
            }
        }
        manager.notify(notificationId, builder.build());
    }

    /** Tras tocar un botón: "Listo: Transporte" o el aviso de error, sin botones. */
    static void finish(Context context, int notificationId, String message, boolean ok) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;
        if (ok) {
            manager.cancel(notificationId);
            return;
        }
        Intent open = new Intent(Intent.ACTION_VIEW, Uri.parse("wasted://clasificar")).setPackage(context.getPackageName());
        manager.notify(notificationId, new Notification.Builder(context, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_classify)
                .setContentTitle(context.getString(R.string.classify_title))
                .setContentText(message)
                .setAutoCancel(true)
                .setContentIntent(PendingIntent.getActivity(context, notificationId, open,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE))
                .build());
    }

    private static boolean allowed(Context context) {
        return Build.VERSION.SDK_INT < 33
                || context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }

    private static void ensureChannel(Context context, NotificationManager manager) {
        if (manager.getNotificationChannel(CHANNEL) != null) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL, context.getString(R.string.classify_channel),
                NotificationManager.IMPORTANCE_DEFAULT);
        channel.setDescription(context.getString(R.string.classify_channel_description));
        manager.createNotificationChannel(channel);
    }
}
