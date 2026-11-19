import AVFoundation
import CoreLocation
import CoreMotion
import Foundation

/// Une las señales de iOS con DriveAutostart.
///
/// iOS no deja que una app «se abra sola» como en Android. Con el consentimiento del usuario y la
/// ubicación «Siempre»:
///  1. el cambio significativo de ubicación despierta SENDA aunque esté cerrada;
///  2. CoreMotion dice si el movimiento es «en coche» (pista DÉBIL: se confirma por velocidad);
///  3. mientras SENDA está activa, el audio del coche (CarPlay o Bluetooth del coche) es señal FUERTE.
/// Solo se guarda en el móvil el consentimiento. No se registra ni se envía el recorrido.
final class DriveController: NSObject, ObservableObject, CLLocationManagerDelegate {
    /// EJEMPLO DECLARADO, sin fuente verificada: los mismos valores que EXAMPLE_AUTOSTART del núcleo
    /// (packages/senda/src/drive-autostart.mjs). Pendientes de calibrar con trayectos reales.
    static let exampleParams = try! DriveAutostart.Params(confirmSpeedMs: 5, confirmWindowS: 120, stopSpeedMs: 1.5, idleStopS: 300, endGraceS: 60)
    /// Intervalo de muestreo del reloj (no es un umbral de decisión).
    private static let tickS: TimeInterval = 15

    @Published private(set) var state: DriveAutostart.State = .OFF
    @Published private(set) var sessionActive = false
    @Published private(set) var autoStartConsented: Bool
    @Published private(set) var lastNote = ""

    private let machine = DriveAutostart(params: DriveController.exampleParams)
    private let location = CLLocationManager()
    private let motion = CMMotionActivityManager()
    private var timer: Timer?
    private var carAudio = false
    private let key = "senda.drive.autoStart"

    override init() {
        autoStartConsented = UserDefaults.standard.bool(forKey: key)
        super.init()
        location.delegate = self
        if autoStartConsented { send("CONSENT", autoStart: true); armWakeUps() }
        NotificationCenter.default.addObserver(self, selector: #selector(routeChanged), name: AVAudioSession.routeChangeNotification, object: nil)
        routeChanged()
    }

    private func now() -> Double { ProcessInfo.processInfo.systemUptime }

    // MARK: consentimiento

    func enableAutoStart() {
        location.requestAlwaysAuthorization()
        UserDefaults.standard.set(true, forKey: key)
        autoStartConsented = true
        send("CONSENT", autoStart: true)
        armWakeUps()
    }

    func disableAutoStart() {
        UserDefaults.standard.set(false, forKey: key)
        autoStartConsented = false
        location.stopMonitoringSignificantLocationChanges()
        motion.stopActivityUpdates()
        send("CONSENT", autoStart: false)
    }

    func userStart() { send("USER_START") }
    func userStop() { send("USER_STOP") }

    // MARK: señales

    private func armWakeUps() {
        guard CLLocationManager.significantLocationChangeMonitoringAvailable() else { lastNote = "Este dispositivo no permite despertar por cambio de ubicación."; return }
        location.startMonitoringSignificantLocationChanges()
        guard CMMotionActivityManager.isActivityAvailable() else { lastNote = "Sin CoreMotion: solo arranque manual o por audio del coche."; return }
        motion.startActivityUpdates(to: .main) { [weak self] a in
            guard let self, let a else { return }
            if a.automotive { self.send("VEHICLE_HINT_ENTER") }
            else if (a.walking || a.running || a.cycling) && a.confidence != .low { self.send("VEHICLE_HINT_EXIT") }
        }
    }

    @objc private func routeChanged() {
        let car = AVAudioSession.sharedInstance().currentRoute.outputs.contains { $0.portType == .carAudio }
        if car != carAudio { carAudio = car; send(car ? "CAR_LINK_APPEARED" : "CAR_LINK_GONE") }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        for l in locations where l.speed >= 0 { send("SPEED", ms: l.speed) }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) { lastNote = "Ubicación no disponible: \(error.localizedDescription)" }

    // MARK: máquina

    private func send(_ type: String, ms: Double = .nan, autoStart: Bool? = nil) {
        do {
            let actions = try machine.handle(type, t: now(), ms: ms, autoStart: autoStart)
            for a in actions { if a.type == "START_SESSION" { sessionActive = true } else if a.type == "STOP_SESSION" { sessionActive = false } }
            state = machine.state
            applyWatching()
        } catch { lastNote = "Evento rechazado: \(error)" }
    }

    /// Mientras se vigila o se conduce: ubicación continua (con indicador visible) y reloj. Fuera: nada.
    private func applyWatching() {
        let watching = state == .CANDIDATE || state == .DRIVING || state == .ENDING
        if watching && timer == nil {
            location.allowsBackgroundLocationUpdates = location.authorizationStatus == .authorizedAlways
            location.showsBackgroundLocationIndicator = true
            location.desiredAccuracy = kCLLocationAccuracyBest
            location.startUpdatingLocation()
            timer = Timer.scheduledTimer(withTimeInterval: Self.tickS, repeats: true) { [weak self] _ in self?.send("TICK") }
        } else if !watching && timer != nil {
            timer?.invalidate(); timer = nil
            location.stopUpdatingLocation()
        }
    }
}
