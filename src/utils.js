export function checkFields(data, res, fields = [], types = []) {
  const errors = [];
  let typeLen = 0;

  // this will avoid redundancy when you have an array of fields of the same type
  if (Array.isArray(types)) {
    typeLen = types.length;
  } else if (typeof types === 'string') {
    typeLen = -1;
  }

  fields.forEach((field, i) => {
    if (typeof data[field] === 'undefined') {
      errors.push(`${field} is not set`);
      return;
    }

    if (typeLen > i) {
      if (typeof data[field] !== types[i]) {
        errors.push(`${data[field]} has to be of type ${types[i]}`);
      }
    } else if (typeLen === -1) {
      if (typeof data[field] !== types) {
        errors.push(`${data[field]} has to be of type ${types}`);
      }
    }
  });

  if (errors.length > 0) {
    res.status(422).json(errors.join(', '));
    return false;
  }
  return true;
}

export function handleDuplicate(res, str, fields) {
  for (let i = 0, l = fields.length; i < l; i++) {
    if (str.includes(fields[i])) {
      res.status(422).json(`${fields[i]} is already in use`);
      return true;
    }
  }
  return false;
}

export function paginate(page, size, result, error = null) {
  return { page, size, result, error };
}
