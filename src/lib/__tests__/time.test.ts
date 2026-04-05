import { describe, it, expect } from 'vitest'
import {
  parseTime,
  minutesSinceStart,
  timeToY,
  durationToHeight,
  formatTime,
  formatTimeRange,
  durationMinutes,
  shiftTime,
  timelineTotalHeight,
  PIXELS_PER_HOUR,
} from '../time'

describe('parseTime', () => {
  it('parses midnight', () => {
    expect(parseTime('00:00')).toBe(0)
  })
  it('parses standard time', () => {
    expect(parseTime('08:30')).toBe(510)
  })
  it('parses end of day', () => {
    expect(parseTime('23:59')).toBe(1439)
  })
})

describe('minutesSinceStart', () => {
  it('returns 0 for day start', () => {
    expect(minutesSinceStart('06:00', 6)).toBe(0)
  })
  it('returns correct offset', () => {
    expect(minutesSinceStart('08:30', 6)).toBe(150)
  })
  it('clamps before start to 0', () => {
    expect(minutesSinceStart('05:00', 6)).toBe(0)
  })
})

describe('timeToY', () => {
  it('converts to pixels correctly', () => {
    expect(timeToY('07:00', 6, 80)).toBe(80)
  })
  it('handles midnight at day start', () => {
    expect(timeToY('00:00', 0, 80)).toBe(0)
  })
  it('handles half hours', () => {
    expect(timeToY('06:30', 6, 80)).toBe(40)
  })
})

describe('timelineTotalHeight', () => {
  it('covers 24 hours at default scale', () => {
    expect(timelineTotalHeight(PIXELS_PER_HOUR)).toBe(24 * PIXELS_PER_HOUR)
  })
})

describe('durationToHeight', () => {
  it('converts 60 min to pixelsPerHour', () => {
    expect(durationToHeight(60, 80)).toBe(80)
  })
  it('converts 30 min to half', () => {
    expect(durationToHeight(30, 80)).toBe(40)
  })
})

describe('formatTime', () => {
  it('formats 24h times', () => {
    expect(formatTime('08:30')).toBe('08:30')
    expect(formatTime('14:00')).toBe('14:00')
    expect(formatTime('12:00')).toBe('12:00')
    expect(formatTime('00:00')).toBe('00:00')
  })
})

describe('formatTimeRange', () => {
  it('formats a range', () => {
    expect(formatTimeRange('09:00', '10:30')).toBe('09:00 – 10:30')
  })
})

describe('durationMinutes', () => {
  it('calculates duration', () => {
    expect(durationMinutes('09:00', '10:30')).toBe(90)
  })
})

describe('shiftTime', () => {
  it('shifts forward', () => {
    expect(shiftTime('09:00', 30)).toBe('09:30')
  })
  it('shifts backward', () => {
    expect(shiftTime('09:00', -30)).toBe('08:30')
  })
  it('clamps to 00:00 floor', () => {
    expect(shiftTime('00:15', -30)).toBe('00:00')
  })
  it('clamps to 23:59 ceiling', () => {
    expect(shiftTime('23:30', 60)).toBe('23:59')
  })
})
