# performance-monitoring Specification

## Purpose
Lets the user opt in, per device, to sending the app's performance data (start time, frozen frames, JavaScript stalls) to Firebase Performance Monitoring, without session content.

## Requirements

### Requirement: Opt-in performance data
In builds with Firebase, the app SHALL include Firebase Performance Monitoring with collection off until the user turns on "Send performance data" in Settings → Error reports. The choice SHALL be saved per device and applied at every start. The switch MUST NOT be shown in builds without Firebase. Android builds MUST NOT apply the Gradle plugin that instruments network requests. Traces MUST NOT carry session content, prompts, paths, project or session names, or the daemon's address, and the app MUST NOT send Analytics events.

#### Scenario: Default
- **WHEN** the app is installed and started
- **THEN** no performance data is sent

#### Scenario: Turned on
- **WHEN** the user turns on "Send performance data"
- **THEN** Firebase collects the automatic traces and the app's custom traces from then on

### Requirement: App-ready trace
The app SHALL measure once per run the time from the start of its JavaScript to the first established daemon connection, or a timeout when no connection opens within 60 seconds, and keep it in this run's local numbers. With collection on, it SHALL also record it as an `app_ready` trace whose metric `ready_ms` is that time, with the attribute `outcome` `connected` or `timeout`.

#### Scenario: Slow start
- **WHEN** collection is on and the daemon connection opens 4 seconds after start
- **THEN** an `app_ready` trace with `ready_ms` of about 4000 and `outcome: connected` is recorded

#### Scenario: Collection off
- **WHEN** collection is off and the daemon connection opens 4 seconds after start
- **THEN** no trace is sent and the local numbers show an app ready time of about 4000 ms

### Requirement: JavaScript responsiveness trace
The app SHALL measure how late a 500 ms timer fires while it is active. A delay of 1 second or more counts as a stall. The stalls of the whole run SHALL be kept in this run's local numbers (count, 5 s or more, longest, total). With collection on, each stretch in the foreground SHALL also be recorded as a `js_responsiveness` trace with the metrics `stalls` (1 s or more), `long_stalls` (5 s or more), `stall_max_ms` and `stall_total_ms`, and the attribute `layout`.

#### Scenario: Frozen for six seconds
- **WHEN** collection is on, the JavaScript thread is blocked for six seconds and the app then goes to the background
- **THEN** the trace has `stalls: 1`, `long_stalls: 1` and `stall_max_ms` of about 6000, and the local numbers count the same stall

### Requirement: Conversation render measurement
Each time a conversation is opened, the app SHALL measure the time from opening it until its list first draws items, together with the number of entries drawn, and keep the last measurements in this run's local numbers. With collection on, each one SHALL also be recorded as a `conversation_ready` trace with the metrics `render_ms` and `entries`. Nothing about the conversation other than these numbers SHALL be recorded.

#### Scenario: Long conversation
- **WHEN** the user opens a conversation with 5,000 entries and its list draws after 900 ms
- **THEN** the local numbers show a conversation render of about 900 ms for that number of entries

### Requirement: Conversation scroll measurement
While the user scrolls a conversation, the app SHALL count the frames it sees, the frames dropped (a frame that takes longer than one and a half display frames counts the frames it skipped) and the longest frame, and add them to this run's local numbers. With collection on, the counts of each conversation visit with scrolling SHALL also be recorded as a `conversation_scroll` trace with the metrics `frames`, `dropped` and `frame_max_ms`.

#### Scenario: Janky scroll
- **WHEN** the user scrolls a conversation for one second at 60 Hz and two frames take 50 ms each
- **THEN** the local numbers count those frames, 4 dropped frames and a longest frame of about 50 ms

### Requirement: Local performance numbers
The app SHALL show this run's numbers (app ready, JavaScript stalls, the last conversation renders and the conversation scroll counts) in a "Performance (this run)" card in Settings, in every build, and SHALL offer to copy them as one row of a Markdown table together with the app version and the layout class. The local numbers SHALL stay in memory on the device, SHALL NOT be sent anywhere by the app, and SHALL start empty on every run.

#### Scenario: Copy for a pull request
- **WHEN** the developer opens a long conversation, scrolls it and taps "Copy" in Settings → Performance (this run)
- **THEN** the clipboard holds a Markdown table row with the app version, the layout class and the numbers of this run

#### Scenario: Nothing measured yet
- **WHEN** the app has just started and no conversation has been opened
- **THEN** the card shows the conversation measurements as not measured yet
