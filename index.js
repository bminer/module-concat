/* node-module-concat
	Node.js module concatenation library

	This library exposes a single function that concatenates Node.js modules
	within a project.  This can be used to obfuscate an entire project into a
	single file.  It can also be used to write client-side JavaScript code where
	each file is written just like a Node.js module.

	Known limitations:
		- Dynamic `require()` statements don't work
			(i.e. `require("./" + variable)`)
		- `require.resolve` calls are not modified
		- `require.cache` statements are not modified
*/

var fs = require("fs")
	, path = require("path")
	, stride = require("stride");

// Read main header/footer and header/footer for each file in the project
var header = fs.readFileSync(__dirname + "/lib/header.js").toString("utf8")
	, footer = fs.readFileSync(__dirname + "/lib/footer.js").toString("utf8")
	, fileHeader = fs.readFileSync(__dirname + "/lib/fileHeader.js").toString("utf8")
	, fileFooter = fs.readFileSync(__dirname + "/lib/fileFooter.js").toString("utf8");

/* Concatenate all modules within a project.
	The procedure works like this:

	0.) A special header file is added to the `outputFile`.  See
		`./lib/header.js` for details.
	1.) Read the entry module, as specified by its path.
	2.) Scan the file for `require("...")` or `require('...')` statements.
		Note: Dynamic require statements such as `require("./" + b)` are not
			matched.
	3.) If the fixed path specified by the `require("...")` statement is a
		relative or absolute filesystem path (i.e. it begins with "./", "../",
		or "/"), then that file is added to the project and recursively scanned
		for `require` statements as in step #2.  Additionally, the file is given
		an unique identifier, and the `require("...")` statement is replaced
		with `__require(id)` where `id` is the unique identifier.  `__require`
		is explained in more detail in `./lib/header.js`.
	4.) In addition, any reference to `__dirname` or `__filename` is replaced
		with `__getDirname(...)` and `__getFilename(...)`, which are explained
		in `./lib/header.js`.

		Note: __dirname and __filename references are replaced with paths
			relative to the `outputFile` at the time of concatenation.
			Therefore, if you move `outputFile` to a different path, the
			__dirname and __filename reference will also change, but it will
			still be the relative path at the time of concatenation.  If you
			don't know what I mean and you are having issues, please just read
			./lib/header.js and look at the contents of the `outputFile`.
	5.) Finally, the modified file is wrapped with a header and footer to
		encapsulate the module within its own function.  The wrapped code is
		then written to the `outputFile`.
	6.) Once all of the modules are written to the `outputFile`, a footer is
		added to the `outputFile` telling Node to require and execute the entry
		module.

	Any source file added to the project has:
		- A prepended header (./lib/fileHeader.js)
		- An appended footer (./lib/fileFooter.js)
		- Certain `require` statements replaced with `__require`
		- All `__dirname` and `__filename` references replaced with
			`__getDirname(...)` and `__getFilename(...)` references.
*/
module.exports = function concat(entryModule, outputFile, cb) {
	// A list of all of the files read and included in the output thus far
	var files = [];
	// The file descriptor pointing to the `outputFile`
	var fd;

	stride(function writeMainHeader() {
		var cb = this;
		// Open WriteStream
		var out = fs.createWriteStream(outputFile);
		out.on("open", function(_fd) {
			// Save the file descriptor
			fd = _fd;
			// Write main header
			fs.write(fd, header, null, "utf8", cb);
		});
	}, function processEntryModule() {
		// Add entry module to the project
		files.push(path.resolve(entryModule) );
		addToProject(fd, files[0], this);
	}, function writeMainFooter() {
		// Write main footer
		fs.write(fd, footer, null, "utf8", this);
	}).once("done", function(err) {
		if(fd) {
			fs.close(fd, function(closeErr) {
				cb(err || closeErr, files);
			});
		} else {
			cb(err, files);
		}
	});

	function getPathRelativeToOutput(filePath) {
		return path.relative(path.dirname(outputFile), filePath);
	}
	function addToProject(fd, filePath, cb) {
		// Keep track of the current `files` length; we need it later
		var lengthBefore = files.length;
		stride(function writeHeader() {
			// Write module header
			fs.write(fd, fileHeader
				.replace(/\$\{id\}/g, files.indexOf(filePath) )
				.replace(/\$\{path\}/g, filePath), null, "utf8", this);
		}, function writeExtraHeaderForJSON() {
			// If this is a *.json file, add some extra fluff
			if(path.extname(filePath) === ".json")
				fs.write(fd, "module.exports = ", null, "utf8", this);
			else
				this(null);
		}, function readFile() {
			// Read file
			fs.readFile(filePath, {"encoding": "utf8"}, this);
		}, function processFile(code) {
			// Scan file for `require(...)`, `__dirname`, and `__filename`
			var requireRegex = /require\s*\(\s*(\s*["'])((?:(?=(\\?))\3.)*?)\1\s*\)/g,
				dirnameRegex = /__dirname/g,
				filenameRegex = /__filename/g;
			code = code.replace(requireRegex, function(match, quote, modulePath) {
				// Check to see if this require path begins with "./" or "../" or "/"
				if(modulePath.match(/^\.?\.?\//) !== null) {
					try {
						modulePath = require.resolve(path.resolve(
							path.join(path.dirname(filePath), modulePath)
						) );
						// Lookup this module's ID
						var index = files.indexOf(modulePath);
						if(index < 0) {
							// Not found; add this module to the project
							index = files.push(modulePath) - 1;
						}
						// Replace the `require` statement with `__require`
						return "__require(" + index + ")";
					} catch(e) {
						// Ignore; do not replace
						return match;
					}
				} else {
					// Ignore; do not replace
					return match;
				}
			})
			// Replace `__dirname` with `__getDirname(...)`
			.replace(dirnameRegex, "__getDirname(" +
				JSON.stringify(getPathRelativeToOutput(filePath) ) + ")")
			// Replace `__filename` with `__getFilename(...)`
			.replace(filenameRegex, "__getFilename(" +
				JSON.stringify(getPathRelativeToOutput(filePath) ) + ")");
			// Write the modified code
			fs.write(fd, code, null, "utf8", this);
		}, function writeFooter() {
			// Write module footer
			index = files.indexOf(filePath);
			fs.write(fd, fileFooter
				.replace(/\$\{id\}/g, index)
				.replace(/\$\{path\}/g, filePath), null, "utf8", this);
		}, function addPendingFiles() {
			// Process any pending files that were required by this file
			var lengthAfter = files.length;
			var args = [];
			for(var i = lengthBefore; i < lengthAfter; i++) {
				// Create new context for filename
				(function(filename) {
					args.push(function() {
						addToProject(fd, filename, this);
					});
				})(files[i]);
			}
			// Pass the `args` Array to stride, and kick off the processing
			stride.apply(null, args).once("done", this);
		}).once("done", cb);
	}
};

// If this module is invoked directly, behave like a cli
if(require.main === module) {
	if(process.argv.length !== 4) {
		console.log("Usage: node concat.js [entryModule] [outputFile]");
		process.exit(1);
	}
	module.exports(process.argv[2], process.argv[3], function(err, files) {
		if(err) {
			console.error("Error", err.stack);
			process.exit(1);
		}
		else {
			console.log(files.length + " files written to " + process.argv[3] + ".");
			console.log("Completed successfully.");
		}
	});
}
