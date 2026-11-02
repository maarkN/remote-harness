import AVFoundation
import ExpoModulesCore
import MediaPlayer

private let onStop = "onStop"
private let onTalk = "onTalk"

/**
 * Keeps hands-free alive with the screen locked or the app in the background (#446). While started,
 * the shared audio session is a spoken-audio playback session that ducks other audio, and a silent
 * `AVAudioEngine` renders through it: the running audio hardware is what keeps the app scheduled
 * under the `audio` background mode between utterances. The lock screen and Control Center show a
 * Now Playing card with the texts given; its pause/stop control reports `onStop`, play and the
 * headset toggle report `onTalk`. Everything here is best effort: when a step fails, speech still
 * plays through whatever session is active, only the background keep-alive is lost.
 */
public final class HandsFreeBackgroundModule: Module {
  private var active = false
  private var engine: AVAudioEngine?
  private var observers: [NSObjectProtocol] = []
  private var targets: [(MPRemoteCommand, Any)] = []

  public func definition() -> ModuleDefinition {
    Name("HandsFreeBackground")

    Events(onStop, onTalk)

    /// Begins keeping the app alive; `title` and `subtitle` go on the Now Playing card.
    Function("start") { (texts: [String: String]) in
      DispatchQueue.main.async {
        self.start(title: texts["title"] ?? "", subtitle: texts["subtitle"] ?? "")
      }
    }

    /// Back to the playback-only session after a listening (speech recognition switched it to record,
    /// which keeps the microphone indicator on).
    Function("release") {
      DispatchQueue.main.async {
        guard self.active else {
          return
        }
        self.configureSession()
        self.startEngine()
      }
    }

    Function("stop") {
      DispatchQueue.main.async {
        self.stop()
      }
    }

    OnDestroy {
      DispatchQueue.main.async {
        self.stop()
      }
    }
  }

  private func start(title: String, subtitle: String) {
    active = true
    configureSession()
    startEngine()
    publishNowPlaying(title: title, subtitle: subtitle)
    registerCommands()
    observe()
  }

  private func stop() {
    active = false
    stopEngine()
    for (command, target) in targets {
      command.removeTarget(target)
    }
    targets = []
    MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
    for observer in observers {
      NotificationCenter.default.removeObserver(observer)
    }
    observers = []
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
  }

  /// Spoken audio: other apps' music gets quieter while something is said, other spoken audio pauses.
  private func configureSession() {
    let session = AVAudioSession.sharedInstance()
    do {
      try session.setCategory(
        .playback,
        mode: .spokenAudio,
        options: [.duckOthers, .interruptSpokenAudioAndMixWithOthers]
      )
      try session.setActive(true)
    } catch {
      // Best effort (see the class comment).
    }
  }

  /// Silence through the output keeps the audio hardware, and with it the app, running in the background.
  private func startEngine() {
    if engine?.isRunning == true {
      return
    }
    stopEngine()
    guard let format = AVAudioFormat(standardFormatWithSampleRate: 44_100, channels: 1) else {
      return
    }
    let engine = AVAudioEngine()
    let source = AVAudioSourceNode(format: format) { _, _, _, audioBufferList -> OSStatus in
      for buffer in UnsafeMutableAudioBufferListPointer(audioBufferList) {
        if let data = buffer.mData {
          memset(data, 0, Int(buffer.mDataByteSize))
        }
      }
      return noErr
    }
    engine.attach(source)
    engine.connect(source, to: engine.mainMixerNode, format: format)
    engine.mainMixerNode.outputVolume = 0
    do {
      try engine.start()
      self.engine = engine
    } catch {
      // Without the engine the app may be suspended between utterances; speech itself still works.
    }
  }

  private func stopEngine() {
    engine?.stop()
    engine = nil
  }

  private func publishNowPlaying(title: String, subtitle: String) {
    MPNowPlayingInfoCenter.default().nowPlayingInfo = [
      MPMediaItemPropertyTitle: title,
      MPMediaItemPropertyArtist: subtitle,
      MPNowPlayingInfoPropertyIsLiveStream: true,
      MPNowPlayingInfoPropertyPlaybackRate: 1.0,
    ]
  }

  /// Pause and stop (the lock screen card) turn hands-free off; play and the headset's toggle mean Talk.
  private func registerCommands() {
    let center = MPRemoteCommandCenter.shared()
    for (command, target) in targets {
      command.removeTarget(target)
    }
    targets = []
    let stop: (MPRemoteCommandEvent) -> MPRemoteCommandHandlerStatus = { [weak self] _ in
      self?.sendEvent(onStop, [:])
      return .success
    }
    let talk: (MPRemoteCommandEvent) -> MPRemoteCommandHandlerStatus = { [weak self] _ in
      self?.sendEvent(onTalk, [:])
      return .success
    }
    for command in [center.pauseCommand, center.stopCommand] {
      command.isEnabled = true
      targets.append((command, command.addTarget(handler: stop)))
    }
    for command in [center.playCommand, center.togglePlayPauseCommand] {
      command.isEnabled = true
      targets.append((command, command.addTarget(handler: talk)))
    }
    let unused: [MPRemoteCommand] = [
      center.nextTrackCommand,
      center.previousTrackCommand,
      center.skipForwardCommand,
      center.skipBackwardCommand,
      center.seekForwardCommand,
      center.seekBackwardCommand,
      center.changePlaybackPositionCommand,
    ]
    for command in unused {
      command.isEnabled = false
    }
  }

  /// An interruption that ended (a call) or a configuration change (speech recognition taking the
  /// session, a route change) stops the engine: start it again while hands-free is on.
  private func observe() {
    for observer in observers {
      NotificationCenter.default.removeObserver(observer)
    }
    let center = NotificationCenter.default
    observers = [
      center.addObserver(
        forName: AVAudioSession.interruptionNotification,
        object: nil,
        queue: .main
      ) { [weak self] notification in
        guard let self, self.active else {
          return
        }
        let type = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt
        if type == AVAudioSession.InterruptionType.ended.rawValue {
          self.configureSession()
          self.startEngine()
        }
      },
      center.addObserver(
        forName: .AVAudioEngineConfigurationChange,
        object: nil,
        queue: .main
      ) { [weak self] _ in
        guard let self, self.active else {
          return
        }
        self.startEngine()
      },
    ]
  }
}
