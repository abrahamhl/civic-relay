package eu.senda.field;

/**
 * Pruebas JVM (Java 17, sin dependencias) de UsbSerialCodec para el puente USB-OTG mmWave (F5).
 */
public final class UsbSerialCodecTest {
    private static int passed = 0;

    private static void check(boolean cond, String msg) {
        if (!cond) throw new AssertionError("FALLO: " + msg);
        passed++;
    }

    public static void main(String[] args) {
        // 1. Identificación de controladores USB-serie habituales
        check(UsbSerialCodec.identifyDriver(0x1A86, 0x7523, 0xFF) == UsbSerialCodec.Driver.CH340, "CH340G");
        check(UsbSerialCodec.identifyDriver(0x10C4, 0xEA60, 0xFF) == UsbSerialCodec.Driver.CP210X, "CP2102");
        check(UsbSerialCodec.identifyDriver(0x0403, 0x6001, 0xFF) == UsbSerialCodec.Driver.FTDI, "FT232R");
        check(UsbSerialCodec.identifyDriver(0x303A, 0x1001, 0x02) == UsbSerialCodec.Driver.CDC_ACM, "ESP32-S3 CDC-ACM");
        check(UsbSerialCodec.identifyDriver(0x1234, 0x5678, 0x08) == UsbSerialCodec.Driver.UNSUPPORTED, "Almacenamiento masivo rechazado");

        // 2. CDC-ACM 256000 8N1 little-endian (256000 = 0x0003E800)
        byte[] cdc = UsbSerialCodec.cdcLineCoding8N1(256000);
        check(cdc.length == 7, "CDC coding 7 bytes");
        check((cdc[0] & 0xFF) == 0x00 && (cdc[1] & 0xFF) == 0xE8 && (cdc[2] & 0xFF) == 0x03 && (cdc[3] & 0xFF) == 0x00, "CDC 256000 LE");
        check(cdc[4] == 0 && cdc[5] == 0 && cdc[6] == 8, "CDC 8N1");

        // 3. CP210x 256000 LE
        byte[] cp = UsbSerialCodec.cp210xBaudBytes(256000);
        check(cp.length == 4 && (cp[1] & 0xFF) == 0xE8 && (cp[2] & 0xFF) == 0x03, "CP210x 256000 LE");

        // 4. CH340 registro 0x1312 a 256000 baudios: factor = round(6e6/256000) = 23 → 256-23 = 233 (0xE9), prescaler 0x83
        int chReg = UsbSerialCodec.ch340BaudReg1312(256000);
        check(chReg == 0xE983, "CH340 256000 → 0xE983 (got 0x" + Integer.toHexString(chReg) + ")");

        // 5. FTDI divisor a 256000 baudios: round(24e6/256000) = 94 = 11*8 + 6 → int=11, frac=6 (code 6)
        int[] ftdi = UsbSerialCodec.ftdiBaudDivisor(256000);
        check((ftdi[0] & 0x3FFF) == 11, "FTDI parte entera 11");
        check(ftdi[1] == 1, "FTDI bit alto de fracción 6");

        // 6. Paridad byte a byte con CMD en packages/senda/src/mmwave-radar.mjs
        check(UsbSerialCodec.CMD_ENABLE_CONFIG.length == 14 && (UsbSerialCodec.CMD_ENABLE_CONFIG[6] & 0xFF) == 0xFF, "CMD_ENABLE_CONFIG");
        check(UsbSerialCodec.CMD_MULTI_TARGET.length == 12 && (UsbSerialCodec.CMD_MULTI_TARGET[6] & 0xFF) == 0x90, "CMD_MULTI_TARGET");
        check(UsbSerialCodec.CMD_END_CONFIG.length == 12 && (UsbSerialCodec.CMD_END_CONFIG[6] & 0xFF) == 0xFE, "CMD_END_CONFIG");

        // 7. Validación de trama RD-03D/LD2450 (30 bytes: AA FF 03 00 ... 55 CC)
        byte[] good = new byte[30];
        good[0] = (byte) 0xAA; good[1] = (byte) 0xFF; good[2] = 0x03; good[3] = 0x00;
        good[28] = 0x55; good[29] = (byte) 0xCC;
        check(UsbSerialCodec.isValidRd03dFrame(good), "Trama RD-03D válida");
        good[29] = 0x00;
        check(!UsbSerialCodec.isValidRd03dFrame(good), "Trama corrupta rechazada");
        check(!UsbSerialCodec.isValidRd03dFrame(new byte[10]), "Trama corta rechazada");

        System.out.println("UsbSerialCodecTest: " + passed + "/" + passed + " OK");
    }
}
