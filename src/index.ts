import { Tags, TiffTags, GpsTags, Ifd1Tags, IptcFields, StringValues } from './enums/index.enums';

const debug = true;

export const isValidFileType = (dataView: DataView): boolean => {
  if (dataView.getUint8(0) === 0xFF || dataView.getUint8(1) === 0xD8) {
    console.info('Valid JPEG');
    return true;
  } else {
    console.info('Not a valid JPEG');
  }

  if (dataView.getUint16(0) === 0x4949) {
    console.info('Valid TIFF, not big endian');
    return true;
  } else if (dataView.getUint16(0) === 0x4D4D) {
    console.info('Valid TIFF, big endian');
    return true;
  } else {
    console.info('Not a valid TIFF');
  }

  return false;
}

export const findExif = (dataView: DataView): number | false => {
  if (debug) console.log('Got file of length ' + dataView.byteLength);
  if ((dataView.getUint8(0) !== 0xFF) || (dataView.getUint8(1) != 0xD8)) {
    if (debug) console.log('Not a valid JPEG');
    return false; // not a valid jpeg
  }

  const length = dataView.byteLength;
  let offset = 2;
  let marker: number;

  while (offset < length) {
    if (dataView.getUint8(offset) !== 0xFF) {
      if (debug) console.log('Not a valid marker at offset ' + offset + ', found: ' + dataView.getUint8(offset));
      return false; // not a valid marker, something is wrong
    }

    marker = dataView.getUint8(offset + 1);

    if (marker === 225) {
      if (debug) console.log('Found 0xFFE1 marker');
      // return offset;
      return readEXIFData(dataView, offset + 4);
    } else {
      offset += 2 + dataView.getUint16(offset + 2);
    }
  }

  // maybe should throw?
  return false;
}

///////////////////////////////////

const getString = (dataView: DataView, start: number, length: number) => {
  let outstr = '';
  for (let n = start; n < start + length; n++) {
    outstr += String.fromCharCode(dataView.getUint8(n));
  }
  return outstr;
}

const readEXIFData = (dataView, start) => {
  if (getString(dataView, start, 4) != 'Exif') {
    if (debug) console.log('Not valid EXIF data! ' + getString(dataView, start, 4));
    return false;
  }

  let bigEnd: boolean;
  let tags: any;
  let tag: any;
  let exifData: any;
  let gpsData: any;
  const tiffOffset = start + 6;

  // test for TIFF validity and endianness
  if (dataView.getUint16(tiffOffset) == 0x4949) {
    bigEnd = false;
  } else if (dataView.getUint16(tiffOffset) == 0x4D4D) {
    bigEnd = true;
  } else {
    if (debug) console.log('Not valid TIFF data! (no 0x4949 or 0x4D4D)');
    return false;
  }

  if (dataView.getUint16(tiffOffset + 2, !bigEnd) != 0x002A) {
    if (debug) console.log('Not valid TIFF data! (no 0x002A)');
    return false;
  }

  const firstIFDOffset = dataView.getUint32(tiffOffset + 4, !bigEnd);

  if (firstIFDOffset < 0x00000008) {
    if (debug) console.log('Not valid TIFF data! (First offset less than 8)', dataView.getUint32(tiffOffset + 4, !bigEnd));
    return false;
  }

  tags = readTags(dataView, tiffOffset, tiffOffset + firstIFDOffset, TiffTags, bigEnd) as any;

  if (tags.ExifIFDPointer) {
    exifData = readTags(dataView, tiffOffset, tiffOffset + tags.ExifIFDPointer, Tags, bigEnd);
    for (tag in exifData) {
      switch (tag) {
        case 'LightSource':
        case 'Flash':
        case 'MeteringMode':
        case 'ExposureProgram':
        case 'SensingMethod':
        case 'SceneCaptureType':
        case 'SceneType':
        case 'CustomRendered':
        case 'WhiteBalance':
        case 'GainControl':
        case 'Contrast':
        case 'Saturation':
        case 'Sharpness':
        case 'SubjectDistanceRange':
        case 'FileSource':
          exifData[tag] = StringValues[tag][exifData[tag]];
          break;

        case 'ExifVersion':
        case 'FlashpixVersion':
          exifData[tag] = String.fromCharCode(exifData[tag][0], exifData[tag][1], exifData[tag][2], exifData[tag][3]);
          break;

        case 'ComponentsConfiguration':
          // TODO: fix type hinting for strict mode
          exifData[tag] =
            StringValues.Components[exifData[tag][0]] +
            StringValues.Components[exifData[tag][1]] +
            StringValues.Components[exifData[tag][2]] +
            StringValues.Components[exifData[tag][3]];
          break;
      }
      tags[tag] = exifData[tag];
    }
  }

  if (tags.GPSInfoIFDPointer) {
    gpsData = readTags(dataView, tiffOffset, tiffOffset + tags.GPSInfoIFDPointer, GpsTags, bigEnd);
    for (tag in gpsData) {
      switch (tag) {
        case 'GPSVersionID':
          gpsData[tag] = gpsData[tag][0] +
            '.' + gpsData[tag][1] +
            '.' + gpsData[tag][2] +
            '.' + gpsData[tag][3];
          break;
      }
      tags[tag] = gpsData[tag];
    }
  }

  // extract thumbnail
  // tags['thumbnail'] = readThumbnailImage(dataView, tiffOffset, firstIFDOffset, bigEnd);

  return tags;
}

