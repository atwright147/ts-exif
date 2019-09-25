import fs from 'fs';
import path from 'path';

import { getExif } from './index';

const SIZE = 131072;  // 128kb

const buf = Buffer.alloc(SIZE);

const fd = fs.openSync(path.join('images', 'IMG_7413.jpg'), 'r');
fs.read(fd, buf, 0, SIZE, 0, (err) => {
    if (err) {
        console.info(err);
        return;
    }
});

// // https://stackoverflow.com/a/12101012/633056
const dataView = new DataView(buf.buffer);

console.info(getExif(dataView));
