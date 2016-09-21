export default function attachUwaveMeta(apiV1, uw) {
  return (req, res, next) => {
    if (!req.uwave) {
      req.uwaveApiV1 = apiV1;
      req.uwave = uw;
    }
    next();
  };
}