const readTags = (dataView, tiffStart, dirStart, strings, bigEnd) => {
  const entries = dataView.getUint16(dirStart, !bigEnd);
  const tags = {};
  let entryOffset;
  let tag;
  let i: number;

  for (i = 0; i < entries; i++) {
    entryOffset = dirStart + i * 12 + 2;
    tag = strings[dataView.getUint16(entryOffset, !bigEnd)];
    if (!tag && debug) console.log('Unknown tag: ' + dataView.getUint16(entryOffset, !bigEnd));
    tags[tag] = readTagValue(dataView, entryOffset, tiffStart, dirStart, bigEnd);
  }
  return tags;
}


const readTagValue = (dataView, entryOffset, tiffStart, dirStart, bigEnd) => {
  const type = dataView.getUint16(entryOffset + 2, !bigEnd);
  const numValues = dataView.getUint32(entryOffset + 4, !bigEnd);
  const valueOffset = dataView.getUint32(entryOffset + 8, !bigEnd) + tiffStart;
  let offset: number;
  let vals: any[];
  let val: any;
  let n: number;
  let numerator: number;
  let denominator: number;

  switch (type) {
    case 1: // byte, 8-bit unsigned int
    case 7: // undefined, 8-bit byte, value depending on field
      if (numValues == 1) {
        return dataView.getUint8(entryOffset + 8, !bigEnd);
      } else {
        offset = numValues > 4 ? valueOffset : (entryOffset + 8);
        vals = [];
        for (n = 0; n < numValues; n++) {
          vals[n] = dataView.getUint8(offset + n);
        }
        return vals;
      }

    case 2: // ascii, 8-bit byte
      offset = numValues > 4 ? valueOffset : (entryOffset + 8);
      return getString(dataView, offset, numValues - 1);

    case 3: // short, 16 bit int
      if (numValues == 1) {
        return dataView.getUint16(entryOffset + 8, !bigEnd);
      } else {
        offset = numValues > 2 ? valueOffset : (entryOffset + 8);
        vals = [];
        for (n = 0; n < numValues; n++) {
          vals[n] = dataView.getUint16(offset + 2 * n, !bigEnd);
        }
        return vals;
      }

    case 4: // long, 32 bit int
      if (numValues == 1) {
        return dataView.getUint32(entryOffset + 8, !bigEnd);
      } else {
        vals = [];
        for (n = 0; n < numValues; n++) {
          vals[n] = dataView.getUint32(valueOffset + 4 * n, !bigEnd);
        }
        return vals;
      }

    case 5:    // rational = two long values, first is numerator, second is denominator
      if (numValues == 1) {
        numerator = dataView.getUint32(valueOffset, !bigEnd);
        denominator = dataView.getUint32(valueOffset + 4, !bigEnd);
        val = new Number(numerator / denominator);
        val.numerator = numerator;
        val.denominator = denominator;
        return val;
      } else {
        vals = [];
        for (n = 0; n < numValues; n++) {
          numerator = dataView.getUint32(valueOffset + 8 * n, !bigEnd);
          denominator = dataView.getUint32(valueOffset + 4 + 8 * n, !bigEnd);
          vals[n] = new Number(numerator / denominator);
          vals[n].numerator = numerator;
          vals[n].denominator = denominator;
        }
        return vals;
      }

    case 9: // slong, 32 bit signed int
      if (numValues == 1) {
        return dataView.getInt32(entryOffset + 8, !bigEnd);
      } else {
        vals = [];
        for (n = 0; n < numValues; n++) {
          vals[n] = dataView.getInt32(valueOffset + 4 * n, !bigEnd);
        }
        return vals;
      }

    case 10: // signed rational, two slongs, first is numerator, second is denominator
      if (numValues == 1) {
        return dataView.getInt32(valueOffset, !bigEnd) / dataView.getInt32(valueOffset + 4, !bigEnd);
      } else {
        vals = [];
        for (n = 0; n < numValues; n++) {
          vals[n] = dataView.getInt32(valueOffset + 8 * n, !bigEnd) / dataView.getInt32(valueOffset + 4 + 8 * n, !bigEnd);
        }
        return vals;
      }
  }
}
