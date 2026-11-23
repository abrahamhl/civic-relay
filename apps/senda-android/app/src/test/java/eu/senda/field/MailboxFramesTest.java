package eu.senda.field;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Random;

public final class MailboxFramesTest {
    private static int n = 0;
    private static void check(boolean ok, String what) { if (!ok) throw new AssertionError(what); n++; }

    public static void main(String[] a) {
        Random r = new Random(7);
        byte[] msg = new byte[5000]; r.nextBytes(msg);
        List<byte[]> fr = MailboxFrames.split(msg, 42, 509);           // 509 = MTU 517 - 3 (ATT) - 5 de margen
        check(fr.size() == 10, "5000 B en tramas de 509 → 10 tramas");
        check(fr.get(0).length == 517, "trama completa = cabecera + 509");

        MailboxFrames.Assembler as = new MailboxFrames.Assembler();
        byte[] out = null;
        for (byte[] f : fr) { byte[] x = as.add("A", f, 0); if (x != null) out = x; }
        check(Arrays.equals(out, msg), "ida y vuelta en orden");

        Collections.shuffle(fr, r);
        out = null;
        for (byte[] f : fr) { byte[] x = as.add("A2", f, 0); if (x != null) out = x; }
        check(Arrays.equals(out, msg), "ida y vuelta desordenada");

        List<byte[]> fr2 = MailboxFrames.split(msg, 43, 509);
        out = null; int complete = 0;
        for (byte[] f : fr2) { byte[] x = as.add("B", f, 0); byte[] y = as.add("B", f, 0); if (x != null) { out = x; complete++; } if (y != null) complete++; }
        check(Arrays.equals(out, msg) && complete == 1, "tramas repetidas no duplican el mensaje");
        check(as.pending() == 0, "una repetición tras completar no deja un mensaje fantasma");

        List<byte[]> f3 = MailboxFrames.split(msg, 44, 509);
        as.add("C", f3.get(0), 0);
        check(as.pending() == 1, "mensaje a medias pendiente");
        as.add("D", MailboxFrames.split(new byte[]{1}, 1, 10).get(0), MailboxFrames.STALE_MS + 1);
        check(as.pending() == 0, "lo incompleto caduca");

        byte[] small = {9, 8, 7};
        check(Arrays.equals(as.add("E", MailboxFrames.split(small, 1, 509).get(0), 0), small), "mensaje de una sola trama");
        check(as.add("F", new byte[]{0, 0, 0, 1, 0, 5, 0, 2, 1}, 0) == null, "índice fuera de rango se ignora");
        check(as.add("F", new byte[]{0, 0}, 0) == null, "trama corta se ignora");

        boolean threw = false;
        try { MailboxFrames.split(new byte[MailboxFrames.MAX_BYTES + 1], 1, 509); } catch (IllegalArgumentException e) { threw = true; }
        check(threw, "se rechaza lo que pasa de 64 KB");
        System.out.println("MailboxFramesTest: " + n + " comprobaciones correctas");
    }
}
