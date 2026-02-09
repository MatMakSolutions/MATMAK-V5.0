import { MvdRaw } from "./MvdRaw";

type MvdValue    = string | number | MvdDocument | Array<MvdValue>;
export type MvdDocument = { [key: string]: MvdValue };

// I need a encrypt / decrypt based on crypt-js
// https://stackoverflow.com/questions/41287108/how-to-encrypt-and-decrypt-string-with-my-passphrase-in-js
// https://stackoverflow.com/questions/41287108/how-to-encrypt-and-decrypt-string-with-my-passphrase-in-js

const SIZE = 8;

const SHIFT = 203;
const SHIFT_STEP = 7;

export function encrypt(data: Uint8Array) {
  let shift = SHIFT; // 203 is a prime number
  // Clone the input data to avoid modifying the original array
  const encryptedData = new Uint8Array(data.length);

  for (let i = 0; i < data.length; i++) {
    encryptedData[i] = (data[i] + (shift+=SHIFT_STEP)) % 256;
  }

  return encryptedData;
}

export function decrypt(encryptedData: Uint8Array) {
  let shift = SHIFT;
  // Clone the input data to avoid modifying the original array
  const decryptedData = new Uint8Array(encryptedData.length);

  for (let i = 0; i < encryptedData.length; i++) {
    decryptedData[i] = (encryptedData[i] - (shift+=SHIFT_STEP) + 256) % 256;
  }

  return decryptedData;
}

