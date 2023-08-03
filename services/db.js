const memDb = [];

const queries = {
  get: {
    packagesByProperties: (properties) => {
      let result = [...memDb];

      for (const key in properties) {
        result = result.filter((x) => x[key] == properties[key]);
      }

      return result;
    },

    packagesByIdAndAbsoluteLatestVersion: ({ Id }) =>
      memDb.filter(
        (x) =>
          x.Id.toLowerCase() === Id.toLowerCase() && x.IsAbsoluteLatestVersion
      ),

    versionsByIdAndAbsoluteLatestVersion: ({ Id }) =>
      memDb
        .filter(
          (x) =>
            x.Id.toLowerCase() === Id.toLowerCase() && x.IsAbsoluteLatestVersion
        )
        .map((x) => x.Version),

    packagesByIdAndLatestVersion: ({ Id }) =>
      memDb.filter(
        (x) => x.Id.toLowerCase() === Id.toLowerCase() && x.IsLatestVersion
      ),

    versionsByIdAndLatestVersion: ({ Id }) =>
      memDb
        .filter(
          (x) => x.Id.toLowerCase() === Id.toLowerCase() && x.IsLatestVersion
        )
        .map((x) => x.Version),

    packagesByIdAndVersion: ({ Id, Version }) => {
      return memDb.filter(
        (x) =>
          x.Listed &&
          x.Version === Version &&
          x.Id.toLowerCase() === Id.toLowerCase()
      );
    },

    packagesByVersion: ({ Version }) => {
      return memDb.filter((x) => x.Listed && x.Version === Version);
    },

    packagesById: ({ Id }) => memDb.filter((x) => x.Listed && x.Id === Id),

    packagesByPath: ({ path }) =>
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
    packagesByIdAndVersion: ({ Id, Version }) => {
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
