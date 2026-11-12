package app.wasted.android;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import app.wasted.android.kit.R;

import java.io.IOException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Un botón de "¿Qué fue?": pone la categoría en Wasted y cierra el aviso. */
public class ClassifyReceiver extends BroadcastReceiver {
    private static final ExecutorService NETWORK = Executors.newSingleThreadExecutor();

    @Override
    public void onReceive(Context context, Intent intent) {
        String transaction = intent.getStringExtra(ClassifyNotifier.EXTRA_TRANSACTION);
        String category = intent.getStringExtra(ClassifyNotifier.EXTRA_CATEGORY);
        int notificationId = intent.getIntExtra(ClassifyNotifier.EXTRA_NOTIFICATION, 0);
        String key = Prefs.key(context);
        if (transaction == null || category == null || key == null) return;

        Context app = context.getApplicationContext();
        PendingResult result = goAsync();
        NETWORK.execute(() -> {
            try {
                WastedApi.classify(app, key, transaction, category);
                ClassifyNotifier.finish(app, notificationId, null, true);
                BalanceWidget.refreshAll(app);
            } catch (IOException e) {
                ClassifyNotifier.finish(app, notificationId, app.getString(R.string.classify_failed), false);
            } finally {
                result.finish();
            }
        });
    }
}
