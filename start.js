const bodyParser = require("body-parser");
const express = require("express");
const app = express();
const { join } = require("path");

const NugetServer = require("./nugetserver.js");

app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

app.set("trust proxy", true);

const port = process.env.PORT || 5000;
const config = {
  rootDir: join(__dirname, process.env.ROOT_DIR || "packages"),
  key: process.env.API_KEY || "testing",
};

new NugetServer(app, config);

app.listen(port, () => {
  console.log(`API running on port ${port}`);
});

process.on("SIGINT", () => {
  process.exit(0);
});
