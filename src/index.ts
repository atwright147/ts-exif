export const getExif = (dataView: DataView) => {
  return isValidFileType(dataView);
}

const isValidFileType = (dataView: DataView) => {
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
