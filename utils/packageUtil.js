const compareVersions = require("compare-versions");
const { join } = require("path");

const fsHelper = require("./fsUtil");
const db = require("../services/db");
const zipHelper = require("./zipUtil");
const xml = {};

getXmlTemplates();

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
  return packages.map((p) => {
    p = { ...p };
    p.Published = `/Date(${new Date(p.Published).getTime()})/`;
    p.LastUpdated = `/Date(${new Date(p.LastUpdated).getTime()})/`;
    return {
      __metadata: {
        uri: `${baseUrl}/Packages(Id='${p.Id}',Version='${p.Version}')`,
        type: "NuGet.Server.DataServices.ODataPackage",
        edit_media: `${baseUrl}/Packages(Id='${p.Id}',Version='${p.Version}')/$value`,
        media_src: `${baseUrl}/package/${p.Id}/${p.Version}`,
        content_type: "application/zip",
      },
      ...p,
    };
  });
}

function reconstructPackagesXML(packages, baseUrl) {
  return packages
    .map((p) => {
      p = { ...p };
      p.Published = new Date(p.Published).toISOString();
      p.LastUpdated = new Date(p.LastUpdated).toISOString();

      let newStr = xml.templateContent;
      newStr = replaceString(newStr, "@baseUrl", baseUrl);

      for (const prop in p) {
        newStr = replaceString(newStr, `@${prop}`, p[prop]);
      }

      const keys = newStr.match(/\@([^<]*)/g);
      if (keys && keys.length != 0) {
        for (const key of keys) {
          newStr = replaceString(newStr, `${key}`, "");
        }
      }

      return newStr;
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
  } else {
    if (packages && packages.length !== 0) {
      return {
        d: reconstructPackagesJson(packages, baseUrl)[0],
      };
    } else {
      return {
        d: {},
      };
    }
  }
}

function reconstructXml(packages, baseUrl, returnSingle) {
  if (!returnSingle) {
    let header = replaceString(xml.templateHeader, "@baseUrl", baseUrl);
    header = replaceString(header, "@date", new Date());
    return (
      header + reconstructPackagesXML(packages, baseUrl) + xml.templateFooter
    );
  } else {
    if (packages.length !== 0) {
      return (
        `<?xml version="1.0" encoding="utf-8" standalone="yes"?>` +
        reconstructPackagesXML(packages, baseUrl)
      );
    } else {
      return (
        `<?xml version="1.0" encoding="utf-8" standalone="yes"?>` +
        xml.errorMeta
      );
    }
  }
}

function replaceString(str, key, value) {
  const regex = new RegExp(key, "gim");
  if (value != null) {
    return str.replace(regex, value);
  }

  return str.replace(regex, "");
}

function getPackageSkelaton() {
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

async function getPackages(query) {
  let searchTerm = query.searchTerm;
  let filter = query.$filter;
  let orderby = query.$orderby;
  let skip = query.$skip;
  let top = query.$top;
  let dbObj = {};

  try {
    const idMatch = filter.match(/'(.*)'/);
    if (idMatch) {
      return await db.dbQuery(
        { Id: id },
        db.queries.get.packageByIdAndLatestVersion
      );
    }

    if (filter.IsAbsoluteLatestVersion) {
      return await db.dbQuery(null, db.queries.get.packagesByLatestVersion);
    }

    return await db.dbQuery(null, db.queries.get.packagesByLatestVersion);
  } catch (e) {
    if (filter) console.error(filter);
    console.error(e);
    throw new Error("Internal error.");
  }
}

function parseNuspec(xml) {
  try {
    const skelaton = getPackageSkelaton();

    const regex1 = new RegExp(
      `(?:.?)<dependency(?:\\s)id=\\"(.*)\\"(?:\\s)version=\\"(.*)\\"(?:\\s)\\/>(?:.?)`,
      "gim"
    );

    const match1 = xml.toString().matchAll(regex1);
    for (const m of match1) {
      const id = m[1];
      const version = m[2];

      if (skelaton.Dependencies === "") skelaton.Dependencies += `${id}:`;
      else skelaton.Dependencies += `|${id}:`;

      if (version && version !== "") skelaton.Dependencies += `${version}:`;
    }

    for (const prop in skelaton) {
      const regex2 = new RegExp(
        `\\<(\\s*)(${prop})(\\s*)\\>(.*)\\<\\/(\\s*)(${prop})(\\s*)\\>`,
        "gi"
      );

      const match2 = regex2.exec(xml);
      if (match2 && match2.length >= 5) {
        if (typeof skelaton[prop] === "boolean") {
          skelaton[prop] = match2[4] == "true";
        }

        if (typeof skelaton[prop] === "string") {
          skelaton[prop] = match2[4];
        }

        if (typeof skelaton[prop] === "number") {
          skelaton[prop] = Number(match2[4]);
        }
      }
    }

    return skelaton;
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
      const xml = await zipHelper.getNuspec(file);
      const newPackage = parseNuspec(xml);
      if (newPackage) {
        newPackage.PackageHash = await fsHelper.getFileHash(file);
        newPackage.PackageSize = (await fsHelper.getStats(file)).size;
        if (newPackage.Version.includes("-")) {
          newPackage.IsPrerelease = true;
        }

        newPackage.NormalizedVersion = normalizeVersion(newPackage.Version);

        const { latestVersion, absoluteLatestVersion } = await getLatestVersion(
          newPackage.Id,
          [newPackage.Version]
        );

        if (latestVersion === newPackage.Version) {
          newPackage.IsLatestVersion = true;

          await db.dbQuery(
            {
              Id: newPackage.Id,
              repoUID,
            },
            db.queries.set.packageLatestVersionToFalse
          );
        }

        if (absoluteLatestVersion === newPackage.Version) {
          newPackage.IsAbsoluteLatestVersion = true;

          await db.dbQuery(
            {
              Id: newPackage.Id,
              repoUID,
            },
            db.queries.set.packageAbsoluteLatestVersionToFalse
          );
        }

        const date = Date.now();
        newPackage.Published = date;
        newPackage.LastUpdated = date;

        return newPackage;
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

async function getLatestVersion(Id, extraVersionsArray) {
  let versions = (
    await db.dbQuery(
      {
        Id: Id,
      },
      db.queries.get.packageById
    )
  ).map((x) => x.Version);

  if (extraVersionsArray) {
    versions = versions.concat(extraVersionsArray);
  }

  let latestVersion = null;
  let absoluteLatestVersion = versions[0];
  let isPrerelease = false;

  for (const version of versions) {
    if (version.indexOf("-") !== -1) isPrerelease = true;
    else isPrerelease = false;

    if (compareVersions(version, absoluteLatestVersion) >= 0) {
      absoluteLatestVersion = version;
      if (!isPrerelease) latestVersion = version;
    } else if (!latestVersion && !isPrerelease) latestVersion = version;
  }

  if (!latestVersion) latestVersion = absoluteLatestVersion;

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
