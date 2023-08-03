const compareVersions = require("compare-versions");
const { join } = require("path");

const fsHelper = require("./fsUtil");
const db = require("../services/db");
const zipHelper = require("./zipUtil");
const xml = {};

async function init() {
  await getXmlTemplates();
}

async function getXmlTemplates() {
  try {
    const templatesDir = join(__dirname, "../", "templates");

    xml.errorMeta = (
      await fsHelper.readFile(join(templatesDir, "errormeta.xml"))
    ).toString();

    xml.templateHeader = (
      await fsHelper.readFile(
        join(templatesDir, "packageMetaTemplateHeader.xml")
      )
    ).toString();

    xml.templateContent = (
      await fsHelper.readFile(
        join(templatesDir, "packageMetaTemplateContent.xml")
      )
    ).toString();

    xml.templateFooter = (
      await fsHelper.readFile(
        join(templatesDir, "packageMetaTemplateFooter.xml")
      )
    ).toString();
  } catch (err) {
    console.error(err);
  }
}

function reconstructPackagesJson(packages, baseUrl) {
  return packages.map((package) => {
    return {
      __metadata: {
        uri: `${baseUrl}/Packages(Id='${package.Id}',Version='${package.Version}')`,
        type: "NuGet.Server.DataServices.ODataPackage",
        edit_media: `${baseUrl}/Packages(Id='${package.Id}',Version='${package.Version}')/$value`,
        media_src: `${baseUrl}/package/${package.Id}/${package.Version}`,
        content_type: "application/zip",
      },
      ...package,
      Published: `/Date(${new Date(package.Published).getTime()})/`,
      LastUpdated: `/Date(${new Date(package.LastUpdated).getTime()})/`,
    };
  });
}

function reconstructPackagesXML(packages, baseUrl) {
  return packages
    .map((package) => {
      package = { ...package };
      package.Published = new Date(package.Published).toISOString();
      package.LastUpdated = new Date(package.LastUpdated).toISOString();

      let xmlPackageContent = xml.templateContent;
      xmlPackageContent = replaceString(xmlPackageContent, "@baseUrl", baseUrl);

      for (const prop in package) {
        xmlPackageContent = replaceString(
          xmlPackageContent,
          `@${prop}`,
          package[prop]
        );
      }

      const keys = xmlPackageContent.match(/\@([^<]*)/g);
      if (!keys || keys.length === 0) {
        return xmlPackageContent;
      }

      for (const key of keys) {
        xmlPackageContent = replaceString(xmlPackageContent, `${key}`, "");
      }

      return xmlPackageContent;
    })
    .join("");
}

function reconstructJson(packages, baseUrl, returnSingle) {
  if (!returnSingle) {
    return {
      d: {
        results: reconstructPackagesJson(packages, baseUrl),
      },
    };
  }

  if (packages && packages.length !== 0) {
    return {
      d: reconstructPackagesJson(packages, baseUrl)[0],
    };
  }

  return {
    d: {},
  };
}

function reconstructXml(packages, baseUrl, returnSingle) {
  if (!returnSingle) {
    let xmlHeader = replaceString(xml.templateHeader, "@baseUrl", baseUrl);
    xmlHeader = replaceString(xmlHeader, "@date", new Date());
    return (
      xmlHeader + reconstructPackagesXML(packages, baseUrl) + xml.templateFooter
    );
  }

  if (packages && packages.length !== 0) {
    return (
      `<?xml version="1.0" encoding="utf-8" standalone="yes"?>` +
      reconstructPackagesXML(packages, baseUrl)
    );
  }

  return (
    `<?xml version="1.0" encoding="utf-8" standalone="yes"?>` + xml.errorMeta
  );
}

function replaceString(str, key, value) {
  const regex = new RegExp(key, "gim");
  if (value != null) {
    return str.replace(regex, value);
  }

  return str.replace(regex, "");
}

function getPackageSkeleton() {
  return {
    Id: "",
    Version: "",
    NormalizedVersion: "",
    IsPrerelease: false,
    Title: "",
    Authors: "",
    Owners: "",
    IconUrl: "",
    LicenseUrl: "",
    ProjectUrl: "",
    DownloadCount: 0,
    RequireLicenseAcceptance: false,
    DevelopmentDependency: false,
    Description: "",
    Summary: "",
    ReleaseNotes: "",
    Published: "",
    LastUpdated: "",
    Dependencies: "",
    PackageHashAlgorithm: "SHA512",
    PackageHash: "",
    PackageSize: 0,
    Copyright: "",
    Tags: "",
    IsAbsoluteLatestVersion: false,
    IsLatestVersion: false,
    Listed: true,
    VersionDownloadCount: 0,
    MinClientVersion: "",
    Language: "",
  };
}

async function createDbPackage(newPackage) {
  try {
    await db.dbQuery(
      {
        package: newPackage,
      },
      db.queries.create.package
    );
  } catch (err) {
    console.error(err);
    throw err;
  }
}

