package app.wasted.android;

import android.content.Context;

import java.io.IOException;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Notificaciones por mandar. Sin señal quedan guardadas en el teléfono y salen
 * con la siguiente notificación o cuando el widget se actualiza.
 */
final class NotificationQueue {
    private static final int MAX = 100;
    /** Lo que acepta /api/notificaciones de una vez. */
    private static final int BATCH = 50;
    private static final ExecutorService NETWORK = Executors.newSingleThreadExecutor();

    private NotificationQueue() {}

    static synchronized void add(Context context, String pkg, String title, String text, long postedAt) {
        JSONArray queue = Prefs.queue(context);
        try {
            queue.put(new JSONObject()
                    .put("id", UUID.randomUUID().toString())
                    .put("paquete", pkg)
                    .put("titulo", title)
                    .put("texto", text)
                    .put("publicada", postedAt));
        } catch (JSONException e) {
            return;
        }
        while (queue.length() > MAX) queue.remove(0);
        Prefs.setQueue(context, queue);
    }

    static void flushAsync(Context context) {
        Context app = context.getApplicationContext();
        NETWORK.execute(() -> flush(app));
    }

    /** Manda lo pendiente. Bloqueante: llamarla fuera del hilo principal. */
    static void flush(Context context) {
        String key = Prefs.key(context);
        if (key == null) return;
        JSONArray batch = new JSONArray();
        Set<String> ids = new HashSet<>();
        synchronized (NotificationQueue.class) {
            JSONArray queue = Prefs.queue(context);
            for (int i = 0; i < queue.length() && i < BATCH; i++) {
                JSONObject item = queue.optJSONObject(i);
                if (item == null) continue;
                batch.put(item);
                ids.add(item.optString("id"));
            }
        }
        if (batch.length() == 0) return;

        try {
            WastedApi.notifications(key, batch);
        } catch (IOException e) {
            // Sin señal o clave inválida: queda en la cola para la próxima.
            return;
        }
        synchronized (NotificationQueue.class) {
            JSONArray queue = Prefs.queue(context);
            JSONArray rest = new JSONArray();
            for (int i = 0; i < queue.length(); i++) {
                JSONObject item = queue.optJSONObject(i);
                if (item != null && !ids.contains(item.optString("id"))) rest.put(item);
            }
            Prefs.setQueue(context, rest);
        }
        Prefs.setNotificationsSentAt(context, System.currentTimeMillis());
        BalanceWidget.refreshAll(context);
    }
}
