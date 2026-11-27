package eu.senda.field;

/** Ejecutar: javac WifiSecurity.java WifiSecurityTest.java && java eu.senda.field.WifiSecurityTest */
public final class WifiSecurityTest {
    private static int n = 0;
    private static void check(boolean ok, String what) { n++; if (!ok) throw new AssertionError(what); }
    public static void main(String[] a) {
        check(WifiSecurity.isOpen("[ESS]"), "abierta");
        check(WifiSecurity.isOpen(""), "vacía = abierta");
        check(!WifiSecurity.isOpen(null), "sin dato no se presume abierta");
        check(!WifiSecurity.isOpen("[WPA2-PSK-CCMP][RSN-PSK-CCMP][ESS]"), "WPA2");
        check(!WifiSecurity.isOpen("[WPA3-SAE-CCMP][ESS]"), "WPA3");
        check(!WifiSecurity.isOpen("[WEP][ESS]"), "WEP");
        check(!WifiSecurity.isOpen("[WPA2-EAP-CCMP][ESS]"), "empresa");
        check(WifiSecurity.isOpen("[RSN-OWE-CCMP][ESS]"), "OWE Enhanced Open sin contraseña");
        check(!WifiSecurity.isOpen("[RSN-OWE_TRANSITION-PSK-CCMP]"), "OWE en transición con PSK no");
        System.out.println("WifiSecurityTest " + n + "/" + n);
    }
}
