package app.wasted.android;

import android.content.Context;
import android.content.SharedPreferences;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Lo que el widget recuerda en el teléfono (preferencias privadas de la app). */
final class Prefs {
    private static final String FILE = "wasted";
    private static final String KEY = "api_key";
    private static final String BALANCE = "balance_json";
    private static final String BALANCE_AT = "balance_at";
    private static final String BUTTONS = "buttons";
    private static final int MAX_BUTTONS = 12;
    private static final String READ_NOTIFICATIONS = "read_notifications";
    private static final String QUEUE = "notification_queue";
    private static final String SEEN = "notification_seen";
    private static final String SENT_AT = "notification_sent_at";
    /** Una notificación igual dentro de este margen es la misma, publicada otra vez. */
    private static final long SEEN_FOR_MS = 10 * 60 * 1000;

    private Prefs() {}

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(FILE, Context.MODE_PRIVATE);
    }

    static String key(Context context) {
        return prefs(context).getString(KEY, null);
    }

    static void setKey(Context context, String key) {
        prefs(context).edit().putString(KEY, key).remove(BALANCE).remove(BALANCE_AT).apply();
    }

    /** Clave revocada o inválida: el widget vuelve a pedir que lo conecten. */
    static void clearKey(Context context) {
        prefs(context).edit().remove(KEY).remove(BALANCE).remove(BALANCE_AT).apply();
    }

    /** Último saldo recibido, para pintar el widget al instante o sin conexión. */
    static String balance(Context context) {
        return prefs(context).getString(BALANCE, null);
    }

    static long balanceAt(Context context) {
        return prefs(context).getLong(BALANCE_AT, 0);
    }

    static void setBalance(Context context, String json) {
        prefs(context).edit().putString(BALANCE, json).putLong(BALANCE_AT, System.currentTimeMillis()).apply();
    }

    /** Botones fijos del cuadro de registro ("6k uber", "+200k cuota semanal"). */
    static List<String> buttons(Context context) {
        List<String> list = new ArrayList<>();
        try {
            JSONArray array = new JSONArray(prefs(context).getString(BUTTONS, "[]"));
            for (int i = 0; i < array.length(); i++) list.add(array.getString(i));
        } catch (JSONException ignored) {
            // Preferencia corrupta: se empieza de cero.
        }
        return list;
    }

    static void addButton(Context context, String text) {
        List<String> list = buttons(context);
        list.remove(text);
        list.add(0, text);
        while (list.size() > MAX_BUTTONS) list.remove(list.size() - 1);
        saveButtons(context, list);
    }

    static void removeButton(Context context, String text) {
        List<String> list = buttons(context);
        list.remove(text);
        saveButtons(context, list);
    }

    private static void saveButtons(Context context, List<String> list) {
        prefs(context).edit().putString(BUTTONS, new JSONArray(list).toString()).apply();
    }

    /** Leer las notificaciones de pagos (se puede pausar sin quitar el permiso). */
    static boolean readNotifications(Context context) {
        return prefs(context).getBoolean(READ_NOTIFICATIONS, true);
    }

    static void setReadNotifications(Context context, boolean read) {
        prefs(context).edit().putBoolean(READ_NOTIFICATIONS, read).apply();
    }

    /** Notificaciones que esperan señal para salir. */
    static JSONArray queue(Context context) {
        try {
            return new JSONArray(prefs(context).getString(QUEUE, "[]"));
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    static void setQueue(Context context, JSONArray queue) {
        prefs(context).edit().putString(QUEUE, queue.toString()).commit();
    }

    static long notificationsSentAt(Context context) {
        return prefs(context).getLong(SENT_AT, 0);
    }

    static void setNotificationsSentAt(Context context, long at) {
        prefs(context).edit().putLong(SENT_AT, at).apply();
    }

    /** true si es nueva; false si la misma llegó hace poco (se volvió a publicar). */
    static synchronized boolean markSeen(Context context, String content) {
        long now = System.currentTimeMillis();
        String hash = Integer.toHexString(content.hashCode()) + ":" + content.length();
        JSONObject seen;
        try {
            seen = new JSONObject(prefs(context).getString(SEEN, "{}"));
        } catch (JSONException e) {
            seen = new JSONObject();
        }
        boolean fresh = now - seen.optLong(hash, 0) > SEEN_FOR_MS;
        JSONObject kept = new JSONObject();
        for (Iterator<String> keys = seen.keys(); keys.hasNext(); ) {
            String k = keys.next();
            long at = seen.optLong(k, 0);
            if (now - at <= SEEN_FOR_MS) {
                try {
                    kept.put(k, at);
                } catch (JSONException ignored) {
                    // Nunca pasa con una clave de texto y un número.
                }
            }
        }
        if (fresh) {
            try {
                kept.put(hash, now);
            } catch (JSONException ignored) {
                // Igual que arriba.
            }
        }
        prefs(context).edit().putString(SEEN, kept.toString()).apply();
        return fresh;
    }
}
