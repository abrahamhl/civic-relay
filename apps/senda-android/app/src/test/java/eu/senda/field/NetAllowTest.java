package eu.senda.field;

/** Prueba en la JVM de la lista cerrada de servicios de red de la app. */
public final class NetAllowTest {
    private static int checks;
    private static void check(boolean ok, String why) { checks++; if (!ok) throw new AssertionError(why); }
    public static void main(String[] a) {
        check(NetAllow.allowed("https://tiles.openfreemap.org/styles/liberty"), "mapa");
        check(NetAllow.allowed("https://router.project-osrm.org/route/v1/driving/1,2;3,4"), "rutas coche");
        check(NetAllow.allowed("https://routing.openstreetmap.de/routed-foot/route/v1/driving/1,2;3,4"), "rutas a pie");
        check(NetAllow.allowed("https://nominatim.openstreetmap.org/search?q=x"), "búsqueda");
        check(NetAllow.allowed("https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0/Actueel_orthoHR/EPSG:3857/10/1/1.jpeg"), "ortofoto NL");
        check(NetAllow.allowed("https://tms-pnoa-ma.idee.es/1.0.0/pnoa-ma/10/1/1.jpeg"), "ortofoto ES");
        check(NetAllow.allowed("https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/x.png"), "NASA GIBS");
        check(NetAllow.allowed("https://s3.amazonaws.com/elevation-tiles-prod/terrarium/10/505/389.png"), "relieve AWS");
        check(!NetAllow.allowed("https://s3.amazonaws.com/otro-contenedor/x"), "otro contenedor de S3 no");
        check(!NetAllow.allowed("https://s3.amazonaws.com/elevation-tiles-prod/terrarium/../../otro/x"), "recorrido en S3 no");
        check(!NetAllow.allowed("https://s3.amazonaws.com/elevation-tiles-prod/terrarium/%2e%2e/%2e%2e/otro/x"), "recorrido codificado %2e en S3 no");
        check(!NetAllow.allowed("https://s3.amazonaws.com/elevation-tiles-prod/terrarium/%2E%2E/otro/x"), "recorrido codificado %2E en S3 no");
        check(!NetAllow.allowed("https://s3.amazonaws.com/elevation-tiles-prod/terrarium/10%5c..%5cotro"), "recorrido %5c en S3 no");
        check(NetAllow.allowed("https://tile.opentopomap.org/10/505/389.png"), "OpenTopoMap");
        check(NetAllow.allowed("https://etraffic.dgt.es/camarasEtraffic/176130.jpg"), "cámaras DGT");
        check(!NetAllow.allowed("https://etraffic.dgt.es.evil.example/x.jpg"), "cámaras DGT: dominio engañoso no");
        check(!NetAllow.allowed("http://tiles.openfreemap.org/x"), "sin cifrar");
        check(!NetAllow.allowed("https://tiles.openfreemap.org.evil.example/x"), "dominio engañoso");
        check(!NetAllow.allowed("https://user@tiles.openfreemap.org/x"), "credenciales en la URL");
        check(!NetAllow.allowed("https://tiles.openfreemap.org:8443/x"), "otro puerto");
        check(!NetAllow.allowed("https://evil.example/x"), "otro servicio");
        check(!NetAllow.allowed(null), "nulo");
        System.out.println("NetAllowTest: " + checks + " comprobaciones OK");
    }
}
