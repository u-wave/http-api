import toItemResponse from '../utils/toItemResponse';

export async function getMotd(req) {
  return toItemResponse(
    { motd: await req.uwave.getMotd() },
    { url: req.fullUrl },
  );
}

export async function setMotd(req) {
  await req.uwave.setMotd(String(req.body.motd));

  return getMotd(req);
}
