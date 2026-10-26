package app.wasted.android;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.google.androidbrowserhelper.trusted.LauncherActivity;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Cuadro para registrar sin abrir la app: se escribe "6k uber" o se toca un
 * botón fijo. Usa el mismo parser que Telegram (POST /api/atajos/registrar).
 */
public class QuickAddActivity extends Activity {
    private static final long CLOSE_AFTER_MS = 2_500;

    private final ExecutorService network = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());

    private EditText input;
    private LinearLayout buttons;
    private TextView message;
    private TextView save;
    private TextView pin;
    private boolean saving;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_quick_add);
        input = findViewById(R.id.add_input);
        buttons = findViewById(R.id.add_buttons);
        message = findViewById(R.id.add_message);
        save = findViewById(R.id.add_save);
        pin = findViewById(R.id.add_pin);

        if (Prefs.key(this) == null) {
            showNotConnected();
            return;
        }

        save.setOnClickListener(v -> submit(input.getText().toString()));
        input.setOnEditorActionListener((v, actionId, event) -> {
            if (actionId != EditorInfo.IME_ACTION_DONE) return false;
            submit(input.getText().toString());
            return true;
        });
        pin.setOnClickListener(v -> {
            String text = input.getText().toString().trim();
            if (text.isEmpty()) return;
            Prefs.addButton(this, text);
            renderButtons();
        });
        renderButtons();
        input.requestFocus();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        main.removeCallbacksAndMessages(null);
        network.shutdown();
    }

    private void renderButtons() {
        buttons.removeAllViews();
        List<String> list = Prefs.buttons(this);
        findViewById(R.id.add_buttons_scroll).setVisibility(list.isEmpty() ? View.GONE : View.VISIBLE);
        int gap = dp(8);
        for (String text : list) {
            TextView chip = new TextView(this);
            chip.setText(text);
            chip.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
            chip.setTextColor(getColor(R.color.ink));
            chip.setBackgroundResource(R.drawable.chip);
            chip.setGravity(Gravity.CENTER);
            chip.setMinHeight(dp(40));
            chip.setPadding(dp(14), 0, dp(14), 0);
            chip.setOnClickListener(v -> submit(text));
            chip.setOnLongClickListener(v -> {
                new AlertDialog.Builder(this)
                        .setMessage(getString(R.string.add_remove_button, text))
                        .setPositiveButton(R.string.add_remove, (d, w) -> {
                            Prefs.removeButton(this, text);
                            renderButtons();
                        })
                        .setNegativeButton(R.string.cancel, null)
                        .show();
                return true;
            });
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
            params.setMarginEnd(gap);
            buttons.addView(chip, params);
        }
    }

    private void submit(String raw) {
        String text = raw.trim();
        String key = Prefs.key(this);
        if (saving || text.isEmpty() || key == null) return;
        setSaving(true);
        network.execute(() -> {
            try {
                String reply = WastedApi.record(key, text);
                main.post(() -> done(reply));
            } catch (WastedApi.InvalidKeyException e) {
                Prefs.clearKey(this);
                BalanceWidget.render(this);
                main.post(this::showNotConnected);
            } catch (IOException e) {
                main.post(() -> {
                    setSaving(false);
                    showMessage(getString(R.string.add_offline));
                });
            }
        });
    }

    /** Muestra la respuesta del servidor. Si se registró ("✓ …"), actualiza el widget y cierra. */
    private void done(String reply) {
        setSaving(false);
        showMessage(reply);
        if (!reply.startsWith("✓")) return;
        BalanceWidget.refreshAll(this);
        input.setText("");
        input.setEnabled(false);
        save.setText(R.string.close);
        save.setOnClickListener(v -> finish());
        message.setOnClickListener(v -> finish());
        main.postDelayed(this::finish, CLOSE_AFTER_MS);
    }

    private void setSaving(boolean value) {
        saving = value;
        save.setText(value ? R.string.add_saving : R.string.add_save);
        save.setEnabled(!value);
        save.setAlpha(value ? 0.6f : 1f);
    }

    private void showMessage(String text) {
        message.setText(text);
        message.setVisibility(View.VISIBLE);
    }

    private void showNotConnected() {
        input.setVisibility(View.GONE);
        findViewById(R.id.add_buttons_scroll).setVisibility(View.GONE);
        pin.setVisibility(View.INVISIBLE);
        showMessage(getString(R.string.add_not_connected));
        save.setText(R.string.open_wasted);
        save.setEnabled(true);
        save.setAlpha(1f);
        save.setOnClickListener(v -> {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(BuildConfig.WASTED_URL + "/ajustes"),
                    this, LauncherActivity.class));
            finish();
        });
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
