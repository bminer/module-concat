var fs = require("fs")
	, hello = require("./lib/hello")
	, world = require("./lib/world")
	, func = require("./lib/func")
	, cool = require("cool");

try {
	let foo = require("notfound");
} catch(e) {}

console.log(hello.hello + ", " + world.world);
console.log(fs.readFileSync(__filename).toString() );
console.log(func() );
exports.hello = hello;
exports.world = world;
exports.func = func;
console.log("index printing world.func:", world.func);
if(require.main === module) {
	console.log("index is main!");
} else {
	console.log("index is **NOT** main!");
}
console.log(cool);
console.log("module-concat version:", require("../package.json").version);
