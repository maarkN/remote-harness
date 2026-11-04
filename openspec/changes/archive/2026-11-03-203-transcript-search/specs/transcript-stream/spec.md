## ADDED Requirements

### Requirement: Transcript search
`transcript.search { query, sessionId?, limit, cursor? }` SHALL answer `transcript.searchResult` with the entries whose searchable text contains every word of `query` as a whole word, case- and accent-insensitive. The searchable text of an entry is the same the device's history cache indexes (prompt, reply and thinking text, tool name and its main input fields, tool result content, system text), so both halves of the search find the same entries. Without `sessionId` the daemon SHALL search the transcripts of every session it knows (not their subagents), newest session first and newest entry first inside each session; with `sessionId` only that session's, and an unknown `sessionId` MUST be answered with `not_found`. Each hit SHALL carry the session id, the entry's `key`, `cursor`, `index`, `kind` and `timestamp`, a snippet of at most 160 characters of the searchable text around the first matched word, the offsets of the matched words inside the snippet, and whether the snippet is cut at its start or end. A page SHALL hold at most `limit` hits (max. 50, default 20) and read at most 20 transcripts; `nextCursor` SHALL say where the next page starts and be `null` once every transcript was searched. A transcript file that no longer exists MUST be skipped, a query without any word MUST return no hits, and the daemon MUST NOT log the query, the sessions searched or the hits.

#### Scenario: Search across sessions
- **WHEN** the app sends `transcript.search` with `query` "connection pool" and two sessions mention it, the newer one in a reply and the older one in a prompt
- **THEN** the reply lists the newer session's hit first, each hit with the entry's key, cursor and kind, a snippet containing "connection pool" and the offsets of both words

#### Scenario: Find in one conversation
- **WHEN** the app sends `transcript.search` with `query` "pool" and the `sessionId` of a session whose transcript has the word on lines 3 and 7
- **THEN** the reply has the hit of line 7, then the hit of line 3, and `nextCursor` is `null`

#### Scenario: Paging
- **WHEN** a search with `limit` 1 has three hits in two sessions
- **THEN** each page carries one hit and a `nextCursor`, the following page sent with that cursor continues after it, and the third page's `nextCursor` is `null`

#### Scenario: Accents and case
- **WHEN** a prompt reads "Configuração do café" and the query is "CAFE"
- **THEN** the prompt is a hit whose range covers "café"; the query "caf" is not a hit (words match whole)

#### Scenario: Missing transcript
- **WHEN** an ended session's transcript file was deleted on the computer
- **THEN** the search skips that session and still answers with the other sessions' hits

#### Scenario: Unknown session
- **WHEN** `transcript.search` names a `sessionId` the daemon does not know
- **THEN** the request is answered with an error of code `not_found`
