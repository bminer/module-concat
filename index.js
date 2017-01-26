/* module-concat
	CommonJS module concatenation library
*/
const fs = require("fs"),
	ModuleConcatStream = require("./lib/moduleConcatStream");

function modConcat(entryModule, outputPath, opts, cb) {
	// Re-organize arguments
	if(typeof opts === "function") {
		cb = opts;
		opts = {};
	}
	// Create a Promise that resolves once the concatenation is complete
	let p = new Promise((resolve, reject) => {
		opts = opts || {};
		opts.outputPath = outputPath;
		// Create output stream and ModuleConcatStream
		let out = fs.createWriteStream(outputPath);
		out.on("error", reject);
		let project = new ModuleConcatStream(entryModule, opts);
		project.on("error", reject);
		// Pipe to outputPath and resolve to stats when complete
		out.on("finish", () => {
			try {
				resolve(project.getStats() )
			} catch(e) {
				reject(e);
			}
		});
		project.pipe(out);
	});
	// Call `cb` if it was provided; otherwise return the Promise
	if(typeof cb === "function") {
		p.then((data) => {
			process.nextTick(() => cb(null, data) );
		}).catch((err) => {
			process.nextTick(() => cb(err) );
		});
	} else {
		return p;
	}
};

// Expose `modConcat` function and `ModuleConcatStream`
modConcat.ModuleConcatStream = ModuleConcatStream;
module.exports = modConcat;

// If this module is invoked directly, behave like a CLI
if(require.main === module) {
	if(process.argv.length !== 4) {
		console.log("Usage: node concat.js [entryModule] [outputPath]");
		return process.exit(1);
	}
	modConcat(process.argv[2], process.argv[3], function(err, stats) {
		if(err) {
			console.error("An error occurred:\n", err.stack);
			process.exit(1);
		} else {
			console.log(stats.files.length + " files written to " +
				process.argv[3] + ".");
			if(stats.unresolvedModules.length) {
				console.log("The following modules could not be resolved:\n",
					stats.unresolvedModules);
			}
			console.log("Completed successfully.");
		}
	});
}
