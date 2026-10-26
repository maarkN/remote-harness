# App access (store review)

Paste the text below into Google Play Console → App content → App access ("All or some functionality is restricted" → Add instructions), and into App Store Connect → App Review Information → Notes. No username or password is needed.

---

Remote Harness has no accounts. In normal use it connects to a program the user installs on their own computer, by scanning a QR code that program shows.

To review every feature without a computer, open the app and tap **Try the demo** on the first screen (below "First time? Set up your computer"). The app then shows a fictional computer with sample sessions, entirely offline:

1. The session list shows sessions that are waiting for a permission, running, idle and ended.
2. Open "Rate limit the login endpoint" to see a conversation with tool calls, and allow or deny the pending request at the bottom.
3. Open "Dark mode toggle in settings" and use the menu to see its terminal, its subagents and its changes.
4. Type a prompt and send it: a sample reply appears.
5. Settings shows the computer, the paired devices, permission rules and the approval log.

A banner at the top says it is a demo; **Leave demo** returns to the first screen. Nothing typed in the demo leaves the phone, and nothing is saved.
