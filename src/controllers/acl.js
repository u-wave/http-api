import toItemResponse from '../utils/toItemResponse';

export async function list(req) {
  const uw = req.uwave;
  const roles = await uw.acl.getAllRoles();

  return toItemResponse(roles, {
    url: req.fullUrl,
  });
}

export async function createRole(req) {
  const uw = req.uwave;
  const { name } = req.params;
  const { permissions } = req.body;

  const role = await uw.acl.createRole(name, permissions);

  return toItemResponse(role, {
    url: req.fullUrl,
  });
}

export async function deleteRole(req) {
  const uw = req.uwave;
  const { name } = req.params;

  await uw.acl.deleteRole(name);

  return toItemResponse({}, {
    url: req.fullUrl,
  });
}
