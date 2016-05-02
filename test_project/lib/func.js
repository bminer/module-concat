console.log("func, printing world.func:", require("./world").func);
module.exports = function() {
	return "I am a function returning a string";
};
