package app.wasted.android;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.View;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import java.io.IOException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.json.JSONObject;

/**
 * Conecta el widget con la clave personal. Llega desde Ajustes con
 * wasted://conectar?clave=wst_… o se pega a mano. Cualquier página podría abrir
 * ese enlace con una clave ajena, así que antes de guardarla muestra a qué
 * cuenta pertenece y pide confirmación.
 */
public class ConnectActivity extends Activity {
    private final ExecutorService network = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());

    private EditText input;
    private TextView message;
    private TextView ok;
    /** Clave ya revisada contra el servidor, esperando confirmación. */
    private String verifiedKey;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_connect);
        input = findViewById(R.id.connect_input);
        message = findViewById(R.id.connect_message);
        ok = findViewById(R.id.connect_ok);
        findViewById(R.id.connect_cancel).setOnClickListener(v -> finish());

        input.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            @Override public void onTextChanged(CharSequence s, int start, int before, int count) {}
            @Override public void afterTextChanged(Editable s) {
                verifiedKey = null;
            }
        });
        ok.setOnClickListener(v -> {
            if (verifiedKey != null) confirm(verifiedKey);
            else check(input.getText().toString().trim());
        });

        Uri data = getIntent().getData();
        String key = data != null ? data.getQueryParameter("clave") : null;
        if (key != null) {
            input.setText(key.trim());
            input.setVisibility(View.GONE);
            check(key.trim());
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        network.shutdown();
    }

    private void check(String key) {
        verifiedKey = null;
        if (!WastedApi.looksLikeKey(key)) {
            show(getString(R.string.connect_invalid));
            input.setVisibility(View.VISIBLE);
            return;
        }
        show(getString(R.string.connect_checking));
        ok.setEnabled(false);
        ok.setAlpha(0.6f);
        network.execute(() -> {
            String text;
            String account = null;
            try {
                JSONObject balance = WastedApi.balance(key);
                account = balance.optString("cuenta", "");
                text = getString(R.string.connect_confirm, account.isEmpty() ? "de Wasted" : account);
            } catch (WastedApi.InvalidKeyException e) {
                text = getString(R.string.connect_invalid);
            } catch (IOException e) {
                text = getString(R.string.add_offline);
            }
            String reply = text;
            String found = account;
            main.post(() -> {
                ok.setEnabled(true);
                ok.setAlpha(1f);
                show(reply);
                if (found != null) {
                    verifiedKey = key;
                } else {
                    input.setVisibility(View.VISIBLE);
                }
            });
        });
    }

    private void confirm(String key) {
        Prefs.setKey(this, key);
        BalanceWidget.refreshAll(this);
        Toast.makeText(this, R.string.connect_done, Toast.LENGTH_SHORT).show();
        offerWidget();
        finish();
    }

    /** Si aún no hay widget en la pantalla de inicio, Android ofrece ponerlo con un toque. */
    private void offerWidget() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        AppWidgetManager manager = getSystemService(AppWidgetManager.class);
        ComponentName widget = new ComponentName(this, BalanceWidget.class);
        if (manager == null || !manager.isRequestPinAppWidgetSupported()) return;
        if (manager.getAppWidgetIds(widget).length > 0) return;
        manager.requestPinAppWidget(widget, null, null);
    }

    private void show(String text) {
        message.setText(text);
        message.setVisibility(View.VISIBLE);
    }
}
