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

new NugetServer(app, {
  rootDir: join(__dirname, "packages"),
  key: "testing",
});

const port = 5000;
app.listen(port, function () {
  console.log(`Express is running on port ${port}`);
});
