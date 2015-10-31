export const checkFields = function checkFields(data, res, fields = [], types = []) {
  const errors = [];
  const fieldLen = fields.length;
  let typeLen = 0;

  // this will avoid redundancy when you have an array of fields of the same type
  if (Array.isArray(types)) {
    typeLen = types.length;
  } else if (typeof types === 'string') {
    typeLen = -1;
  }

  for (let i = 0; i < fieldLen; i++) {
    if (typeof data[fields[i]] === 'undefined') {
      errors.push(`${fields[i]} is not set`);
      continue;
    }

    if (typeLen > i) {
      if (typeof data[fields[i]] !== types[i]) {
        errors.push(`${data[fields[i]]} has to be of type ${types[i]}`);
      }
    } else if (typeLen === -1) {
      if (typeof data[fields[i]] !== types) {
        errors.push(`${data[fields[i]]} has to be of type ${types}`);
      }
    }
  }

  if (errors.length > 0) {
    res.status(422).json(errors.join(', '));
    return false;
  }
  return true;
};

export const escape = function escape(str) {
  if (str) return str.replace('$', '\uFF04').replace('.', '\uFF0E');
  return null;
};

export const handleDuplicate = function handleDuplicate(res, str, fields) {
  for (let i = fields.length - 1; i >= 0; i--) {
    if (str.includes(fields[i])) {
      res.status(422).json(`${fields[i]} is already in use`);
      return true;
    }
  }
  return false;
};

export const split = function split(arr, size) {
  if (!Array.isArray(arr)) return [];

  const length = arr.length;
  const chunks = [];

  for (let i = 0; i < length; i += size) {
    chunks.push(arr.slice(i, size));
  }

  return chunks;
};

export const paginate = function paginate(page, size, data, err = null) {
  return {
    'page': page,
    'size': size,
    'result': data,
    'error': err
  };
};

export default checkFields;
