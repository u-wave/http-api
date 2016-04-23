import ApiV1 from './ApiV1';

module.exports = function createApiV1(uw, opts) {
  return new ApiV1(uw, opts);
};

module.exports.V1 = ApiV1;
module.exports.ApiV1 = ApiV1;
