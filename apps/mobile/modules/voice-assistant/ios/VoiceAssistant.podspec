Pod::Spec.new do |s|
  s.name           = 'VoiceAssistant'
  s.version        = '1.0.0'
  s.summary        = 'Bridges Siri / Shortcuts App Intents to the Remote Harness JavaScript.'
  s.description    = 'Forwards voice assistant requests to JavaScript and their answers back.'
  s.license        = 'MIT'
  s.author         = 'Remote Harness'
  s.homepage       = 'https://remoteharness.app'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '*.swift'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
