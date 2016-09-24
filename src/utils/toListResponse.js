import isPlainObject from 'lodash/isPlainObject';
import cloneDeep from 'lodash/cloneDeep';
import getPath from 'lodash/get';
import setPath from 'lodash/set';

function extractIncluded(data, included) {
  const includedTypes = Object.keys(included);
  const includeds = {};
  const had = {};

  if (includedTypes.length === 0) {
    return {
      data,
      included: {},
    };
  }

  for (const typeName of includedTypes) {
    includeds[typeName] = [];
  }

  const resultData = [];
  for (const initialItem of data) {
    let item = isPlainObject(initialItem) ? initialItem : initialItem.toJSON();
    for (const type of includedTypes) {
      for (const path of included[type]) {
        const includedItem = getPath(item, path);
        if (includedItem) {
          if (item === initialItem) {
            item = cloneDeep(item);
          }
          setPath(item, path, includedItem._id);
          if (!had[type + includedItem._id]) {
            includeds[type].push(includedItem);
            had[type + includedItem._id] = true;
          }
        }
      }
    }
    resultData.push(item);
  }

  return {
    included: includeds,
    data: resultData,
  };
}

export default function toListResponse(list, {
  meta = {},
  included = {},
  url = null,
} = {}) {
  let props = { data: list };
  if (included) {
    props = extractIncluded(list, included);
  }
  return {
    meta: {
      included,
      ...meta,
    },
    links: url ? { self: url } : {},
    data: null,
    included: null,
    ...props,
  };
}
