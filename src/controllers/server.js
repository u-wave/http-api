import toItemResponse from '../utils/toItemResponse';

export function getServerTime(req) {
  return toItemResponse({
    time: Date.now(),
  }, { url: req.fullUrl });
}

export function getConfigSchema(req) {
  const uw = req.uwave;
  const schema = uw.config.getSchema();

  return toItemResponse(schema, { url: req.fullUrl });
}
