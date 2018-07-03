import UwaveHttpApi from './HttpApi';
import UwaveSocketServer from './SocketServer';

export function createHttpApi(uw, opts) {
  return new UwaveHttpApi(uw, opts);
}
export function createSocketServer(uw, opts) {
  return new UwaveSocketServer(uw, opts);
}
