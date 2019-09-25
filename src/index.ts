const debug = true;

export const getExif = (dataView: DataView) => {
  return isValidFileType(dataView);
}

export const isValidFileType = (dataView: DataView) => {
  if (dataView.getUint8(0) === 0xFF || dataView.getUint8(1) === 0xD8) {
    console.info('Valid JPEG');
    return true;
  } else {
    console.info('Not a valid JPEG');
  }

  if (dataView.getUint16(0) == 0x4949) {
    console.info('Valid TIFF, not big endian');
    return true;
  } else if (dataView.getUint16(0) == 0x4D4D) {
    console.info('Valid TIFF, big endian');
    return true;
  } else {
    console.info('Not a valid TIFF');
  }

  return false;
}

export const findExif = (dataView: DataView) => {
  if (debug) console.log("Got file of length " + dataView.byteLength);
  if ((dataView.getUint8(0) != 0xFF) || (dataView.getUint8(1) != 0xD8)) {
    if (debug) console.log("Not a valid JPEG");
    return false; // not a valid jpeg
  }

  const length = dataView.byteLength;
  let offset = 2;
  let marker: number;

  while (offset < length) {
    if (dataView.getUint8(offset) != 0xFF) {
      if (debug) console.log("Not a valid marker at offset " + offset + ", found: " + dataView.getUint8(offset));
      return false; // not a valid marker, something is wrong
    }

    marker = dataView.getUint8(offset + 1);

    if (marker == 225) {
      if (debug) console.log("Found 0xFFE1 marker");
      return offset;
      // return readEXIFData(dataView, offset + 4, dataView.getUint16(offset + 2) - 2);
    } else {
      offset += 2 + dataView.getUint16(offset + 2);
    }
  }

  // msybe should throw?
  return false;
}
