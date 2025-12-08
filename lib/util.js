// @ts-check

// @ts-ignore
var lib = lib ?? {};
// @ts-ignore
lib.util = lib.util ?? {};

{
  /**
   * @param {number} value 
   * @param {number} min 
   * @param {number} max 
   */
  lib.util.clamp = (value, min, max) => {
    return Math.max(min, Math.min(value, max));
  }

  /**
   * @template {Object} T
   * @param {T} obj 
   */
  lib.util.keys = (obj) => {
    return /** @type {(keyof T)[]} */ (Object.keys(obj));
  }

  /**
   * Parses an offset value.
   * 
   * See https://www.w3.org/TR/smil-animation/#Timing-OffsetValueSyntax.
   * 
   * Changes to the pattern described by W3C:
   * - Minutes must be two digits -> Allows single digit as well if there's no hours specified
   * - Minutes metric is only 'min' -> Allow 'm' for minutes as well
   * - Requires a leading digit before the fraction -> Optional
   * 
   * @param {string} value 
   * clock-values instead.
   * @returns {{ seconds: number, toStringRep: (seconds: number) => string }?} The parsed time in seconds and a
   * function to create a string representation for it matching the input, or null if not a valid clock value.
   */
  lib.util.parseOffsetValue = (value) => {
    const clockMatch = /^\s*([+-]?)\s*(?:(\d+):)?([0-5]\d|(?<!:)\d):([0-5]\d(?:\.\d+)?)\s*$/.exec(value);
    if (clockMatch !== null) {
      const sign = clockMatch[1] === '-' ? -1 : 1;
      const positiveSignSpecified = clockMatch[1] === '+';
      const hours = Number(clockMatch[2] ?? '0');
      const minutes = Number(clockMatch[3]);
      const seconds = Number(clockMatch[4]);

      return {
        seconds: sign * ((hours * 60 + minutes) * 60 + seconds),
        toStringRep: s => {
          const sg = Math.sign(s);
          s *= sg;
          const h = Math.floor(s / 3600);
          s -= h * 3600;
          const m = Math.floor(s / 60);
          s -= m * 60;
          return (sg < 0 ? '-' : positiveSignSpecified ? '+' : '') + [h, m, s].filter(n => n > 0).join(':');
        },
      };
    }

    const timecountMatch = /^\s*([+-]?)\s*(\d+(?:\.\d+)?|\.\d+)(h|min|m|s|ms)?\s*$/i.exec(value);
    if (timecountMatch !== null) {
      const sign = timecountMatch[1] === '-' ? -1 : 1;
      const positiveSignSpecified = timecountMatch[1] === '+';
      const val = Number(timecountMatch[2]);
      const metric = timecountMatch[3] ?? '';

      let multiplier = {
        'h': 3600,
        'min': 60,
        'm': 60,
        's': 1,
        'ms': 0.001,
      }[metric.toLowerCase()] ?? 1;

      return {
        seconds: sign * val * multiplier,
        toStringRep: s => `${Math.sign(s) < 0 ? '-' : positiveSignSpecified ? '+' : ''}${Math.abs(s) / multiplier}${metric}`
      };
    }

    return null;
  }
}