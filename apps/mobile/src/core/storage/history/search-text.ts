/**
 * The text the history cache indexes for full-text search. It lives in the protocol package so the
 * daemon's `transcript.search` reads the very same text and both halves of the search agree.
 */
export { searchText } from '@remote-harness/protocol'
