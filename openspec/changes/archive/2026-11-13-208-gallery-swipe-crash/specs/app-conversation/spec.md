## MODIFIED Requirements

### Requirement: Images in the conversation
The conversation SHALL show the images of user prompts and tool results as thumbnails of fixed size, below the prompt text and in the tool call (collapsed and in the Output tab). Image data MUST be fetched only when a thumbnail is about to be shown, with at most two fetches at a time, the newest first, fetches dropped when their thumbnail goes away before they start, and a size-capped cache, and a placeholder MUST keep the thumbnail's size while loading so the list does not move. Tapping a thumbnail SHALL open a full-screen viewer with pinch zoom, pan and double tap, closed with a close button, a single tap while not zoomed or the Android back button. The viewer SHALL be a gallery of the message's images: a horizontal swipe while not zoomed (a zoomed image keeps panning), a tap on a thumbnail or the Previous / Next buttons (reachable by VoiceOver / TalkBack) move to the previous or next image, the "N of M" counter follows, zoom resets on the change, a swipe MUST never close the app (in development and release builds alike, on iOS and Android), and a thumbnail strip at the bottom shows the message's images with the current one highlighted, hidden when the message has one image; its thumbnails come from the same cache and fetch queue as the conversation's. The viewer SHALL decode the image at its own resolution, capped at about 16 megapixels, and fit it to the screen, so zoom shows the image's pixels up to its source resolution instead of magnified screen pixels. An image that fails to load SHALL show a localized message and retry when tapped; while the daemon is disconnected it SHALL wait and load once the connection is back. An image over the size limit SHALL show a localized message with its size. All texts and accessibility labels MUST be translated.

#### Scenario: Screenshot in a tool result
- **WHEN** a tool result with an image is shown in the conversation
- **THEN** its thumbnail appears in the tool call and loads when it scrolls into view

#### Scenario: Full screen
- **WHEN** the user taps a thumbnail
- **THEN** the image opens full screen and can be zoomed with a pinch

#### Scenario: Swipe to the next image
- **WHEN** a message has five images, the viewer shows the second at 1× and the user swipes left
- **THEN** the third image shows, the counter reads "3 of 5" and the third thumbnail is highlighted; a swipe while zoomed pans instead

#### Scenario: Swipe in a release build
- **WHEN** a message has three images and, in a release build at 1×, the user swipes left twice, then right three times, then makes a short swipe
- **THEN** the viewer shows the second and the third image, then the second and the first, stays on the first at the last swipe to the right, snaps back after the short swipe, and the app keeps running throughout

#### Scenario: Single image
- **WHEN** the viewer opens the only image of a message
- **THEN** no thumbnail strip is shown and a swipe changes nothing

#### Scenario: Sharp zoom
- **WHEN** the user zooms a 4000 × 3000 screenshot to 3× on a 390-point-wide phone with a 3× screen
- **THEN** every screen pixel shows a distinct image pixel, and a 40-megapixel image is decoded at the cap instead of in full

#### Scenario: Too large
- **WHEN** an image ref is larger than the limit
- **THEN** the thumbnail shows that the image is too large to preview, without fetching it

#### Scenario: Android back
- **WHEN** the viewer is open on Android and the user presses back
- **THEN** the viewer closes and the conversation stays open
