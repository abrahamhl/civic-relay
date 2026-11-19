import Foundation

/// Máquina de estados del arranque automático de SENDA Drive.
///
/// Reimplementación EXACTA de la referencia `packages/senda/src/drive-autostart.mjs`; debe reproducir
/// `packages/senda/conformance/drive-autostart.vectors.txt` (DriveAutostartTests, en la CI de macOS).
/// Sin consentimiento de arranque automático no ocurre nada automático; el conductor siempre manda.
/// Con el coche vinculado presente no se cierra por inactividad. Los umbrales se DECLARAN: sin valores por defecto.
final class DriveAutostart {
    enum State: String { case OFF, IDLE, CANDIDATE, DRIVING, ENDING }

    struct Params {
        let confirmSpeedMs, confirmWindowS, stopSpeedMs, idleStopS, endGraceS: Double
        init(confirmSpeedMs: Double, confirmWindowS: Double, stopSpeedMs: Double, idleStopS: Double, endGraceS: Double) throws {
            let all: [(String, Double)] = [("confirmSpeedMs", confirmSpeedMs), ("confirmWindowS", confirmWindowS), ("stopSpeedMs", stopSpeedMs), ("idleStopS", idleStopS), ("endGraceS", endGraceS)]
            for (name, v) in all where !v.isFinite { throw DriveError.undeclared(name) }
            self.confirmSpeedMs = confirmSpeedMs; self.confirmWindowS = confirmWindowS; self.stopSpeedMs = stopSpeedMs; self.idleStopS = idleStopS; self.endGraceS = endGraceS
        }
    }

    enum DriveError: Error, Equatable { case undeclared(String), unknownEvent(String) }

    struct Action: Equatable, CustomStringConvertible {
        let type: String, reason: String
        var description: String { "\(type):\(reason)" }
    }

    private let p: Params
    private(set) var state: State = .OFF
    private var autoConsent = false, suppressed = false, manual = false, carLinked = false
    private var candidateSince = Double.nan, lastMovingT = Double.nan, endingSince = Double.nan

    init(params: Params) { p = params }

    private var rest: State { autoConsent ? .IDLE : .OFF }

    /// type como en la referencia JS; t en s; ms solo para SPEED; autoStart solo para CONSENT.
    func handle(_ type: String, t: Double, ms: Double = .nan, autoStart: Bool? = nil) throws -> [Action] {
        guard t.isFinite else { throw DriveError.undeclared("t") }
        var a: [Action] = []
        switch type {
        case "CONSENT":
            if autoStart == true { autoConsent = true; if state == .OFF { state = .IDLE } }
            else {
                autoConsent = false
                if state == .DRIVING || state == .ENDING { a.append(Action(type: "STOP_SESSION", reason: "CONSENT_REVOKED")) }
                state = .OFF; manual = false; suppressed = false; candidateSince = .nan; endingSince = .nan
            }
        case "CAR_LINK_APPEARED":
            carLinked = true
            if (state == .IDLE || state == .CANDIDATE) && !suppressed { state = .DRIVING; lastMovingT = t; candidateSince = .nan; a.append(Action(type: "START_SESSION", reason: "CAR_LINK")) }
            else if state == .ENDING { state = .DRIVING; lastMovingT = t; endingSince = .nan }
        case "VEHICLE_HINT_ENTER":
            if state == .IDLE && !suppressed { state = .CANDIDATE; candidateSince = t }
            else if state == .ENDING { state = .DRIVING; lastMovingT = t; endingSince = .nan }
        case "CAR_LINK_GONE", "VEHICLE_HINT_EXIT":
            suppressed = false
            if type == "CAR_LINK_GONE" { carLinked = false }
            if state == .DRIVING && !manual { state = .ENDING; endingSince = t }
            else if state == .CANDIDATE { state = .IDLE; candidateSince = .nan }
        case "SPEED":
            guard ms.isFinite else { throw DriveError.undeclared("ms") }
            if state == .CANDIDATE {
                if t - candidateSince > p.confirmWindowS { state = .IDLE; candidateSince = .nan }
                else if ms >= p.confirmSpeedMs { state = .DRIVING; lastMovingT = t; candidateSince = .nan; a.append(Action(type: "START_SESSION", reason: "VEHICLE_HINT_CONFIRMED_BY_SPEED")) }
            } else if (state == .DRIVING || state == .ENDING) && ms >= p.stopSpeedMs {
                lastMovingT = t
                if state == .ENDING { state = .DRIVING; endingSince = .nan }
            }
        case "TICK":
            if state == .CANDIDATE && t - candidateSince > p.confirmWindowS { state = .IDLE; candidateSince = .nan }
            else if state == .DRIVING && !manual && !carLinked && t - lastMovingT >= p.idleStopS { state = .ENDING; endingSince = t }
            else if state == .ENDING && t - endingSince >= p.endGraceS { state = rest; endingSince = .nan; a.append(Action(type: "STOP_SESSION", reason: "ENDED")) }
        case "USER_START":
            if state != .DRIVING {
                if state == .ENDING { state = .DRIVING; endingSince = .nan }
                else { state = .DRIVING; a.append(Action(type: "START_SESSION", reason: "USER_START")) }
                manual = true; lastMovingT = t; candidateSince = .nan
            }
        case "USER_STOP":
            if state == .DRIVING || state == .ENDING { a.append(Action(type: "STOP_SESSION", reason: "USER_STOP")) }
            state = rest; manual = false; candidateSince = .nan; endingSince = .nan; suppressed = autoConsent
        default:
            throw DriveError.unknownEvent(type)
        }
        return a
    }
}
