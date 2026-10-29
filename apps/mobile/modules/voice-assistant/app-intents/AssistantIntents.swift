import AppIntents
import Foundation

/// Sends a message to a session, like the reply field; with no session, the one that needs the user.
@available(iOS 16.0, *)
struct ReplyToSessionIntent: AppIntent {
  static let title: LocalizedStringResource = "Reply to a session"
  static let description = IntentDescription("Sends a message to a coding session on your computer.")
  static let openAppWhenRun = false
  static let authenticationPolicy: IntentAuthenticationPolicy = .requiresAuthentication

  @Parameter(title: "Message", requestValueDialog: "What should I send?")
  var text: String

  @Parameter(title: "Session")
  var session: SessionEntity?

  static var parameterSummary: some ParameterSummary {
    Summary("Send \(\.$text) to \(\.$session)")
  }

  func perform() async throws -> some IntentResult & ProvidesDialog {
    var payload: [String: Any] = ["action": "reply", "text": text]
    if let session {
      payload["sessionId"] = session.id
    }
    let reply = try await askApp(payload, continueInForeground: continueInForeground)
    return .result(dialog: IntentDialog(stringLiteral: reply.message))
  }

  private func continueInForeground() async throws -> Bool {
    if #available(iOS 17.0, *) {
      try await requestToContinueInForeground()
      return true
    }
    return false
  }
}

@available(iOS 17.0, *)
extension ReplyToSessionIntent: ForegroundContinuableIntent {}

@available(iOS 16.0, *)
enum PermissionAnswer: String, AppEnum {
  case allow
  case deny

  static let typeDisplayRepresentation: TypeDisplayRepresentation = "Answer"
  static let caseDisplayRepresentations: [PermissionAnswer: DisplayRepresentation] = [
    .allow: "Allow",
    .deny: "Deny",
  ]
}

/// Allows or denies the oldest plain permission request, after reading it and asking to confirm.
@available(iOS 16.0, *)
struct AnswerPermissionIntent: AppIntent {
  static let title: LocalizedStringResource = "Answer the pending permission"
  static let description = IntentDescription("Allows or denies the oldest permission a session is waiting for.")
  static let openAppWhenRun = false
  static let authenticationPolicy: IntentAuthenticationPolicy = .requiresAuthentication

  @Parameter(title: "Answer", requestValueDialog: "Allow or deny?")
  var answer: PermissionAnswer

  static var parameterSummary: some ParameterSummary {
    Summary("\(\.$answer) the pending permission")
  }

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let pending = try await askApp(
      ["action": "pending", "decision": answer.rawValue],
      continueInForeground: continueInForeground
    )
    guard pending.ok, let requestId = pending.requestId else {
      return .result(dialog: IntentDialog(stringLiteral: pending.message))
    }
    // Throws (and nothing is answered) when the user says no.
    try await requestConfirmation(result: .result(dialog: IntentDialog(stringLiteral: pending.message)))
    let done = try await askApp(
      ["action": "answer", "requestId": requestId, "decision": answer.rawValue],
      continueInForeground: continueInForeground
    )
    return .result(dialog: IntentDialog(stringLiteral: done.message))
  }

  private func continueInForeground() async throws -> Bool {
    if #available(iOS 17.0, *) {
      try await requestToContinueInForeground()
      return true
    }
    return false
  }
}

@available(iOS 17.0, *)
extension AnswerPermissionIntent: ForegroundContinuableIntent {}

/// Says how many sessions wait for the user and are running, naming the waiting ones.
@available(iOS 16.0, *)
struct WaitingSessionsIntent: AppIntent {
  static let title: LocalizedStringResource = "What’s waiting"
  static let description = IntentDescription("Tells which sessions on your computer are waiting for you.")
  static let openAppWhenRun = false
  static let authenticationPolicy: IntentAuthenticationPolicy = .requiresAuthentication

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let reply = try await askApp(["action": "waiting"], continueInForeground: continueInForeground)
    return .result(dialog: IntentDialog(stringLiteral: reply.message))
  }

  private func continueInForeground() async throws -> Bool {
    if #available(iOS 17.0, *) {
      try await requestToContinueInForeground()
      return true
    }
    return false
  }
}

@available(iOS 17.0, *)
extension WaitingSessionsIntent: ForegroundContinuableIntent {}

/// Phrases Siri recognizes without setup; every phrase names the app (Apple's rule).
@available(iOS 16.0, *)
struct RemoteHarnessShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: ReplyToSessionIntent(),
      phrases: [
        "Reply in \(.applicationName)",
        "Send a message in \(.applicationName)",
      ]
    )
    AppShortcut(
      intent: AnswerPermissionIntent(),
      phrases: [
        "Answer the permission in \(.applicationName)",
        "Answer \(.applicationName)",
      ]
    )
    AppShortcut(
      intent: WaitingSessionsIntent(),
      phrases: [
        "What’s waiting in \(.applicationName)",
        "Check \(.applicationName)",
      ]
    )
  }
}