const MVD_TYPE = {
  NUMBER   : 0x01,
  STRING   : 0x02,
  DOCUMENT : 0x03,
  ARRAY    : 0x04,
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function writeInt32(arr: Uint8Array, offset: number, value: number): number {
  const view = new DataView(arr.buffer);
  view.setInt32(offset, value, true);  // little-endian
  return offset + 4;
}

function readInt32(arr: Uint8Array, offset: number): [number, number] {
  const view = new DataView(arr.buffer);
  return [view.getInt32(offset, true), offset + 4];
}

function calculateDocumentSize(doc: MvdDocument | Array<MvdValue>): number {
  let size = SIZE + 1; // For size placeholder and document terminator
  if (Array.isArray(doc)) {
    for (let i = 0; i < doc.length; i++) {
      size += calculateElementSize(String(i), doc[i]);
    }
  } else {
    for (const key in doc) {
      size += calculateElementSize(key, doc[key]);
    }
  }
  return size;
}

function calculateElementSize(key: string, value: MvdValue): number {
  let size = 1 + textEncoder.encode(key).length + 1; // Type and key
  switch (typeof value) {
    case 'string':
      size += SIZE + textEncoder.encode(value).length ; // Bad text size estimate
      break;
    case 'number':
      size += 8;
      break;
    case 'object':
      if (Array.isArray(value)) {
        size += calculateDocumentSize(value);
      } else {
        size += calculateDocumentSize(value as MvdDocument);
      }
      break;
  }
  return size;
}

export function encodeMVD(doc: MvdDocument, key: number = 3): Uint8Array {
  return encrypt(textEncoder.encode(JSON.stringify(doc))) //encrypt(arr, key);
}

function encodeDocument(doc: MvdDocument | Array<MvdValue>, arr: Uint8Array, offset: number): number {
  const startOffset = offset;
  offset += SIZE; // Placeholder for size

  if (Array.isArray(doc)) {
    for (let i = 0; i < doc.length; i++) {
      offset = encodeElement(String(i), doc[i], arr, offset);
    }
  } else {
    for (const key in doc) {
      offset = encodeElement(key, doc[key], arr, offset);
    }
  }

  arr[offset++] = 0; // End of document/array
  writeInt32(arr, startOffset, offset - startOffset);
  return offset;
}

function encodeElement(key: string, value: MvdValue, arr: Uint8Array, offset: number): number {
  if (typeof value === 'string') {
    arr[offset++] = MVD_TYPE.STRING;
    arr.set(textEncoder.encode(key), offset);
    offset += textEncoder.encode(key).length;
    arr[offset++] = 0;

    offset = writeInt32(arr, offset, textEncoder.encode(value).length + 1);
    arr.set(textEncoder.encode(value), offset);
    offset += textEncoder.encode(value).length;
    arr[offset++] = 0;
  } else if (typeof value === 'number') {
    arr[offset++] = MVD_TYPE.NUMBER;
    arr.set(textEncoder.encode(key), offset);
    offset += textEncoder.encode(key).length;
    arr[offset++] = 0;
    new DataView(arr.buffer).setFloat64(offset, value, true);
    offset += 8;
  } else if (Array.isArray(value)) {
    arr[offset++] = MVD_TYPE.ARRAY;
    arr.set(textEncoder.encode(key), offset);
    offset += textEncoder.encode(key).length;
    arr[offset++] = 0;
    offset = encodeDocument(value, arr, offset);
  } else {
    arr[offset++] = MVD_TYPE.DOCUMENT;
    arr.set(textEncoder.encode(key), offset);
    offset += textEncoder.encode(key).length;
    arr[offset++] = 0;
    offset = encodeDocument(value as MvdDocument, arr, offset);
  }
  return offset;
}

export function decodeMVD(arr: Uint8Array, key: number = 3): MvdRaw {
  return <MvdRaw>JSON.parse(textDecoder.decode(decrypt(arr)))//decodeDocument(/*decrypt(arr, key)*/arr, 0).doc;
}

function decodeDocument(arr: Uint8Array, offset: number): { doc: MvdDocument, nextOffset: number } {
  const [size] = readInt32(arr, offset);
  const expectedEndOffset = offset + size;
  offset += SIZE;

  const doc: MvdDocument = {};

  while (arr[offset] !== 0) {
    const type = arr[offset++];
    const end  = arr.indexOf(0, offset);
    const key  = textDecoder.decode(arr.subarray(offset, end));

    offset = end + 1;

    switch (type) {
      case MVD_TYPE.STRING:
        const [strSize, strOffset] = readInt32(arr, offset);
        doc[key] = textDecoder.decode(arr.subarray(strOffset, strOffset + strSize - 1));
        offset = strOffset + strSize;
        break;
      case MVD_TYPE.NUMBER:
        doc[key] = new DataView(arr.buffer).getFloat64(offset, true);
        offset += 8;
        break;
      case MVD_TYPE.DOCUMENT:
        const decodedDoc = decodeDocument(arr, offset);
        doc[key] = decodedDoc.doc;
        offset = decodedDoc.nextOffset;
        break;
      case MVD_TYPE.ARRAY:
        const decodedArray = decodeArray(arr, offset);
        doc[key] = decodedArray.array;
        offset = decodedArray.nextOffset;
        break;
    }
  }

  offset++; // Skip the end of document/array terminator
  if (offset !== expectedEndOffset) {
    throw new Error('Mismatched document size.');
  }
  return { doc, nextOffset: offset };
}

function decodeArray(arr: Uint8Array, offset: number): { array: Array<MvdValue>, nextOffset: number } {
  const [size] = readInt32(arr, offset);
  const expectedEndOffset = offset + size;

  offset += SIZE;

  const mvdArray: Array<MvdValue> = [];

  while (arr[offset] !== 0) {
    const type   = arr[offset++];
    const end    = arr.indexOf(0, offset);
    offset = end + 1;                 // move past the key for arrays, as it's just the index

    switch (type) {
      case MVD_TYPE.STRING:
        const [strSize, strOffset] = readInt32(arr, offset);
        mvdArray.push(textDecoder.decode(arr.subarray(strOffset, strOffset + strSize - 1)));
        offset = strOffset + strSize;
        break;
      case MVD_TYPE.NUMBER:
        mvdArray.push(new DataView(arr.buffer).getFloat64(offset, true));
        offset += 8;
        break;
      case MVD_TYPE.DOCUMENT:
        const decodedDoc = decodeDocument(arr, offset);
        mvdArray.push(decodedDoc.doc);
        offset = decodedDoc.nextOffset;
        break;
      case MVD_TYPE.ARRAY:
        const decodedArray = decodeArray(arr, offset);
        mvdArray.push(decodedArray.array);
        offset = decodedArray.nextOffset;
        break;
    }
  }

  offset++; // Skip the end of document/array terminator
  if (offset !== expectedEndOffset) {
    throw new Error('Mismatched document size.');
  }
  return { array: mvdArray, nextOffset: offset };
}
