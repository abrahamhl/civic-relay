import XCTest
@testable import SendaDrive

/// Conformidad: DriveAutostart (Swift) reproduce línea a línea los vectores de la referencia JS.
final class DriveAutostartTests: XCTestCase {
    private func param(_ line: Substring, _ key: String) throws -> Double {
        for kv in line.dropFirst(2).split(separator: " ") {
            let p = kv.split(separator: "=")
            if p.count == 2, p[0] == key, let v = Double(p[1]) { return v }
        }
        throw NSError(domain: "vectores", code: 1, userInfo: [NSLocalizedDescriptionKey: "falta \(key)"])
    }

    func testConformidadConLaReferencia() throws {
        let url = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "drive-autostart.vectors", withExtension: "txt"), "los vectores deben ir en el paquete de pruebas")
        let text = try String(contentsOf: url, encoding: .utf8)
        var machine: DriveAutostart?
        var scenario = "", scenarios = 0, checks = 0
        for line in text.split(separator: "\n") where !line.isEmpty && !line.hasPrefix("#") {
            if line.hasPrefix("S ") { scenario = String(line.dropFirst(2)); scenarios += 1; continue }
            if line.hasPrefix("P ") {
                machine = DriveAutostart(params: try DriveAutostart.Params(
                    confirmSpeedMs: try param(line, "confirmSpeedMs"), confirmWindowS: try param(line, "confirmWindowS"),
                    stopSpeedMs: try param(line, "stopSpeedMs"), idleStopS: try param(line, "idleStopS"), endGraceS: try param(line, "endGraceS")))
                continue
            }
            let io = line.dropFirst(2).components(separatedBy: " => ")
            let input = io[0].split(separator: " ")
            var t = Double.nan, ms = Double.nan
            var auto: Bool?
            for kv in input.dropFirst() {
                let p = kv.split(separator: "=")
                switch p[0] {
                case "t": t = Double(p[1])!
                case "ms": ms = Double(p[1])!
                case "autoStart": auto = p[1] == "1"
                default: break
                }
            }
            let m = try XCTUnwrap(machine)
            let actions = try m.handle(String(input[0]), t: t, ms: ms, autoStart: auto)
            let got = ([m.state.rawValue] + actions.map(\.description)).joined(separator: " ")
            XCTAssertEqual(got, io[1], "\(scenario) · \(io[0])")
            checks += 1
        }
        XCTAssertGreaterThanOrEqual(scenarios, 10)
        XCTAssertGreaterThan(checks, 40)
    }

    func testUmbralNoDeclaradoSeRechaza() {
        XCTAssertThrowsError(try DriveAutostart.Params(confirmSpeedMs: .nan, confirmWindowS: 120, stopSpeedMs: 1.5, idleStopS: 300, endGraceS: 60))
    }
}
