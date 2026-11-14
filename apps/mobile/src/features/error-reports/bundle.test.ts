import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, test } from 'vitest'
import {
  ATTACHMENTS_BUDGET,
  type Attachment,
  attachmentName,
  bundleReport,
  fitsBudget,
  issueBodyNote,
} from './bundle'
import { buildReport, githubIssueUrl } from './format'

const report = buildReport({
  kind: 'manual',
  at: new Date('2026-11-14T10:00:00Z'),
  description: 'The switcher is cut',
  context: {
    appVersion: '1.2.0',
    runtimeVersion: 'abc',
    updateId: null,
    channel: 'production',
    platform: 'ios',
    osVersion: '26.1',
    daemonVersion: '1.2.0',
  },
  entries: [],
})

const attachment = (kind: Attachment['kind'], size: number, name = 'file.jpg'): Attachment => ({
  kind,
  uri: `file:///tmp/${name}`,
  name,
  size,
})

describe('report bundle', () => {
  test('numbered attachment names keep their extension', () => {
    expect(attachmentName(0, attachment('screenshot', 1, 'ReactNative-snapshot-x.jpg'))).toBe(
      'attachments/01-screenshot.jpg',
    )
    expect(attachmentName(11, attachment('video', 1, 'IMG_0042.MOV'))).toBe('attachments/12-video.mov')
    expect(attachmentName(2, attachment('audio', 1, 'recording'))).toBe('attachments/03-audio')
  })

  test('the zip holds report.json with the attachment list, the logs and the files', () => {
    const files = [
      { attachment: attachment('screenshot', 3, 'shot.jpg'), bytes: new Uint8Array([1, 2, 3]) },
      { attachment: attachment('audio', 2, 'note.m4a'), bytes: new Uint8Array([4, 5]) },
    ]
    const logs = [{ name: 'daemon.log', text: '{"msg":"started"}\n', truncated: true }]
    const zip = unzipSync(bundleReport({ report, logs, files }))
    expect(Object.keys(zip).sort()).toEqual([
      'attachments/01-screenshot.jpg',
      'attachments/02-audio.m4a',
      'computer-logs.txt',
      'report.json',
    ])
    const json = JSON.parse(strFromU8(zip['report.json']!)) as Record<string, unknown>
    expect(json.description).toBe('The switcher is cut')
    expect(json.attachments).toEqual([
      { file: 'attachments/01-screenshot.jpg', kind: 'screenshot', size: 3 },
      { file: 'attachments/02-audio.m4a', kind: 'audio', size: 2 },
    ])
    expect(json.computerLogs).toBe(true)
    expect(strFromU8(zip['computer-logs.txt']!)).toBe('== daemon.log (last part) ==\n{"msg":"started"}\n')
    expect(Array.from(zip['attachments/02-audio.m4a']!)).toEqual([4, 5])
  })

  test('without logs there is no logs file', () => {
    const zip = unzipSync(bundleReport({ report, logs: null, files: [] }))
    expect(Object.keys(zip)).toEqual(['report.json'])
    expect((JSON.parse(strFromU8(zip['report.json']!)) as { computerLogs: boolean }).computerLogs).toBe(false)
  })

  test('attachments stay within the budget', () => {
    const half = Math.floor(ATTACHMENTS_BUDGET / 2)
    expect(fitsBudget([attachment('image', half)], half)).toBe(true)
    expect(fitsBudget([attachment('image', half), attachment('image', half)], 1)).toBe(false)
  })

  test('the GitHub issue names the report ID', () => {
    const url = githubIssueUrl(report, 'https://github.com/x/y/issues/new', 'abc-123')
    const body = decodeURIComponent(url.split('&body=')[1] ?? '')
    expect(body.startsWith(issueBodyNote('abc-123'))).toBe(true)
  })
})
