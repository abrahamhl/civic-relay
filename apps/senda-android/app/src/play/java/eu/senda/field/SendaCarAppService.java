package eu.senda.field;

import android.content.Intent;
import android.content.pm.ApplicationInfo;

import androidx.annotation.NonNull;
import androidx.car.app.CarAppService;
import androidx.car.app.Screen;
import androidx.car.app.Session;
import androidx.car.app.validation.HostValidator;

/**
 * SENDA en la pantalla del coche (Android Auto y coches con Google integrado) con la Car App Library.
 * Solo en la versión «play» (la base no tiene dependencias). Plantillas de Google: nada de vídeo ni
 * mapas propios, y textos breves pensados para no distraer.
 * Categoría declarada: POI, PROVISIONAL. Google solo admite en coche ciertas categorías (navegación, POI,
 * IoT, VoIP, tiempo); la que corresponde a un servicio de avisos sin guiado está por confirmar con Google
 * (docs/roadsafe/19_*).
 */
public final class SendaCarAppService extends CarAppService {
    @NonNull @Override public HostValidator createHostValidator() {
        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) return HostValidator.ALLOW_ALL_HOSTS_VALIDATOR;
        return new HostValidator.Builder(getApplicationContext()).addAllowedHosts(androidx.car.app.R.array.hosts_allowlist_sample).build();
    }

    @NonNull @Override @SuppressWarnings("deprecation")
    public Session onCreateSession() {
        return new Session() {
            @NonNull @Override public Screen onCreateScreen(@NonNull Intent intent) { return new DriveCarScreen(getCarContext()); }
        };
    }
}
