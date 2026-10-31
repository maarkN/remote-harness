// Remote Harness menu bar icon. The daemon starts it and sends the menu as JSON lines on stdin;
// clicks go back as JSON lines on stdout. It quits when stdin closes (the daemon stopped).
import AppKit
import CoreImage
import SwiftUI

struct TrayItem: Decodable {
  let id: String?
  let label: String?
  let enabled: Bool?
  let checked: Bool?
  let type: String?
  let items: [TrayItem]?
  /// Contents of a `qr` item.
  let text: String?
}

/// One row of a Preferences window section — mirrors the daemon's `PrefRow` union; unused fields
/// for a given `kind` stay nil. Every label/hint/value is already translated by the daemon.
struct PrefRowWire: Decodable {
  let kind: String
  let id: String?
  let label: String?
  let hint: String?
  let checked: Bool?
  let value: String?
  let options: [PrefOptionWire]?
  let style: String?
  /// The question a destructive button asks before it runs.
  let confirm: String?
  let text: String?
  /// `entry` rows: `online` / `offline`, and the row's action.
  let tone: String?
  let button: PrefButtonWire?
}
struct PrefButtonWire: Decodable {
  let id: String
  let label: String
  let style: String?
  let confirm: String?
}
struct PrefOptionWire: Decodable {
  let id: String
  let label: String
  let checked: Bool
}
struct PrefSectionWire: Decodable {
  let title: String?
  let rows: [PrefRowWire]
}
struct PrefTabWire: Decodable, Identifiable {
  let id: String
  let label: String
  let sections: [PrefSectionWire]
}
struct TrayPrefsWindowWire: Decodable {
  let title: String
  let tabs: [PrefTabWire]
}

struct TraySessionWire: Decodable, Identifiable {
  let id: String
  let title: String
  let folder: String
  let profile: String
  let state: String
  let worktree: Bool
  let controllable: Bool
  let agent: String
  let updatedAt: String
}
struct TraySessionsActionsWire: Decodable {
  let focus: String
  let rename: String
  let close: String
  let copyPath: String
}
struct TrayRenamePromptWire: Decodable {
  let title: String
  let confirm: String
  let cancel: String
}
struct TraySessionsWindowWire: Decodable {
  let title: String
  let searchPlaceholder: String
  let actions: TraySessionsActionsWire
  let renamePrompt: TrayRenamePromptWire
}

// MARK: - Popover wire (mirrors the daemon's `TrayPopover`; every string already translated)

struct TrayPillWire: Decodable {
  let label: String
  let tone: String
}
struct PopoverActionWire: Decodable, Identifiable {
  let id: String
  let label: String
  let detail: String?
  let enabled: Bool?
  let style: String?
  let items: [PopoverActionWire]?
}
struct PopoverHeaderWire: Decodable {
  let title: String
  let subtitle: String
  let pill: TrayPillWire
}
struct PopoverPendingWire: Decodable {
  let label: String
  let createdAt: String
  let agent: String
  let title: String
  let profile: String
  let profileColor: String?
  let summary: String
  let actions: [PopoverActionWire]
}
struct PopoverSessionWire: Decodable, Identifiable {
  let id: String
  let agent: String
  let title: String
  let detail: String
  let pill: TrayPillWire
  let action: String?
  let menu: [PopoverActionWire]
}
struct PopoverSessionsWire: Decodable {
  let label: String
  let detail: String
  let rows: [PopoverSessionWire]
  let more: PopoverActionWire?
  let ended: PopoverActionWire?
  let empty: String?
}
struct PopoverDeviceWire: Decodable, Identifiable {
  let id: String
  let name: String
  let platform: String
  let detail: String
  let pill: TrayPillWire
}
struct PopoverDevicesWire: Decodable {
  let label: String
  let detail: String
  let rows: [PopoverDeviceWire]
  let empty: String?
  let action: String
}
struct TrayPopoverWire: Decodable {
  let header: PopoverHeaderWire
  let pending: PopoverPendingWire?
  let sessions: PopoverSessionsWire
  let devices: PopoverDevicesWire
  let actions: [[PopoverActionWire]]
}

struct TrayMessage: Decodable {
  let type: String
  let tooltip: String?
  /// Glyph state: `idle`, `working`, `waiting` or `offline` (absent = idle).
  let icon: String?
  let items: [TrayItem]?
  /// Full, uncapped session list; present only once the daemon knows this helper opens windows.
  let sessions: [TraySessionWire]?
  let sessionsWindow: TraySessionsWindowWire?
  let prefsWindow: TrayPrefsWindowWire?
  /// The popover's cards; present once the daemon knows this helper shows the popover.
  let popover: TrayPopoverWire?
}

