import pino from 'pino';
import { Writable } from 'stream';
import { pushLog } from './log-buffer.js';

const level = process.env.LOG_LEVEL || 'info';
const isDev = process.env.NODE_ENV !== 'production';

const bufferStream = new Writable({
  write(chunk: Buffer, _enc, cb) {
    pushLog(chunk.toString());
    cb();
  },
});

export const logger = isDev
  ? pino(
      { level },
      pino.multistream([
        {
          stream: pino.transport({
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'HH:MM:ss' },
          }),
          level,
        },
        { stream: bufferStream, level },
      ]),
    )
  : pino(
      { level },
      pino.multistream([
        { stream: process.stdout, level },
        { stream: bufferStream, level },
      ]),
    );
