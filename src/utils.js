export const checkFields = function checkFields(data, res, fields = []) {
  const errors = [];

  for (let i = fields.length - 1; i >= 0; i--) {
    if (typeof data[fields[i]] === 'undefined') {
      errors.push(`${fields[i]} is not set`);
    }
  }

  if (errors.length > 0) {
    res.status(422).json(errors.join(', '));
    return false;
  }
  return true;
};

export const escape = function escape(str) {
  if (str) return str.replace('$', '\uFF04').replace('.', '\uFF0E')
  return null;
};

export const handleDuplicate = function handleDuplicate(res, str, fields) {
  for (let i = fields.length - 1; i >= 0; i--) {
    if(str.includes(fields[i])) {
      res.status(422).json(`${fields[i]} is already in use`);
      return true;
    }
  }
  return false;
};

export default checkFields;