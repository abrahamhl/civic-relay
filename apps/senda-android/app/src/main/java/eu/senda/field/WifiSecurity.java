package eu.senda.field;

import java.util.Locale;

/**
 * ¿Es una red Wi-Fi abierta (sin contraseña)? A partir del campo `capabilities` de Android (p. ej. "[WPA2-PSK-CCMP][ESS]").
 * Es la única clase de red que SENDA puede usar como salida a Internet sin permiso de su dueño: conectarse a una red
 * protegida sin autorización es acceso ilícito. OWE («Enhanced Open») cifra el aire pero no pide contraseña: cuenta como abierta.
 * Java puro: se prueba en la JVM (WifiSecurityTest).
 */
public final class WifiSecurity {
    private WifiSecurity() {}

    public static boolean isOpen(String capabilities) {
        if (capabilities == null) return false; // sin dato: no se presume abierta
        String c = capabilities.toUpperCase(Locale.ROOT);
        if (c.contains("OWE") && !c.contains("PSK") && !c.contains("SAE") && !c.contains("EAP")) return true;
        return !(c.contains("WPA") || c.contains("WEP") || c.contains("SAE") || c.contains("PSK") || c.contains("EAP") || c.contains("RSN"));
    }
}
