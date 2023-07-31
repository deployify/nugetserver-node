const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const { join } = path;

async function getInDir(dir, dirs = false) {
  return new Promise(async (resolve, reject) => {
    if (await this.exist(dir)) {
      fs.readdir(dir, async (err, arr) => {
        if (!err) {
          const toReturn = [];
          for (const x of arr) {
            let stats = await this.getLStats(join(dir, x));
            if (stats.isDirectory() === dirs) {
              toReturn.push(x);
            }
          }

          resolve(toReturn);
        } else {
          reject("Could not delete " + dir + ": " + err);
        }
      });
    } else {
      resolve([]);
    }
  });
}

async function deleteFile(file) {
  return new Promise(async (resolve, reject) => {
    if (await this.exist(file)) {
      fs.unlink(file, (err) => {
        if (!err) {
          resolve();
        } else {
          reject("Could not delete " + file + ": " + err);
        }
      });
    } else {
      resolve();
    }
  });
}

async function moveFile(oldFile, newFile) {
  try {
    if (await this.exist(oldFile)) {
      await this.copyFile(oldFile, newFile);
      await this.deleteFile(oldFile);
    } else {
      throw new Error(oldFile + " does not exist.");
    }
  } catch (err) {
    throw err;
  }
}

async function copyFile(fromFile, toFile) {
  return new Promise(async (resolve, reject) => {
    if (await this.exist(fromFile)) {
      fs.copyFile(fromFile, toFile, (err) => {
        if (!err) {
          resolve();
        } else {
          reject(err);
        }
      });
    } else {
      reject(fromFile + " does not exist.");
    }
  });
}

async function readFile(file) {
  return new Promise(async (resolve, reject) => {
    if (await this.exist(file)) {
      fs.readFile(file, (err, data) => {
        if (!err) {
          resolve(data);
        } else {
          reject("Could not read " + file + ": " + err);
        }
      });
    } else {
      reject(file + " does not exist.");
    }
  });
}

async function writeFile(file, data) {
  return new Promise(async (resolve, reject) => {
    if (!(await this.exist(file))) {
      fs.writeFile(file, data, (err) => {
        if (!err) {
          resolve();
        } else {
          reject("Could not write to " + file + ": " + err);
        }
      });
    } else {
      reject(file + " already exist.");
    }
  });
}

async function exist(dir) {
  return new Promise((resolve, reject) => {
    fs.stat(dir, (err, stats) => {
      if (stats) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}

async function createDir(dir) {
  return new Promise(async (resolve, reject) => {
    if (!(await this.exist(dir))) {
      fs.mkdir(
        dir,
        {
          recursive: true,
        },
        (err) => {
          if (!err) {
            resolve();
          } else {
            reject("Could not create " + dir + ": " + err);
          }
        }
      );
    } else {
      resolve(dir + " already exists.");
    }
  });
}

async function getFileHash(file, hashName = "sha512") {
  return new Promise(async (resolve, reject) => {
    if (await this.exist(file)) {
      const stream = fs.createReadStream(file);
      const hash = crypto.createHash(hashName);
      stream.on("error", () => reject("GetFileHash: file stream error"));
      stream.on("data", (chunk) => hash.update(chunk));
      stream.on("end", () => resolve(hash.digest("base64")));
    } else {
      reject("GetFileHash: Could not create file hash");
    }
  });
}

async function getStats(dir) {
  return new Promise(async (resolve, reject) => {
    if (await this.exist(dir)) {
      fs.stat(dir, (err, stats) => {
        if (!err) {
          resolve(stats);
        } else {
          reject("Could not get stats " + dir + ": " + err);
        }
      });
    } else {
      reject(dir + " does not exist.");
    }
  });
}

async function getLStats(dir) {
  return new Promise(async (resolve, reject) => {
    if (await this.exist(dir)) {
      fs.lstat(dir, (err, lstats) => {
        if (!err) {
          resolve(lstats);
        } else {
          reject("Could not get stats " + dir + ": " + err);
        }
      });
    } else {
      reject(dir + " does not exist.");
    }
  });
}

module.exports = {
  getLStats,
  getStats,
  getFileHash,
  createDir,
  exist,
  writeFile,
  readFile,
  getInDir,
  deleteFile,
  moveFile,
  copyFile,
};