/// Data the Preferences/Sessions windows render; updated on the main thread as menu messages
/// arrive, so SwiftUI redraws both windows live without either needing its own round trip.
final class TrayState: ObservableObject {
  @Published var sessions: [TraySessionWire] = []
  @Published var sessionsWindow: TraySessionsWindowWire?
  @Published var prefsWindow: TrayPrefsWindowWire?
  @Published var popover: TrayPopoverWire?
  /// The Preferences window's selected tab (`prefs:<tab>` opens it on that tab).
  @Published var prefsTab = "general"
}

final class Tray: NSObject {
  private let statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
  private var state = "idle"
  let data = TrayState()
  private var prefsWindow: NSWindow?
  private var sessionsWindow: NSWindow?
  /// The cards popover, shown instead of the menu once the daemon sends `popover`.
  private let popover = NSPopover()
  private lazy var popoverHost = NSHostingController(rootView: PopoverView(state: data, tray: self))

  override init() {
    super.init()
    if let button = statusItem.button {
      button.image = Tray.glyph("idle")
      button.image?.accessibilityDescription = "Remote Harness"
    }
    popover.behavior = .transient
    popover.animates = false
  }

  @objc private func togglePopover(_ sender: Any?) {
    if popover.isShown {
      popover.performClose(sender)
      return
    }
    guard let button = statusItem.button else { return }
    if popover.contentViewController == nil {
      if #available(macOS 13.0, *) { popoverHost.sizingOptions = [.preferredContentSize] }
      popover.contentViewController = popoverHost
    }
    popover.contentSize = popoverHost.view.fittingSize
    NSApp.activate(ignoringOtherApps: true)
    popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
  }

  /// A popover click: the popover closes first (a prompt or a window may follow), then the action runs.
  func popoverAction(_ id: String) {
    popover.performClose(nil)
    dispatch(id)
  }

  /// The Remote Harness mark in its bold weight (three reins meeting in one ring), drawn from the
  /// same geometry as the app icon (256-unit box). Color encodes only the state: `idle` is a template
  /// image (macOS tints it for light and dark menu bars), `working` fills the ring, `waiting` adds
  /// the amber dot (the one color allowed in the menu bar) over label-colored strokes.
  private static func glyph(_ state: String) -> NSImage {
    let colored = state == "waiting"
    let image = NSImage(size: NSSize(width: 18, height: 18), flipped: true) { rect in
      let s = rect.width / 256
      let p = { (x: CGFloat, y: CGFloat) in NSPoint(x: x * s, y: y * s) }
      (colored ? NSColor.labelColor : NSColor.black).set()
      let strokes = NSBezierPath()
      strokes.lineWidth = 34 * s
      strokes.lineCapStyle = .round
      strokes.lineJoinStyle = .round
      strokes.appendOval(in: NSRect(x: 92 * s, y: 150 * s, width: 72 * s, height: 72 * s))
      strokes.move(to: p(128, 150))
      strokes.line(to: p(128, 70))
      strokes.move(to: p(108, 156))
      strokes.curve(to: p(56, 84), controlPoint1: p(100, 122), controlPoint2: p(86, 104))
      strokes.move(to: p(148, 156))
      strokes.curve(to: p(200, 84), controlPoint1: p(156, 122), controlPoint2: p(170, 104))
      strokes.stroke()
      if state == "working" {
        NSBezierPath(ovalIn: NSRect(x: 104 * s, y: 162 * s, width: 48 * s, height: 48 * s)).fill()
      }
      for (x, y) in [(104, 24), (28, 46), (180, 46)] as [(CGFloat, CGFloat)] {
        let node = NSRect(x: x * s, y: y * s, width: 48 * s, height: 48 * s)
        NSBezierPath(roundedRect: node, xRadius: 12 * s, yRadius: 12 * s).fill()
      }
      if colored {
        // Amber accent (#E8A33D), the only color the glyph ever carries.
        NSColor(calibratedRed: 0.91, green: 0.64, blue: 0.24, alpha: 1).set()
        NSBezierPath(ovalIn: NSRect(x: 176 * s, y: 164 * s, width: 64 * s, height: 64 * s)).fill()
      }
      return true
    }
    image.isTemplate = !colored
    return image
  }

  /// The mark as a template image, for the popover header.
  static func markImage() -> NSImage { glyph("idle") }

