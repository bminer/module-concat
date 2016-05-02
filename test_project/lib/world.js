exports.world = "World";
exports.file = require("fs").readFileSync(__dirname + "/file.txt");
console.log("world printing hello", require("./hello"));
exports.func = require("./func");
