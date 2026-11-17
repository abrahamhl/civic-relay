plugins { id("com.android.application") }
android {
    namespace = "eu.senda.field"
    compileSdk = 35
    defaultConfig {
        applicationId = "eu.senda.field"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1-campo"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
// Sin dependencias externas: solo el SDK de Android (menos superficie de ataque, auditable).

// La app web (investor-next/public/senda) se copia dentro del APK en cada compilación: una sola fuente
// de verdad, la misma que pasa las pruebas del núcleo y de navegador. AppActivity la sirve sin red.
val webAssets = layout.buildDirectory.dir("generated/webassets")
val syncWebAssets = tasks.register<Sync>("syncWebAssets") {
    from(rootProject.file("../../investor-next/public")) {
        include("senda/**", "geo/land-110m.json")
    }
    into(webAssets)
}
android.sourceSets.getByName("main").assets.srcDir(webAssets)
tasks.named("preBuild") { dependsOn(syncWebAssets) }
