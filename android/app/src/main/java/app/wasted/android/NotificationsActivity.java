package app.wasted.android;

import android.app.Activity;
import android.app.NotificationManager;
import android.content.ActivityNotFoundException;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.text.format.DateUtils;
import android.view.View;
import android.widget.Switch;
import android.widget.TextView;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Activa el registro por notificaciones: explica qué se lee, muestra qué apps
 * hay instaladas y lleva al permiso de Android. Llega desde Ajustes
 * (wasted://notificaciones) o al mantener pulsado el ícono.
 */
public class NotificationsActivity extends Activity {
    private TextView apps;
    private TextView status;
    private TextView access;
    private Switch toggle;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_notifications);
        apps = findViewById(R.id.notifications_apps);
        status = findViewById(R.id.notifications_status);
        access = findViewById(R.id.notifications_access);
        toggle = findViewById(R.id.notifications_toggle);

        access.setOnClickListener(v -> openListenerSettings());
        findViewById(R.id.notifications_app_info).setOnClickListener(v -> startActivity(
                new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()))));
        toggle.setOnCheckedChangeListener((v, checked) -> {
            Prefs.setReadNotifications(this, checked);
            render();
        });
        findViewById(R.id.notifications_close).setOnClickListener(v -> finish());

        // "Permitir ajustes restringidos" solo existe desde Android 13.
        int restricted = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU ? View.VISIBLE : View.GONE;
        findViewById(R.id.notifications_restricted_help).setVisibility(restricted);
        findViewById(R.id.notifications_app_info).setVisibility(restricted);
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Al volver de los ajustes de Android, el permiso pudo cambiar.
        render();
    }

    private void render() {
        apps.setText(installedApps());
        toggle.setChecked(Prefs.readNotifications(this));
        boolean granted = hasAccess();
        boolean connected = Prefs.key(this) != null;
        access.setVisibility(granted ? View.GONE : View.VISIBLE);
        toggle.setVisibility(granted ? View.VISIBLE : View.GONE);

        if (!connected) {
            status.setText(R.string.add_not_connected);
        } else if (!granted) {
            status.setText(R.string.notifications_no_access);
        } else if (!Prefs.readNotifications(this)) {
            status.setText(R.string.notifications_paused);
        } else {
            long at = Prefs.notificationsSentAt(this);
            status.setText(at == 0
                    ? getString(R.string.notifications_on)
                    : getString(R.string.notifications_on_since, DateUtils.getRelativeTimeSpanString(
                            at, System.currentTimeMillis(), DateUtils.MINUTE_IN_MILLIS)));
        }
    }

    /** "✓ Nequi", "– Yango (no está instalada)"…, una línea por app. */
    private String installedApps() {
        Map<String, Boolean> byName = new LinkedHashMap<>();
        PackageManager pm = getPackageManager();
        for (Map.Entry<String, String> app : Packages.WATCHED.entrySet()) {
            boolean installed;
            try {
                pm.getPackageInfo(app.getKey(), 0);
                installed = true;
            } catch (PackageManager.NameNotFoundException e) {
                installed = false;
            }
            Boolean before = byName.get(app.getValue());
            byName.put(app.getValue(), installed || Boolean.TRUE.equals(before));
        }
        StringBuilder text = new StringBuilder();
        for (Map.Entry<String, Boolean> app : byName.entrySet()) {
            if (text.length() > 0) text.append('\n');
            text.append(app.getValue()
                    ? getString(R.string.notifications_app_installed, app.getKey())
                    : getString(R.string.notifications_app_missing, app.getKey()));
        }
        return text.toString();
    }

    private boolean hasAccess() {
        ComponentName reader = new ComponentName(this, NotificationReader.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            return manager != null && manager.isNotificationListenerAccessGranted(reader);
        }
        String enabled = Settings.Secure.getString(getContentResolver(), "enabled_notification_listeners");
        return enabled != null && enabled.contains(reader.flattenToString());
    }

    /** Directo al interruptor de Wasted cuando Android lo permite; si no, a la lista. */
    private void openListenerSettings() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            try {
                startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS)
                        .putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME,
                                new ComponentName(this, NotificationReader.class).flattenToString()));
                return;
            } catch (ActivityNotFoundException ignored) {
                // Algunos fabricantes no tienen esa pantalla: sigue con la lista general.
            }
        }
        startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS));
    }
}
