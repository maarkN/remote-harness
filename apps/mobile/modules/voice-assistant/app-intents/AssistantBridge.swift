import Foundation

// Compiled into the app target by the `withVoiceAssistantIntents` config plugin (App Intents metadata
// is only extracted from the app target). Talks to `VoiceAssistantModule` only through these
// notifications and the session list in UserDefaults; keep the names in sync with that module.
enum AssistantNames {
  static let request = Notification.Name("RemoteHarnessAssistantRequest")
  static let ack = Notification.Name("RemoteHarnessAssistantAck")
  static let response = Notification.Name("RemoteHarnessAssistantResponse")
  static let sessionsKey = "RemoteHarnessAssistantSessions"
}

/// What the app's JavaScript answered: `message` is the sentence to speak, in the app language.
struct AssistantReply {
  let ok: Bool
  let message: String
  let requestId: String?
  let sessionId: String?

  static func native(_ message: String) -> AssistantReply {
    AssistantReply(ok: false, message: message, requestId: nil, sessionId: nil)
  }

  static var timedOut: AssistantReply {
    .native(String(localized: "assistant.timeout", defaultValue: "Remote Harness didn’t answer in time. Try again."))
  }

  static var openApp: AssistantReply {
    .native(String(localized: "assistant.openApp", defaultValue: "Open Remote Harness once, then try again."))
  }
}

/**
 * Hands a request to the app's JavaScript: posts it until `VoiceAssistantModule` acknowledges it (the
 * JS runtime is listening), then waits for the answer. Without an acknowledgement the app is not
 * running, and the caller may bring it to the foreground and deliver again.
 */
final class AssistantBridge: @unchecked Sendable {
  static let shared = AssistantBridge()

  private let lock = NSLock()
  private var acknowledged = Set<String>()
  private var replies: [String: AssistantReply] = [:]
  private var waiters: [String: CheckedContinuation<AssistantReply?, Never>] = [:]

  private init() {
    NotificationCenter.default.addObserver(forName: AssistantNames.ack, object: nil, queue: nil) { [weak self] note in
      guard let id = note.userInfo?["id"] as? String else {
        return
      }
      self?.lock.lock()
      self?.acknowledged.insert(id)
      self?.lock.unlock()
    }
    NotificationCenter.default.addObserver(forName: AssistantNames.response, object: nil, queue: nil) { [weak self] note in
      guard let id = note.userInfo?["id"] as? String, let body = note.userInfo?["reply"] as? [String: Any] else {
        return
      }
      self?.answered(id, AssistantReply(
        ok: body["ok"] as? Bool ?? false,
        message: body["message"] as? String ?? "",
        requestId: body["requestId"] as? String,
        sessionId: body["sessionId"] as? String
      ))
    }
  }

  /// Posts the request every 0.5 s until it is acknowledged; false when it was not within `seconds`.
  func deliver(id: String, payload: [String: Any], foreground: Bool, within seconds: Double) async -> Bool {
    let deadline = Date().addingTimeInterval(seconds)
    while Date() < deadline {
      if isAcknowledged(id) {
        return true
      }
      NotificationCenter.default.post(
        name: AssistantNames.request,
        object: nil,
        userInfo: ["id": id, "payload": payload, "foreground": foreground]
      )
      try? await Task.sleep(nanoseconds: 500_000_000)
    }
    return isAcknowledged(id)
  }

  /// The answer to `id`, or nil after `seconds`.
  func reply(id: String, within seconds: Double) async -> AssistantReply? {
    await withCheckedContinuation { (continuation: CheckedContinuation<AssistantReply?, Never>) in
      lock.lock()
      if let reply = replies.removeValue(forKey: id) {
        lock.unlock()
        continuation.resume(returning: reply)
        return
      }
      waiters[id] = continuation
      lock.unlock()
      DispatchQueue.global().asyncAfter(deadline: .now() + seconds) { [weak self] in
        self?.lock.lock()
        let waiter = self?.waiters.removeValue(forKey: id)
        self?.lock.unlock()
        waiter?.resume(returning: nil)
      }
    }
  }

  private func isAcknowledged(_ id: String) -> Bool {
    lock.lock()
    defer { lock.unlock() }
    return acknowledged.contains(id)
  }

  private func answered(_ id: String, _ reply: AssistantReply) {
    lock.lock()
    if let waiter = waiters.removeValue(forKey: id) {
      lock.unlock()
      waiter.resume(returning: reply)
      return
    }
    replies[id] = reply
    lock.unlock()
  }
}

/**
 * One request from an intent to the app: delivered in the background when the app is alive; else
 * `continueInForeground` opens the app (iOS 17+; returns false on iOS 16) and it is delivered there.
 */
func askApp(
  _ payload: [String: Any],
  continueInForeground: () async throws -> Bool
) async throws -> AssistantReply {
  let bridge = AssistantBridge.shared
  let id = UUID().uuidString
  if await !bridge.deliver(id: id, payload: payload, foreground: false, within: 2) {
    guard try await continueInForeground() else {
      return .openApp
    }
    guard await bridge.deliver(id: id, payload: payload, foreground: true, within: 10) else {
      return .timedOut
    }
  }
  return await bridge.reply(id: id, within: 15) ?? .timedOut
}
