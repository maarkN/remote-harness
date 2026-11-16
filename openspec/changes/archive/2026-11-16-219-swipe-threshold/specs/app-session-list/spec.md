## MODIFIED Requirements

### Requirement: Swipe actions and action sheet
Each session row SHALL support swipe actions: swipe left reveals **More** and **Close** (danger; **Hide** for read-only sessions); swipe right reveals **Mute** / **Unmute** (accent) and **Pin** / **Unpin**. The row SHALL follow the finger and MAY be dragged past the revealed buttons. A swipe that is released before the full-swipe distance SHALL only reveal the buttons (or close the row again) and never run an action, also while the row animates open or closed. The full-swipe distance SHALL be half the row's width and never less than the revealed buttons plus 24 pt, so a row resting open never reaches it. Releasing the finger past that distance SHALL run the outermost action of that side (Mute / Unmute on the right swipe, Close or Hide on the left swipe) and close the row; while the drag is past the distance, the outermost action SHALL stretch to fill the space. The phone SHALL vibrate when the drag crosses the full-swipe distance (and lightly when it goes back under it), before the finger is lifted. Only one row MAY be open at a time, and tapping elsewhere or scrolling closes it. Long press on a row and **More** SHALL open the same action sheet: Close session (controllable) or Resume (read-only), Mute / Unmute, Pin to top / Unpin, Clean up worktree (when the session's folder is a worktree, with its path and change count), Copy folder path, Hide from list (read-only). Close SHALL open a confirmation sheet that explains the graceful sequence, warns more strongly when the session is running or waiting, and offers the worktree cleanup with its outcomes; "Discard" requires a second confirmation. The session screen's More options menu SHALL also offer Close session.

#### Scenario: Swipe to close
- **WHEN** the user drags a running session to the left past half the row's width and lifts the finger
- **THEN** the phone vibrates as the drag crosses the distance, and on release the close confirmation opens with the stronger warning

#### Scenario: Short swipe only reveals the buttons
- **WHEN** the user drags a row about 80 pt to the right, or flicks it, and lifts the finger
- **THEN** the row springs open showing Mute and Pin, and the session is not muted

#### Scenario: Short swipe on a read-only session
- **WHEN** the user drags a read-only session a short way to the left and lifts the finger
- **THEN** the row springs open showing More and Hide, and the session stays in the list

#### Scenario: Back under the distance before releasing
- **WHEN** the user drags past the full-swipe distance, moves back under it and lifts the finger
- **THEN** no action runs and the row rests open with its buttons

#### Scenario: Swipe to mute
- **WHEN** the user swipes a row to the right and taps Mute
- **THEN** the session is muted (the row shows the muted glyph) and the row closes

#### Scenario: Read-only session
- **WHEN** the user long-presses a read-only session
- **THEN** the sheet offers Resume and Hide from list instead of Close session

#### Scenario: Close with a dirty worktree
- **WHEN** the user closes a session whose worktree has 2 modified files and 3 unpushed commits and ticks "Also delete the worktree"
- **THEN** the sheet shows both counts and offers "Commit & push, then delete", "Discard changes and delete…" (with a second confirmation) and "Keep the worktree, just close"

### Requirement: Pinned and hidden sessions
Pinned sessions SHALL appear first in the list, in the chosen order among themselves; hidden sessions SHALL leave the list until they become live again (controllable and not ended), which also clears the hidden flag. Both are stored on the device. Hiding a session (a full swipe, the Hide button or Hide from list in the action sheet) SHALL show "Session hidden" with **Undo** at the bottom of the list for 5 seconds, announced to screen readers; Undo SHALL bring the session back where it was. Hiding another session replaces the bar with the newer one.

#### Scenario: Pin
- **WHEN** the user pins an idle session while the list is sorted by recency
- **THEN** it moves to the top and stays there after relaunching the app

#### Scenario: Hidden session resumed on the computer
- **WHEN** a hidden ended session becomes controllable again
- **THEN** it reappears in the list

#### Scenario: Undo a hide
- **WHEN** the user hides a read-only session with a full swipe and taps Undo within 5 seconds
- **THEN** the session is back in the list and stays there after relaunching the app

#### Scenario: Undo expires
- **WHEN** the user hides a session and does nothing for 5 seconds
- **THEN** the bar goes away and the session stays hidden
