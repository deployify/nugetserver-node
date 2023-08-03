const { join } = require("path");

const multer = require("multer");
const multerUpload = multer({
  dest: join(__dirname, "uploads"),
});

const db = require("./services/db.js");
const fsHelper = require("./utils/fsUtil");
const pHelper = require("./utils/packageUtil.js");

const permissions = {
  read: 1,
  download: 2,
  update: 4,
  create: 8,
  delete: 16,
  owner: 32,
};

module.exports = class {
  constructor(app, config) {
    try {
      this.app = app;

      this.key = config.key;

      this.repoDir = config.rootDir;
      this.baseRoutev1 = "/:key/nuget";

      this.init();
    } catch (err) {
      console.error(err);
    }
  }

  async init() {
    try {
      await pHelper.init();
      console.log("Initing Nuget server...");

      const exists = await fsHelper.exist(this.repoDir);
      if (!exists) {
        fsHelper.createDir(this.repoDir);
      }

      this.metadata = await fsHelper.readFile(
        join(__dirname, "templates", "metadata.xml")
      );

      this.baseMetadata = (
        await fsHelper.readFile(
          join(__dirname, "templates", "basemetadata.xml")
        )
      ).toString();
      console.log("Setting routes.");
      await this.checkPackages();

      this.setRoutes();
      console.log("Nuget server inited.");
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  checkPermission(req, res, next, neededPermission) {
    if (req.temp.permission < neededPermission) {
      return res.status(401).send("Permission denied.");
    }

    next();
  }

  setRoutes() {
    this.app.use([`${this.baseRoutev1}*`], async (req, res, next) => {
      try {
        if (!req.params.key) {
          return res.status(401).send("Missing key param.");
        }

        const permission = req.params.key === this.key ? permissions.owner : 0;

        req.temp = {
          permission,
        };

        if (!permission) {
          return res.status(401).send("Permission denied.");
        }

        next();
      } catch (err) {
        console.error(err);
        return res.status(401).send();
      }
    });

    this.app.get(
      [`${this.baseRoutev1}`],
      (req, res, next) => {
        this.checkPermission(req, res, next, permissions.read);
      },
      (req, res) => {
        try {
          res.type("application/xml;charset=utf-8");
          res.send(
            pHelper.replaceString(
              this.baseMetadata,
              "@baseUrl",
              this.getBaseUrl(req)
            )
          );
        } catch (err) {
          console.error(err);
        }
      }
    );

    this.app.get(
      [`${this.baseRoutev1}/[\$]metadata`],
      (req, res, next) => {
        this.checkPermission(req, res, next, permissions.read);
      },
      (req, res) => {
        try {
          res.type("application/xml;charset=utf-8");
          res.send(this.metadata);
        } catch (err) {
          console.error(err);
        }
      }
    );

    this.app.get(
      [`${this.baseRoutev1}/package/:Id/:Version`],
      (req, res, next) => {
        this.checkPermission(req, res, next, permissions.download);
      },
      async (req, res) => {
        try {
          req.setTimeout(999999999);
          res.setTimeout(999999999);

          const Id = req.params.Id;
          const Version = req.params.Version;
          const file = join(this.repoDir, `${Id}.${Version}.nupkg`);

          const packages = await db.dbQuery(
            {
              Id,
              Version,
            },
            db.queries.get.packageByIdAndVersion
          );

          if (packages.length === 0) {
            return res.status(410).send("The package does not exist.");
          }

          const exists = await fsHelper.exist(file);
          if (!exists) {
            return res.status(410).send("The package does not exist.");
          }

          await db.dbQuery(
            {
              Id,
              Version,
            },
            db.queries.set.incrementDownloaded
          );

          res.download(file);
        } catch (err) {
          console.error(err);
        }
      }
    );

    this.app.get(
      [`${this.baseRoutev1}/FindPackagesById\\(\\)`],
      (req, res, next) => {
        this.checkPermission(req, res, next, permissions.read);
      },
      async (req, res) => {
        try {
          const Id = req.query.id.replace(/'/g, "");

          if (!Id) {
            return res.status(400).send("Missing Id param");
          }

          const packages = await db.dbQuery(
            {
              Id,
            },
            db.queries.get.packageById
          );

          this.handlePackagesResult(req, res, packages, false);
        } catch (errorCode) {
          res.status(500).send();
        }
      }
    );

    this.app.get(
      [`${this.baseRoutev1}/Packages\\(:Id\\,:Version\\)`],
      (req, res, next) => {
        this.checkPermission(req, res, next, permissions.read);
      },
      async (req, res) => {
        try {
          const Id = req.params.Id.split("=")[1].replace(/'/g, "");
          const Version = req.params.Version.split("=")[1].replace(/'/g, "");

          if (!Id || !Version) {
            return res.status(400).send("Missing param");
          }

          const packages = await db.dbQuery(
            {
              Id,
              Version,
            },
            db.queries.get.packageByIdAndVersion
          );

          this.handlePackagesResult(req, res, packages, true);
        } catch (errorCode) {
          res.status(errorCode).send();
        }
      }
    );

    this.app.get(
      [
        `${this.baseRoutev1}/Packages`,
        `${this.baseRoutev1}/Packages\\(\\)`,
        `${this.baseRoutev1}/Search`,
        `${this.baseRoutev1}/Search\\(\\)`,
      ],
      (req, res, next) => {
        this.checkPermission(req, res, next, permissions.read);
      },
      async (req, res) => {
        try {
          let packages = [];

          if (!req.query.$filter) {
            packages = await db.dbQuery(null, db.queries.get.packages);
          } else {
            packages = await pHelper.getPackages(req.query);
          }

          this.handlePackagesResult(req, res, packages, false);
        } catch (errorCode) {
          console.log(errorCode);
          res.status(500).send();
        }
      }
    );

    this.app.put(
      [`${this.baseRoutev1}`, `${this.baseRoutev1}/api/v2/package`],
      multerUpload.single("package"),
      (req, res, next) => {
        this.checkPermission(req, res, next, permissions.create);
      },
      async (req, res, next) => {
        try {
          req.setTimeout(999999999);
          res.setTimeout(999999999);

          if (!req.file) {
            return res.status(400).send("Missing field: package");
          }

          const newPackage = await pHelper.getNugetPackageJson(req.file.path);

          await pHelper.createDbPackage(newPackage);
          await fsHelper.moveFile(
            req.file.path,
            `${this.repoDir}/${newPackage.Id}.${newPackage.Version}.nupkg`
          );
          res.status(201).send();
          await fsHelper.deleteFile(req.file.path);
        } catch (err) {
          console.error(err);
          await fsHelper.deleteFile(req.file.path);
          res.status(500).send();
        }
      }
    );
  }

  getBaseUrl(req) {
    const key = req.params.key;
    const protocol = req.protocol;
    const domain = req.headers["host"];

    return `${protocol}://${domain}/${key}/nuget`;
  }

  async checkDeletedPackages() {
    try {
      const result = await db.dbQuery({}, db.queries.get.packages);

      for (const p of result) {
        const exists = await fsHelper.Exist(p.path);

        if (!exists) {
          await db.dbQuery(
            {
              Id: p.Id,
              Version: p.Version,
            },
            db.queries.delete.packageByIdAndVersion
          );
        }
      }
    } catch (err) {
      console.error("Could not check for deleted packages:", err);
    }
  }

  async checkPackages() {
    console.log("Inventorying packages...");

    try {
      const files = await fsHelper.getInDir(this.repoDir, false);
      for (const file of files.filter((x) => x.endsWith(".nupkg"))) {
        try {
          const fullFilePath = join(this.repoDir, file);

          const newPackage = await pHelper.getNugetPackageJson(fullFilePath);

          const existsInDb = await db.dbQuery(
            {
              Id: newPackage.Id,
              Version: newPackage.Version,
            },
            db.queries.get.packageByIdAndVersion
          );

          if (existsInDb.length === 0) {
            await pHelper.createDbPackage(newPackage);
          }
        } catch (err) {
          console.error(err.message);
        }
      }
    } catch (err) {
      console.error(err.massage);
    }

    console.log("Checking packages is done.");
  }

  handlePackagesResult(req, res, packages, single) {
    if (
      req.headers.accept &&
      req.headers.accept.indexOf("application/atom+xml") !== -1
    ) {
      res.type("application/atom+xml;charset=utf-8");
      return res.send(
        pHelper.reconstructXml(packages, this.getBaseUrl(req), single)
      );
    }

    res.type("application/json;charset=utf-8");
    res.json(pHelper.reconstructJson(packages, this.getBaseUrl(req), single));
  }
};