  func apply(_ message: TrayMessage) {
    guard message.type == "menu" else { return }
    let next = message.icon ?? "idle"
    if next != state, let button = statusItem.button {
      state = next
      button.image = Tray.glyph(next)
      button.image?.accessibilityDescription = "Remote Harness"
      button.alphaValue = next == "offline" ? 0.4 : 1
    }
    statusItem.button?.toolTip = message.tooltip
    if let sessions = message.sessions { data.sessions = sessions }
    if let sessionsWindow = message.sessionsWindow { data.sessionsWindow = sessionsWindow }
    if let prefsWindow = message.prefsWindow { data.prefsWindow = prefsWindow }
    if let cards = message.popover {
      // The popover replaces the menu: a click on the icon toggles it.
      data.popover = cards
      statusItem.menu = nil
      statusItem.button?.target = self
      statusItem.button?.action = #selector(togglePopover(_:))
      if popover.isShown { popover.contentSize = popoverHost.view.fittingSize }
    } else {
      statusItem.menu = build(message.items ?? [])
    }
  }

  private func build(_ items: [TrayItem]) -> NSMenu {
    let menu = NSMenu()
    menu.autoenablesItems = false
    for item in items {
      if item.type == "separator" {
        menu.addItem(.separator())
        continue
      }
      if item.type == "qr" {
        if let text = item.text, let entry = Tray.qrItem(text) { menu.addItem(entry) }
        continue
      }
      let entry = NSMenuItem(title: item.label ?? "", action: nil, keyEquivalent: "")
      if item.type == "submenu" {
        entry.submenu = build(item.items ?? [])
      } else if let id = item.id {
        entry.target = self
        entry.action = #selector(clicked(_:))
        entry.representedObject = id
        entry.isEnabled = item.enabled ?? true
        entry.state = (item.checked ?? false) ? .on : .off
      }
      menu.addItem(entry)
    }
    return menu
  }

  /// Side of the pairing QR code in the menu, in points.
  private static let qrSide: CGFloat = 200

  /// `text` as a white-on-quiet-zone QR code, legible in light and dark mode. Nil when CoreImage
  /// cannot encode it (shared by the menu's `qr` item and the Preferences window's Pairing tab).
  private static func qrNSImage(_ text: String) -> NSImage? {
    guard let filter = CIFilter(name: "CIQRCodeGenerator") else { return nil }
    filter.setValue(Data(text.utf8), forKey: "inputMessage")
    filter.setValue("M", forKey: "inputCorrectionLevel")
    guard let output = filter.outputImage else { return nil }
    let scale = (qrSide * 2) / output.extent.width
    let scaled = output.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
    let rep = NSCIImageRep(ciImage: scaled)
    let image = NSImage(size: NSSize(width: qrSide, height: qrSide))
    image.addRepresentation(rep)
    return image
  }

  /// A menu item showing `text` as a QR code (the pairing link), on white with a quiet zone so the
  /// phone's camera reads it in light and dark mode. Nil when CoreImage cannot encode it.
  private static func qrItem(_ text: String) -> NSMenuItem? {
    guard let image = qrNSImage(text) else { return nil }
    let padding: CGFloat = 12
    let side = qrSide + padding * 2
    let container = NSView(frame: NSRect(x: 0, y: 0, width: side + 32, height: side + 16))
    let card = NSView(frame: NSRect(x: 16, y: 8, width: side, height: side))
    card.wantsLayer = true
    card.layer?.backgroundColor = NSColor.white.cgColor
    card.layer?.cornerRadius = 8
    let view = NSImageView(frame: NSRect(x: padding, y: padding, width: qrSide, height: qrSide))
    view.image = image
    view.imageScaling = .scaleProportionallyUpOrDown
    view.setAccessibilityLabel("Pairing QR code")
    card.addSubview(view)
    container.addSubview(card)
    let entry = NSMenuItem()
    entry.view = container
    return entry
  }

  @objc private func clicked(_ sender: NSMenuItem) {
    guard let id = sender.representedObject as? String else { return }
    dispatch(id)
  }

  /// Ids a helper with windows never sends to the daemon: it already has everything it needs
  /// cached in `data` to open the right window itself.
  func dispatch(_ id: String) {
    if id == "prefs", data.prefsWindow != nil {
      showPreferences()
    } else if id.hasPrefix("prefs:"), data.prefsWindow != nil {
      showPreferences(tab: String(id.dropFirst("prefs:".count)))
    } else if id == "see-all" {
      showSessions()
    } else if id.hasPrefix("rename:") {
      promptRename(sessionId: String(id.dropFirst("rename:".count)))
    } else {
      sendAction(id, nil)
    }
  }

