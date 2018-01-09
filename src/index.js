import ApiV1 from './ApiV1';

export default function createApiV1(uw, opts) {
  return new ApiV1(uw, opts);
};

createApiV1.V1 = ApiV1;
createApiV1.ApiV1 = ApiV1;
