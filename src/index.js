import UwaveHttpApi from './HttpApi';

export default function createHttpApi(uw, opts) {
  return new UwaveHttpApi(uw, opts);
}

createHttpApi.HttpApi = UwaveHttpApi;

// Backwards compat?
createHttpApi.V1 = UwaveHttpApi;
createHttpApi.ApiV1 = UwaveHttpApi;