  /// Confirms destructive buttons (the window has no nested-submenu trick the menu uses) and sends
  /// everything else straight through. `question` is the alert's text, `confirmLabel` its button.
  func sendAction(_ id: String, _ value: String?, confirmLabel: String? = nil, question: String? = nil) {
    if let confirmLabel, !confirm(confirmLabel, question: question) { return }
    var payload: [String: Any] = ["type": "click", "id": id]
    if let value { payload["value"] = value }
    emit(payload)
  }

  private func confirm(_ label: String, question: String?) -> Bool {
    let alert = NSAlert()
    alert.messageText = question ?? label
    alert.addButton(withTitle: label)
    alert.addButton(withTitle: data.sessionsWindow?.renamePrompt.cancel ?? "Cancel")
    NSApp.activate(ignoringOtherApps: true)
    return alert.runModal() == .alertFirstButtonReturn
  }

  private func promptRename(sessionId: String) {
    let prompt = data.sessionsWindow?.renamePrompt
    let alert = NSAlert()
    alert.messageText = prompt?.title ?? "Rename session"
    alert.addButton(withTitle: prompt?.confirm ?? "Rename")
    alert.addButton(withTitle: prompt?.cancel ?? "Cancel")
    let field = NSTextField(frame: NSRect(x: 0, y: 0, width: 260, height: 24))
    field.stringValue = data.sessions.first(where: { $0.id == sessionId })?.title ?? ""
    alert.accessoryView = field
    alert.window.initialFirstResponder = field
    NSApp.activate(ignoringOtherApps: true)
    guard alert.runModal() == .alertFirstButtonReturn else { return }
    let name = field.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !name.isEmpty else { return }
    emit(["type": "click", "id": "rename:\(sessionId)", "value": name])
  }

  private func showPreferences(tab: String? = nil) {
    if let tab { data.prefsTab = tab }
    if prefsWindow == nil {
      let hosting = NSHostingController(rootView: PreferencesView(state: data, tray: self))
      let window = NSWindow(contentViewController: hosting)
      window.styleMask = [.titled, .closable, .miniaturizable]
      window.isReleasedWhenClosed = false
      window.center()
      prefsWindow = window
    }
    prefsWindow?.title = data.prefsWindow?.title ?? "Preferences"
    NSApp.activate(ignoringOtherApps: true)
    prefsWindow?.makeKeyAndOrderFront(nil)
  }

  private func showSessions() {
    if sessionsWindow == nil {
      let hosting = NSHostingController(rootView: SessionsView(state: data, tray: self))
      let window = NSWindow(contentViewController: hosting)
      window.styleMask = [.titled, .closable, .miniaturizable, .resizable]
      window.isReleasedWhenClosed = false
      window.center()
      sessionsWindow = window
    }
    sessionsWindow?.title = data.sessionsWindow?.title ?? "Sessions"
    NSApp.activate(ignoringOtherApps: true)
    sessionsWindow?.makeKeyAndOrderFront(nil)
  }
}

// MARK: - Preferences window

struct PreferencesView: View {
  @ObservedObject var state: TrayState
  let tray: Tray

  var body: some View {
    TabView(selection: $state.prefsTab) {
      ForEach(state.prefsWindow?.tabs ?? []) { tab in
        PrefTabView(tab: tab, tray: tray)
          .tabItem { Text(tab.label) }
          .tag(tab.id)
      }
    }
    .frame(width: 720, height: 440)
  }
}

/// One tab: grouped boxes (macOS 13+, like the prototype), else the plain form in a scroll view.
struct PrefTabView: View {
  let tab: PrefTabWire
  let tray: Tray

  private var form: some View {
    Form {
      ForEach(Array(tab.sections.enumerated()), id: \.offset) { _, section in
        PrefSectionView(section: section, tray: tray)
      }
    }
  }

  var body: some View {
    if #available(macOS 13.0, *) {
      form.formStyle(.grouped)
    } else {
      ScrollView { form.padding(16) }
    }
  }
}

struct PrefSectionView: View {
  let section: PrefSectionWire
  let tray: Tray

  var body: some View {
    if let title = section.title {
      Section(header: Text(title).font(.headline).padding(.top, 6)) { rows }
    } else {
      Section { rows }
    }
  }

  private var rows: some View {
    ForEach(Array(section.rows.enumerated()), id: \.offset) { _, row in
      PrefRowView(row: row, tray: tray)
    }
  }
}

struct PrefRowView: View {
  let row: PrefRowWire
  let tray: Tray
  @State private var text: String = ""