async function getPackages(query, id) {
  const filter = query.$filter || "";
  const LatestVersion = query.LatestVersion !== undefined;
  const AbsoluteLatestVersion = query.AbsoluteLatestVersion !== undefined;

  // Not implemented
  const searchTerm = query.searchTerm;
  const orderby = query.$orderby;
  const skip = query.$skip;
  const top = query.$top;

  try {
    const versionMatch = filter.match(/Version=\'(.*?)\'/i);
    const idMatch = filter.match(/Id=\'(.*?)\'/i);
    const latestVersionMatch = filter.match(/LatestVersion=(true|false)/i);
    const absoluteLatestVersionMatch = filter.match(
      /AbsoluteLatestVersion=(true|false)/i
    );

    const properties = {};

    if (id) {
      properties.Id = id;
    } else if (idMatch) {
      properties.Id = idMatch[1];
    }

    if (versionMatch) {
      properties.Version = versionMatch[1];
    }

    if (latestVersionMatch || LatestVersion) {
      properties.IsLatestVersion =
        LatestVersion || latestVersionMatch[1] === "true";
    }

    if (absoluteLatestVersionMatch || AbsoluteLatestVersion) {
      properties.IsAbsoluteLatestVersion =
        AbsoluteLatestVersion || absoluteLatestVersionMatch[1] === "true";
    }

    return await db.dbQuery(properties, db.queries.get.packagesByProperties);
  } catch (e) {
    if (filter) console.error(filter);
    console.error(e);
    throw new Error("Internal error.");
  }
}

function nuspecXmlToJson(xml) {
  try {
    const skeleton = getPackageSkeleton();

    const dependencyRegex = new RegExp(
      `(?:.?)<dependency(?:\\s)id=\\"(.*)\\"(?:\\s)version=\\"(.*)\\"(?:\\s)\\/>(?:.?)`,
      "gim"
    );

    const dependencyMatches = xml.toString().matchAll(dependencyRegex);
    for (const dependencyMatch of dependencyMatches) {
      const id = dependencyMatch[1];
      const version = dependencyMatch[2];

      if (skeleton.Dependencies === "") {
        skeleton.Dependencies += `${id}:`;
      } else {
        skeleton.Dependencies += `|${id}:`;
      }

      if (version && version !== "") {
        skeleton.Dependencies += `${version}:`;
      }
    }

    for (const prop in skeleton) {
      const propRegex = new RegExp(
        `\\<(\\s*)(${prop})(\\s*)\\>(.*)\\<\\/(\\s*)(${prop})(\\s*)\\>`,
        "gi"
      );

      const propMatches = propRegex.exec(xml);
      if (!propMatches || propMatches.length < 5) {
        continue;
      }

      if (typeof skeleton[prop] === "boolean") {
        skeleton[prop] = propMatches[4] == "true";
      }

      if (typeof skeleton[prop] === "string") {
        skeleton[prop] = propMatches[4];
      }

      if (typeof skeleton[prop] === "number") {
        skeleton[prop] = Number(propMatches[4]);
      }
    }

    return skeleton;
  } catch (err) {
    console.error(err);
    return null;
  }
}

function normalizeVersion(version) {
  try {
    return version
      .split(".")
      .map((x, index, arr) => {
        let normalized = "";
        if (/^\d+$/.test(x)) {
          normalized += Number(x);
        } else {
          normalized += x;
        }

        if (index != arr.length - 1) {
          normalized += ".";
        }

        return normalized;
      })
      .join("");
  } catch (err) {
    return version;
  }
}

async function getNugetPackageJson(file) {
  const repoUID = "packages";

  if (await fsHelper.exist(file)) {
    try {
      const nuspecXml = await zipHelper.getNuspec(file);
      const nuspecJson = nuspecXmlToJson(nuspecXml);
      if (nuspecJson) {
        nuspecJson.PackageHash = await fsHelper.getFileHash(file);
        nuspecJson.PackageSize = (await fsHelper.getStats(file)).size;
        if (nuspecJson.Version.includes("-")) {
          nuspecJson.IsPrerelease = true;
        }

        nuspecJson.NormalizedVersion = normalizeVersion(nuspecJson.Version);

        const { latestVersion, absoluteLatestVersion } = await getLatestVersion(
          nuspecJson.Id,
          [nuspecJson.Version]
        );

        if (latestVersion === nuspecJson.Version) {
          nuspecJson.IsLatestVersion = true;

          await db.dbQuery(
            {
              Id: nuspecJson.Id,
              repoUID,
            },
            db.queries.set.packageLatestVersionToFalse
          );
        }

        if (absoluteLatestVersion === nuspecJson.Version) {
          nuspecJson.IsAbsoluteLatestVersion = true;

          await db.dbQuery(
            {
              Id: nuspecJson.Id,
              repoUID,
            },
            db.queries.set.packageAbsoluteLatestVersionToFalse
          );
        }

        const dateNow = Date.now();
        nuspecJson.Published = dateNow;
        nuspecJson.LastUpdated = dateNow;

        return nuspecJson;
      } else {
        new Error("new package json file is empty");
      }
    } catch (err) {
      console.error(err);
      throw err;
    }
  } else {
    console.error(file, "does not exist");
    new Error(`${file} does not exist`);
  }
}

async function getLatestVersion(id, extraVersionsArray) {
  const dbPackages = await db.dbQuery(
    {
      Id: id,
    },
    db.queries.get.packagesById
  );

  let versions = dbPackages.map((x) => x.Version);

  if (extraVersionsArray) {
    versions = versions.concat(extraVersionsArray);
  }

  let latestVersion = null;
  let absoluteLatestVersion = versions[0];
  let isPrerelease = false;

  for (const version of versions) {
    isPrerelease = version.indexOf("-") !== -1;

    if (compareVersions(version, absoluteLatestVersion) >= 0) {
      absoluteLatestVersion = version;

      if (!isPrerelease) {
        latestVersion = version;
      }
    } else if (!latestVersion && !isPrerelease) {
      latestVersion = version;
    }
  }

  if (!latestVersion) {
    latestVersion = absoluteLatestVersion;
  }

  return {
    latestVersion,
    absoluteLatestVersion,
  };
}

module.exports = {
  init,
  getNugetPackageJson,
  reconstructJson,
  reconstructXml,
  createDbPackage,
  getPackages,
  replaceString,
};
