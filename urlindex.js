var urlindex = (function (exports) {
  'use strict';

  const typeofs = [
    'string',
    'number',
    'bigint',
    'symbol'
  ];
  const objectTypeNames = [
    'Function',
    'Generator',
    'AsyncGenerator',
    'GeneratorFunction',
    'AsyncGeneratorFunction',
    'AsyncFunction',
    'Observable',
    'Array',
    'Buffer',
    'Object',
    'RegExp',
    'Date',
    'Error',
    'Map',
    'Set',
    'WeakMap',
    'WeakSet',
    'ArrayBuffer',
    'SharedArrayBuffer',
    'DataView',
    'Promise',
    'URL',
    'HTMLElement',
    'Int8Array',
    'Uint8Array',
    'Uint8ClampedArray',
    'Int16Array',
    'Uint16Array',
    'Int32Array',
    'Uint32Array',
    'Float32Array',
    'Float64Array',
    'BigInt64Array',
    'BigUint64Array'
  ];
  function is(value) {
    if (value === null) {
      return 'null';
    }
    if (value === undefined) {
      return 'undefined';
    }
    if (value === true || value === false) {
      return 'boolean';
    }
    const typeOf = typeof value;
    if (typeofs.includes(typeOf)) {
      return typeOf;
    }
    if (typeOf === 'function') {
      return 'Function';
    }
    if (Array.isArray(value)) {
      return 'Array';
    }
    if (isBuffer$1(value)) {
      return 'Buffer';
    }
    const objectType = getObjectType(value);
    if (objectType) {
      return objectType;
    }
    return 'Object';
  }
  function isBuffer$1(value) {
    return value && value.constructor && value.constructor.isBuffer && value.constructor.isBuffer.call(null, value);
  }
  function getObjectType(value) {
    const objectTypeName = Object.prototype.toString.call(value).slice(8, -1);
    if (objectTypeNames.includes(objectTypeName)) {
      return objectTypeName;
    }
    return undefined;
  }

  class Type {
    constructor(major, name, terminal) {
      this.major = major;
      this.majorEncoded = major << 5;
      this.name = name;
      this.terminal = terminal;
    }
    toString() {
      return `Type[${ this.major }].${ this.name }`;
    }
    compare(typ) {
      return this.major < typ.major ? -1 : this.major > typ.major ? 1 : 0;
    }
  }
  Type.uint = new Type(0, 'uint', true);
  Type.negint = new Type(1, 'negint', true);
  Type.bytes = new Type(2, 'bytes', true);
  Type.string = new Type(3, 'string', true);
  Type.array = new Type(4, 'array', false);
  Type.map = new Type(5, 'map', false);
  Type.tag = new Type(6, 'tag', false);
  Type.float = new Type(7, 'float', true);
  Type.false = new Type(7, 'false', true);
  Type.true = new Type(7, 'true', true);
  Type.null = new Type(7, 'null', true);
  Type.undefined = new Type(7, 'undefined', true);
  Type.break = new Type(7, 'break', true);
  class Token {
    constructor(type, value, encodedLength) {
      this.type = type;
      this.value = value;
      this.encodedLength = encodedLength;
      this.encodedBytes = undefined;
    }
    toString() {
      return `Token[${ this.type }].${ this.value }`;
    }
  }

  const useBuffer = globalThis.process && !globalThis.process.browser && globalThis.Buffer && typeof globalThis.Buffer.isBuffer === 'function';
  const textDecoder = new TextDecoder();
  const textEncoder = new TextEncoder();
  function isBuffer(buf) {
    return useBuffer && globalThis.Buffer.isBuffer(buf);
  }
  function asU8A(buf) {
    if (!(buf instanceof Uint8Array)) {
      return Uint8Array.from(buf);
    }
    return isBuffer(buf) ? new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength) : buf;
  }
  const toString = useBuffer ? (bytes, start, end) => {
    return end - start > 64 ? globalThis.Buffer.from(bytes.subarray(start, end)).toString('utf8') : utf8Slice(bytes, start, end);
  } : (bytes, start, end) => {
    return end - start > 64 ? textDecoder.decode(bytes.subarray(start, end)) : utf8Slice(bytes, start, end);
  };
  const fromString = useBuffer ? string => {
    return string.length > 64 ? globalThis.Buffer.from(string) : utf8ToBytes(string);
  } : string => {
    return string.length > 64 ? textEncoder.encode(string) : utf8ToBytes(string);
  };
  const fromArray = arr => {
    return Uint8Array.from(arr);
  };
  const slice = useBuffer ? (bytes, start, end) => {
    if (isBuffer(bytes)) {
      return new Uint8Array(bytes.subarray(start, end));
    }
    return bytes.slice(start, end);
  } : (bytes, start, end) => {
    return bytes.slice(start, end);
  };
  const concat = useBuffer ? (chunks, length) => {
    chunks = chunks.map(c => c instanceof Uint8Array ? c : globalThis.Buffer.from(c));
    return asU8A(globalThis.Buffer.concat(chunks, length));
  } : (chunks, length) => {
    const out = new Uint8Array(length);
    let off = 0;
    for (let b of chunks) {
      if (off + b.length > out.length) {
        b = b.subarray(0, out.length - off);
      }
      out.set(b, off);
      off += b.length;
    }
    return out;
  };
  const alloc = useBuffer ? size => {
    return globalThis.Buffer.allocUnsafe(size);
  } : size => {
    return new Uint8Array(size);
  };
  function compare(b1, b2) {
    if (isBuffer(b1) && isBuffer(b2)) {
      return b1.compare(b2);
    }
    for (let i = 0; i < b1.length; i++) {
      if (b1[i] === b2[i]) {
        continue;
      }
      return b1[i] < b2[i] ? -1 : 1;
    }
    return 0;
  }
  function utf8ToBytes(string, units = Infinity) {
    let codePoint;
    const length = string.length;
    let leadSurrogate = null;
    const bytes = [];
    for (let i = 0; i < length; ++i) {
      codePoint = string.charCodeAt(i);
      if (codePoint > 55295 && codePoint < 57344) {
        if (!leadSurrogate) {
          if (codePoint > 56319) {
            if ((units -= 3) > -1)
              bytes.push(239, 191, 189);
            continue;
          } else if (i + 1 === length) {
            if ((units -= 3) > -1)
              bytes.push(239, 191, 189);
            continue;
          }
          leadSurrogate = codePoint;
          continue;
        }
        if (codePoint < 56320) {
          if ((units -= 3) > -1)
            bytes.push(239, 191, 189);
          leadSurrogate = codePoint;
          continue;
        }
        codePoint = (leadSurrogate - 55296 << 10 | codePoint - 56320) + 65536;
      } else if (leadSurrogate) {
        if ((units -= 3) > -1)
          bytes.push(239, 191, 189);
      }
      leadSurrogate = null;
      if (codePoint < 128) {
        if ((units -= 1) < 0)
          break;
        bytes.push(codePoint);
      } else if (codePoint < 2048) {
        if ((units -= 2) < 0)
          break;
        bytes.push(codePoint >> 6 | 192, codePoint & 63 | 128);
      } else if (codePoint < 65536) {
        if ((units -= 3) < 0)
          break;
        bytes.push(codePoint >> 12 | 224, codePoint >> 6 & 63 | 128, codePoint & 63 | 128);
      } else if (codePoint < 1114112) {
        if ((units -= 4) < 0)
          break;
        bytes.push(codePoint >> 18 | 240, codePoint >> 12 & 63 | 128, codePoint >> 6 & 63 | 128, codePoint & 63 | 128);
      } else {
        throw new Error('Invalid code point');
      }
    }
    return bytes;
  }
  function utf8Slice(buf, offset, end) {
    const res = [];
    while (offset < end) {
      const firstByte = buf[offset];
      let codePoint = null;
      let bytesPerSequence = firstByte > 239 ? 4 : firstByte > 223 ? 3 : firstByte > 191 ? 2 : 1;
      if (offset + bytesPerSequence <= end) {
        let secondByte, thirdByte, fourthByte, tempCodePoint;
        switch (bytesPerSequence) {
        case 1:
          if (firstByte < 128) {
            codePoint = firstByte;
          }
          break;
        case 2:
          secondByte = buf[offset + 1];
          if ((secondByte & 192) === 128) {
            tempCodePoint = (firstByte & 31) << 6 | secondByte & 63;
            if (tempCodePoint > 127) {
              codePoint = tempCodePoint;
            }
          }
          break;
        case 3:
          secondByte = buf[offset + 1];
          thirdByte = buf[offset + 2];
          if ((secondByte & 192) === 128 && (thirdByte & 192) === 128) {
            tempCodePoint = (firstByte & 15) << 12 | (secondByte & 63) << 6 | thirdByte & 63;
            if (tempCodePoint > 2047 && (tempCodePoint < 55296 || tempCodePoint > 57343)) {
              codePoint = tempCodePoint;
            }
          }
          break;
        case 4:
          secondByte = buf[offset + 1];
          thirdByte = buf[offset + 2];
          fourthByte = buf[offset + 3];
          if ((secondByte & 192) === 128 && (thirdByte & 192) === 128 && (fourthByte & 192) === 128) {
            tempCodePoint = (firstByte & 15) << 18 | (secondByte & 63) << 12 | (thirdByte & 63) << 6 | fourthByte & 63;
            if (tempCodePoint > 65535 && tempCodePoint < 1114112) {
              codePoint = tempCodePoint;
            }
          }
        }
      }
      if (codePoint === null) {
        codePoint = 65533;
        bytesPerSequence = 1;
      } else if (codePoint > 65535) {
        codePoint -= 65536;
        res.push(codePoint >>> 10 & 1023 | 55296);
        codePoint = 56320 | codePoint & 1023;
      }
      res.push(codePoint);
      offset += bytesPerSequence;
    }
    return decodeCodePointsArray(res);
  }
  const MAX_ARGUMENTS_LENGTH = 4096;
  function decodeCodePointsArray(codePoints) {
    const len = codePoints.length;
    if (len <= MAX_ARGUMENTS_LENGTH) {
      return String.fromCharCode.apply(String, codePoints);
    }
    let res = '';
    let i = 0;
    while (i < len) {
      res += String.fromCharCode.apply(String, codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH));
    }
    return res;
  }

  const defaultChunkSize = 256;
  class Bl {
    constructor(chunkSize = defaultChunkSize) {
      this.chunkSize = chunkSize;
      this.cursor = 0;
      this.maxCursor = -1;
      this.chunks = [];
      this._initReuseChunk = null;
    }
    reset() {
      this.chunks = [];
      this.cursor = 0;
      this.maxCursor = -1;
      if (this._initReuseChunk !== null) {
        this.chunks.push(this._initReuseChunk);
        this.maxCursor = this._initReuseChunk.length - 1;
      }
    }
    push(bytes) {
      let topChunk = this.chunks[this.chunks.length - 1];
      const newMax = this.cursor + bytes.length;
      if (newMax <= this.maxCursor + 1) {
        const chunkPos = topChunk.length - (this.maxCursor - this.cursor) - 1;
        topChunk.set(bytes, chunkPos);
      } else {
        if (topChunk) {
          const chunkPos = topChunk.length - (this.maxCursor - this.cursor) - 1;
          if (chunkPos < topChunk.length) {
            this.chunks[this.chunks.length - 1] = topChunk.subarray(0, chunkPos);
            this.maxCursor = this.cursor - 1;
          }
        }
        if (bytes.length < 64 && bytes.length < this.chunkSize) {
          topChunk = alloc(this.chunkSize);
          this.chunks.push(topChunk);
          this.maxCursor += topChunk.length;
          if (this._initReuseChunk === null) {
            this._initReuseChunk = topChunk;
          }
          topChunk.set(bytes, 0);
        } else {
          this.chunks.push(bytes);
          this.maxCursor += bytes.length;
        }
      }
      this.cursor += bytes.length;
    }
    toBytes(reset = false) {
      let byts;
      if (this.chunks.length === 1) {
        const chunk = this.chunks[0];
        if (reset && this.cursor > chunk.length / 2) {
          byts = this.cursor === chunk.length ? chunk : chunk.subarray(0, this.cursor);
          this._initReuseChunk = null;
          this.chunks = [];
        } else {
          byts = slice(chunk, 0, this.cursor);
        }
      } else {
        byts = concat(this.chunks, this.cursor);
      }
      if (reset) {
        this.reset();
      }
      return byts;
    }
  }

  const decodeErrPrefix = 'CBOR decode error:';
  const encodeErrPrefix = 'CBOR encode error:';
  function assertEnoughData(data, pos, need) {
    if (data.length - pos < need) {
      throw new Error(`${ decodeErrPrefix } not enough data for type`);
    }
  }

  const uintBoundaries = [
    24,
    256,
    65536,
    4294967296,
    BigInt('18446744073709551616')
  ];
  function readUint8(data, offset, options) {
    assertEnoughData(data, offset, 1);
    const value = data[offset];
    if (options.strict === true && value < uintBoundaries[0]) {
      throw new Error(`${ decodeErrPrefix } integer encoded in more bytes than necessary (strict decode)`);
    }
    return value;
  }
  function readUint16(data, offset, options) {
    assertEnoughData(data, offset, 2);
    const value = data[offset] << 8 | data[offset + 1];
    if (options.strict === true && value < uintBoundaries[1]) {
      throw new Error(`${ decodeErrPrefix } integer encoded in more bytes than necessary (strict decode)`);
    }
    return value;
  }
  function readUint32(data, offset, options) {
    assertEnoughData(data, offset, 4);
    const value = data[offset] * 16777216 + (data[offset + 1] << 16) + (data[offset + 2] << 8) + data[offset + 3];
    if (options.strict === true && value < uintBoundaries[2]) {
      throw new Error(`${ decodeErrPrefix } integer encoded in more bytes than necessary (strict decode)`);
    }
    return value;
  }
  function readUint64(data, offset, options) {
    assertEnoughData(data, offset, 8);
    const hi = data[offset] * 16777216 + (data[offset + 1] << 16) + (data[offset + 2] << 8) + data[offset + 3];
    const lo = data[offset + 4] * 16777216 + (data[offset + 5] << 16) + (data[offset + 6] << 8) + data[offset + 7];
    const value = (BigInt(hi) << BigInt(32)) + BigInt(lo);
    if (options.strict === true && value < uintBoundaries[3]) {
      throw new Error(`${ decodeErrPrefix } integer encoded in more bytes than necessary (strict decode)`);
    }
    if (value <= Number.MAX_SAFE_INTEGER) {
      return Number(value);
    }
    if (options.allowBigInt === true) {
      return value;
    }
    throw new Error(`${ decodeErrPrefix } integers outside of the safe integer range are not supported`);
  }
  function decodeUint8(data, pos, _minor, options) {
    return new Token(Type.uint, readUint8(data, pos + 1, options), 2);
  }
  function decodeUint16(data, pos, _minor, options) {
    return new Token(Type.uint, readUint16(data, pos + 1, options), 3);
  }
  function decodeUint32(data, pos, _minor, options) {
    return new Token(Type.uint, readUint32(data, pos + 1, options), 5);
  }
  function decodeUint64(data, pos, _minor, options) {
    return new Token(Type.uint, readUint64(data, pos + 1, options), 9);
  }
  function encodeUint(buf, token) {
    return encodeUintValue(buf, 0, token.value);
  }
  function encodeUintValue(buf, major, uint) {
    if (uint < uintBoundaries[0]) {
      const nuint = Number(uint);
      buf.push([major | nuint]);
    } else if (uint < uintBoundaries[1]) {
      const nuint = Number(uint);
      buf.push([
        major | 24,
        nuint
      ]);
    } else if (uint < uintBoundaries[2]) {
      const nuint = Number(uint);
      buf.push([
        major | 25,
        nuint >>> 8,
        nuint & 255
      ]);
    } else if (uint < uintBoundaries[3]) {
      const nuint = Number(uint);
      buf.push([
        major | 26,
        nuint >>> 24 & 255,
        nuint >>> 16 & 255,
        nuint >>> 8 & 255,
        nuint & 255
      ]);
    } else {
      const buint = BigInt(uint);
      if (buint < uintBoundaries[4]) {
        const set = [
          major | 27,
          0,
          0,
          0,
          0,
          0,
          0,
          0
        ];
        let lo = Number(buint & BigInt(4294967295));
        let hi = Number(buint >> BigInt(32) & BigInt(4294967295));
        set[8] = lo & 255;
        lo = lo >> 8;
        set[7] = lo & 255;
        lo = lo >> 8;
        set[6] = lo & 255;
        lo = lo >> 8;
        set[5] = lo & 255;
        set[4] = hi & 255;
        hi = hi >> 8;
        set[3] = hi & 255;
        hi = hi >> 8;
        set[2] = hi & 255;
        hi = hi >> 8;
        set[1] = hi & 255;
        buf.push(set);
      } else {
        throw new Error(`${ decodeErrPrefix } encountered BigInt larger than allowable range`);
      }
    }
  }
  encodeUint.encodedSize = function encodedSize(token) {
    return encodeUintValue.encodedSize(token.value);
  };
  encodeUintValue.encodedSize = function encodedSize(uint) {
    if (uint < uintBoundaries[0]) {
      return 1;
    }
    if (uint < uintBoundaries[1]) {
      return 2;
    }
    if (uint < uintBoundaries[2]) {
      return 3;
    }
    if (uint < uintBoundaries[3]) {
      return 5;
    }
    return 9;
  };
  encodeUint.compareTokens = function compareTokens(tok1, tok2) {
    return tok1.value < tok2.value ? -1 : tok1.value > tok2.value ? 1 : 0;
  };

  function decodeNegint8(data, pos, _minor, options) {
    return new Token(Type.negint, -1 - readUint8(data, pos + 1, options), 2);
  }
  function decodeNegint16(data, pos, _minor, options) {
    return new Token(Type.negint, -1 - readUint16(data, pos + 1, options), 3);
  }
  function decodeNegint32(data, pos, _minor, options) {
    return new Token(Type.negint, -1 - readUint32(data, pos + 1, options), 5);
  }
  const neg1b = BigInt(-1);
  const pos1b = BigInt(1);
  function decodeNegint64(data, pos, _minor, options) {
    const int = readUint64(data, pos + 1, options);
    if (typeof int !== 'bigint') {
      const value = -1 - int;
      if (value >= Number.MIN_SAFE_INTEGER) {
        return new Token(Type.negint, value, 9);
      }
    }
    if (options.allowBigInt !== true) {
      throw new Error(`${ decodeErrPrefix } integers outside of the safe integer range are not supported`);
    }
    return new Token(Type.negint, neg1b - BigInt(int), 9);
  }
  function encodeNegint(buf, token) {
    const negint = token.value;
    const unsigned = typeof negint === 'bigint' ? negint * neg1b - pos1b : negint * -1 - 1;
    encodeUintValue(buf, token.type.majorEncoded, unsigned);
  }
  encodeNegint.encodedSize = function encodedSize(token) {
    const negint = token.value;
    const unsigned = typeof negint === 'bigint' ? negint * neg1b - pos1b : negint * -1 - 1;
    if (unsigned < uintBoundaries[0]) {
      return 1;
    }
    if (unsigned < uintBoundaries[1]) {
      return 2;
    }
    if (unsigned < uintBoundaries[2]) {
      return 3;
    }
    if (unsigned < uintBoundaries[3]) {
      return 5;
    }
    return 9;
  };
  encodeNegint.compareTokens = function compareTokens(tok1, tok2) {
    return tok1.value < tok2.value ? 1 : tok1.value > tok2.value ? -1 : 0;
  };

  function toToken$3(data, pos, prefix, length) {
    assertEnoughData(data, pos, prefix + length);
    const buf = slice(data, pos + prefix, pos + prefix + length);
    return new Token(Type.bytes, buf, prefix + length);
  }
  function decodeBytesCompact(data, pos, minor, _options) {
    return toToken$3(data, pos, 1, minor);
  }
  function decodeBytes8(data, pos, _minor, options) {
    return toToken$3(data, pos, 2, readUint8(data, pos + 1, options));
  }
  function decodeBytes16(data, pos, _minor, options) {
    return toToken$3(data, pos, 3, readUint16(data, pos + 1, options));
  }
  function decodeBytes32(data, pos, _minor, options) {
    return toToken$3(data, pos, 5, readUint32(data, pos + 1, options));
  }
  function decodeBytes64(data, pos, _minor, options) {
    const l = readUint64(data, pos + 1, options);
    if (typeof l === 'bigint') {
      throw new Error(`${ decodeErrPrefix } 64-bit integer bytes lengths not supported`);
    }
    return toToken$3(data, pos, 9, l);
  }
  function tokenBytes(token) {
    if (token.encodedBytes === undefined) {
      token.encodedBytes = token.type === Type.string ? fromString(token.value) : token.value;
    }
    return token.encodedBytes;
  }
  function encodeBytes(buf, token) {
    const bytes = tokenBytes(token);
    encodeUintValue(buf, token.type.majorEncoded, bytes.length);
    buf.push(bytes);
  }
  encodeBytes.encodedSize = function encodedSize(token) {
    const bytes = tokenBytes(token);
    return encodeUintValue.encodedSize(bytes.length) + bytes.length;
  };
  encodeBytes.compareTokens = function compareTokens(tok1, tok2) {
    return compareBytes(tokenBytes(tok1), tokenBytes(tok2));
  };
  function compareBytes(b1, b2) {
    return b1.length < b2.length ? -1 : b1.length > b2.length ? 1 : compare(b1, b2);
  }

  function toToken$2(data, pos, prefix, length) {
    const totLength = prefix + length;
    assertEnoughData(data, pos, totLength);
    return new Token(Type.string, toString(data, pos + prefix, pos + totLength), totLength);
  }
  function decodeStringCompact(data, pos, minor, _options) {
    return toToken$2(data, pos, 1, minor);
  }
  function decodeString8(data, pos, _minor, options) {
    return toToken$2(data, pos, 2, readUint8(data, pos + 1, options));
  }
  function decodeString16(data, pos, _minor, options) {
    return toToken$2(data, pos, 3, readUint16(data, pos + 1, options));
  }
  function decodeString32(data, pos, _minor, options) {
    return toToken$2(data, pos, 5, readUint32(data, pos + 1, options));
  }
  function decodeString64(data, pos, _minor, options) {
    const l = readUint64(data, pos + 1, options);
    if (typeof l === 'bigint') {
      throw new Error(`${ decodeErrPrefix } 64-bit integer string lengths not supported`);
    }
    return toToken$2(data, pos, 9, l);
  }
  const encodeString = encodeBytes;

  function toToken$1(_data, _pos, prefix, length) {
    return new Token(Type.array, length, prefix);
  }
  function decodeArrayCompact(data, pos, minor, _options) {
    return toToken$1(data, pos, 1, minor);
  }
  function decodeArray8(data, pos, _minor, options) {
    return toToken$1(data, pos, 2, readUint8(data, pos + 1, options));
  }
  function decodeArray16(data, pos, _minor, options) {
    return toToken$1(data, pos, 3, readUint16(data, pos + 1, options));
  }
  function decodeArray32(data, pos, _minor, options) {
    return toToken$1(data, pos, 5, readUint32(data, pos + 1, options));
  }
  function decodeArray64(data, pos, _minor, options) {
    const l = readUint64(data, pos + 1, options);
    if (typeof l === 'bigint') {
      throw new Error(`${ decodeErrPrefix } 64-bit integer array lengths not supported`);
    }
    return toToken$1(data, pos, 9, l);
  }
  function decodeArrayIndefinite(data, pos, _minor, options) {
    if (options.allowIndefinite === false) {
      throw new Error(`${ decodeErrPrefix } indefinite length items not allowed`);
    }
    return toToken$1(data, pos, 1, Infinity);
  }
  function encodeArray(buf, token) {
    encodeUintValue(buf, Type.array.majorEncoded, token.value);
  }
  encodeArray.compareTokens = encodeUint.compareTokens;

  function toToken(_data, _pos, prefix, length) {
    return new Token(Type.map, length, prefix);
  }
  function decodeMapCompact(data, pos, minor, _options) {
    return toToken(data, pos, 1, minor);
  }
  function decodeMap8(data, pos, _minor, options) {
    return toToken(data, pos, 2, readUint8(data, pos + 1, options));
  }
  function decodeMap16(data, pos, _minor, options) {
    return toToken(data, pos, 3, readUint16(data, pos + 1, options));
  }
  function decodeMap32(data, pos, _minor, options) {
    return toToken(data, pos, 5, readUint32(data, pos + 1, options));
  }
  function decodeMap64(data, pos, _minor, options) {
    const l = readUint64(data, pos + 1, options);
    if (typeof l === 'bigint') {
      throw new Error(`${ decodeErrPrefix } 64-bit integer map lengths not supported`);
    }
    return toToken(data, pos, 9, l);
  }
  function decodeMapIndefinite(data, pos, _minor, options) {
    if (options.allowIndefinite === false) {
      throw new Error(`${ decodeErrPrefix } indefinite length items not allowed`);
    }
    return toToken(data, pos, 1, Infinity);
  }
  function encodeMap(buf, token) {
    encodeUintValue(buf, Type.map.majorEncoded, token.value);
  }
  encodeMap.compareTokens = encodeUint.compareTokens;

  function decodeTagCompact(_data, _pos, minor, _options) {
    return new Token(Type.tag, minor, 1);
  }
  function decodeTag8(data, pos, _minor, options) {
    return new Token(Type.tag, readUint8(data, pos + 1, options), 2);
  }
  function decodeTag16(data, pos, _minor, options) {
    return new Token(Type.tag, readUint16(data, pos + 1, options), 3);
  }
  function decodeTag32(data, pos, _minor, options) {
    return new Token(Type.tag, readUint32(data, pos + 1, options), 5);
  }
  function decodeTag64(data, pos, _minor, options) {
    return new Token(Type.tag, readUint64(data, pos + 1, options), 9);
  }
  function encodeTag(buf, token) {
    encodeUintValue(buf, Type.tag.majorEncoded, token.value);
  }
  encodeTag.compareTokens = encodeUint.compareTokens;

  const MINOR_FALSE = 20;
  const MINOR_TRUE = 21;
  const MINOR_NULL = 22;
  const MINOR_UNDEFINED = 23;
  function decodeUndefined(_data, _pos, _minor, options) {
    if (options.allowUndefined === false) {
      throw new Error(`${ decodeErrPrefix } undefined values are not supported`);
    } else if (options.coerceUndefinedToNull === true) {
      return new Token(Type.null, null, 1);
    }
    return new Token(Type.undefined, undefined, 1);
  }
  function decodeBreak(_data, _pos, _minor, options) {
    if (options.allowIndefinite === false) {
      throw new Error(`${ decodeErrPrefix } indefinite length items not allowed`);
    }
    return new Token(Type.break, undefined, 1);
  }
  function createToken(value, bytes, options) {
    if (options) {
      if (options.allowNaN === false && Number.isNaN(value)) {
        throw new Error(`${ decodeErrPrefix } NaN values are not supported`);
      }
      if (options.allowInfinity === false && (value === Infinity || value === -Infinity)) {
        throw new Error(`${ decodeErrPrefix } Infinity values are not supported`);
      }
    }
    return new Token(Type.float, value, bytes);
  }
  function decodeFloat16(data, pos, _minor, options) {
    return createToken(readFloat16(data, pos + 1), 3, options);
  }
  function decodeFloat32(data, pos, _minor, options) {
    return createToken(readFloat32(data, pos + 1), 5, options);
  }
  function decodeFloat64(data, pos, _minor, options) {
    return createToken(readFloat64(data, pos + 1), 9, options);
  }
  function encodeFloat(buf, token, options) {
    const float = token.value;
    if (float === false) {
      buf.push([Type.float.majorEncoded | MINOR_FALSE]);
    } else if (float === true) {
      buf.push([Type.float.majorEncoded | MINOR_TRUE]);
    } else if (float === null) {
      buf.push([Type.float.majorEncoded | MINOR_NULL]);
    } else if (float === undefined) {
      buf.push([Type.float.majorEncoded | MINOR_UNDEFINED]);
    } else {
      let decoded;
      let success = false;
      if (!options || options.float64 !== true) {
        encodeFloat16(float);
        decoded = readFloat16(ui8a, 1);
        if (float === decoded || Number.isNaN(float)) {
          ui8a[0] = 249;
          buf.push(ui8a.slice(0, 3));
          success = true;
        } else {
          encodeFloat32(float);
          decoded = readFloat32(ui8a, 1);
          if (float === decoded) {
            ui8a[0] = 250;
            buf.push(ui8a.slice(0, 5));
            success = true;
          }
        }
      }
      if (!success) {
        encodeFloat64(float);
        decoded = readFloat64(ui8a, 1);
        ui8a[0] = 251;
        buf.push(ui8a.slice(0, 9));
      }
    }
  }
  encodeFloat.encodedSize = function encodedSize(token, options) {
    const float = token.value;
    if (float === false || float === true || float === null || float === undefined) {
      return 1;
    }
    let decoded;
    if (!options || options.float64 !== true) {
      encodeFloat16(float);
      decoded = readFloat16(ui8a, 1);
      if (float === decoded || Number.isNaN(float)) {
        return 3;
      }
      encodeFloat32(float);
      decoded = readFloat32(ui8a, 1);
      if (float === decoded) {
        return 5;
      }
    }
    return 9;
  };
  const buffer = new ArrayBuffer(9);
  const dataView = new DataView(buffer, 1);
  const ui8a = new Uint8Array(buffer, 0);
  function encodeFloat16(inp) {
    if (inp === Infinity) {
      dataView.setUint16(0, 31744, false);
    } else if (inp === -Infinity) {
      dataView.setUint16(0, 64512, false);
    } else if (Number.isNaN(inp)) {
      dataView.setUint16(0, 32256, false);
    } else {
      dataView.setFloat32(0, inp);
      const valu32 = dataView.getUint32(0);
      const exponent = (valu32 & 2139095040) >> 23;
      const mantissa = valu32 & 8388607;
      if (exponent === 255) {
        dataView.setUint16(0, 31744, false);
      } else if (exponent === 0) {
        dataView.setUint16(0, (inp & 2147483648) >> 16 | mantissa >> 13, false);
      } else {
        const logicalExponent = exponent - 127;
        if (logicalExponent < -24) {
          dataView.setUint16(0, 0);
        } else if (logicalExponent < -14) {
          dataView.setUint16(0, (valu32 & 2147483648) >> 16 | 1 << 24 + logicalExponent, false);
        } else {
          dataView.setUint16(0, (valu32 & 2147483648) >> 16 | logicalExponent + 15 << 10 | mantissa >> 13, false);
        }
      }
    }
  }
  function readFloat16(ui8a, pos) {
    if (ui8a.length - pos < 2) {
      throw new Error(`${ decodeErrPrefix } not enough data for float16`);
    }
    const half = (ui8a[pos] << 8) + ui8a[pos + 1];
    if (half === 31744) {
      return Infinity;
    }
    if (half === 64512) {
      return -Infinity;
    }
    if (half === 32256) {
      return NaN;
    }
    const exp = half >> 10 & 31;
    const mant = half & 1023;
    let val;
    if (exp === 0) {
      val = mant * 2 ** -24;
    } else if (exp !== 31) {
      val = (mant + 1024) * 2 ** (exp - 25);
    } else {
      val = mant === 0 ? Infinity : NaN;
    }
    return half & 32768 ? -val : val;
  }
  function encodeFloat32(inp) {
    dataView.setFloat32(0, inp, false);
  }
  function readFloat32(ui8a, pos) {
    if (ui8a.length - pos < 4) {
      throw new Error(`${ decodeErrPrefix } not enough data for float32`);
    }
    const offset = (ui8a.byteOffset || 0) + pos;
    return new DataView(ui8a.buffer, offset, 4).getFloat32(0, false);
  }
  function encodeFloat64(inp) {
    dataView.setFloat64(0, inp, false);
  }
  function readFloat64(ui8a, pos) {
    if (ui8a.length - pos < 8) {
      throw new Error(`${ decodeErrPrefix } not enough data for float64`);
    }
    const offset = (ui8a.byteOffset || 0) + pos;
    return new DataView(ui8a.buffer, offset, 8).getFloat64(0, false);
  }
  encodeFloat.compareTokens = encodeUint.compareTokens;

  function invalidMinor(data, pos, minor) {
    throw new Error(`${ decodeErrPrefix } encountered invalid minor (${ minor }) for major ${ data[pos] >>> 5 }`);
  }
  function errorer(msg) {
    return () => {
      throw new Error(`${ decodeErrPrefix } ${ msg }`);
    };
  }
  const jump = [];
  for (let i = 0; i <= 23; i++) {
    jump[i] = invalidMinor;
  }
  jump[24] = decodeUint8;
  jump[25] = decodeUint16;
  jump[26] = decodeUint32;
  jump[27] = decodeUint64;
  jump[28] = invalidMinor;
  jump[29] = invalidMinor;
  jump[30] = invalidMinor;
  jump[31] = invalidMinor;
  for (let i = 32; i <= 55; i++) {
    jump[i] = invalidMinor;
  }
  jump[56] = decodeNegint8;
  jump[57] = decodeNegint16;
  jump[58] = decodeNegint32;
  jump[59] = decodeNegint64;
  jump[60] = invalidMinor;
  jump[61] = invalidMinor;
  jump[62] = invalidMinor;
  jump[63] = invalidMinor;
  for (let i = 64; i <= 87; i++) {
    jump[i] = decodeBytesCompact;
  }
  jump[88] = decodeBytes8;
  jump[89] = decodeBytes16;
  jump[90] = decodeBytes32;
  jump[91] = decodeBytes64;
  jump[92] = invalidMinor;
  jump[93] = invalidMinor;
  jump[94] = invalidMinor;
  jump[95] = errorer('indefinite length bytes/strings are not supported');
  for (let i = 96; i <= 119; i++) {
    jump[i] = decodeStringCompact;
  }
  jump[120] = decodeString8;
  jump[121] = decodeString16;
  jump[122] = decodeString32;
  jump[123] = decodeString64;
  jump[124] = invalidMinor;
  jump[125] = invalidMinor;
  jump[126] = invalidMinor;
  jump[127] = errorer('indefinite length bytes/strings are not supported');
  for (let i = 128; i <= 151; i++) {
    jump[i] = decodeArrayCompact;
  }
  jump[152] = decodeArray8;
  jump[153] = decodeArray16;
  jump[154] = decodeArray32;
  jump[155] = decodeArray64;
  jump[156] = invalidMinor;
  jump[157] = invalidMinor;
  jump[158] = invalidMinor;
  jump[159] = decodeArrayIndefinite;
  for (let i = 160; i <= 183; i++) {
    jump[i] = decodeMapCompact;
  }
  jump[184] = decodeMap8;
  jump[185] = decodeMap16;
  jump[186] = decodeMap32;
  jump[187] = decodeMap64;
  jump[188] = invalidMinor;
  jump[189] = invalidMinor;
  jump[190] = invalidMinor;
  jump[191] = decodeMapIndefinite;
  for (let i = 192; i <= 215; i++) {
    jump[i] = decodeTagCompact;
  }
  jump[216] = decodeTag8;
  jump[217] = decodeTag16;
  jump[218] = decodeTag32;
  jump[219] = decodeTag64;
  jump[220] = invalidMinor;
  jump[221] = invalidMinor;
  jump[222] = invalidMinor;
  jump[223] = invalidMinor;
  for (let i = 224; i <= 243; i++) {
    jump[i] = errorer('simple values are not supported');
  }
  jump[244] = invalidMinor;
  jump[245] = invalidMinor;
  jump[246] = invalidMinor;
  jump[247] = decodeUndefined;
  jump[248] = errorer('simple values are not supported');
  jump[249] = decodeFloat16;
  jump[250] = decodeFloat32;
  jump[251] = decodeFloat64;
  jump[252] = invalidMinor;
  jump[253] = invalidMinor;
  jump[254] = invalidMinor;
  jump[255] = decodeBreak;
  const quick = [];
  for (let i = 0; i < 24; i++) {
    quick[i] = new Token(Type.uint, i, 1);
  }
  for (let i = -1; i >= -24; i--) {
    quick[31 - i] = new Token(Type.negint, i, 1);
  }
  quick[64] = new Token(Type.bytes, new Uint8Array(0), 1);
  quick[96] = new Token(Type.string, '', 1);
  quick[128] = new Token(Type.array, 0, 1);
  quick[160] = new Token(Type.map, 0, 1);
  quick[244] = new Token(Type.false, false, 1);
  quick[245] = new Token(Type.true, true, 1);
  quick[246] = new Token(Type.null, null, 1);
  function quickEncodeToken(token) {
    switch (token.type) {
    case Type.false:
      return fromArray([244]);
    case Type.true:
      return fromArray([245]);
    case Type.null:
      return fromArray([246]);
    case Type.bytes:
      if (!token.value.length) {
        return fromArray([64]);
      }
      return;
    case Type.string:
      if (token.value === '') {
        return fromArray([96]);
      }
      return;
    case Type.array:
      if (token.value === 0) {
        return fromArray([128]);
      }
      return;
    case Type.map:
      if (token.value === 0) {
        return fromArray([160]);
      }
      return;
    case Type.uint:
      if (token.value < 24) {
        return fromArray([Number(token.value)]);
      }
      return;
    case Type.negint:
      if (token.value >= -24) {
        return fromArray([31 - Number(token.value)]);
      }
    }
  }

  const defaultEncodeOptions = {
    float64: false,
    mapSorter,
    quickEncodeToken
  };
  const cborEncoders = [];
  cborEncoders[Type.uint.major] = encodeUint;
  cborEncoders[Type.negint.major] = encodeNegint;
  cborEncoders[Type.bytes.major] = encodeBytes;
  cborEncoders[Type.string.major] = encodeString;
  cborEncoders[Type.array.major] = encodeArray;
  cborEncoders[Type.map.major] = encodeMap;
  cborEncoders[Type.tag.major] = encodeTag;
  cborEncoders[Type.float.major] = encodeFloat;
  const buf = new Bl();
  class Ref {
    constructor(obj, parent) {
      this.obj = obj;
      this.parent = parent;
    }
    includes(obj) {
      let p = this;
      do {
        if (p.obj === obj) {
          return true;
        }
      } while (p = p.parent);
      return false;
    }
    static createCheck(stack, obj) {
      if (stack && stack.includes(obj)) {
        throw new Error(`${ encodeErrPrefix } object contains circular references`);
      }
      return new Ref(obj, stack);
    }
  }
  const simpleTokens = {
    null: new Token(Type.null, null),
    undefined: new Token(Type.undefined, undefined),
    true: new Token(Type.true, true),
    false: new Token(Type.false, false),
    emptyArray: new Token(Type.array, 0),
    emptyMap: new Token(Type.map, 0)
  };
  const typeEncoders = {
    number(obj, _typ, _options, _refStack) {
      if (!Number.isInteger(obj) || !Number.isSafeInteger(obj)) {
        return new Token(Type.float, obj);
      } else if (obj >= 0) {
        return new Token(Type.uint, obj);
      } else {
        return new Token(Type.negint, obj);
      }
    },
    bigint(obj, _typ, _options, _refStack) {
      if (obj >= BigInt(0)) {
        return new Token(Type.uint, obj);
      } else {
        return new Token(Type.negint, obj);
      }
    },
    Uint8Array(obj, _typ, _options, _refStack) {
      return new Token(Type.bytes, obj);
    },
    string(obj, _typ, _options, _refStack) {
      return new Token(Type.string, obj);
    },
    boolean(obj, _typ, _options, _refStack) {
      return obj ? simpleTokens.true : simpleTokens.false;
    },
    null(_obj, _typ, _options, _refStack) {
      return simpleTokens.null;
    },
    undefined(_obj, _typ, _options, _refStack) {
      return simpleTokens.undefined;
    },
    ArrayBuffer(obj, _typ, _options, _refStack) {
      return new Token(Type.bytes, new Uint8Array(obj));
    },
    DataView(obj, _typ, _options, _refStack) {
      return new Token(Type.bytes, new Uint8Array(obj.buffer, obj.byteOffset, obj.byteLength));
    },
    Array(obj, _typ, options, refStack) {
      if (!obj.length) {
        if (options.addBreakTokens === true) {
          return [
            simpleTokens.emptyArray,
            new Token(Type.break)
          ];
        }
        return simpleTokens.emptyArray;
      }
      refStack = Ref.createCheck(refStack, obj);
      const entries = [];
      let i = 0;
      for (const e of obj) {
        entries[i++] = objectToTokens(e, options, refStack);
      }
      if (options.addBreakTokens) {
        return [
          new Token(Type.array, obj.length),
          entries,
          new Token(Type.break)
        ];
      }
      return [
        new Token(Type.array, obj.length),
        entries
      ];
    },
    Object(obj, typ, options, refStack) {
      const isMap = typ !== 'Object';
      const keys = isMap ? obj.keys() : Object.keys(obj);
      const length = isMap ? obj.size : keys.length;
      if (!length) {
        if (options.addBreakTokens === true) {
          return [
            simpleTokens.emptyMap,
            new Token(Type.break)
          ];
        }
        return simpleTokens.emptyMap;
      }
      refStack = Ref.createCheck(refStack, obj);
      const entries = [];
      let i = 0;
      for (const key of keys) {
        entries[i++] = [
          objectToTokens(key, options, refStack),
          objectToTokens(isMap ? obj.get(key) : obj[key], options, refStack)
        ];
      }
      sortMapEntries(entries, options);
      if (options.addBreakTokens) {
        return [
          new Token(Type.map, length),
          entries,
          new Token(Type.break)
        ];
      }
      return [
        new Token(Type.map, length),
        entries
      ];
    }
  };
  typeEncoders.Map = typeEncoders.Object;
  typeEncoders.Buffer = typeEncoders.Uint8Array;
  for (const typ of 'Uint8Clamped Uint16 Uint32 Int8 Int16 Int32 BigUint64 BigInt64 Float32 Float64'.split(' ')) {
    typeEncoders[`${ typ }Array`] = typeEncoders.DataView;
  }
  function objectToTokens(obj, options = {}, refStack) {
    const typ = is(obj);
    const customTypeEncoder = options && options.typeEncoders && options.typeEncoders[typ] || typeEncoders[typ];
    if (typeof customTypeEncoder === 'function') {
      const tokens = customTypeEncoder(obj, typ, options, refStack);
      if (tokens != null) {
        return tokens;
      }
    }
    const typeEncoder = typeEncoders[typ];
    if (!typeEncoder) {
      throw new Error(`${ encodeErrPrefix } unsupported type: ${ typ }`);
    }
    return typeEncoder(obj, typ, options, refStack);
  }
  function sortMapEntries(entries, options) {
    if (options.mapSorter) {
      entries.sort(options.mapSorter);
    }
  }
  function mapSorter(e1, e2) {
    const keyToken1 = Array.isArray(e1[0]) ? e1[0][0] : e1[0];
    const keyToken2 = Array.isArray(e2[0]) ? e2[0][0] : e2[0];
    if (keyToken1.type !== keyToken2.type) {
      return keyToken1.type.compare(keyToken2.type);
    }
    const major = keyToken1.type.major;
    const tcmp = cborEncoders[major].compareTokens(keyToken1, keyToken2);
    if (tcmp === 0) {
      console.warn('WARNING: complex key types used, CBOR key sorting guarantees are gone');
    }
    return tcmp;
  }
  function tokensToEncoded(buf, tokens, encoders, options) {
    if (Array.isArray(tokens)) {
      for (const token of tokens) {
        tokensToEncoded(buf, token, encoders, options);
      }
    } else {
      encoders[tokens.type.major](buf, tokens, options);
    }
  }
  function encodeCustom(data, encoders, options) {
    const tokens = objectToTokens(data, options);
    if (!Array.isArray(tokens) && options.quickEncodeToken) {
      const quickBytes = options.quickEncodeToken(tokens);
      if (quickBytes) {
        return quickBytes;
      }
      const encoder = encoders[tokens.type.major];
      if (encoder.encodedSize) {
        const size = encoder.encodedSize(tokens, options);
        const buf = new Bl(size);
        encoder(buf, tokens, options);
        if (buf.chunks.length !== 1) {
          throw new Error(`Unexpected error: pre-calculated length for ${ tokens } was wrong`);
        }
        return asU8A(buf.chunks[0]);
      }
    }
    tokensToEncoded(buf, tokens, encoders, options);
    return buf.toBytes(true);
  }
  function encode$4(data, options) {
    options = Object.assign({}, defaultEncodeOptions, options);
    return encodeCustom(data, cborEncoders, options);
  }

  const defaultDecodeOptions = {
    strict: false,
    allowIndefinite: true,
    allowUndefined: true,
    allowBigInt: true
  };
  class Tokeniser {
    constructor(data, options = {}) {
      this.pos = 0;
      this.data = data;
      this.options = options;
    }
    done() {
      return this.pos >= this.data.length;
    }
    next() {
      const byt = this.data[this.pos];
      let token = quick[byt];
      if (token === undefined) {
        const decoder = jump[byt];
        if (!decoder) {
          throw new Error(`${ decodeErrPrefix } no decoder for major type ${ byt >>> 5 } (byte 0x${ byt.toString(16).padStart(2, '0') })`);
        }
        const minor = byt & 31;
        token = decoder(this.data, this.pos, minor, this.options);
      }
      this.pos += token.encodedLength;
      return token;
    }
  }
  const DONE = Symbol.for('DONE');
  const BREAK = Symbol.for('BREAK');
  function tokenToArray(token, tokeniser, options) {
    const arr = [];
    for (let i = 0; i < token.value; i++) {
      const value = tokensToObject(tokeniser, options);
      if (value === BREAK) {
        if (token.value === Infinity) {
          break;
        }
        throw new Error(`${ decodeErrPrefix } got unexpected break to lengthed array`);
      }
      if (value === DONE) {
        throw new Error(`${ decodeErrPrefix } found array but not enough entries (got ${ i }, expected ${ token.value })`);
      }
      arr[i] = value;
    }
    return arr;
  }
  function tokenToMap(token, tokeniser, options) {
    const useMaps = options.useMaps === true;
    const obj = useMaps ? undefined : {};
    const m = useMaps ? new Map() : undefined;
    for (let i = 0; i < token.value; i++) {
      const key = tokensToObject(tokeniser, options);
      if (key === BREAK) {
        if (token.value === Infinity) {
          break;
        }
        throw new Error(`${ decodeErrPrefix } got unexpected break to lengthed map`);
      }
      if (key === DONE) {
        throw new Error(`${ decodeErrPrefix } found map but not enough entries (got ${ i } [no key], expected ${ token.value })`);
      }
      if (useMaps !== true && typeof key !== 'string') {
        throw new Error(`${ decodeErrPrefix } non-string keys not supported (got ${ typeof key })`);
      }
      const value = tokensToObject(tokeniser, options);
      if (value === DONE) {
        throw new Error(`${ decodeErrPrefix } found map but not enough entries (got ${ i } [no value], expected ${ token.value })`);
      }
      if (useMaps) {
        m.set(key, value);
      } else {
        obj[key] = value;
      }
    }
    return useMaps ? m : obj;
  }
  function tokensToObject(tokeniser, options) {
    if (tokeniser.done()) {
      return DONE;
    }
    const token = tokeniser.next();
    if (token.type === Type.break) {
      return BREAK;
    }
    if (token.type.terminal) {
      return token.value;
    }
    if (token.type === Type.array) {
      return tokenToArray(token, tokeniser, options);
    }
    if (token.type === Type.map) {
      return tokenToMap(token, tokeniser, options);
    }
    if (token.type === Type.tag) {
      if (options.tags && typeof options.tags[token.value] === 'function') {
        const tagged = tokensToObject(tokeniser, options);
        return options.tags[token.value](tagged);
      }
      throw new Error(`${ decodeErrPrefix } tag not supported (${ token.value })`);
    }
    throw new Error('unsupported');
  }
  function decode$5(data, options) {
    if (!(data instanceof Uint8Array)) {
      throw new Error(`${ decodeErrPrefix } data to decode must be a Uint8Array`);
    }
    options = Object.assign({}, defaultDecodeOptions, options);
    const tokeniser = options.tokenizer || new Tokeniser(data, options);
    const decoded = tokensToObject(tokeniser, options);
    if (decoded === DONE) {
      throw new Error(`${ decodeErrPrefix } did not find any content to decode`);
    }
    if (decoded === BREAK) {
      throw new Error(`${ decodeErrPrefix } got unexpected break`);
    }
    if (!tokeniser.done()) {
      throw new Error(`${ decodeErrPrefix } too many terminals, data makes no sense`);
    }
    return decoded;
  }

  var encode_1 = encode$3;
  var MSB = 128, REST = 127, MSBALL = ~REST, INT = Math.pow(2, 31);
  function encode$3(num, out, offset) {
    out = out || [];
    offset = offset || 0;
    var oldOffset = offset;
    while (num >= INT) {
      out[offset++] = num & 255 | MSB;
      num /= 128;
    }
    while (num & MSBALL) {
      out[offset++] = num & 255 | MSB;
      num >>>= 7;
    }
    out[offset] = num | 0;
    encode$3.bytes = offset - oldOffset + 1;
    return out;
  }
  var decode$4 = read;
  var MSB$1 = 128, REST$1 = 127;
  function read(buf, offset) {
    var res = 0, offset = offset || 0, shift = 0, counter = offset, b, l = buf.length;
    do {
      if (counter >= l) {
        read.bytes = 0;
        throw new RangeError('Could not decode varint');
      }
      b = buf[counter++];
      res += shift < 28 ? (b & REST$1) << shift : (b & REST$1) * Math.pow(2, shift);
      shift += 7;
    } while (b >= MSB$1);
    read.bytes = counter - offset;
    return res;
  }
  var N1 = Math.pow(2, 7);
  var N2 = Math.pow(2, 14);
  var N3 = Math.pow(2, 21);
  var N4 = Math.pow(2, 28);
  var N5 = Math.pow(2, 35);
  var N6 = Math.pow(2, 42);
  var N7 = Math.pow(2, 49);
  var N8 = Math.pow(2, 56);
  var N9 = Math.pow(2, 63);
  var length = function (value) {
    return value < N1 ? 1 : value < N2 ? 2 : value < N3 ? 3 : value < N4 ? 4 : value < N5 ? 5 : value < N6 ? 6 : value < N7 ? 7 : value < N8 ? 8 : value < N9 ? 9 : 10;
  };
  var varint = {
    encode: encode_1,
    decode: decode$4,
    encodingLength: length
  };
  var _brrp_varint = varint;

  const decode$3 = data => {
    const code = _brrp_varint.decode(data);
    return [
      code,
      _brrp_varint.decode.bytes
    ];
  };
  const encodeTo = (int, target, offset = 0) => {
    _brrp_varint.encode(int, target, offset);
    return target;
  };
  const encodingLength = int => {
    return _brrp_varint.encodingLength(int);
  };

  const equals$1 = (aa, bb) => {
    if (aa === bb)
      return true;
    if (aa.byteLength !== bb.byteLength) {
      return false;
    }
    for (let ii = 0; ii < aa.byteLength; ii++) {
      if (aa[ii] !== bb[ii]) {
        return false;
      }
    }
    return true;
  };
  const coerce = o => {
    if (o instanceof Uint8Array && o.constructor.name === 'Uint8Array')
      return o;
    if (o instanceof ArrayBuffer)
      return new Uint8Array(o);
    if (ArrayBuffer.isView(o)) {
      return new Uint8Array(o.buffer, o.byteOffset, o.byteLength);
    }
    throw new Error('Unknown type, must be binary type');
  };

  const create$2 = (code, digest) => {
    const size = digest.byteLength;
    const sizeOffset = encodingLength(code);
    const digestOffset = sizeOffset + encodingLength(size);
    const bytes = new Uint8Array(digestOffset + size);
    encodeTo(code, bytes, 0);
    encodeTo(size, bytes, sizeOffset);
    bytes.set(digest, digestOffset);
    return new Digest(code, size, digest, bytes);
  };
  const decode$2 = multihash => {
    const bytes = coerce(multihash);
    const [code, sizeOffset] = decode$3(bytes);
    const [size, digestOffset] = decode$3(bytes.subarray(sizeOffset));
    const digest = bytes.subarray(sizeOffset + digestOffset);
    if (digest.byteLength !== size) {
      throw new Error('Incorrect length');
    }
    return new Digest(code, size, digest, bytes);
  };
  const equals = (a, b) => {
    if (a === b) {
      return true;
    } else {
      return a.code === b.code && a.size === b.size && equals$1(a.bytes, b.bytes);
    }
  };
  class Digest {
    constructor(code, size, digest, bytes) {
      this.code = code;
      this.size = size;
      this.digest = digest;
      this.bytes = bytes;
    }
  }

  function base(ALPHABET, name) {
    if (ALPHABET.length >= 255) {
      throw new TypeError('Alphabet too long');
    }
    var BASE_MAP = new Uint8Array(256);
    for (var j = 0; j < BASE_MAP.length; j++) {
      BASE_MAP[j] = 255;
    }
    for (var i = 0; i < ALPHABET.length; i++) {
      var x = ALPHABET.charAt(i);
      var xc = x.charCodeAt(0);
      if (BASE_MAP[xc] !== 255) {
        throw new TypeError(x + ' is ambiguous');
      }
      BASE_MAP[xc] = i;
    }
    var BASE = ALPHABET.length;
    var LEADER = ALPHABET.charAt(0);
    var FACTOR = Math.log(BASE) / Math.log(256);
    var iFACTOR = Math.log(256) / Math.log(BASE);
    function encode(source) {
      if (source instanceof Uint8Array);
      else if (ArrayBuffer.isView(source)) {
        source = new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
      } else if (Array.isArray(source)) {
        source = Uint8Array.from(source);
      }
      if (!(source instanceof Uint8Array)) {
        throw new TypeError('Expected Uint8Array');
      }
      if (source.length === 0) {
        return '';
      }
      var zeroes = 0;
      var length = 0;
      var pbegin = 0;
      var pend = source.length;
      while (pbegin !== pend && source[pbegin] === 0) {
        pbegin++;
        zeroes++;
      }
      var size = (pend - pbegin) * iFACTOR + 1 >>> 0;
      var b58 = new Uint8Array(size);
      while (pbegin !== pend) {
        var carry = source[pbegin];
        var i = 0;
        for (var it1 = size - 1; (carry !== 0 || i < length) && it1 !== -1; it1--, i++) {
          carry += 256 * b58[it1] >>> 0;
          b58[it1] = carry % BASE >>> 0;
          carry = carry / BASE >>> 0;
        }
        if (carry !== 0) {
          throw new Error('Non-zero carry');
        }
        length = i;
        pbegin++;
      }
      var it2 = size - length;
      while (it2 !== size && b58[it2] === 0) {
        it2++;
      }
      var str = LEADER.repeat(zeroes);
      for (; it2 < size; ++it2) {
        str += ALPHABET.charAt(b58[it2]);
      }
      return str;
    }
    function decodeUnsafe(source) {
      if (typeof source !== 'string') {
        throw new TypeError('Expected String');
      }
      if (source.length === 0) {
        return new Uint8Array();
      }
      var psz = 0;
      if (source[psz] === ' ') {
        return;
      }
      var zeroes = 0;
      var length = 0;
      while (source[psz] === LEADER) {
        zeroes++;
        psz++;
      }
      var size = (source.length - psz) * FACTOR + 1 >>> 0;
      var b256 = new Uint8Array(size);
      while (source[psz]) {
        var carry = BASE_MAP[source.charCodeAt(psz)];
        if (carry === 255) {
          return;
        }
        var i = 0;
        for (var it3 = size - 1; (carry !== 0 || i < length) && it3 !== -1; it3--, i++) {
          carry += BASE * b256[it3] >>> 0;
          b256[it3] = carry % 256 >>> 0;
          carry = carry / 256 >>> 0;
        }
        if (carry !== 0) {
          throw new Error('Non-zero carry');
        }
        length = i;
        psz++;
      }
      if (source[psz] === ' ') {
        return;
      }
      var it4 = size - length;
      while (it4 !== size && b256[it4] === 0) {
        it4++;
      }
      var vch = new Uint8Array(zeroes + (size - it4));
      var j = zeroes;
      while (it4 !== size) {
        vch[j++] = b256[it4++];
      }
      return vch;
    }
    function decode(string) {
      var buffer = decodeUnsafe(string);
      if (buffer) {
        return buffer;
      }
      throw new Error(`Non-${ name } character`);
    }
    return {
      encode: encode,
      decodeUnsafe: decodeUnsafe,
      decode: decode
    };
  }
  var src = base;
  var _brrp__multiformats_scope_baseX = src;

  class Encoder {
    constructor(name, prefix, baseEncode) {
      this.name = name;
      this.prefix = prefix;
      this.baseEncode = baseEncode;
    }
    encode(bytes) {
      if (bytes instanceof Uint8Array) {
        return `${ this.prefix }${ this.baseEncode(bytes) }`;
      } else {
        throw Error('Unknown type, must be binary type');
      }
    }
  }
  class Decoder {
    constructor(name, prefix, baseDecode) {
      this.name = name;
      this.prefix = prefix;
      this.baseDecode = baseDecode;
    }
    decode(text) {
      if (typeof text === 'string') {
        switch (text[0]) {
        case this.prefix: {
            return this.baseDecode(text.slice(1));
          }
        default: {
            throw Error(`Unable to decode multibase string ${ JSON.stringify(text) }, ${ this.name } decoder only supports inputs prefixed with ${ this.prefix }`);
          }
        }
      } else {
        throw Error('Can only multibase decode strings');
      }
    }
    or(decoder) {
      return or(this, decoder);
    }
  }
  class ComposedDecoder {
    constructor(decoders) {
      this.decoders = decoders;
    }
    or(decoder) {
      return or(this, decoder);
    }
    decode(input) {
      const prefix = input[0];
      const decoder = this.decoders[prefix];
      if (decoder) {
        return decoder.decode(input);
      } else {
        throw RangeError(`Unable to decode multibase string ${ JSON.stringify(input) }, only inputs prefixed with ${ Object.keys(this.decoders) } are supported`);
      }
    }
  }
  const or = (left, right) => new ComposedDecoder({
    ...left.decoders || { [left.prefix]: left },
    ...right.decoders || { [right.prefix]: right }
  });
  class Codec {
    constructor(name, prefix, baseEncode, baseDecode) {
      this.name = name;
      this.prefix = prefix;
      this.baseEncode = baseEncode;
      this.baseDecode = baseDecode;
      this.encoder = new Encoder(name, prefix, baseEncode);
      this.decoder = new Decoder(name, prefix, baseDecode);
    }
    encode(input) {
      return this.encoder.encode(input);
    }
    decode(input) {
      return this.decoder.decode(input);
    }
  }
  const from$1 = ({name, prefix, encode, decode}) => new Codec(name, prefix, encode, decode);
  const baseX = ({prefix, name, alphabet}) => {
    const {encode, decode} = _brrp__multiformats_scope_baseX(alphabet, name);
    return from$1({
      prefix,
      name,
      encode,
      decode: text => coerce(decode(text))
    });
  };
  const decode$1 = (string, alphabet, bitsPerChar, name) => {
    const codes = {};
    for (let i = 0; i < alphabet.length; ++i) {
      codes[alphabet[i]] = i;
    }
    let end = string.length;
    while (string[end - 1] === '=') {
      --end;
    }
    const out = new Uint8Array(end * bitsPerChar / 8 | 0);
    let bits = 0;
    let buffer = 0;
    let written = 0;
    for (let i = 0; i < end; ++i) {
      const value = codes[string[i]];
      if (value === undefined) {
        throw new SyntaxError(`Non-${ name } character`);
      }
      buffer = buffer << bitsPerChar | value;
      bits += bitsPerChar;
      if (bits >= 8) {
        bits -= 8;
        out[written++] = 255 & buffer >> bits;
      }
    }
    if (bits >= bitsPerChar || 255 & buffer << 8 - bits) {
      throw new SyntaxError('Unexpected end of data');
    }
    return out;
  };
  const encode$2 = (data, alphabet, bitsPerChar) => {
    const pad = alphabet[alphabet.length - 1] === '=';
    const mask = (1 << bitsPerChar) - 1;
    let out = '';
    let bits = 0;
    let buffer = 0;
    for (let i = 0; i < data.length; ++i) {
      buffer = buffer << 8 | data[i];
      bits += 8;
      while (bits > bitsPerChar) {
        bits -= bitsPerChar;
        out += alphabet[mask & buffer >> bits];
      }
    }
    if (bits) {
      out += alphabet[mask & buffer << bitsPerChar - bits];
    }
    if (pad) {
      while (out.length * bitsPerChar & 7) {
        out += '=';
      }
    }
    return out;
  };
  const rfc4648 = ({name, prefix, bitsPerChar, alphabet}) => {
    return from$1({
      prefix,
      name,
      encode(input) {
        return encode$2(input, alphabet, bitsPerChar);
      },
      decode(input) {
        return decode$1(input, alphabet, bitsPerChar, name);
      }
    });
  };

  const base58btc = baseX({
    name: 'base58btc',
    prefix: 'z',
    alphabet: '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  });
  baseX({
    name: 'base58flickr',
    prefix: 'Z',
    alphabet: '123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ'
  });

  const base32 = rfc4648({
    prefix: 'b',
    name: 'base32',
    alphabet: 'abcdefghijklmnopqrstuvwxyz234567',
    bitsPerChar: 5
  });
  rfc4648({
    prefix: 'B',
    name: 'base32upper',
    alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',
    bitsPerChar: 5
  });
  rfc4648({
    prefix: 'c',
    name: 'base32pad',
    alphabet: 'abcdefghijklmnopqrstuvwxyz234567=',
    bitsPerChar: 5
  });
  rfc4648({
    prefix: 'C',
    name: 'base32padupper',
    alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567=',
    bitsPerChar: 5
  });
  rfc4648({
    prefix: 'v',
    name: 'base32hex',
    alphabet: '0123456789abcdefghijklmnopqrstuv',
    bitsPerChar: 5
  });
  rfc4648({
    prefix: 'V',
    name: 'base32hexupper',
    alphabet: '0123456789ABCDEFGHIJKLMNOPQRSTUV',
    bitsPerChar: 5
  });
  rfc4648({
    prefix: 't',
    name: 'base32hexpad',
    alphabet: '0123456789abcdefghijklmnopqrstuv=',
    bitsPerChar: 5
  });
  rfc4648({
    prefix: 'T',
    name: 'base32hexpadupper',
    alphabet: '0123456789ABCDEFGHIJKLMNOPQRSTUV=',
    bitsPerChar: 5
  });
  rfc4648({
    prefix: 'h',
    name: 'base32z',
    alphabet: 'ybndrfg8ejkmcpqxot1uwisza345h769',
    bitsPerChar: 5
  });

  class CID {
    constructor(version, code, multihash, bytes) {
      this.code = code;
      this.version = version;
      this.multihash = multihash;
      this.bytes = bytes;
      this.byteOffset = bytes.byteOffset;
      this.byteLength = bytes.byteLength;
      this.asCID = this;
      this._baseCache = new Map();
      Object.defineProperties(this, {
        byteOffset: hidden,
        byteLength: hidden,
        code: readonly$1,
        version: readonly$1,
        multihash: readonly$1,
        bytes: readonly$1,
        _baseCache: hidden,
        asCID: hidden
      });
    }
    toV0() {
      switch (this.version) {
      case 0: {
          return this;
        }
      default: {
          const {code, multihash} = this;
          if (code !== DAG_PB_CODE) {
            throw new Error('Cannot convert a non dag-pb CID to CIDv0');
          }
          if (multihash.code !== SHA_256_CODE) {
            throw new Error('Cannot convert non sha2-256 multihash CID to CIDv0');
          }
          return CID.createV0(multihash);
        }
      }
    }
    toV1() {
      switch (this.version) {
      case 0: {
          const {code, digest} = this.multihash;
          const multihash = create$2(code, digest);
          return CID.createV1(this.code, multihash);
        }
      case 1: {
          return this;
        }
      default: {
          throw Error(`Can not convert CID version ${ this.version } to version 0. This is a bug please report`);
        }
      }
    }
    equals(other) {
      return other && this.code === other.code && this.version === other.version && equals(this.multihash, other.multihash);
    }
    toString(base) {
      const {bytes, version, _baseCache} = this;
      switch (version) {
      case 0:
        return toStringV0(bytes, _baseCache, base || base58btc.encoder);
      default:
        return toStringV1(bytes, _baseCache, base || base32.encoder);
      }
    }
    toJSON() {
      return {
        code: this.code,
        version: this.version,
        hash: this.multihash.bytes
      };
    }
    get [Symbol.toStringTag]() {
      return 'CID';
    }
    [Symbol.for('nodejs.util.inspect.custom')]() {
      return 'CID(' + this.toString() + ')';
    }
    static isCID(value) {
      deprecate(/^0\.0/, IS_CID_DEPRECATION);
      return !!(value && (value[cidSymbol] || value.asCID === value));
    }
    get toBaseEncodedString() {
      throw new Error('Deprecated, use .toString()');
    }
    get codec() {
      throw new Error('"codec" property is deprecated, use integer "code" property instead');
    }
    get buffer() {
      throw new Error('Deprecated .buffer property, use .bytes to get Uint8Array instead');
    }
    get multibaseName() {
      throw new Error('"multibaseName" property is deprecated');
    }
    get prefix() {
      throw new Error('"prefix" property is deprecated');
    }
    static asCID(value) {
      if (value instanceof CID) {
        return value;
      } else if (value != null && value.asCID === value) {
        const {version, code, multihash, bytes} = value;
        return new CID(version, code, multihash, bytes || encodeCID(version, code, multihash.bytes));
      } else if (value != null && value[cidSymbol] === true) {
        const {version, multihash, code} = value;
        const digest = decode$2(multihash);
        return CID.create(version, code, digest);
      } else {
        return null;
      }
    }
    static create(version, code, digest) {
      if (typeof code !== 'number') {
        throw new Error('String codecs are no longer supported');
      }
      switch (version) {
      case 0: {
          if (code !== DAG_PB_CODE) {
            throw new Error(`Version 0 CID must use dag-pb (code: ${ DAG_PB_CODE }) block encoding`);
          } else {
            return new CID(version, code, digest, digest.bytes);
          }
        }
      case 1: {
          const bytes = encodeCID(version, code, digest.bytes);
          return new CID(version, code, digest, bytes);
        }
      default: {
          throw new Error('Invalid version');
        }
      }
    }
    static createV0(digest) {
      return CID.create(0, DAG_PB_CODE, digest);
    }
    static createV1(code, digest) {
      return CID.create(1, code, digest);
    }
    static decode(bytes) {
      const [cid, remainder] = CID.decodeFirst(bytes);
      if (remainder.length) {
        throw new Error('Incorrect length');
      }
      return cid;
    }
    static decodeFirst(bytes) {
      const specs = CID.inspectBytes(bytes);
      const prefixSize = specs.size - specs.multihashSize;
      const multihashBytes = coerce(bytes.subarray(prefixSize, prefixSize + specs.multihashSize));
      if (multihashBytes.byteLength !== specs.multihashSize) {
        throw new Error('Incorrect length');
      }
      const digestBytes = multihashBytes.subarray(specs.multihashSize - specs.digestSize);
      const digest = new Digest(specs.multihashCode, specs.digestSize, digestBytes, multihashBytes);
      const cid = specs.version === 0 ? CID.createV0(digest) : CID.createV1(specs.codec, digest);
      return [
        cid,
        bytes.subarray(specs.size)
      ];
    }
    static inspectBytes(initialBytes) {
      let offset = 0;
      const next = () => {
        const [i, length] = decode$3(initialBytes.subarray(offset));
        offset += length;
        return i;
      };
      let version = next();
      let codec = DAG_PB_CODE;
      if (version === 18) {
        version = 0;
        offset = 0;
      } else if (version === 1) {
        codec = next();
      }
      if (version !== 0 && version !== 1) {
        throw new RangeError(`Invalid CID version ${ version }`);
      }
      const prefixSize = offset;
      const multihashCode = next();
      const digestSize = next();
      const size = offset + digestSize;
      const multihashSize = size - prefixSize;
      return {
        version,
        codec,
        multihashCode,
        digestSize,
        multihashSize,
        size
      };
    }
    static parse(source, base) {
      const [prefix, bytes] = parseCIDtoBytes(source, base);
      const cid = CID.decode(bytes);
      cid._baseCache.set(prefix, source);
      return cid;
    }
  }
  const parseCIDtoBytes = (source, base) => {
    switch (source[0]) {
    case 'Q': {
        const decoder = base || base58btc;
        return [
          base58btc.prefix,
          decoder.decode(`${ base58btc.prefix }${ source }`)
        ];
      }
    case base58btc.prefix: {
        const decoder = base || base58btc;
        return [
          base58btc.prefix,
          decoder.decode(source)
        ];
      }
    case base32.prefix: {
        const decoder = base || base32;
        return [
          base32.prefix,
          decoder.decode(source)
        ];
      }
    default: {
        if (base == null) {
          throw Error('To parse non base32 or base58btc encoded CID multibase decoder must be provided');
        }
        return [
          source[0],
          base.decode(source)
        ];
      }
    }
  };
  const toStringV0 = (bytes, cache, base) => {
    const {prefix} = base;
    if (prefix !== base58btc.prefix) {
      throw Error(`Cannot string encode V0 in ${ base.name } encoding`);
    }
    const cid = cache.get(prefix);
    if (cid == null) {
      const cid = base.encode(bytes).slice(1);
      cache.set(prefix, cid);
      return cid;
    } else {
      return cid;
    }
  };
  const toStringV1 = (bytes, cache, base) => {
    const {prefix} = base;
    const cid = cache.get(prefix);
    if (cid == null) {
      const cid = base.encode(bytes);
      cache.set(prefix, cid);
      return cid;
    } else {
      return cid;
    }
  };
  const DAG_PB_CODE = 112;
  const SHA_256_CODE = 18;
  const encodeCID = (version, code, multihash) => {
    const codeOffset = encodingLength(version);
    const hashOffset = codeOffset + encodingLength(code);
    const bytes = new Uint8Array(hashOffset + multihash.byteLength);
    encodeTo(version, bytes, 0);
    encodeTo(code, bytes, codeOffset);
    bytes.set(multihash, hashOffset);
    return bytes;
  };
  const cidSymbol = Symbol.for('@ipld/js-cid/CID');
  const readonly$1 = {
    writable: false,
    configurable: false,
    enumerable: true
  };
  const hidden = {
    writable: false,
    enumerable: false,
    configurable: false
  };
  const version = '0.0.0-dev';
  const deprecate = (range, message) => {
    if (range.test(version)) {
      console.warn(message);
    } else {
      throw new Error(message);
    }
  };
  const IS_CID_DEPRECATION = `CID.isCID(v) is deprecated and will be removed in the next major release.
Following code pattern:

if (CID.isCID(value)) {
  doSomethingWithCID(value)
}

Is replaced with:

const cid = CID.asCID(value)
if (cid) {
  // Make sure to use cid instead of value
  doSomethingWithCID(cid)
}
`;

  const CID_CBOR_TAG = 42;
  function cidEncoder(obj) {
    if (obj.asCID !== obj) {
      return null;
    }
    const cid = CID.asCID(obj);
    if (!cid) {
      return null;
    }
    const bytes = new Uint8Array(cid.bytes.byteLength + 1);
    bytes.set(cid.bytes, 1);
    return [
      new Token(Type.tag, CID_CBOR_TAG),
      new Token(Type.bytes, bytes)
    ];
  }
  function undefinedEncoder() {
    throw new Error('`undefined` is not supported by the IPLD Data Model and cannot be encoded');
  }
  function numberEncoder(num) {
    if (Number.isNaN(num)) {
      throw new Error('`NaN` is not supported by the IPLD Data Model and cannot be encoded');
    }
    if (num === Infinity || num === -Infinity) {
      throw new Error('`Infinity` and `-Infinity` is not supported by the IPLD Data Model and cannot be encoded');
    }
    return null;
  }
  const encodeOptions = {
    float64: true,
    typeEncoders: {
      Object: cidEncoder,
      undefined: undefinedEncoder,
      number: numberEncoder
    }
  };
  function cidDecoder(bytes) {
    if (bytes[0] !== 0) {
      throw new Error('Invalid CID for CBOR tag 42; expected leading 0x00');
    }
    return CID.decode(bytes.subarray(1));
  }
  const decodeOptions = {
    allowIndefinite: false,
    coerceUndefinedToNull: true,
    allowNaN: false,
    allowInfinity: false,
    allowBigInt: true,
    strict: true,
    useMaps: false,
    tags: []
  };
  decodeOptions.tags[CID_CBOR_TAG] = cidDecoder;
  const name = 'dag-cbor';
  const code = 113;
  const encode$1 = node => encode$4(node, encodeOptions);
  const decode = data => decode$5(data, decodeOptions);

  var codec = /*#__PURE__*/Object.freeze({
    __proto__: null,
    name: name,
    code: code,
    encode: encode$1,
    decode: decode
  });

  const from = ({name, code, encode}) => new Hasher(name, code, encode);
  class Hasher {
    constructor(name, code, encode) {
      this.name = name;
      this.code = code;
      this.encode = encode;
    }
    async digest(input) {
      if (input instanceof Uint8Array) {
        const digest = await this.encode(input);
        return create$2(this.code, digest);
      } else {
        throw Error('Unknown type, must be binary type');
      }
    }
  }

  const sha = name => async data => new Uint8Array(await crypto.subtle.digest(name, data));
  const sha256 = from({
    name: 'sha2-256',
    code: 18,
    encode: sha('SHA-256')
  });
  from({
    name: 'sha2-512',
    code: 19,
    encode: sha('SHA-512')
  });

  const readonly = ({enumerable = true, configurable = false} = {}) => ({
    enumerable,
    configurable,
    writable: false
  });
  const links = function* (source, base) {
    if (source == null)
      return;
    if (source instanceof Uint8Array)
      return;
    for (const [key, value] of Object.entries(source)) {
      const path = [
        ...base,
        key
      ];
      if (value != null && typeof value === 'object') {
        if (Array.isArray(value)) {
          for (const [index, element] of value.entries()) {
            const elementPath = [
              ...path,
              index
            ];
            const cid = CID.asCID(element);
            if (cid) {
              yield [
                elementPath.join('/'),
                cid
              ];
            } else if (typeof element === 'object') {
              yield* links(element, elementPath);
            }
          }
        } else {
          const cid = CID.asCID(value);
          if (cid) {
            yield [
              path.join('/'),
              cid
            ];
          } else {
            yield* links(value, path);
          }
        }
      }
    }
  };
  const tree = function* (source, base) {
    if (source == null)
      return;
    for (const [key, value] of Object.entries(source)) {
      const path = [
        ...base,
        key
      ];
      yield path.join('/');
      if (value != null && !(value instanceof Uint8Array) && typeof value === 'object' && !CID.asCID(value)) {
        if (Array.isArray(value)) {
          for (const [index, element] of value.entries()) {
            const elementPath = [
              ...path,
              index
            ];
            yield elementPath.join('/');
            if (typeof element === 'object' && !CID.asCID(element)) {
              yield* tree(element, elementPath);
            }
          }
        } else {
          yield* tree(value, path);
        }
      }
    }
  };
  const get = (source, path) => {
    let node = source;
    for (const [index, key] of path.entries()) {
      node = node[key];
      if (node == null) {
        throw new Error(`Object has no property at ${ path.slice(0, index + 1).map(part => `[${ JSON.stringify(part) }]`).join('') }`);
      }
      const cid = CID.asCID(node);
      if (cid) {
        return {
          value: cid,
          remaining: path.slice(index + 1).join('/')
        };
      }
    }
    return { value: node };
  };
  class Block {
    constructor({cid, bytes, value}) {
      if (!cid || !bytes || typeof value === 'undefined')
        throw new Error('Missing required argument');
      this.cid = cid;
      this.bytes = bytes;
      this.value = value;
      this.asBlock = this;
      Object.defineProperties(this, {
        cid: readonly(),
        bytes: readonly(),
        value: readonly(),
        asBlock: readonly()
      });
    }
    links() {
      return links(this.value, []);
    }
    tree() {
      return tree(this.value, []);
    }
    get(path = '/') {
      return get(this.value, path.split('/').filter(Boolean));
    }
  }
  const encode = async ({value, codec, hasher}) => {
    if (typeof value === 'undefined')
      throw new Error('Missing required argument "value"');
    if (!codec || !hasher)
      throw new Error('Missing required argument: codec or hasher');
    const bytes = codec.encode(value);
    const hash = await hasher.digest(bytes);
    const cid = CID.create(1, codec.code, hash);
    return new Block({
      value,
      bytes,
      cid
    });
  };

  const readUInt32LE = (buffer) => {
    const offset = buffer.byteLength - 4;
    return ((buffer[offset]) |
            (buffer[offset + 1] << 8) |
            (buffer[offset + 2] << 16)) +
            (buffer[offset + 3] * 0x1000000)
  };

  const MAX_UINT32 = 4294967295;

  const bf = factor => {
    const threshold = Math.floor(MAX_UINT32 / factor);
    return async entry => {
      const identity = await entry.identity();
      /* c8 ignore next */
      if (typeof identity !== 'number') {
        /* c8 ignore next */
        throw new Error('Identity must be a number')
        /* c8 ignore next */
      }
      if (identity <= threshold) {
        return true
      }
      return false
    }
  };
  /*
  const enc64 = num => {
    const b = Buffer.allocUnsafe(8)
    b.writeBigUint64LE(num)
    return b
  }
  */

  const simpleCompare = (a, b) => {
    if (a === b) return 0
    if (a > b) return 1
    return -1
  };

  class CIDCounter {
    constructor () {
      this._cids = new Set();
    }

    add (node) {
      /* c8 ignore next */
      if (!node.address) {
        /* c8 ignore next */
        throw new Error('Cannot add node without address')
        /* c8 ignore next */
      }
      if (node.address.then) {
        const p = node.address.then(cid => this._cids.add(cid.toString()));
        this._cids.add(p);
        p.then(() => this._cids.delete(p));
      } else {
        this._cids.add(node.address.toString());
      }
    }

    async all () {
      await Promise.all([...this._cids]);
      return this._cids
    }
  }

  class Entry {
    constructor ({ key, address }, opts = {}) {
      this.key = key;
      this.address = address;
      this.codec = opts.codec;
      this.hasher = opts.hasher;
    }

    get isEntry () {
      return true
    }
  }

  class EntryList {
    constructor ({ entries, closed }) {
      if (typeof closed !== 'boolean') throw new Error('Missing required argument "closed"')
      this.entries = entries;
      this.closed = closed;
      this.startKey = entries[0].key;
    }

    find (key, compare) {
      const { entries } = this;
      for (let i = entries.length - 1; i > -1; i--) {
        const entry = entries[i];
        const comp = compare(key, entry.key);
        if (comp > -1) {
          return [i, entry]
        }
      }
      return null
    }

    findMany (keys, compare, sorted = false, strict = false) {
      const { entries } = this;
      const results = new Map();
      // Note: object based entries must be sorted
      if (!sorted) {
        keys = keys.sort(compare);
      } else {
        keys = [...keys];
      }
      for (let i = entries.length - 1; i > -1; i--) {
        if (!keys.length) break
        const entry = entries[i];
        const found = [];
        while (keys.length) {
          let key = keys[keys.length - 1];
          key = key.key ? key.key : key;
          const comp = compare(key, entry.key);
          if (!strict) {
            if (comp > -1) {
              found.push(keys.pop());
            } else {
              break
            }
          } else {
            if (comp === 0) {
              found.push(keys.pop());
            } else if (comp > 0) {
              keys.pop();
            } else {
              break
            }
          }
        }
        if (found.length) {
          results.set(i, [entry, found]);
        }
      }
      return results
    }

    findRange (start, end, compare) {
      const { entries } = this;
      let last;
      let first = 0;
      for (let i = entries.length - 1; i > -1; i--) {
        const entry = entries[i];
        const comp = compare(end, entry.key);
        if (comp > 0) {
          last = i;
          break
        }
      }
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const comp = compare(start, entry.key);
        if (comp === 0) {
          first = i;
          break
        } else if (comp < 0) {
          break
        }
        first = i;
      }
      return { first, last, entries: entries.slice(first, last + 1) }
    }
  }

  const stringKey = key => typeof key === 'string' ? key : JSON.stringify(key);

  class Node {
    constructor ({ entryList, chunker, distance, getNode, compare, cache }) {
      this.entryList = entryList;
      this.chunker = chunker;
      this.distance = distance;
      this.getNode = getNode;
      this.compare = compare;
      this.cache = cache;
    }

    get closed () {
      return this.entryList.closed
    }

    get key () {
      return this.entryList.startKey
    }

    async getEntry (key, cids = new CIDCounter()) {
      const result = await this._getEntry(key, cids);
      return { result, cids }
    }

    async _getEntry (key, cids) {
      cids.add(this);
      let node = this;
      while (!node.isLeaf) {
        const result = node.entryList.find(key, this.compare);
        if (result === null) throw new Error('Not found')
        const [, entry] = result;
        node = await this.getNode(await entry.address);
        cids.add(node);
      }
      const result = node.entryList.find(key, this.compare);
      if (result === null) throw new Error('Not found')
      const [, entry] = result;
      return entry
    }

    async getAllEntries (cids = new CIDCounter()) {
      const result = await this._getAllEntries(cids);
      return { result, cids }
    }

    _getAllEntries (cids) {
      cids.add(this);
      if (this.isLeaf) {
        return this.entryList.entries
      } else {
        const { entries } = this.entryList;
        const mapper = async entry => this.getNode(await entry.address).then(node => node._getAllEntries(cids));
        return Promise.all(entries.map(mapper)).then(results => results.flat())
      }
    }

    async getEntries (keys, sorted = false, cids = new CIDCounter()) {
      const result = await this._getEntries(keys, sorted, cids);
      return { result, cids }
    }

    async _getEntries (keys, sorted, cids) {
      cids.add(this);
      if (!sorted) keys = keys.sort(this.compare);
      const results = this.entryList.findMany(keys, this.compare, true, this.isLeaf);
      if (this.isLeaf) {
        return [...results.values()].map(([entry]) => entry)
      }
      let entries = [];
      for (const [entry, keys] of [...results.values()].reverse()) {
        const p = this.getNode(await entry.address);
        entries.push(p.then(node => node._getEntries(keys.reverse(), true, cids)));
      }
      entries = await Promise.all(entries);
      return entries.flat()
    }

    async getRangeEntries (start, end, cids = new CIDCounter()) {
      const result = await this._getRangeEntries(start, end, cids);
      return { result, cids }
    }

    _getRangeEntries (start, end, cids) {
      cids.add(this);
      const { entries } = this.entryList.findRange(start, end, this.compare);
      if (this.isLeaf) {
        return entries.filter(entry => {
          const s = this.compare(start, entry.key);
          const e = this.compare(end, entry.key);
          if (s <= 0 && e >= 0) return true
          return false
        })
      }

      if (!entries.length) return []
      const thenRange = async entry => this.getNode(await entry.address).then(node => {
        return node._getRangeEntries(start, end, cids)
      });
      const results = [thenRange(entries.shift())];

      if (!entries.length) return results[0]
      const last = thenRange(entries.pop());

      while (entries.length) {
        const thenAll = async entry => this.getNode(await entry.address).then(async node => {
          return node._getAllEntries(cids)
        });
        results.push(thenAll(entries.shift()));
      }
      results.push(last);
      return Promise.all(results).then(results => results.flat())
    }

    async transaction (bulk, opts = {}) {
      const {
        sorted,
        LeafClass,
        LeafEntryClass,
        BranchClass,
        BranchEntryClass
      } = opts;
      const entryOptions = {
        codec: this.codec,
        hasher: this.hasher,
        getNode: this.getNode,
        compare: this.compare,
        cache: this.cache,
        ...opts
      };
      const nodeOptions = { chunker: this.chunker, opts: entryOptions };
      if (!sorted) bulk = bulk.sort(({ key: a }, { key: b }) => this.compare(a, b));
      const results = this.entryList.findMany(bulk, this.compare, true, this.isLeaf);
      let entries = [];
      if (this.isLeaf) {
        const previous = [];
        const changes = {};
        const deletes = new Map();
        for (const { key, del, value } of bulk) {
          const skey = stringKey(key);
          if (del) {
            if (typeof changes[skey] === 'undefined') deletes.set(skey, null);
          } else {
            changes[skey] = { key, value };
            deletes.delete(skey);
          }
        }
        entries = [...this.entryList.entries];
        for (const [i, [entry]] of results) {
          previous.push(entry);
          const skey = stringKey(entry.key);
          if (deletes.has(skey)) {
            deletes.set(skey, i);
          } else {
            entries[i] = new LeafEntryClass(changes[skey], entryOptions);
            delete changes[skey];
          }
        }
        let count = 0;
        for (const [, i] of deletes) {
          entries.splice(i - count++, 1);
        }
        const appends = Object.values(changes).map(obj => new LeafEntryClass(obj, entryOptions));
        // TODO: there's a faster version of this that only does one iteration
        entries = entries.concat(appends).sort(({ key: a }, { key: b }) => this.compare(a, b));
        const _opts = { entries, NodeClass: LeafClass, distance: 0, ...nodeOptions };
        const nodes = await Node.from(_opts);
        return { nodes, previous, blocks: [], distance: 0 }
      } else {
        for (const [i, [entry, keys]] of results) {
          const p = this.getNode(await entry.address)
            .then(node => node.transaction(keys.reverse(), { ...opts, sorted: true }))
            .then(r => ({ entry, keys, distance, ...r }));
          results.set(i, p);
        }
        entries = [...this.entryList.entries];
        const final = { previous: [], blocks: [] };
        let distance;
        for (const [i, p] of results) {
          const { nodes, previous, blocks, distance: _distance } = await p;
          distance = _distance;
          entries[i] = nodes;
          if (previous.length) final.previous = final.previous.concat(previous);
          if (blocks.length) final.blocks = final.blocks.concat(blocks);
        }
        entries = entries.flat();
        // TODO: rewrite this to use getNode concurrently on merge
        let newEntries = [];
        let prepend = null;
        for (let entry of entries) {
          if (prepend) {
            if (entry.isEntry) entry = await this.getNode(await entry.address);
            const entries = prepend.entryList.entries.concat(entry.entryList.entries);
            prepend = null;
            const NodeClass = distance === 0 ? LeafClass : BranchClass;
            const _opts = { entries, NodeClass, distance, ...nodeOptions };
            const nodes = await Node.from(_opts);
            if (!nodes[nodes.length - 1].closed) {
              prepend = nodes.pop();
            }
            if (nodes.length) {
              newEntries = newEntries.concat(nodes);
            }
          } else {
            if (!entry.isEntry && !entry.closed) {
              prepend = entry;
            } else {
              newEntries.push(entry);
            }
          }
        }
        if (prepend) {
          newEntries.push(prepend);
        }
        distance++;
        const toEntry = async branch => {
          if (branch.isEntry) return branch
          const block = await branch.encode();
          final.blocks.push(block);
          this.cache.set(branch);
          return new BranchEntryClass(branch, entryOptions)
        };
        entries = await Promise.all(newEntries.map(toEntry));
        const _opts = { entries, NodeClass: BranchClass, distance, ...nodeOptions };
        return { nodes: await Node.from(_opts), ...final, distance }
      }
    }

    async bulk (bulk, opts = {}) {
      const { BranchClass, BranchEntryClass } = opts;
      const entryOptions = {
        codec: this.codec,
        hasher: this.hasher,
        getNode: this.getNode,
        compare: this.compare,
        cache: this.cache,
        ...opts
      };
      const nodeOptions = { chunker: this.chunker, opts: entryOptions };

      const results = await this.transaction(bulk, opts);
      const onBranch = async branch => {
        const block = await branch.encode();
        results.blocks.push(block);
        this.cache.set(branch);
      };
      while (results.nodes.length > 1) {
        const distance = results.nodes[0].distance + 1;
        const mapper = async node => {
          await onBranch(node);
          return new BranchEntryClass(node, entryOptions)
        };
        const entries = await Promise.all(results.nodes.map(mapper));
        results.nodes = await Node.from({ entries, NodeClass: BranchClass, distance, ...nodeOptions });
        const promises = results.nodes.map(node => node.encode())
        ;(await Promise.all(promises)).forEach(b => results.blocks.push(b));
      }
      const [root] = results.nodes;
      await onBranch(root);
      return { ...results, root }
    }

    static async from ({ entries, chunker, NodeClass, distance, opts }) {
      const parts = [];
      let chunk = [];
      for (const entry of entries) {
        chunk.push(entry);
        if (await chunker(entry, distance)) {
          parts.push(new EntryList({ entries: chunk, closed: true }));
          chunk = [];
        }
      }
      if (chunk.length) {
        parts.push(new EntryList({ entries: chunk, closed: false }));
      }
      return parts.map(entryList => new NodeClass({ entryList, chunker, distance, ...opts }))
    }
  }

  class IPLDNode extends Node {
    constructor ({ codec, hasher, block, ...opts }) {
      super(opts);
      this.codec = codec;
      this.hasher = hasher;
      if (!block) {
        this.block = this.encode();
        this.address = this.block.then(block => block.cid);
      } else {
        this.block = block;
        this.address = block.cid;
      }
    }

    async get (key) {
      const { result: entry, cids } = await this.getEntry(key);
      return { result: entry.key, cids }
    }

    async encode () {
      if (this.block) return this.block
      const value = await this.encodeNode();
      const opts = { codec: this.codec, hasher: this.hasher, value };
      this.block = await encode(opts);
      return this.block
    }
  }

  class IPLDBranch extends IPLDNode {
    async encodeNode () {
      const { entries } = this.entryList;
      const mapper = async entry => [entry.key, await entry.address];
      const list = await Promise.all(entries.map(mapper));
      return { branch: [this.distance, list], closed: this.closed }
    }

    get isBranch () {
      return true
    }
  }

  class IPLDLeaf extends IPLDNode {
    encodeNode () {
      const list = this.entryList.entries.map(entry => entry.encodeNode());
      return { leaf: list, closed: this.closed }
    }

    get isLeaf () {
      return true
    }
  }

  const create$1 = async function * (obj) {
    let {
      LeafClass,
      LeafEntryClass,
      BranchClass,
      BranchEntryClass,
      list,
      chunker,
      compare,
      ...opts
    } = obj;
    list = list.map(value => new LeafEntryClass(value, opts));
    opts.compare = compare;
    let nodes = await Node.from({ entries: list, chunker, NodeClass: LeafClass, distance: 0, opts });
    yield * nodes;
    let distance = 1;
    while (nodes.length > 1) {
      const mapper = async node => new BranchEntryClass({ key: node.key, address: await node.address }, opts);
      const entries = await Promise.all(nodes.map(mapper));
      nodes = await Node.from({ entries, chunker, NodeClass: BranchClass, distance, opts });
      yield * nodes;
      distance++;
    }
  };

  class MapEntry extends Entry {
    async identity () {
      const encoded = await this.codec.encode(await this.encodeNode());
      const hash = await this.hasher.encode(encoded);
      return readUInt32LE(hash)
    }
  }

  class MapLeafEntry extends MapEntry {
    constructor (node, opts) {
      super(node, opts);
      this.value = node.value;
    }

    encodeNode () {
      return [this.key, this.value]
    }
  }

  class MapBranchEntry extends MapEntry {
    async encodeNode () {
      return [this.key, await this.address]
    }
  }

  const getValue = async (node, key) => {
    const { result: entry, cids } = await node.getEntry(key);
    return { result: entry.value, cids }
  };

  const getManyValues = async (node, keys) => {
    const { result: entries, cids } = await node.getEntries(keys);
    return { result: entries.map(entry => entry.value), cids }
  };

  class MapLeaf extends IPLDLeaf {
    get (key) {
      return getValue(this, key)
    }

    getMany (keys) {
      return getManyValues(this, keys)
    }

    bulk (bulk, opts = {}) {
      return super.bulk(bulk, { ...classes, ...opts })
    }
  }
  class MapBranch extends IPLDBranch {
    get (key) {
      return getValue(this, key)
    }

    getMany (keys) {
      return getManyValues(this, keys)
    }

    bulk (bulk, opts = {}) {
      return super.bulk(bulk, { ...classes, ...opts })
    }
  }

  const classes = {
    LeafClass: MapLeaf,
    LeafEntryClass: MapLeafEntry,
    BranchClass: MapBranch,
    BranchEntryClass: MapBranchEntry
  };

  const createGetNode = (get, cache, chunker, codec, hasher, compare, opts) => {
    const LeafClass = opts.LeafClass || MapLeaf;
    const LeafEntryClass = opts.LeafEntryClass || MapLeafEntry;
    const BranchClass = opts.BranchClass || MapBranch;
    const BranchEntryClass = opts.BranchEntryClass || MapBranchEntry;

    const entryOpts = { codec, hasher };

    const decoder = block => {
      const { value } = block;
      const opts = { chunker, cache, block, getNode, codec, hasher, compare };
      let entries;
      let CLS;
      if (value.leaf) {
        entries = value.leaf.map(([key, value]) => new LeafEntryClass({ key, value }, entryOpts));
        CLS = LeafClass;
      } else if (value.branch) {
        const [distance, _entries] = value.branch;
        opts.distance = distance;
        entries = _entries.map(([key, address]) => new BranchEntryClass({ key, address }, entryOpts));
        CLS = BranchClass;
      } /* c8 ignore next */ else {
        /* c8 ignore next */
        throw new Error('Unknown block data, does not match schema')
        /* c8 ignore next */
      }
      const entryList = new EntryList({ entries, closed: value.closed });
      const node = new CLS({ entryList, ...opts });
      cache.set(node);
      return node
    };
    const getNode = async cid => {
      if (cache.has(cid)) return cache.get(cid)
      return get(cid).then(block => decoder(block))
    };
    return getNode
  };

  const create = ({ get, cache, chunker, list, codec, hasher, sorted, compare, ...opts }) => {
    if (!sorted) list = list.sort(({ key: a }, { key: b }) => compare(a, b));
    const getNode = createGetNode(get, cache, chunker, codec, hasher, compare, opts);
    const _opts = {
      list,
      codec,
      hasher,
      chunker,
      getNode,
      sorted,
      compare,
      cache,
      LeafClass: opts.LeafClass || MapLeaf,
      LeafEntryClass: opts.LeafEntryClass || MapLeafEntry,
      BranchClass: opts.BranchClass || MapBranch,
      BranchEntryClass: opts.BranchEntryClass || MapBranchEntry
    };
    return create$1(_opts)
  };

  const load = ({ cid, get, cache, chunker, codec, hasher, compare, ...opts }) => {
    const getNode = createGetNode(get, cache, chunker, codec, hasher, compare, opts);
    return getNode(cid)
  };

  const nocache = {
    has: () => false,
    get: () => { throw new Error('Cannot ask for entries from nocache') },
    set: () => {}
  };

  //import { Readable } from "stream";

  // ============================================================================
  class URLIndex {
    constructor(storage) {
      this.root = null;

      this.storage = storage;

      //const cache = global;
      const cache = nocache;
      const chunker = bf(3);
      const get = (x) => this.storage.get(x);

      this.btreeOpts = { get, compare: simpleCompare, cache, chunker, codec, hasher: sha256 };
    }

    get rootCid() {
      return this.root ? this.root.block.cid : null;
    }

    async createNew(info) {
      await this._createTree([{ key: "@info", value: info }]);
      return this.rootCid;
    }

    async _createTree(list) {
      for await (const node of create({ list, ...this.btreeOpts })) {
        await this.storage.put(await node.block);
        this.root = node;
      }
    }

    async loadExisting(cid) {
      if (typeof(cid) === "string") {
        cid = CID.parse(cid);
      }
      this.root = await load({ cid, ...this.btreeOpts });
    }

    async add({ url, ts, cid, title = "" } = {}) {
      if (!cid || !url || !ts) {
        throw new Error("cid, url, ts must be provided");
      }

      const key = getSurt(url) + " " + ts;

      const value = { url, cid };
      if (title) {
        value.title = title;
      }

      const res = await this.root.getRangeEntries(key, key + "!");
      if (res && res.result.length) {
        console.log("already added!");
        return this.rootCid;
      }

      await this._insertTree([{ key, value }]);
      return this.rootCid;
    }

    async _insertTree(bulk) {
      const newtree = await this.root.bulk(bulk);
      await Promise.all(newtree.blocks.map((block) => this.storage.put(block)));
      this.root = newtree.root;
    }

    prefixUpperBound(url) {
      return (
        url.slice(0, -1) + String.fromCharCode(url.charCodeAt(url.length - 1) + 1)
      );
    }

    async query({ url, matchType = "exact"} = {}) {
      let start;
      let end;

      if (!url) {
        return [];
      }

      switch (matchType) {
        case "raw-prefix":
          start = url;
          end = this.prefixUpperBound(start);
          break;

        case "all":
          start = "";
          end = "zzz";
          break;

        case "prefix":
          start = getSurt(url);
          end = this.prefixUpperBound(start);
          break;

        case "exact":
        default:
          start = getSurt(url);
          end = start + "!";
      }

      const res = await this.root.getRangeEntries(start, end);

      return res.result.map((entry) => {
        return { key: entry.key, ...entry.value };
      });
    }
  }

  function getSurt(url) {
    try {
      if (!url.startsWith("https:") && !url.startsWith("http:")) {
        return url;
      }
      url = url.replace(/^(https?:\/\/)www\d*\./, "$1");
      const urlObj = new URL(url.toLowerCase());

      const hostParts = urlObj.hostname.split(".").reverse();
      let surt = hostParts.join(",");
      if (urlObj.port) {
        surt += ":" + urlObj.port;
      }
      surt += ")";
      surt += urlObj.pathname;
      if (urlObj.search) {
        urlObj.searchParams.sort();
        surt += urlObj.search;
      }
      return surt;
    } catch (e) {
      return url;
    }
  }

  // ============================================================================
  class BaseStorage {
    constructor() {
      this._cids = new Set();
      this._existing = new Set();
    }

    _add(cid) {
      if (!this._existing.has(cid.toString())) {
        this._cids.add(cid);
        //console.log("added ", cid);
      }
    }

    _addExisting(cid) {
      //console.log("track existing", cid);
      this._existing.add(cid.toString());
    }

    get cids() {
      return this._cids;
    }
  }

  // ============================================================================
  class MemStorage extends BaseStorage {
    constructor() {
      super();
      this.storage = {};
    }

    async get(cid) {
      const block = this.storage[cid.toString()];
      //console.log("getting: " + cid);

      if (!block) {
        throw new Error("Not found");
      }
      return block;
    }

    async put(block) {
      //console.log("putting: " + block.cid);
      this.storage[block.cid.toString()] = block;
      this._add(block.cid);
    }
  }

  // ============================================================================
  class IPFSStorage extends BaseStorage {
    constructor(ipfs) {
      super();
      this.ipfs = ipfs;
    }

    async get(cid) {
      console.log("getting: " + cid);
      this._addExisting(cid);

      const res = await this.ipfs.dag.get(cid);

      const value = res.value;

      return encode({ value, codec, hasher: sha256 });
    }

    async put(block) {
      console.log("putting: " + block.cid);
      const res = await this.ipfs.dag.put(block.bytes, {
        cid: block.cid,
        storeCodec: "dag-cbor",
        inputCodec: "dag-cbor",
      });
      if (res.toString() !== block.cid.toString()) {
        throw new Error("put resulted in wrong cid!");
      }
      this._add(block.cid);
    }
  }

  // ============================================================================
  class IPFSReadOnlyStorage extends BaseStorage {
    constructor(ipfs) {
      super();
      this.ipfsStore = new IPFSStorage(ipfs);
      this.memStore = new MemStorage();
      this.ipfs = ipfs;
    }

    async get(cid) {
      // first, try local store
      try {
        return await this.memStore.get(cid);
      } catch (e) {
        // try ipfs store
      }

      // then, ipfs store
      const result = await this.ipfsStore.get(cid);
      this.memStore._addExisting(cid);
      return result;
    }

    async put(block) {
      return await this.memStore.put(block);
    }

    get cids() {
      return this.memStore.cids;
    }
  }

  var storage = /*#__PURE__*/Object.freeze({
    __proto__: null,
    BaseStorage: BaseStorage,
    MemStorage: MemStorage,
    IPFSStorage: IPFSStorage,
    IPFSReadOnlyStorage: IPFSReadOnlyStorage
  });

  exports.CID = CID;
  exports.URLIndex = URLIndex;
  exports.storage = storage;

  Object.defineProperty(exports, '__esModule', { value: true });

  return exports;

})({});
