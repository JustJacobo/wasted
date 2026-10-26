package app.wasted.android;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * Llamadas a /api/atajos/* con la clave personal (Authorization: Bearer wst_…).
 * Son bloqueantes: llamarlas fuera del hilo principal.
 */
final class WastedApi {
    /** La clave no existe, fue revocada o la persona ya no tiene acceso. */
    static final class InvalidKeyException extends IOException {
        InvalidKeyException() {
            super("Clave no válida");
        }
    }

    static final String KEY_PREFIX = "wst_";

    private WastedApi() {}

    /** true si el texto tiene la forma de una clave de Wasted. */
    static boolean looksLikeKey(String key) {
        return key != null && key.startsWith(KEY_PREFIX) && key.length() <= 64
                && key.matches("wst_[A-Za-z0-9_-]+");
    }

    /** Saldo y semana en curso (GET /api/atajos/saldo). */
    static JSONObject balance(String key) throws IOException {
        HttpURLConnection connection = open("/api/atajos/saldo", key);
        try {
            String body = read(connection);
            return new JSONObject(body);
        } catch (JSONException e) {
            throw new IOException("Respuesta inesperada", e);
        } finally {
            connection.disconnect();
        }
    }

    /** Registra una línea de texto y devuelve el mensaje de confirmación o de ayuda. */
    static String record(String key, String text) throws IOException {
        HttpURLConnection connection = open("/api/atajos/registrar?formato=texto", key);
        try {
            connection.setRequestMethod("POST");
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "text/plain; charset=utf-8");
            byte[] payload = text.getBytes(StandardCharsets.UTF_8);
            connection.setFixedLengthStreamingMode(payload.length);
            try (OutputStream out = connection.getOutputStream()) {
                out.write(payload);
            }
            return read(connection).trim();
        } finally {
            connection.disconnect();
        }
    }

    private static HttpURLConnection open(String path, String key) throws IOException {
        HttpURLConnection connection = (HttpURLConnection) new URL(BuildConfig.WASTED_URL + path).openConnection();
        connection.setConnectTimeout(10_000);
        connection.setReadTimeout(20_000);
        connection.setUseCaches(false);
        connection.setRequestProperty("Authorization", "Bearer " + key);
        connection.setRequestProperty("Accept", "application/json, text/plain");
        return connection;
    }

    private static String read(HttpURLConnection connection) throws IOException {
        int status = connection.getResponseCode();
        if (status == HttpURLConnection.HTTP_UNAUTHORIZED) throw new InvalidKeyException();
        if (status >= 500) throw new IOException("Error del servidor (" + status + ")");
        InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
        if (stream == null) throw new IOException("Respuesta vacía (" + status + ")");
        try (InputStream in = stream; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            int n;
            while ((n = in.read(buffer)) != -1) out.write(buffer, 0, n);
            return out.toString("UTF-8");
        }
    }
}
