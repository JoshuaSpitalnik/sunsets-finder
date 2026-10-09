import { describe, expect, it } from 'vitest'
import { parseCommonsDate, parsePhotos } from './photos'

describe('parseCommonsDate', () => {
  it('parses EXIF-style dates with time', () => {
    const d = parseCommonsDate('2014-01-01 16:06:06')!
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2014, 0, 1, 16])
  })

  it('parses day.month.year (PikiWiki style)', () => {
    const d = parseCommonsDate('2.9.2024')!
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2024, 8, 2])
  })

  it('strips HTML and rejects garbage', () => {
    expect(parseCommonsDate('<time datetime="2019-05-03">3 May 2019</time>')?.getFullYear()).toBe(2019)
    expect(parseCommonsDate('unknown')).toBeUndefined()
    expect(parseCommonsDate(undefined)).toBeUndefined()
  })
})

describe('parsePhotos', () => {
  it('keeps images in search order and cleans metadata', () => {
    const photos = parsePhotos([
      {
        title: 'File:Jaffa on sunset 02.jpg',
        index: 2,
        imageinfo: [{ thumburl: 'https://t/2.jpg', descriptionurl: 'https://c/2', mime: 'image/jpeg' }],
      },
      {
        title: 'File:Jaffa on sunset 01.jpg',
        index: 1,
        coordinates: [{ lat: 32.05, lon: 34.75 }],
        imageinfo: [
          {
            thumburl: 'https://t/1.jpg',
            descriptionurl: 'https://c/1',
            mime: 'image/jpeg',
            extmetadata: { Artist: { value: '<a href="x">Someone</a>' }, DateTimeOriginal: { value: '2014-01-01 16:06:06' } },
          },
        ],
      },
      { title: 'File:Clip.webm', index: 3, imageinfo: [{ descriptionurl: 'https://c/3', mime: 'video/webm' }] },
    ])
    expect(photos.map((p) => p.title)).toEqual(['Jaffa on sunset 01', 'Jaffa on sunset 02'])
    expect(photos[0].artist).toBe('Someone')
    expect(photos[0].position).toEqual({ lat: 32.05, lng: 34.75 })
    expect(photos[0].takenAt?.getFullYear()).toBe(2014)
  })
})
