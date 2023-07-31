const { v4: uuidv4 } = require("uuid");

module.exports = {
  encodeStr(str) {
    return Buffer.from(str).toString("base64");
  },

  decodeStr(str) {
    return Buffer.from(str, "base64").toString("ascii");
  },

  getNumbersFromStr(str) {
    let groups = str.match(/(\d*)/g);

    if (groups && groups.length > 0) {
      return groups[0];
    }

    return 0;
  },

  getUUID() {
    return uuidv4();
  },

  getFileExt(fileName) {
    let splitted = fileName.split(".");
    return splitted[splitted.length - 1].toLowerCase();
  },

  replaceChar(str, index, value) {
    return str.substr(0, index) + value + str.substr(index + value.length);
  },

  replaceFirstOrLastChar(str, oldChar, newChar, last) {
    if (last) {
      return this.replaceChar(str, str.lastIndexOf(oldChar), newChar);
    } else {
      return this.replaceChar(str, str.indexOf(oldChar), newChar);
    }
  },

  getVersionFromFileName(fileName) {
    let arr = fileName.split(".");

    if (arr.length >= 2) {
      arr.splice(0, 1);
      arr.splice(arr.length - 1, 1);
      return arr.join(".");
    }
  },
};