  var body: some View {
    switch row.kind {
    case "toggle":
      Toggle(
        isOn: Binding(get: { row.checked ?? false }, set: { _ in tray.sendAction(row.id ?? "", nil) })
      ) {
        VStack(alignment: .leading, spacing: 2) {
          Text(row.label ?? "")
          if let hint = row.hint {
            Text(hint).font(.caption).foregroundStyle(.secondary)
          }
        }
      }
    case "text":
      HStack {
        Text(row.label ?? "")
        Spacer()
        TextField("", text: $text)
          .frame(width: 200)
          .onAppear { text = row.value ?? "" }
          .onSubmit { tray.sendAction(row.id ?? "", text) }
      }
    case "value":
      HStack {
        Text(row.label ?? "")
        Spacer()
        Text(row.value ?? "").foregroundStyle(.secondary)
      }
    case "picker":
      Picker(
        row.label ?? "",
        selection: Binding(
          get: { row.options?.first(where: { $0.checked })?.id ?? "" },
          set: { newId in tray.sendAction(newId, nil) }
        )
      ) {
        ForEach(row.options ?? [], id: \.id) { option in Text(option.label).tag(option.id) }
      }
    case "button":
      Button(row.label ?? "") {
        tray.sendAction(
          row.id ?? "", nil, confirmLabel: row.style == "destructive" ? row.label : nil, question: row.confirm)
      }
    case "entry":
      HStack {
        VStack(alignment: .leading, spacing: 2) {
          Text(row.label ?? "")
          if let hint = row.hint {
            Text(hint).font(.caption).foregroundStyle(.secondary)
          }
        }
        Spacer()
        if let value = row.value {
          Text(value).font(.caption).foregroundColor(row.tone == "online" ? Palette.success : .secondary)
        }
        if let button = row.button {
          Button(button.label) {
            tray.sendAction(
              button.id, nil, confirmLabel: button.style == "destructive" ? button.label : nil,
              question: button.confirm)
          }
        }
      }
    case "qr":
      if let text = row.text, let image = Tray.qrForPreview(text) {
        Image(nsImage: image).resizable().frame(width: 160, height: 160).padding(.vertical, 4)
      }
    case "note":
      Text(row.label ?? "").font(.caption).foregroundStyle(.secondary)
    default:
      EmptyView()
    }
  }
}

extension Tray {
  /// Exposes the private QR generator to `PrefRowView` without widening its access elsewhere.
  fileprivate static func qrForPreview(_ text: String) -> NSImage? { qrNSImage(text) }
}

// MARK: - Sessions window

struct SessionsView: View {
  @ObservedObject var state: TrayState
  let tray: Tray
  @State private var query = ""

  var filtered: [TraySessionWire] {
    guard !query.isEmpty else { return state.sessions }
    return state.sessions.filter {
      $0.title.localizedCaseInsensitiveContains(query) || $0.folder.localizedCaseInsensitiveContains(query)
    }
  }

  var body: some View {
    VStack(spacing: 0) {
      TextField(state.sessionsWindow?.searchPlaceholder ?? "", text: $query)
        .textFieldStyle(.roundedBorder)
        .padding(10)
      List(filtered) { session in
        SessionRowView(session: session, actions: state.sessionsWindow?.actions, tray: tray)
      }
    }
    .frame(minWidth: 480, idealWidth: 560, minHeight: 320, idealHeight: 440)
  }
}

struct SessionRowView: View {
  let session: TraySessionWire
  let actions: TraySessionsActionsWire?
  let tray: Tray

  var body: some View {
    HStack {
      VStack(alignment: .leading, spacing: 2) {
        Text(session.title).bold()
        Text("\(session.folder) · \(session.agent) · \(session.state)")
          .font(.caption)
          .foregroundStyle(.secondary)
      }
      Spacer()
      Button(actions?.focus ?? "Focus") { tray.sendAction("focus:\(session.id)", nil) }
        .disabled(!session.controllable)
      Button(actions?.rename ?? "Rename…") { tray.dispatch("rename:\(session.id)") }
      Button(actions?.close ?? "Close") { tray.sendAction("close:\(session.id)", nil) }
        .disabled(!session.controllable)
      Button(actions?.copyPath ?? "Copy path") {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(session.folder, forType: .string)
      }
    }
    .padding(.vertical, 4)
  }
}

// MARK: - Popover

/// The popover's colors: the identity's state colors, deeper in the light appearance so text keeps
/// its contrast. Agent colors are fixed in every appearance, like in the app.
enum Palette {
  static func dynamic(dark: (CGFloat, CGFloat, CGFloat), light: (CGFloat, CGFloat, CGFloat)) -> Color {
    Color(
      nsColor: NSColor(name: nil) { appearance in
        let isDark = appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
        let (r, g, b) = isDark ? dark : light
        return NSColor(srgbRed: r / 255, green: g / 255, blue: b / 255, alpha: 1)
      })
  }
  static let accent = dynamic(dark: (232, 163, 61), light: (168, 106, 18))
  static let success = dynamic(dark: (127, 176, 105), light: (62, 125, 42))
  static let danger = dynamic(dark: (224, 108, 117), light: (192, 57, 43))
  static let warning = dynamic(dark: (243, 220, 122), light: (138, 109, 0))

