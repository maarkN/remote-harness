import AppIntents
import Foundation

/// A session Siri can reply to: the active computer's live sessions the app saw last (on-device list).
@available(iOS 16.0, *)
struct SessionEntity: AppEntity {
  static let typeDisplayRepresentation: TypeDisplayRepresentation = "Session"
  static let defaultQuery = SessionQuery()

  let id: String
  let title: String

  var displayRepresentation: DisplayRepresentation {
    DisplayRepresentation(title: "\(title)")
  }
}

private struct StoredSession: Decodable {
  let id: String
  let title: String
}

@available(iOS 16.0, *)
struct SessionQuery: EntityStringQuery {
  /// Written by the app (`VoiceAssistantModule.setSessions`), waiting sessions first.
  private func stored() -> [SessionEntity] {
    guard
      let json = UserDefaults.standard.string(forKey: AssistantNames.sessionsKey),
      let data = json.data(using: .utf8),
      let sessions = try? JSONDecoder().decode([StoredSession].self, from: data)
    else {
      return []
    }
    return sessions.map { SessionEntity(id: $0.id, title: $0.title) }
  }

  func entities(for identifiers: [String]) async throws -> [SessionEntity] {
    stored().filter { identifiers.contains($0.id) }
  }

  func entities(matching string: String) async throws -> [SessionEntity] {
    stored().filter { $0.title.localizedCaseInsensitiveContains(string) }
  }

  func suggestedEntities() async throws -> [SessionEntity] {
    stored()
  }
}
