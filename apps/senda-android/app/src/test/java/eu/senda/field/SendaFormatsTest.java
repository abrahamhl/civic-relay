package eu.senda.field;

/**
 * Paridad con packages/senda/tests/beacon-survey.test.mjs: mismos vectores literales.
 * Se ejecuta en la JVM pura (sin Android): javac + java, ver .github/workflows/senda-android-ci.yml.
 */
public final class SendaFormatsTest {
    private static int checks;
    private static void check(boolean ok, String why) { checks++; if (!ok) throw new AssertionError(why); }

    public static void main(String[] args) {
        check(SendaFormats.crc8("123456789".getBytes(java.nio.charset.StandardCharsets.US_ASCII), 9) == 0xF4, "CRC-8 valor de comprobación estándar");

        String id = SendaFormats.beaconIdOf("SENDA-TEST");
        check(id.equals("76f202336769f0e2"), "id de baliza igual que la web: " + id);

        byte[] f = SendaFormats.encodeFrame("TRAPPED", 37, 3, 'B', id, 258);
        String h = SendaFormats.hex(f, 0, f.length);
        check(h.equals("534e010325034276f202336769f0e20102e1"), "trama igual que la web: " + h);

        SendaFormats.Frame d = SendaFormats.decodeFrame(SendaFormats.unhex("534e0100fffe0076f202336769f0e2000022"));
        check(d != null && d.status.equals("UNKNOWN") && d.battery == null && d.floor == -2 && d.unit == null && d.beaconId.equals(id) && d.seq == 0, "decodifica trama de la web");

        byte[] bad = f.clone(); bad[4] = 99;
        check(SendaFormats.decodeFrame(bad) == null, "CRC rechaza trama alterada");
        check(SendaFormats.decodeFrame(new byte[18]) == null, "trama ajena descartada");

        String line = SendaFormats.surveyLine(4.5, 12, SendaFormats.zFor(2, 1.5), "AA:BB:CC:DD:EE:01", "Casa \"3B\"", -61, 1793000000L, true, true, "android");
        check(line.equals("{\"x\":4.5,\"y\":12,\"z\":7.5,\"bssid\":\"aa:bb:cc:dd:ee:01\",\"ssid\":\"Casa \\\"3B\\\"\",\"rssi\":-61,\"t\":1793000000,\"connected\":true,\"internet\":true,\"source\":\"android\"}"),
              "línea JSONL igual al literal del test web: " + line);
        check(SendaFormats.surveyLine(0, 0, 1.2, "ble:76f202336769f0e2", null, -70, 1, false, false, null).equals("{\"x\":0,\"y\":0,\"z\":1.2,\"bssid\":\"ble:76f202336769f0e2\",\"ssid\":null,\"rssi\":-70,\"t\":1}"), "baliza BLE como fila de barrido");

        boolean threw = false;
        try { SendaFormats.surveyLine(0, 0, 0, "aa:bb:cc:dd:ee:01", null, 5, 1, false, false, null); } catch (IllegalArgumentException e) { threw = true; }
        check(threw, "rssi positivo rechazado");
        threw = false;
        try { SendaFormats.surveyLine(0, 0, 0, "no-es-mac", null, -50, 1, false, false, null); } catch (IllegalArgumentException e) { threw = true; }
        check(threw, "bssid no válido rechazado");
        threw = false;
        try { SendaFormats.surveyLine(Double.NaN, 0, 0, "aa:bb:cc:dd:ee:01", null, -50, 1, false, false, null); } catch (IllegalArgumentException e) { threw = true; }
        check(threw, "coordenada NaN rechazada");

        NativeAction a = NativeAction.parse("senda://accion?a=BLE_BEACON,WIFI_SCAN&id=76f202336769f0e2&b=B14&f=3&u=B&bat=37&cmd=abc");
        check(a.actions.contains("BLE_BEACON") && a.actions.contains("WIFI_SCAN") && a.floor == 3 && a.unit == 'B' && "B14".equals(a.buildingId) && a.battery == 37, "enlace de la web interpretado");
        threw = false;
        try { NativeAction.parse("senda://accion?a=BORRAR_TODO&id=76f202336769f0e2"); } catch (IllegalArgumentException e) { threw = true; }
        check(threw, "acción desconocida rechazada (lista blanca)");
        threw = false;
        try { NativeAction.parse("https://evil.example/accion?a=BLE_BEACON&id=76f202336769f0e2"); } catch (IllegalArgumentException e) { threw = true; }
        check(threw, "esquema ajeno rechazado");

        System.out.println("PASS: " + checks + " invariantes de formato SENDA (paridad web / Android / ESP32).");
    }
}
