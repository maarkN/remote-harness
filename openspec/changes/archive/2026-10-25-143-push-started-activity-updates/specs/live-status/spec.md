## MODIFIED Requirements

### Requirement: Follow a session
When the daemon announces `live.follow` and "Live status" is on, the session's More options menu and the session list's action sheet SHALL offer **Follow live status** / **Stop following**. A followed session SHALL show a "following" mark, with an accessible label, on its row and in its header. Following SHALL start the live status at once when the session is working or waiting; an idle session shows nothing until its next turn.

While a session is followed, each new turn (`UserPromptSubmit`) SHALL start its live status on that phone, even with the app in the background or closed. This happens only when the session has no live status yet, no app is in the foreground (the app in front starts its own), and neither the session nor its profile is muted. It starts:
- on Android, as the app-drawn notification, with the updates that follow;
- on iOS 17.2 or later, as a Live Activity started by push with the phone's push-to-start token. The start payload SHALL ask iOS for the activity's update token right away (iOS 18+). When iOS hands the app that token in the background, the app SHALL register it with the daemon without opening its screens, over a short-lived authenticated connection, so the activity gets the same updates (steps, counts, waiting with Deny / Allow, done, end) as one started from the app. Until a token arrives the daemon keeps the status but sends no update. A registration without theme colors SHALL keep the colors the session's live status already had;
- on older iOS, or before the app sent a push-to-start token, as a regular push "Session working" with the profile name, like the other notifications.

A session SHALL stop being followed when the user taps Stop following, when it ends, or after 12 hours without a turn. Turning "Live status" off SHALL stop following every session and turn auto-follow off. Follows MUST survive daemon restarts. The push-to-start payload follows the live status content rules. The fallback push carries only the state, the profile name and the session id. Texts MUST be translated.

#### Scenario: Follow a session working on the computer
- **WHEN** a session is working after a prompt typed on the computer and the user taps Follow live status in its menu
- **THEN** its live status starts and the session row shows the following mark

#### Scenario: Desktop turn with the app closed (Android)
- **WHEN** a followed session gets a prompt from the computer while the Android app is closed
- **THEN** the live status notification appears and keeps updating until the turn is done

#### Scenario: Desktop turn with the app in the background (iOS)
- **WHEN** a followed session gets a prompt from the computer, the iPhone runs iOS 18 and the app is in the background
- **THEN** a Live Activity for that session starts from the push, and the next time the app runs it adopts that activity instead of starting another

#### Scenario: Push-started activity keeps updating with the app closed (iOS)
- **WHEN** a followed session gets a prompt from the computer while the iPhone app is closed, and iOS hands the new activity's token to the app in the background
- **THEN** the activity shows the current step, glyphs and counts within the usual throttle, without the app being opened

#### Scenario: Permission on a push-started activity
- **WHEN** a session whose Live Activity was started by push asks for a tool permission
- **THEN** the activity turns to "Waiting for you" with Deny / Allow, and tapping Allow answers the request without opening the app

#### Scenario: Push-started activity ends
- **WHEN** the turn of a push-started activity finishes, or its session closes
- **THEN** the activity shows done (and is dismissed after 15 minutes without a new turn) or ends at once, like one started from the app

#### Scenario: Colors kept
- **WHEN** the app registers a push-started activity's token from the background without theme colors
- **THEN** the updates keep the colors the follow carried

#### Scenario: Older iOS
- **WHEN** a followed session starts a turn on an iPhone without a push-to-start token
- **THEN** the phone receives the push "Session working" with the profile name, and tapping it opens the session

#### Scenario: Stop following
- **WHEN** the user taps Stop following
- **THEN** the mark disappears and later turns from the computer start no live status

#### Scenario: Idle for 12 hours
- **WHEN** a followed session has no turn for 12 hours
- **THEN** it is no longer followed

#### Scenario: Muted
- **WHEN** a followed session's profile is muted and the session starts a turn
- **THEN** no live status starts and no push is sent

#### Scenario: Daemon restart
- **WHEN** the daemon restarts and a followed session then starts a turn with the app closed
- **THEN** the live status starts as before the restart
