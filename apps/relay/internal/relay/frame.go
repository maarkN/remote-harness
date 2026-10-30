package relay

import (
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"regexp"
)

// Frame types on the daemon connection. Device connections carry raw messages only.
const (
	frameChallenge byte = 0x01 // relay → daemon: 32 random bytes
	frameHello     byte = 0x02 // daemon → relay: Ed25519 public key + signature of the challenge
	frameReady     byte = 0x03 // relay → daemon: the 16-byte daemon ID, the room is open
	frameOpen      byte = 0x10 // relay → daemon: a device joined on the channel
	frameData      byte = 0x11 // both: one device message on the channel
	frameClose     byte = 0x12 // both: the channel closed, with a u16 close code
)

// WebSocket close codes the relay uses (4100–4199 are passed through from the daemon).
const (
	CodeNormal           = 1000
	CodeTooBig           = 1009
	CodeRestart          = 1012
	CodeBadFrame         = 4000
	CodeAuthFailed       = 4001
	CodeDroppedByDaemon  = 4003
	CodeDaemonOffline    = 4004
	CodeHandshakeTimeout = 4008
	CodeReplaced         = 4009
	CodeIdle             = 4010
	CodeRoomFull         = 4030
	CodeSlowDevice       = 4031
	codeDaemonMin        = 4100
	codeDaemonMax        = 4199
)

const (
	challengeSize = 32
	helloSize     = 1 + ed25519.PublicKeySize + ed25519.SignatureSize
	headerSize    = 5
	daemonIDSize  = 16
)

// challengeContext prefixes the signed challenge so the signature means nothing elsewhere.
var challengeContext = []byte("remote-harness relay v1\x00")

var daemonIDPattern = regexp.MustCompile(`^[0-9a-f]{32}$`)

var errBadFrame = errors.New("malformed frame")

// DaemonID is the first 16 bytes of SHA-256 of the daemon's Ed25519 relay public key, in hex.
func DaemonID(pub ed25519.PublicKey) string {
	sum := sha256.Sum256(pub)
	return hex.EncodeToString(sum[:daemonIDSize])
}

func validDaemonID(id string) bool { return daemonIDPattern.MatchString(id) }

// SignChallenge is what a daemon answers to a challenge (used by tests and documented for clients).
func SignChallenge(priv ed25519.PrivateKey, challenge []byte) []byte {
	hello := make([]byte, 0, helloSize)
	hello = append(hello, frameHello)
	hello = append(hello, priv.Public().(ed25519.PublicKey)...)
	return append(hello, ed25519.Sign(priv, challengeMessage(challenge))...)
}

func challengeMessage(challenge []byte) []byte {
	return append(append([]byte{}, challengeContext...), challenge...)
}

// verifyHello checks a daemon's answer and returns its daemon ID.
func verifyHello(msg, challenge []byte) (string, bool) {
	if len(msg) != helloSize || msg[0] != frameHello {
		return "", false
	}
	pub := ed25519.PublicKey(msg[1 : 1+ed25519.PublicKeySize])
	sig := msg[1+ed25519.PublicKeySize:]
	if !ed25519.Verify(pub, challengeMessage(challenge), sig) {
		return "", false
	}
	return DaemonID(pub), true
}

func encodeFrame(kind byte, channel uint32, rest []byte) []byte {
	f := make([]byte, headerSize+len(rest))
	f[0] = kind
	binary.BigEndian.PutUint32(f[1:headerSize], channel)
	copy(f[headerSize:], rest)
	return f
}

func encodeClose(channel uint32, code uint16) []byte {
	return encodeFrame(frameClose, channel, binary.BigEndian.AppendUint16(nil, code))
}

// decodeFrame splits a frame from the daemon. Only DATA and CLOSE may come from the daemon.
func decodeFrame(f []byte) (kind byte, channel uint32, rest []byte, err error) {
	if len(f) < headerSize {
		return 0, 0, nil, errBadFrame
	}
	kind, channel, rest = f[0], binary.BigEndian.Uint32(f[1:headerSize]), f[headerSize:]
	switch kind {
	case frameData:
	case frameClose:
		if len(rest) != 2 {
			return 0, 0, nil, errBadFrame
		}
	default:
		return 0, 0, nil, errBadFrame
	}
	return kind, channel, rest, nil
}

// deviceCloseCode maps the code a daemon asked for to the one sent to the device.
func deviceCloseCode(code uint16) int {
	if code >= codeDaemonMin && code <= codeDaemonMax {
		return int(code)
	}
	return CodeDroppedByDaemon
}
