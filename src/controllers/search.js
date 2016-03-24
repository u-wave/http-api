import Promise from 'bluebird';

export function search(uw, query) {
  const promises = {};
  uw.sources.forEach(source => {
    promises[source.type] = source.search(query)
      // Default to empty search on failure, for now.
      // TODO log & return error somewhere.
      .catch(() => []);
  });
  return Promise.props(promises);
}
