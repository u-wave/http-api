export function checkFields(res, obj, types) {
  const errors = [];

  Object.keys(types).forEach((field) => {
    const type = types[field];
    const value = obj[field];
    if (typeof value === 'undefined') {
      errors.push(`expected "${field}" to be set`);
    } else if (typeof value !== type) {
      errors.push(`expected "${field}" to be a ${type}`);
    }
  });

  if (errors.length > 0) {
    res.status(422).json(errors.join(', '));
    return false;
  }
  return true;
}

export function paginate(page, size, result, error = null) {
  return { page, size, result, error };
}
