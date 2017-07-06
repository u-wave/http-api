import { NotFoundError } from '../errors';
import toItemResponse from '../utils/toItemResponse';

export async function getAll(req) {
  const { emoji } = req.uwave;

  return toItemResponse(
    await emoji.list(),
    { url: req.fullUrl },
  );
}

export async function getEmoji(req) {
  const { emoji } = req.uwave;

  const data = await emoji.getEmoji(req.params.shortcode);
  if (!data) {
    throw new NotFoundError();
  }

  return toItemResponse(data, { url: req.fullUrl });
}

export async function addCustomEmoji(req) {
  const { emoji } = req.uwave;

  await emoji.addCustomEmoji(req.user, req.params.shortcode, req);

  return toItemResponse({}, { url: req.fullUrl });
}

export async function deleteCustomEmoji(req) {
  const { emoji } = req.uwave;

  await emoji.deleteCustomEmoji(req.user, req.params.shortcode);

  return toItemResponse({}, { url: req.fullUrl });
}
