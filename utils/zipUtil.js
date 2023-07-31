const unzip = require("unzipper");
const fs = require("fs");
const fsHelper = require("./fsUtil");

async function getNuspec(file) {
  const exists = await fsHelper.exist(file);
  if (!exists) {
    throw new Error("File was not found.");
  }

  return new Promise((resolve, reject) => {
    let str = "";
    let stream = fs.createReadStream(file);
    stream.pipe(unzip.Parse()).on("entry", (entry) => {
      let fileName = entry.path;
      if (fileName.toLowerCase().endsWith(".nuspec")) {
        entry.on("data", (data) => {
          str += data;
        });

        entry.on("finish", () => {
          resolve(str.toString("utf8"));
        });
      } else {
        entry.autodrain();
      }
    });

    stream.on("finish", () => {
      reject(new Error("Nuspec file not found."));
    });
  });
}

module.exports = { getNuspec };
