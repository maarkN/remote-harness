import { describe, expect, test } from 'vitest'
import {
  ACTION_WIDTH,
  armedSide,
  fullSwipeDistance,
  IDLE_SWIPE,
  panelWidth,
  releaseSwipe,
  startSwipe,
  stretchedWidth,
  trackArm,
} from './swipe'

const MARGIN = 16
const PANEL = panelWidth(2, MARGIN)

describe('panelWidth', () => {
  test('two actions and the row margin: 168 pt', () => {
    expect(ACTION_WIDTH).toBe(76)
    expect(PANEL).toBe(168)
  })
})

describe('fullSwipeDistance', () => {
  test('half of the row on a phone', () => {
    expect(fullSwipeDistance(393, PANEL)).toBe(196.5)
  })

  test('never closer than the panel plus 24 pt on a narrow row', () => {
    expect(fullSwipeDistance(320, PANEL)).toBe(192)
  })
})

describe('armedSide', () => {
  test('#559: the row resting open, on either side, never arms the full swipe', () => {
    for (const width of [320, 375, 393, 440, 1024]) {
      const distance = fullSwipeDistance(width, PANEL)
      expect(armedSide(PANEL, distance)).toBeNull()
      expect(armedSide(-PANEL, distance)).toBeNull()
    }
  })

  test('past the distance arms the side being revealed', () => {
    const distance = fullSwipeDistance(393, PANEL)
    expect(armedSide(200, distance)).toBe('start')
    expect(armedSide(-200, distance)).toBe('end')
    expect(armedSide(196, distance)).toBeNull()
  })
})

describe('stretchedWidth', () => {
  test('the panel keeps its width until the row passes it', () => {
    expect(stretchedWidth(80, 'start', 2, MARGIN)).toBe(152)
    expect(stretchedWidth(PANEL, 'start', 2, MARGIN)).toBe(152)
  })

  test('past the panel it fills the space on its own side only', () => {
    expect(stretchedWidth(216, 'start', 2, MARGIN)).toBe(200)
    expect(stretchedWidth(-216, 'end', 2, MARGIN)).toBe(200)
    expect(stretchedWidth(216, 'end', 2, MARGIN)).toBe(152)
  })
})

describe('release tracker', () => {
  test('a drag released while armed fires that side', () => {
    const armed = trackArm(startSwipe(), 'start', true)
    expect(releaseSwipe(armed)).toEqual({ fire: 'start', next: IDLE_SWIPE })
  })

  test('a drag that went back under the distance fires nothing', () => {
    const back = trackArm(trackArm(startSwipe(), 'end', true), 'end', false)
    expect(releaseSwipe(back).fire).toBeNull()
  })

  test('the animation after the release never arms or fires (#559)', () => {
    // The finger lifted before the distance; the spring then crosses it on the way open.
    const released = releaseSwipe(startSwipe()).next
    const animated = trackArm(released, 'start', true)
    expect(animated).toBe(released)
    expect(releaseSwipe(animated).fire).toBeNull()
  })

  test('disarming the other side keeps the armed one', () => {
    const armed = trackArm(startSwipe(), 'start', true)
    expect(trackArm(armed, 'end', false)).toBe(armed)
  })
})
