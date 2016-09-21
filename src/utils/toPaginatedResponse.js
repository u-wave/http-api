import * as url from 'url';
import * as qs from 'qs';

function appendQuery(base, query) {
  const parsed = url.parse(base, true);
  parsed.search = qs.stringify({
    ...parsed.query,
    ...query,
  });
  parsed.query = null;
  return `${url.format(parsed)}`;
}

export default function toPaginatedResponse(page, { baseUrl = '' } = {}) {
  return {
    meta: {
      offset: page.currentPage.offset,
      pageSize: page.pageSize,
      results: page.filteredSize,
      total: page.totalSize,
    },
    links: {
      self: appendQuery(baseUrl, { page: page.currentPage }),
      next: appendQuery(baseUrl, { page: page.nextPage }),
      prev: appendQuery(baseUrl, { page: page.prevPage }),
    },
    data: page.data,
  };
}