  static func tone(_ tone: String) -> Color {
    switch tone {
    case "running", "accent": return accent
    case "idle", "online": return success
    case "waiting": return warning
    default: return Color.secondary
    }
  }

  static func agent(_ agent: String) -> Color {
    let rgb: (Double, Double, Double)
    switch agent {
    case "claude": rgb = (217, 119, 87)
    case "codex": rgb = (47, 191, 143)
    case "kimi": rgb = (91, 155, 245)
    case "qwen": rgb = (140, 108, 245)
    default: return Color.gray
    }
    return Color(.sRGB, red: rgb.0 / 255, green: rgb.1 / 255, blue: rgb.2 / 255)
  }

  /// `#61afef` from the config; nil when it is not a 6-digit hex color.
  static func hex(_ value: String?) -> Color? {
    guard let value, value.hasPrefix("#"), value.count == 7, let int = Int(value.dropFirst(), radix: 16)
    else { return nil }
    return Color(
      .sRGB, red: Double((int >> 16) & 0xFF) / 255, green: Double((int >> 8) & 0xFF) / 255,
      blue: Double(int & 0xFF) / 255)
  }
}

let monoFont = Font.system(size: 12.5, design: .monospaced)

struct PopoverView: View {
  @ObservedObject var state: TrayState
  let tray: Tray

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      if let cards = state.popover {
        PopoverHeader(header: cards.header)
        Divider()
        if let pending = cards.pending {
          PendingCard(pending: pending, tray: tray)
        }
        SectionLabel(label: cards.sessions.label, detail: cards.sessions.detail)
        ForEach(cards.sessions.rows) { row in SessionRow(row: row, tray: tray) }
        if let empty = cards.sessions.empty { MutedRow(text: empty) }
        if let more = cards.sessions.more { LinkRow(action: more, tray: tray) }
        if let ended = cards.sessions.ended { LinkRow(action: ended, tray: tray) }
        SectionLabel(label: cards.devices.label, detail: cards.devices.detail)
        ForEach(cards.devices.rows) { row in
          DeviceRow(row: row) { tray.popoverAction(cards.devices.action) }
        }
        if let empty = cards.devices.empty { MutedRow(text: empty) }
        Divider().padding(.top, 6)
        VStack(alignment: .leading, spacing: 0) {
          ForEach(Array(cards.actions.enumerated()), id: \.offset) { index, group in
            if index > 0 { Divider().padding(.vertical, 4).padding(.horizontal, 6) }
            ForEach(group) { action in ActionRow(action: action, tray: tray) }
          }
        }
        .padding(6)
      }
    }
    .font(monoFont)
    .frame(width: 372)
  }
}

struct PopoverHeader: View {
  let header: PopoverHeaderWire

  var body: some View {
    HStack(spacing: 10) {
      Image(nsImage: Tray.markImage())
        .renderingMode(.template)
        .resizable()
        .frame(width: 22, height: 22)
        .foregroundColor(Palette.accent)
      VStack(alignment: .leading, spacing: 1) {
        Text(header.title).font(.system(size: 13, weight: .bold, design: .monospaced))
        Text(header.subtitle).font(.system(size: 11, design: .monospaced)).foregroundColor(.secondary)
          .lineLimit(1).truncationMode(.tail)
      }
      Spacer(minLength: 4)
      Pill(pill: header.pill)
    }
    .padding(.horizontal, 14)
    .padding(.top, 12)
    .padding(.bottom, 10)
  }
}

struct SectionLabel: View {
  let label: String
  var detail: String? = nil
  var trailing: AnyView? = nil

  var body: some View {
    HStack {
      Text(label.uppercased())
        .font(.system(size: 10.5, weight: .bold, design: .monospaced))
        .tracking(1)
        .foregroundColor(.secondary)
      Spacer()
      if let trailing { trailing }
      if let detail {
        Text(detail).font(.system(size: 10.5, design: .monospaced)).foregroundColor(.secondary.opacity(0.7))
      }
    }
    .padding(.horizontal, 14)
    .padding(.top, 10)
    .padding(.bottom, 4)
  }
}

struct Pill: View {
  let pill: TrayPillWire

