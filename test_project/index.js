var fs = require("fs")
	, hello = require("./lib/hello")
	, world = require("./lib/world");

console.log(hello.hello + ", " + world.world);
console.log(fs.readFileSync(__filename).toString() );
exports.hello = hello;
exports.world = world;
