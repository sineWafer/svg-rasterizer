// @ts-check

/**
 * @param {number} value 
 */
function num16BitToLitEndianBytes(value) {
  return [value & 0xff, (value >>> 8) & 0xff];
}

/**
 * @param {number} value 
 */
function num32BitToLitEndianBytes(value) {
  return [
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  ];
}

/**
 * @param {Date} date 
 */
function toMsDosDate16Bit(date) {
  // https://learn.microsoft.com/windows/win32/api/winbase/nf-winbase-dosdatetimetofiletime
  return date.getDate() |
    ((date.getMonth() + 1) << 5) |
    ((date.getFullYear() - 1980) << 9);
}

/**
 * @param {Date} date 
 */
function toMsDosTime16Bit(date) {
  // https://learn.microsoft.com/windows/win32/api/winbase/nf-winbase-dosdatetimetofiletime
  return Math.floor(date.getSeconds() / 2) |
    (date.getMinutes() << 5) |
    (date.getHours() << 11);
}

const utf8Encoder = new TextEncoder();

const crc32Lookup = [...Array(256).keys()].map(index => {
  let v = index;
  for (let i = 0; i < 8; ++i) {
    v = v & 1 ? (v >>> 1) ^ 0xedb88320 : v >>> 1;
  }
  return v;
});

/**
 * @param {Uint8Array} bytes 
 */
function computeCrc32(bytes) {
  let checksum = 0xffffffff;

  for (let i = 0; i < bytes.length; ++i) {
    checksum = crc32Lookup[(checksum ^ bytes[i]) & 0xff] ^ (checksum >>> 8);
  }

  return ~checksum;
}

export default class ZipWriter {
  // See https://pkwaredownloads.blob.core.windows.net/pem/APPNOTE.txt

  constructor() {
      /** @private @type {(Uint8Array<ArrayBuffer> | Blob)[]} */ this.data = [];
      /** @private */ this.dataByteLength = 0;
      /** @private @type {Uint8Array<ArrayBuffer>[]} */ this.centralDirectoryData = [];
      /** @private */ this.centralDirectoryDataByteLength = 0;
      /** @private */ this.includedFileNames = new Set();
  }

  /**
   * Appends a file.
   * 
   * @param {Blob} data 
   * @param {string} fileName 
   */
  async appendFile(data, fileName) {
    const inputFileName = fileName;
    fileName = fileName.replaceAll('\\', '/');
    fileName = fileName.replaceAll(/[^\/0-9a-zA-Z_.~-]/g, '_'); // FUTURE: allow unicode?

    if (fileName.length === 0) {
      throw new Error('File name cannot be empty');
    }
    if (!/^(?:(?:(?<!^)\/)?[^\/]+)*$/.test(fileName)) {
      throw new Error(`Invalid file name: '${inputFileName}' (normalized to '${fileName}')`);
    }
    if (this.includedFileNames.has(fileName)) {
      throw new Error('Cannot include multiple files with the same name');
    }
    this.includedFileNames.add(fileName);

    const fileNameBytes = utf8Encoder.encode(fileName); // Will produce valid ASCII since chars are filtered
    const dataSize2Bytes = num32BitToLitEndianBytes(data.size);
    const date = new Date();
    const byteOffset = this.dataByteLength;

    const commonHeaderBytes = [
      0x0a, 0x00, // Version needed to extract: 10 = 1.0 = minimum, compatibility: 0 (MS-DOS)
      0x00, 0x00, // General purpose bit flag, unused
      0x00, 0x00, // Compression method: stored (no compression)
      ...num16BitToLitEndianBytes(toMsDosTime16Bit(date)), // Last modified time
      ...num16BitToLitEndianBytes(toMsDosDate16Bit(date)), // Last modified date
      ...num32BitToLitEndianBytes(computeCrc32(new Uint8Array(await data.arrayBuffer()))), // CRC 32
      ...dataSize2Bytes, // Compressed size (not using compression here)
      ...dataSize2Bytes, // Uncompressed size
      ...num16BitToLitEndianBytes(fileNameBytes.length), // File name length
      0x00, 0x00, // Extra field length, none
    ];

    const localFileHeaderBytes = [
      0x50, 0x4b, 0x03, 0x04, // Local file header signature
      ...commonHeaderBytes,
    ];

    const centralDirectoryFileHeaderBytes = [
      0x50, 0x4b, 0x01, 0x02, // Central directory file header signature
      0x0a, 0x00, // Version made by: 10 = 1.0 = minimum, compatibility: 0 (MS-DOS)
      ...commonHeaderBytes,
      0x00, 0x00, // File comment length
      0x00, 0x00, // Disk where file starts
      0x00, 0x00, // Internal file attributes
      0x00, 0x00, 0x00, 0x00, // External file attributes
      ...num32BitToLitEndianBytes(byteOffset), // Relative offset of local file header from start of disk
    ];

    this.data.push(new Uint8Array(localFileHeaderBytes));
    this.data.push(fileNameBytes);
    this.data.push(data);
    this.dataByteLength += localFileHeaderBytes.length + fileNameBytes.length + data.size;

    this.centralDirectoryData.push(new Uint8Array(centralDirectoryFileHeaderBytes));
    this.centralDirectoryData.push(fileNameBytes);
    this.centralDirectoryDataByteLength += centralDirectoryFileHeaderBytes.length + fileNameBytes.length;
  }

  toBlob() {
    const finalData = [...this.data];
    const fileCountBytes = num16BitToLitEndianBytes(this.includedFileNames.size);

    finalData.push(...this.centralDirectoryData);
    finalData.push(new Uint8Array([
      0x50, 0x4b, 0x05, 0x06, // End of central directory record signature
      0x00, 0x00, // Number of this disk
      0x00, 0x00, // Number of the disk with the start of the central directory
      ...fileCountBytes, // Number of entries in the central directory of this disk
      ...fileCountBytes, // Number of entries in the central directory
      ...num32BitToLitEndianBytes(this.centralDirectoryDataByteLength), // Size of the central directory
      ...num32BitToLitEndianBytes(this.dataByteLength), // Offset of the central directory from starting disk
      0x00, 0x00, // ZIP file comment length
    ]));
    return new Blob(finalData, { type: 'application/zip' });
  }
};