import ExpoModulesCore

// Shared with the App Intents compiled into the app target (`app-intents/AssistantBridge.swift`):
// both sides only talk through these notifications and the session list in UserDefaults.
private let requestNotification = Notification.Name("RemoteHarnessAssistantRequest")
private let ackNotification = Notification.Name("RemoteHarnessAssistantAck")
private let responseNotification = Notification.Name("RemoteHarnessAssistantResponse")
private let sessionsKey = "RemoteHarnessAssistantSessions"
private let onRequest = "onRequest"

/**
 * Forwards voice assistant requests (posted by the App Intents) to JavaScript as `onRequest` events,
 * queued until JavaScript listens, and posts JavaScript's answers (`complete`) back to the intents.
 * A request is acknowledged once JavaScript has it, so an intent knows the app is alive.
 */
public final class VoiceAssistantModule: Module {
  private var observer: NSObjectProtocol?
  private var listening = false
  private var queued: [[String: Any]] = []
  private var delivered = Set<String>()
  private let lock = NSLock()

  public func definition() -> ModuleDefinition {
    Name("VoiceAssistant")

    Events(onRequest)

    OnCreate {
      self.observer = NotificationCenter.default.addObserver(
        forName: requestNotification,
        object: nil,
        queue: nil
      ) { [weak self] notification in
        self?.received(notification.userInfo)
      }
    }

    OnDestroy {
      if let observer = self.observer {
        NotificationCenter.default.removeObserver(observer)
      }
    }

    OnStartObserving(onRequest) {
      self.lock.lock()
      self.listening = true
      let pending = self.queued
      self.queued = []
      self.lock.unlock()
      for event in pending {
        self.deliver(event)
      }
    }

    OnStopObserving(onRequest) {
      self.lock.lock()
      self.listening = false
      self.lock.unlock()
    }

    /// JavaScript's answer to request `id`: `ok`, `message` (spoken) and optional ids.
    Function("complete") { (id: String, reply: [String: Any]) in
      NotificationCenter.default.post(
        name: responseNotification,
        object: nil,
        userInfo: ["id": id, "reply": reply]
      )
    }

    /// Sessions offered to Siri (JSON array of `{ id, title, state, updatedAt }`); stays on the device.
    Function("setSessions") { (json: String) in
      UserDefaults.standard.set(json, forKey: sessionsKey)
    }
  }

  /// The intent posts a request again until it is acknowledged: deliver it once, acknowledge every time.
  private func received(_ info: [AnyHashable: Any]?) {
    guard let id = info?["id"] as? String else {
      return
    }
    let event: [String: Any] = [
      "id": id,
      "payload": info?["payload"] as? [String: Any] ?? [:],
      "foreground": info?["foreground"] as? Bool ?? false,
    ]
    lock.lock()
    if delivered.contains(id) {
      lock.unlock()
      acknowledge(id)
      return
    }
    if !listening {
      if !queued.contains(where: { $0["id"] as? String == id }) {
        queued.append(event)
      }
      lock.unlock()
      return
    }
    lock.unlock()
    deliver(event)
  }

  private func deliver(_ event: [String: Any]) {
    guard let id = event["id"] as? String else {
      return
    }
    lock.lock()
    let first = delivered.insert(id).inserted
    lock.unlock()
    if first {
      sendEvent(onRequest, event)
    }
    acknowledge(id)
  }

  private func acknowledge(_ id: String) {
    NotificationCenter.default.post(name: ackNotification, object: nil, userInfo: ["id": id])
  }
}
