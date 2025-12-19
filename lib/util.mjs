// @ts-check

/**
 * @param {number} value 
 * @param {number} min 
 * @param {number} max 
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
};

/**
 * @template {Object} T
 * @param {T} obj 
 */
export function keys(obj) {
  return /** @type {(keyof T)[]} */ (Object.keys(obj));
};

/**
 * @typedef {string | { value: string }} StringParserInput
 */

/**
 * @param {StringParserInput} value 
 */
function normalizeStringParserInput(value) {
  return typeof value === 'string' ? value : value.value;
}

/**
 * @param {StringParserInput} value 
 */
export function parsePositiveInt(value) {
  value = normalizeStringParserInput(value);
  const str = value.replaceAll(/[^\d]/g, '');
  return str.length === 0 ? null : Number(str);
};

/**
 * @param {StringParserInput} value 
 */
export function parsePositiveFloat(value) {
  value = normalizeStringParserInput(value);
  let str = value.replaceAll(/[^\d.]/g, '');
  const slices = str.split('.');
  str = slices.slice(0, 2).join('.') + slices.slice(2).join();
  return str.length === 0 ? null : Number(str);
}

/**
 * Parses an offset value.
 * 
 * See https://www.w3.org/TR/smil-animation/#Timing-OffsetValueSyntax.
 * 
 * Changes to the pattern described by W3C:
 * - Whitespace only allowed in lead, trail and after sign -> Whitespace allowed anywhere
 * - Minutes must be two digits -> Allows single digit as well if there's no hours specified
 * - Minutes metric is only 'min' -> Allow 'm' for minutes as well
 * - Requires a leading digit before the fraction -> Optional
 * 
 * @param {StringParserInput} value 
 * clock-values instead.
 * @returns {{
 *   seconds: number,
 *   toStringRep: (seconds: number, allowNoMetric: boolean = true, allowExplicityPlusSign = true) => string,
 *   timecountMetric: string?,
 * }?} The parsed time in seconds and a function to create a string representation for it matching the input, or null
 * if not a valid clock value.
 */
export function parseOffsetValue(value) {
  value = normalizeStringParserInput(value);
  value = value.replaceAll(/\s+/g, '');

  /**
   * @param {number} sign 
   * @param {boolean} allowPlus 
   */
  function getSignStr(sign, allowPlus) {
    return sign < 0 ? '-' : allowPlus ? '+' : '';
  }

  const clockMatch = /^([+-]?)(?:(\d+):)?([0-5]\d|(?<!:)\d):([0-5]\d(?:\.\d+)?)$/.exec(value);
  if (clockMatch !== null) {
    const sign = clockMatch[1] === '-' ? -1 : 1;
    const plusSignSpecified = clockMatch[1] === '+';
    const hours = Number(clockMatch[2] ?? '0');
    const minutes = Number(clockMatch[3]);
    const seconds = Number(clockMatch[4]);

    return {
      seconds: sign * ((hours * 60 + minutes) * 60 + seconds),
      toStringRep: (s, _, allowExplicityPlusSign = true) => {
        const sg = Math.sign(s);
        s *= sg;
        const h = Math.floor(s / 3600);
        s -= h * 3600;
        const m = Math.floor(s / 60);
        s -= m * 60;
        return getSignStr(sg, plusSignSpecified && allowExplicityPlusSign) + [h, m, s].filter(n => n > 0).join(':');
      },
      timecountMetric: null,
    };
  }

  const timecountMatch = /^([+-]?)(\d+(?:\.\d+)?|\.\d+)(h|min|s|ms|m)?$/i.exec(value);
  if (timecountMatch !== null) {
    const sign = timecountMatch[1] === '-' ? -1 : 1;
    const plusSignSpecified = timecountMatch[1] === '+';
    const val = Number(timecountMatch[2]);
    let metric = timecountMatch[3]?.toLowerCase() ?? '';

    if (metric === 'm') {
      metric = 'min';
    }

    const multiplier = {
      'h': 3600,
      'min': 60,
      's': 1,
      'ms': 0.001,
    }[metric] ?? 1;

    return {
      seconds: sign * val * multiplier,
      toStringRep: (s, allowNoMetric = true, allowExplicityPlusSign = true) =>
        getSignStr(Math.sign(s), plusSignSpecified && allowExplicityPlusSign) +
        String(Math.abs(s) / multiplier) +
        (allowNoMetric || metric.length > 0 ? metric : 's'),
      timecountMetric: metric,
    };
  }

  return null;
};

/**
 * @param {string | Blob} file Blob or URL of blob.
 * @param {string} fileName 
 */
export function saveFile(file, fileName) {
  const link = document.createElement('a');
  link.href = typeof file === 'string' ? file : URL.createObjectURL(file);
  link.download = fileName;
  link.click();
};