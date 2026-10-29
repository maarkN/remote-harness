// Background handlers first: headless JS (Android) runs this file without mounting the router.
import './src/features/push/background'
// Siri / Shortcuts requests, which can arrive with the app in the background.
import './src/features/assistant/register'
import 'expo-router/entry'