  var body: some View {
    let color = Palette.tone(pill.tone)
    HStack(spacing: 5) {
      Circle().fill(color).frame(width: 6, height: 6)
      Text(pill.label).font(.system(size: 11, design: .monospaced)).lineLimit(1)
    }
    .foregroundColor(color)
    .padding(.horizontal, 7)
    .padding(.vertical, 2)
    .background(Capsule().fill(color.opacity(0.16)))
    .fixedSize()
  }
}

struct AgentBadge: View {
  let agent: String

  var body: some View {
    Text(String(agent.prefix(2)))
      .font(.system(size: 8.5, weight: .bold, design: .monospaced))
      .foregroundColor(.white)
      .frame(width: 18, height: 18)
      .background(RoundedRectangle(cornerRadius: 4).fill(Palette.agent(agent)))
  }
}

/// A full-width row that highlights on hover, like a menu item.
struct HoverRow<Content: View>: View {
  let action: (() -> Void)?
  @ViewBuilder let content: () -> Content
  @State private var hovering = false

  var body: some View {
    content()
      .padding(.horizontal, 14)
      .padding(.vertical, 6)
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(hovering && action != nil ? Color.primary.opacity(0.07) : Color.clear)
      .contentShape(Rectangle())
      .onHover { hovering = $0 }
      .onTapGesture { action?() }
  }
}

struct PendingCard: View {
  let pending: PopoverPendingWire
  let tray: Tray

  private static let iso: ISO8601DateFormatter = {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter
  }()

  private var since: Date? {
    Self.iso.date(from: pending.createdAt) ?? ISO8601DateFormatter().date(from: pending.createdAt)
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      HStack {
        Text(pending.label.uppercased())
          .font(.system(size: 10.5, weight: .bold, design: .monospaced))
          .tracking(1)
          .foregroundColor(.secondary)
        Spacer()
        if let since {
          TimelineView(.periodic(from: Date(), by: 1)) { context in
            Text(Self.elapsed(since, context.date))
              .font(.system(size: 10.5, design: .monospaced))
              .foregroundColor(.secondary.opacity(0.7))
          }
        }
      }
      .padding(.horizontal, 14)
      .padding(.top, 10)
      .padding(.bottom, 4)
      VStack(alignment: .leading, spacing: 7) {
        HStack(spacing: 8) {
          AgentBadge(agent: pending.agent)
          Text(pending.title).bold().lineLimit(1).truncationMode(.tail)
          Spacer(minLength: 4)
          Text(pending.profile).font(.system(size: 11, design: .monospaced))
            .foregroundColor(Palette.hex(pending.profileColor) ?? .secondary)
        }
        Text(pending.summary)
          .font(.system(size: 12, design: .monospaced))
          .lineLimit(1).truncationMode(.tail)
          .padding(.horizontal, 9)
          .padding(.vertical, 6)
          .frame(maxWidth: .infinity, alignment: .leading)
          .background(RoundedRectangle(cornerRadius: 6).fill(Color.primary.opacity(0.08)))
        HStack(spacing: 6) {
          ForEach(pending.actions) { action in
            let color = action.style == "allow" ? Palette.success : action.style == "deny" ? Palette.danger : Color.secondary
            Button(action: { tray.popoverAction(action.id) }) {
              Text(action.label)
                .font(.system(size: 11.5, weight: .semibold, design: .monospaced))
                .foregroundColor(action.style == nil ? .primary : color)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .background(RoundedRectangle(cornerRadius: 7).stroke(color.opacity(0.8), lineWidth: 1))
          }
        }
      }
      .padding(.horizontal, 11)
      .padding(.vertical, 9)
      .background(RoundedRectangle(cornerRadius: 10).fill(Palette.warning.opacity(0.06)))
      .overlay(RoundedRectangle(cornerRadius: 10).stroke(Palette.warning, lineWidth: 1))
      .padding(.horizontal, 14)
      .padding(.top, 4)
      .padding(.bottom, 6)
    }
  }

  /// `0:52`, `12:03`, `1:02:03`: digits only, nothing to translate.
  static func elapsed(_ from: Date, _ to: Date) -> String {
    let total = max(0, Int(to.timeIntervalSince(from)))
    let (h, m, s) = (total / 3600, (total % 3600) / 60, total % 60)
    return h > 0 ? String(format: "%d:%02d:%02d", h, m, s) : String(format: "%d:%02d", m, s)
  }
}

struct SessionRow: View {
  let row: PopoverSessionWire
  let tray: Tray

