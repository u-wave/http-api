export default function attachUwaveMeta(apiV1, uw) {
  return (req, res, next) => {
    if (!req.uwave) {
      /* eslint-disable no-param-reassign */
      req.uwaveApiV1 = apiV1;
      req.uwave = uw;
      /* eslint-enable no-param-reassign */
    }
    next();
  };
}
