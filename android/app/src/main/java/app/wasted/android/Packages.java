package app.wasted.android;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Apps cuyas notificaciones de pagos se leen, con su nombre. Debe coincidir con
 * WATCHED_PACKAGES de src/lib/notifications/parsers.ts. Las demás ni se miran.
 */
final class Packages {
    static final Map<String, String> WATCHED;

    static {
        Map<String, String> map = new LinkedHashMap<>();
        map.put("com.nequi.MobileApp", "Nequi");
        map.put("com.nu.production", "Nu");
        map.put("com.didiglobal.passenger", "DiDi");
        map.put("com.sdu.didi.psnger", "DiDi");
        map.put("com.ubercab", "Uber");
        map.put("com.yandex.yango", "Yango");
        WATCHED = Collections.unmodifiableMap(map);
    }

    private Packages() {}
}