  var body: some View {
    HoverRow(action: row.action.map { id in { tray.popoverAction(id) } }) {
      HStack(spacing: 9) {
        AgentBadge(agent: row.agent)
        VStack(alignment: .leading, spacing: 1) {
          Text(row.title).lineLimit(1).truncationMode(.tail)
          Text(row.detail).font(.system(size: 11, design: .monospaced)).foregroundColor(.secondary)
            .lineLimit(1).truncationMode(.middle)
        }
        Spacer(minLength: 4)
        Pill(pill: row.pill)
      }
    }
    .contextMenu {
      ForEach(row.menu) { item in
        Button(item.label) { tray.popoverAction(item.id) }.disabled(item.enabled == false)
      }
    }
  }
}

struct DeviceRow: View {
  let row: PopoverDeviceWire
  let open: () -> Void

  var body: some View {
    HoverRow(action: open) {
      HStack(spacing: 9) {
        Image(systemName: row.platform == "ios" || row.platform == "android" ? "iphone" : "ipad")
          .frame(width: 18)
          .foregroundColor(.secondary)
        VStack(alignment: .leading, spacing: 1) {
          Text(row.name).lineLimit(1)
          Text(row.detail).font(.system(size: 11, design: .monospaced)).foregroundColor(.secondary)
            .lineLimit(1)
        }
        Spacer(minLength: 4)
        Pill(pill: row.pill)
      }
    }
  }
}

struct MutedRow: View {
  let text: String

  var body: some View {
    Text(text)
      .foregroundColor(.secondary)
      .padding(.horizontal, 14)
      .padding(.vertical, 6)
  }
}

/// "See all sessions…" and the ended count: a muted row with a chevron, opening the Sessions window.
struct LinkRow: View {
  let action: PopoverActionWire
  let tray: Tray

  var body: some View {
    HoverRow(action: { tray.popoverAction(action.id) }) {
      HStack {
        Text(action.label).foregroundColor(.secondary).padding(.leading, 27)
        Spacer()
        Text("›").foregroundColor(.secondary)
      }
    }
  }
}

struct ActionRow: View {
  let action: PopoverActionWire
  let tray: Tray
  @State private var hovering = false

  /// Standard shortcuts of the quick actions, by id (drawn and bound by the helper).
  private var shortcut: (KeyEquivalent, String)? {
    switch action.id {
    case "new": return ("n", "⌘N")
    case "prefs": return (",", "⌘,")
    case "quit": return ("q", "⌘Q")
    default: return nil
    }
  }

  var body: some View {
    let enabled = action.enabled != false
    Group {
      if let items = action.items {
        Menu {
          ForEach(items) { item in Button(item.label) { tray.popoverAction(item.id) } }
        } label: {
          Text(action.label)
        }
        .menuStyle(.borderlessButton)
        .fixedSize()
        // The borderless menu button brings its own inset: 7 + 3 lines it up with the other rows.
        .padding(.horizontal, 7)
        .padding(.vertical, 6)
        .frame(maxWidth: .infinity, alignment: .leading)
      } else {
        Button(action: { tray.popoverAction(action.id) }) {
          HStack {
            Text(action.label).foregroundColor(enabled ? .primary : .secondary)
            Spacer()
            if let detail = action.detail {
              Text(detail).font(.system(size: 11, design: .monospaced)).foregroundColor(.secondary.opacity(0.7))
            }
            if let shortcut {
              Text(shortcut.1).font(.system(size: 11, design: .monospaced)).foregroundColor(.secondary.opacity(0.7))
            }
          }
          .padding(.horizontal, 10)
          .padding(.vertical, 6)
          .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .background(RoundedRectangle(cornerRadius: 6).fill(hovering && enabled ? Color.primary.opacity(0.07) : Color.clear))
        .onHover { hovering = $0 }
        .modifier(ShortcutModifier(shortcut: shortcut?.0))
      }
    }
  }
}

struct ShortcutModifier: ViewModifier {
  let shortcut: KeyEquivalent?

  func body(content: Content) -> some View {
    if let shortcut {
      content.keyboardShortcut(shortcut, modifiers: .command)
    } else {
      content
    }
  }
}

func emit(_ object: [String: Any]) {
  guard let data = try? JSONSerialization.data(withJSONObject: object),
    let line = String(data: data, encoding: .utf8)
  else { return }
  FileHandle.standardOutput.write(Data((line + "\n").utf8))
}

let app = NSApplication.shared
// Menu bar only: no Dock icon, no main window.
app.setActivationPolicy(.accessory)
let tray = Tray()

Thread.detachNewThread {
  while let line = readLine() {
    guard let data = line.data(using: .utf8),
      let message = try? JSONDecoder().decode(TrayMessage.self, from: data)
    else { continue }
    DispatchQueue.main.async { tray.apply(message) }
  }
  DispatchQueue.main.async { exit(0) }
}

emit(["type": "ready", "windows": true, "popover": true])
app.run()
