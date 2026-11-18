import SwiftUI
import UniformTypeIdentifiers
import WebKit

@main
struct SendaApp: App {
    // Se crea en cada arranque, también cuando iOS despierta la app por un cambio de ubicación.
    @StateObject private var drive = DriveController()
    var body: some Scene { WindowGroup { ContentView().environmentObject(drive) } }
}

struct ContentView: View {
    @EnvironmentObject var drive: DriveController
    @State private var showWeb = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("Si lo activas, SENDA se pone en marcha cuando detecta que vas en coche y se apaga al bajar. iOS mostrará el indicador de ubicación mientras tanto. Solo se guarda tu decisión en este iPhone; no se registra ni se envía el recorrido.")
                        .font(.callout)
                    Text("Umbrales de arranque y parada: valores de ejemplo, aún sin calibrar con trayectos reales.")
                        .font(.footnote).foregroundStyle(.secondary)
                }
                Section("Arranque automático") {
                    if drive.autoStartConsented {
                        Button("Desactivar el arranque automático", role: .destructive) { drive.disableAutoStart() }
                    } else {
                        Button("Activar el arranque automático") { drive.enableAutoStart() }
                    }
                }
                Section("Ahora") {
                    Button("Empezar ahora") { drive.userStart() }
                    Button("Parar ahora") { drive.userStop() }
                    LabeledContent("Estado", value: drive.state.rawValue + (drive.sessionActive ? " · en ruta" : ""))
                    if !drive.lastNote.isEmpty { Text(drive.lastNote).font(.footnote) }
                }
                Section { Button("Abrir SENDA") { showWeb = true } }
            }
            .navigationTitle("SENDA Drive")
            .sheet(isPresented: $showWeb) { SendaWebView().ignoresSafeArea() }
        }
    }
}

/// La app web SENDA empaquetada en la app, servida con un esquema propio (sin red), como en Android.
struct SendaWebView: UIViewRepresentable {
    func makeUIView(context: Context) -> WKWebView {
        let cfg = WKWebViewConfiguration()
        cfg.setURLSchemeHandler(BundledSchemeHandler(), forURLScheme: BundledSchemeHandler.scheme)
        let web = WKWebView(frame: .zero, configuration: cfg)
        web.load(URLRequest(url: URL(string: "\(BundledSchemeHandler.scheme)://app/senda/index.html")!))
        return web
    }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}

final class BundledSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "senda-app"

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url, let root = Bundle.main.resourceURL?.appendingPathComponent("web") else { return fail(task) }
        var path = url.path
        if path.hasSuffix("/") { path += "index.html" }
        if (path as NSString).pathExtension.isEmpty { path += ".html" }
        // Sin recorrido de directorios: el fichero debe quedar dentro de la carpeta empaquetada.
        let file = root.appendingPathComponent(path).standardizedFileURL
        guard file.path.hasPrefix(root.standardizedFileURL.path + "/"), let data = try? Data(contentsOf: file) else { return fail(task) }
        let mime = UTType(filenameExtension: file.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
        let type = file.pathExtension == "mjs" ? "text/javascript" : mime
        task.didReceive(HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: ["Content-Type": type])!)
        task.didReceive(data)
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}

    private func fail(_ task: WKURLSchemeTask) { task.didFailWithError(URLError(.fileDoesNotExist)) }
}
