const memDb = [];

const queries = {
  get: {
    packageByIdAndAbsoluteLatestVersion: ({ Id }) =>
      memDb.filter((x) => x.Id === Id && x.IsAbsoluteLatestVersion),

    versionByIdAndAbsoluteLatestVersion: ({ Id }) =>
      memDb
        .filter((x) => x.Id === Id && x.IsAbsoluteLatestVersion)
        .map((x) => x.Version),

    packageByIdAndLatestVersion: ({ Id }) =>
      memDb.filter((x) => x.Id === Id && x.IsLatestVersion),

    versionByIdAndLatestVersion: ({ Id }) =>
      memDb
        .filter((x) => x.Id === Id && x.IsLatestVersion)
        .map((x) => x.Version),

    packageByIdAndVersion: ({ Id, Version }) => {
      Id = Id.toLowerCase();
      return memDb.filter(
        (x) => x.Listed && x.Version === Version && x.Id.toLowerCase() === Id
      );
    },

    packageById: ({ Id }) => memDb.filter((x) => x.Listed && x.Id === Id),

    packageByPath: ({ path }) =>
      memDb.filter((x) => x.path.toLowerCase() === path.toLowerCase()),

    packages: () => memDb,

    packagesByLatestVersion: () => memDb.filter((x) => x.IsLatestVersion),
    packagesByAbsoluteLatestVersion: () =>
      memDb.filter((x) => x.IsAbsoluteLatestVersion),
  },
  set: {
    packageAbsoluteLatestVersionToTrueByIdAndVersion: ({ Id, Version }) =>
      memDb
        .filter(
          (x) =>
            !x.IsAbsoluteLatestVersion && x.Id === Id && x.Version === Version
        )
        .map((x) => {
          x.IsAbsoluteLatestVersion = true;
          return x.Version;
        }),
    packageAbsoluteLatestVersionToFalse: ({ Id }) =>
      memDb
        .filter((x) => x.IsAbsoluteLatestVersion && x.Id === Id)
        .map((x) => {
          x.IsAbsoluteLatestVersion = false;
          return x.Version;
        }),
    packageLatestVersionToFalse: ({ Id }) =>
      memDb
        .filter((x) => x.IsLatestVersion && x.Id === Id)
        .map((x) => {
          x.IsLatestVersion = false;
          return x.Version;
        }),

    packageLatestVersionToTrueByIdAndVersion: ({ Id, Version }) =>
      memDb
        .filter(
          (x) => !x.IsLatestVersion && x.Id === Id && x.Version === Version
        )
        .map((x) => {
          x.IsLatestVersion = true;
          return x.Version;
        }),
    incrementDownloaded: ({ Id, Version }) =>
      memDb
        .filter((x) => x.Id === Id && x.Version === Version)
        .map((x) => {
          x.VersionDownloadCount = x.VersionDownloadCount + 1;
          x.DownloadCount = x.DownloadCount + 1;
        }),

    any: ({ key, value }) =>
      memDb
        .filter((x) => x.Id === Id && x.Version === Version)
        .map((x) => (x[key] = value)),
  },
  create: {
    package: ({ package }) => {
      let existingIndex = memDb.findIndex(
        (x) => x.Id === package.Id && x.Version === package.Version
      );

      if (existingIndex !== -1) {
        memDb[existingIndex] = package;
      } else {
        memDb.push(package);
      }
      return {};
    },
  },
  delete: {
    packageByPath: ({ path }) => {
      const index = memDb.findIndex(
        (x) => x.path.trim().toLowerCase() === path.trim().toLowerCase()
      );

      const toReturn = memDb[index];
      if (index !== -1) memDb.splice(index, 1);

      return toReturn;
    },
    packageByIdAndVersion: ({ Id, Version }) => {
      const index = memDb.findIndex(
        (x) => x.Id === Id && x.Version === Version
      );

      if (index !== -1) {
        memDb.splice(index, 1);
      }

      return {};
    },
  },
};

async function dbQuery(data, query) {
  try {
    return query(data);
  } catch (err) {
    console.error(err);
    throw new Error(err);
  }
}

module.exports = {
  queries,
  dbQuery,
};
