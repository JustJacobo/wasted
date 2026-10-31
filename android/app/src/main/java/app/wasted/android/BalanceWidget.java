package app.wasted.android;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.text.format.DateUtils;
import android.widget.RemoteViews;

import com.google.androidbrowserhelper.trusted.LauncherActivity;

import java.io.IOException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * Widget "Te quedan": pinta al instante el último saldo guardado y luego lo
 * pide a /api/atajos/saldo. Se actualiza cada 30 min, al tocar ↻ y al registrar.
 */
public class BalanceWidget extends AppWidgetProvider {
    static final String ACTION_REFRESH = "app.wasted.android.REFRESH";

    private static final ExecutorService NETWORK = Executors.newSingleThreadExecutor();

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        render(context);
        fetch(context, goAsync());
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (ACTION_REFRESH.equals(intent.getAction())) {
            render(context);
            fetch(context, goAsync());
            return;
        }
        super.onReceive(context, intent);
    }

    /** Pide a todos los widgets que vuelvan a cargar el saldo (tras registrar o conectar). */
    static void refreshAll(Context context) {
        Intent intent = new Intent(context, BalanceWidget.class).setAction(ACTION_REFRESH);
        context.sendBroadcast(intent);
    }

    private static void fetch(Context context, PendingResult result) {
        Context app = context.getApplicationContext();
        String key = Prefs.key(app);
        if (key == null) {
            result.finish();
            return;
        }
        NETWORK.execute(() -> {
            try {
                // Lo que quedó sin enviar por falta de señal sale antes de pedir el saldo.
                NotificationQueue.flush(app);
                Prefs.setBalance(app, WastedApi.balance(key).toString());
            } catch (WastedApi.InvalidKeyException e) {
                Prefs.clearKey(app);
            } catch (IOException ignored) {
                // Sin conexión: queda el último saldo, marcado con su hora.
            } finally {
                render(app);
                result.finish();
            }
        });
    }

    static void render(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, BalanceWidget.class));
        if (ids.length == 0) return;
        RemoteViews views = build(context);
        for (int id : ids) manager.updateAppWidget(id, views);
    }

    private static RemoteViews build(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_balance);
        String key = Prefs.key(context);
        String cached = Prefs.balance(context);

        if (key == null) {
            views.setTextViewText(R.id.widget_title, "Wasted");
            views.setTextViewText(R.id.widget_amount, context.getString(R.string.widget_not_connected));
            views.setTextViewText(R.id.widget_detail, context.getString(R.string.widget_not_connected_detail));
            views.setOnClickPendingIntent(R.id.widget_open, openApp(context, "/ajustes"));
        } else if (cached == null) {
            views.setTextViewText(R.id.widget_amount, context.getString(R.string.widget_loading));
            views.setTextViewText(R.id.widget_detail, "");
            views.setOnClickPendingIntent(R.id.widget_open, openApp(context, "/"));
        } else {
            try {
                JSONObject s = new JSONObject(cached);
                views.setTextViewText(R.id.widget_title, s.optString("titulo", "Te quedan"));
                views.setTextViewText(R.id.widget_amount, s.optString("cifra"));
                boolean negative = !"none".equals(s.optString("nivel")) && s.optLong("teQuedan") < 0;
                if (negative) setDanger(context, views);
                views.setTextViewText(R.id.widget_detail, detail(context, s));
            } catch (JSONException e) {
                views.setTextViewText(R.id.widget_amount, context.getString(R.string.widget_loading));
            }
            views.setOnClickPendingIntent(R.id.widget_open, openApp(context, "/"));
        }

        views.setOnClickPendingIntent(R.id.widget_register, PendingIntent.getActivity(
                context, 1, new Intent(context, QuickAddActivity.class)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK),
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        views.setOnClickPendingIntent(R.id.widget_refresh, PendingIntent.getBroadcast(
                context, 2, new Intent(context, BalanceWidget.class).setAction(ACTION_REFRESH),
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        return views;
    }

    /**
     * Cifra en rojo. Desde Android 12 se pasa el recurso, que el launcher resuelve
     * con el tema actual; un color fijo quedaría con el del modo en que se pintó.
     */
    private static void setDanger(Context context, RemoteViews views) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            views.setColorStateList(R.id.widget_amount, "setTextColor", R.color.danger);
        } else {
            views.setTextColor(R.id.widget_amount, context.getColor(R.color.danger));
        }
    }

    /**
     * "Puedes gastar $X por día hasta el domingo" (o "Esta semana entró … · salió …"
     * si no hay proyección), o la hora del último dato si lleva rato sin actualizar.
     */
    private static String detail(Context context, JSONObject s) {
        String projection = s.isNull("proyeccion") ? "" : s.optString("proyeccion");
        String detail = projection.isEmpty() ? s.optString("detalle") : projection;
        long at = Prefs.balanceAt(context);
        if (at > 0 && System.currentTimeMillis() - at > 45 * DateUtils.MINUTE_IN_MILLIS) {
            CharSequence when = DateUtils.getRelativeTimeSpanString(at, System.currentTimeMillis(),
                    DateUtils.MINUTE_IN_MILLIS);
            return context.getString(R.string.widget_offline, when);
        }
        return detail;
    }

    private static PendingIntent openApp(Context context, String path) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(BuildConfig.WASTED_URL + path), context,
                LauncherActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(context, path.hashCode(), intent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }
}
