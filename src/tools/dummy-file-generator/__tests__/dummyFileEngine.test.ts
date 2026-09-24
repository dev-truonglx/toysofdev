import { describe, it, expect } from 'vitest';
import { generateDummyBuffer } from '../dummyFileEngine';

describe('dummyFileEngine', () => {
  it('generates valid MP4 buffers with correct signatures and sizes', () => {
    const smallMp4 = generateDummyBuffer({
      sizeBytes: 2246,
      format: 'mp4',
      pattern: 'zeros',
      filename: 'test.mp4',
    });
    expect(smallMp4.length).toBe(2246);
    // Check ftyp header
    expect(smallMp4[4]).toBe(0x66); // 'f'
    expect(smallMp4[5]).toBe(0x74); // 't'
    expect(smallMp4[6]).toBe(0x79); // 'y'
    expect(smallMp4[7]).toBe(0x70); // 'p'

    const largeMp4 = generateDummyBuffer({
      sizeBytes: 10 * 1024,
      format: 'mp4',
      pattern: 'random',
      filename: 'test-10kb.mp4',
    });
    expect(largeMp4.length).toBe(10 * 1024);
    expect(largeMp4[4]).toBe(0x66);
    expect(largeMp4[5]).toBe(0x74);
    expect(largeMp4[6]).toBe(0x79);
    expect(largeMp4[7]).toBe(0x70);

    // Padding 'free' box
    const freeOffset = 2246;
    expect(largeMp4[freeOffset + 4]).toBe(0x66); // 'f'
    expect(largeMp4[freeOffset + 5]).toBe(0x72); // 'r'
    expect(largeMp4[freeOffset + 6]).toBe(0x65); // 'e'
    expect(largeMp4[freeOffset + 7]).toBe(0x65); // 'e'
  });

  it('generates PDF, ZIP, PNG correctly', () => {
    const pdf = generateDummyBuffer({
      sizeBytes: 5 * 1024,
      format: 'pdf',
      pattern: 'zeros',
      filename: 'test.pdf',
    });
    expect(pdf.length).toBe(5 * 1024);
    expect(new TextDecoder().decode(pdf.slice(0, 4))).toBe('%PDF');

    const zip = generateDummyBuffer({
      sizeBytes: 2 * 1024,
      format: 'zip',
      pattern: 'zeros',
      filename: 'test.zip',
    });
    expect(zip.length).toBe(2 * 1024);
    expect(zip[0]).toBe(0x50); // P
    expect(zip[1]).toBe(0x4b); // K

    const png = generateDummyBuffer({
      sizeBytes: 2 * 1024,
      format: 'png',
      pattern: 'zeros',
      filename: 'test.png',
    });
    expect(png.length).toBe(2 * 1024);
    expect(png[0]).toBe(0x89);
    expect(png[1]).toBe(0x50); // P
    expect(png[2]).toBe(0x4e); // N
    expect(png[3]).toBe(0x47); // G
  });
});
