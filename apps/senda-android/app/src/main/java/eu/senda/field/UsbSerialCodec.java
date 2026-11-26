package eu.senda.field;

/**
 * Codificación USB-serie pura (Java 17 sin dependencias externas ni SDK de Android) para conectar
 * módulos de radar mmWave 24 GHz (RD-03D / LD2450 a 256000 baudios 8N1) por USB-OTG.
 *
 * Licencia: propia del repositorio SENDA (cero librerías de terceros → cero conflictos de licencia,
 * cero permisos de red y 100 % compatible con la versión base del APK).
 *
 * Referencias de protocolos USB-serie públicos:
 *  - USB Implementers Forum, CDC PSTN 1.2 (SET_LINE_CODING = 0x20, SET_CONTROL_LINE_STATE = 0x22)
 *  - WCH CH340/CH341 datasheet (VID 0x1A86, comando 0xA1 / 0x9A)
 *  - Silicon Labs AN571 CP210x Interface Specification (VID 0x10C4, SET_BAUDRATE = 0x1E)
 *  - FTDI AN232B-05 (VID 0x0403, SET_BAUD_RATE = 0x03, SET_DATA = 0x04)
 *  - Protocolo RD-03D / LD2450: paridad byte a byte con packages/senda/src/mmwave-radar.mjs
 */
public final class UsbSerialCodec {
    public static final int DEFAULT_BAUD = 256000;
    public static final int FRAME_LEN = 30;

    // Órdenes RD-03D / LD2450: idénticas a CMD en packages/senda/src/mmwave-radar.mjs
    public static final byte[] CMD_ENABLE_CONFIG = bytes(0xFD, 0xFC, 0xFB, 0xFA, 0x04, 0x00, 0xFF, 0x00, 0x01, 0x00, 0x04, 0x03, 0x02, 0x01);
    public static final byte[] CMD_MULTI_TARGET  = bytes(0xFD, 0xFC, 0xFB, 0xFA, 0x02, 0x00, 0x90, 0x00, 0x04, 0x03, 0x02, 0x01);
    public static final byte[] CMD_END_CONFIG    = bytes(0xFD, 0xFC, 0xFB, 0xFA, 0x02, 0x00, 0xFE, 0x00, 0x04, 0x03, 0x02, 0x01);

    public enum Driver { CH340, CP210X, FTDI, CDC_ACM, UNSUPPORTED }

    private UsbSerialCodec() {}

    /** Identifica el controlador USB-serie por VID/PID o clase de interfaz USB (CDC = 2). */
    public static Driver identifyDriver(int vendorId, int productId, int interfaceClass) {
        if (vendorId == 0x1A86 && (productId == 0x7523 || productId == 0x5523 || productId == 0x7522 || productId == 0x55D4)) {
            return Driver.CH340;
        }
        if (vendorId == 0x10C4 && (productId == 0xEA60 || productId == 0xEA70 || productId == 0xEA71 || productId == 0xEA80)) {
            return Driver.CP210X;
        }
        if (vendorId == 0x0403 && (productId == 0x6001 || productId == 0x6010 || productId == 0x6011 || productId == 0x6014 || productId == 0x6015)) {
            return Driver.FTDI;
        }
        // CDC-ACM estándar (incluye XIAO ESP32-S3 VID 0x303A, STM32, RP2040, Arduino)
        if (interfaceClass == 2 || vendorId == 0x303A) {
            return Driver.CDC_ACM;
        }
        return Driver.UNSUPPORTED;
    }

    /** Construye los 7 bytes little-endian del descriptor CDC-ACM SET_LINE_CODING (8N1). */
    public static byte[] cdcLineCoding8N1(int baudRate) {
        if (baudRate <= 0) throw new IllegalArgumentException("baudRate debe ser > 0");
        return new byte[] {
            (byte) (baudRate & 0xFF),
            (byte) ((baudRate >>> 8) & 0xFF),
            (byte) ((baudRate >>> 16) & 0xFF),
            (byte) ((baudRate >>> 24) & 0xFF),
            0x00, // 1 bit de parada
            0x00, // sin paridad
            0x08  // 8 bits de datos
        };
    }

    /** Construye los 4 bytes little-endian de CP210x SET_BAUDRATE (request 0x1E). */
    public static byte[] cp210xBaudBytes(int baudRate) {
        if (baudRate <= 0) throw new IllegalArgumentException("baudRate debe ser > 0");
        return new byte[] {
            (byte) (baudRate & 0xFF),
            (byte) ((baudRate >>> 8) & 0xFF),
            (byte) ((baudRate >>> 16) & 0xFF),
            (byte) ((baudRate >>> 24) & 0xFF)
        };
    }

    /**
     * Calcula el valor 16-bit (divisor << 8 | prescaler) del registro 0x1312 de CH340/CH341.
     * Reloj base 48 MHz: prescaler 3 → 6 MHz; para 256000 bps: 6_000_000 / 256_000 = 23,4375 → 256 - 23 = 233 (0xE9).
     */
    public static int ch340BaudReg1312(int baudRate) {
        if (baudRate < 300 || baudRate > 2_000_000) throw new IllegalArgumentException("baudRate fuera de rango CH340");
        // Prescaler 3 (divisor reloj /8 = 6 MHz) cubre 256000 bps y >= 24000 bps con baja desviación
        int factor;
        int prescaler;
        if (baudRate >= 24000) {
            prescaler = 0x03;
            factor = Math.round(6_000_000f / baudRate);
        } else {
            prescaler = 0x02; // 750 kHz
            factor = Math.round(750_000f / baudRate);
        }
        int regHi = (256 - Math.max(1, Math.min(255, factor))) & 0xFF;
        // Bit 7 del prescaler habilita reloj rápido estable en CH340G/C
        return (regHi << 8) | (0x80 | prescaler);
    }

    /**
     * Calcula el divisor codificado (value, index) de FTDI FT232R/FT232H (reloj base 3 MHz en octavos).
     * Devuelve un array de 2 enteros: [wValue, wIndex].
     */
    public static int[] ftdiBaudDivisor(int baudRate) {
        if (baudRate <= 0) throw new IllegalArgumentException("baudRate debe ser > 0");
        int[] fracCode = { 0, 3, 2, 4, 1, 5, 6, 7 };
        int divisor8 = Math.max(1, Math.round(24_000_000f / baudRate));
        int intPart = divisor8 >>> 3;
        int fracPart = divisor8 & 0x07;
        int encoded = (intPart & 0x3FFF) | (fracCode[fracPart] << 14);
        int wValue = encoded & 0xFFFF;
        int wIndex = (encoded >>> 16) & 0x01;
        return new int[] { wValue, wIndex };
    }

    /** Comprueba si un bloque de 30 bytes cumple la cabecera y cierre del RD-03D/LD2450. */
    public static boolean isValidRd03dFrame(byte[] frame) {
        if (frame == null || frame.length != FRAME_LEN) return false;
        return (frame[0] & 0xFF) == 0xAA
            && (frame[1] & 0xFF) == 0xFF
            && (frame[2] & 0xFF) == 0x03
            && (frame[3] & 0xFF) == 0x00
            && (frame[28] & 0xFF) == 0x55
            && (frame[29] & 0xFF) == 0xCC;
    }

    private static byte[] bytes(int... vals) {
        byte[] out = new byte[vals.length];
        for (int i = 0; i < vals.length; i++) out[i] = (byte) vals[i];
        return out;
    }
}
