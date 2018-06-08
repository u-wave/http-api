import router from 'router';
import route from '../route';
import { HTTPError } from '../errors';
import protect from '../middleware/protect';
import * as controller from '../controllers/emoji';

export default function emojiRouter() {
  function checkEmojiEnabled(req, res, next) {
    if (!req.uwave.emoji) {
      next(new HTTPError(400, 'Emoji are not enabled.'));
    } else {
      next();
    }
  }

  return router()
    .use(checkEmojiEnabled)
    .get(
      '/',
      route(controller.getAll),
    )
    .get(
      '/:shortcode',
      route(controller.getEmoji),
    )
    .put(
      '/:shortcode',
      protect('emoji.add'),
      route(controller.addCustomEmoji),
    )
    .delete(
      '/:shortcode',
      protect('emoji.remove'),
      route(controller.deleteCustomEmoji),
    );
}
