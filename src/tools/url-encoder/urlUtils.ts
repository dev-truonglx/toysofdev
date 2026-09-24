export interface UrlSegment {
  text: string;
  isChanged: boolean;
  original?: string;
  inputStart: number;
  inputEnd: number;
}

/**
 * Parses an encoded URL string into segments, identifying characters that were decoded and tracking input ranges.
 */
export function parseUrlDecode(input: string, fullUrlMode: boolean = false): UrlSegment[] {
  if (!input) return [];

  const decodeFn = fullUrlMode ? decodeURI : decodeURIComponent;
  const segments: UrlSegment[] = [];

  const percentRegex = /(%[0-9a-fA-F]{2})+/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = percentRegex.exec(input)) !== null) {
    if (match.index > lastIndex) {
      const literal = input.slice(lastIndex, match.index);
      const start = lastIndex;
      const end = match.index;
      if (segments.length > 0 && !segments[segments.length - 1].isChanged) {
        segments[segments.length - 1].text += literal;
        segments[segments.length - 1].inputEnd = end;
      } else {
        segments.push({ text: literal, isChanged: false, inputStart: start, inputEnd: end });
      }
    }

    const percentBlock = match[0];
    const hexBytes = percentBlock.match(/%[0-9a-fA-F]{2}/g) || [];
    let bIdx = 0;
    let currentInputPos = match.index;

    while (bIdx < hexBytes.length) {
      let decodedSuccessfully = false;

      for (let len = 1; len <= 4 && bIdx + len <= hexBytes.length; len++) {
        const chunk = hexBytes.slice(bIdx, bIdx + len).join("");
        try {
          const decoded = decodeFn(chunk);
          if (decoded !== chunk) {
            const start = currentInputPos;
            const end = currentInputPos + chunk.length;
            segments.push({
              text: decoded,
              isChanged: true,
              original: chunk,
              inputStart: start,
              inputEnd: end,
            });
            currentInputPos = end;
            bIdx += len;
            decodedSuccessfully = true;
            break;
          }
        } catch {
          // URIError - try next byte length
        }
      }

      if (!decodedSuccessfully) {
        const unparsedByte = hexBytes[bIdx];
        const start = currentInputPos;
        const end = currentInputPos + unparsedByte.length;
        if (segments.length > 0 && !segments[segments.length - 1].isChanged) {
          segments[segments.length - 1].text += unparsedByte;
          segments[segments.length - 1].inputEnd = end;
        } else {
          segments.push({ text: unparsedByte, isChanged: false, inputStart: start, inputEnd: end });
        }
        currentInputPos = end;
        bIdx++;
      }
    }

    lastIndex = match.index + percentBlock.length;
  }

  if (lastIndex < input.length) {
    const trailing = input.slice(lastIndex);
    const start = lastIndex;
    const end = input.length;
    if (segments.length > 0 && !segments[segments.length - 1].isChanged) {
      segments[segments.length - 1].text += trailing;
      segments[segments.length - 1].inputEnd = end;
    } else {
      segments.push({ text: trailing, isChanged: false, inputStart: start, inputEnd: end });
    }
  }

  return segments;
}

/**
 * Parses a plain text string into segments, identifying sequences that were encoded and tracking input ranges.
 */
export function parseUrlEncode(input: string, fullUrlMode: boolean = false): UrlSegment[] {
  if (!input) return [];

  const encodeFn = fullUrlMode ? encodeURI : encodeURIComponent;
  const segments: UrlSegment[] = [];
  const characters = Array.from(input);
  let currentInputPos = 0;

  for (const char of characters) {
    const encoded = encodeFn(char);
    const charLen = char.length;
    const start = currentInputPos;
    const end = currentInputPos + charLen;

    if (encoded !== char) {
      segments.push({
        text: encoded,
        isChanged: true,
        original: char,
        inputStart: start,
        inputEnd: end,
      });
    } else {
      if (segments.length > 0 && !segments[segments.length - 1].isChanged) {
        segments[segments.length - 1].text += char;
        segments[segments.length - 1].inputEnd = end;
      } else {
        segments.push({ text: char, isChanged: false, inputStart: start, inputEnd: end });
      }
    }
    currentInputPos = end;
  }

  return segments;
}
