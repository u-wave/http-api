export const checkFields = function checkFields(data, res, fields = [], types = []) {
  const errors = [];
  const fieldLen = fields.length;
  const typeLen = types.length;

  for (let i = 0; i < fieldLen; i++) {
    if (typeof data[fields[i]] === 'undefined') {
      errors.push(`${fields[i]} is not set`);
      continue;
    }

    if (typeLen > i) {
      if (typeof data[fields[i]] !== types[i]) {
        errors.push(`${data[fields[i]]} has to be of type ${types[i]}`);
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

export default checkFields;
