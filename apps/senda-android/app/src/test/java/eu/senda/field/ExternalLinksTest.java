package eu.senda.field;

public final class ExternalLinksTest {
    private static int n = 0;
    private static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); n++; }
    public static void main(String[] a) {
        check(ExternalLinks.allowed("https://waze.com/ul?ll=39.42,-0.38&navigate=yes"), "Waze");
        check(ExternalLinks.allowed("https://www.google.com/maps/dir/?api=1&destination=1,2"), "Google Maps");
        check(ExternalLinks.allowed("sms:+34600000000?&body=hola"), "SMS");
        check(ExternalLinks.allowed("tel:112"), "llamada");
        check(ExternalLinks.allowed("https://github.com/abrahamhl/civic-relay/releases/download/senda-android-latest/senda-base.apk"), "descarga del APK");
        check(!ExternalLinks.allowed("https://www.google.com/search?q=x"), "Google que no es Maps");
        check(!ExternalLinks.allowed("https://evil.example/waze.com"), "otro host");
        check(!ExternalLinks.allowed("https://waze.com.evil.example/ul"), "subdominio engañoso");
        check(!ExternalLinks.allowed("https://user@waze.com/ul"), "credenciales en la URL");
        check(!ExternalLinks.allowed("http://waze.com/ul"), "sin cifrar");
        check(!ExternalLinks.allowed("javascript:alert(1)"), "javascript");
        check(!ExternalLinks.allowed("https://github.com/otro/repo"), "otro repositorio de GitHub");
        check(!ExternalLinks.allowed(null), "nulo");
        System.out.println("ExternalLinksTest: " + n + " comprobaciones correctas");
    }
}
