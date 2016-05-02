exports.hello = "Hello";
console.log(require("./world"))
exports.doneLoading = true;
if(require.main === module) {
	console.log("hello module is main!!!!");
}
console.log("hello's filename is", __filename);
