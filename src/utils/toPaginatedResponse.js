import * as url from 'url';
import * as qs from 'qs';
import cloneDeep from 'lodash/cloneDeep';
import getPath from 'lodash/get';
import setPath from 'lodash/set';

function appendQuery(base, query) {
  const parsed = url.parse(base, true);
  parsed.search = qs.stringify({
    ...parsed.query,
    ...query,
  });
  parsed.query = null;
  return `${url.format(parsed)}`;
}

function extractIncluded(data, included) {
  const includedTypes = Object.keys(included);
  const includeds = {};
  const had = {};

  for (const typeName of includedTypes) {
    includeds[typeName] = [];
  }

  const resultData = [];
  for (const initialItem of data) {
    let item = initialItem.toJSON();
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

export default function toPaginatedResponse(
  page,
  { baseUrl = '', included = {} } = {}
) {
  let props = { data: page.data };
  if (included) {
    props = extractIncluded(page.data, included);
  }
  return Object.assign({
    meta: {
      offset: page.currentPage.offset,
      pageSize: page.pageSize,
      results: page.filteredSize,
      total: page.totalSize,
      included,
    },
    links: {
      self: appendQuery(baseUrl, { page: page.currentPage }),
      next: appendQuery(baseUrl, { page: page.nextPage }),
      prev: appendQuery(baseUrl, { page: page.prevPage }),
    },
    data: null,
    included: null,
  }, props);
}
