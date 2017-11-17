const fs = require("fs")
	, path = require("path")
	, Readable = require("stream").Readable
	, resolve = require("resolve");

// Read main header/footer and header/footer for each file in the project
const HEADER = fs.readFileSync(__dirname + "/header.js", {"encoding": "utf8"})
	, FOOTER = fs.readFileSync(__dirname + "/footer.js", {"encoding": "utf8"})
	, FILE_HEADER = fs.readFileSync(__dirname + "/fileHeader.js", {"encoding": "utf8"})
	, FILE_FOOTER = fs.readFileSync(__dirname + "/fileFooter.js", {"encoding": "utf8"});

/* Concatenate all modules within a project.
	The procedure works like this:

	0.) Add a special header file to the stream.  See `./lib/header.js` for
		details.
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
	4.) In addition, if `outputPath` is specified, any reference to `__dirname`
		or `__filename` is replaced with `__getDirname(...)` and
		`__getFilename(...)`, which are explained in `./lib/header.js`.

		Note: __dirname and __filename references are replaced with paths
			relative to the `outputPath` at the time of concatenation.
			Therefore, if you move `outputPath` to a different path, the
			__dirname and __filename reference will also change, but it will
			still be the relative path at the time of concatenation.  If you
			don't know what I mean and you are having issues, please just read
			./lib/header.js and look at the contents of the `outputPath`.
	5.) Finally, the modified file is wrapped with a header and footer to
		encapsulate the module within its own function.  Then, it is written to
		the stream.
	6.) Once all of the modules are written to the stream, add a special footer
		to the stream.  See `./lib/footer.js` for details.

	Any source file added to the project has:
		- A prepended header (./lib/fileHeader.js)
		- An appended footer (./lib/fileFooter.js)
		- Certain `require` statements replaced with `__require`
		- All `__dirname` and `__filename` references replaced with
			`__getDirname(...)` and `__getFilename(...)` references if
			`outputPath` is specified.

	Known limitations:
		- Dynamic `require()` statements don't work
			(i.e. `require("./" + variable)`)
		- `require.resolve` calls are not modified
		- `require.cache` statements are not modified

API
---
`new ModuleConcatStream(entryModulePath, options)`
	Constructs a Readable stream of the concatenated project.
- `entryModulePath` - the path to the entry point of the project to be
	concatenated.  This might be an `index.js` file, for example.
- `options` - object to specify any of the following options
	- `outputPath`
	- `excludeFiles`
	- `excludeNodeModules`
	- `extensions`
	- `compilers`
	- `browser`

	See README.md for more details.
*/
class ModuleConcatStream extends Readable {
	constructor(entryModulePath, options) {
		// Pass Readable options to the super constructor
		super(options);
		// Save options
		let opts = this._options = options || {};
		// Ensure that `opts.excludeFiles` is an Array
		if(!Array.isArray(opts.excludeFiles) ) {
			opts.excludeFiles = [];
		}
		// Ensure all excluded file paths are resolved
		for(var i = 0; i < opts.excludeFiles.length; i++) {
			opts.excludeFiles[i] = path.resolve(opts.excludeFiles[i]);
		}
		// Ensure `opts.excludeNodeModules` is either falsy, `true`, or an Array
		if(opts.excludeNodeModules && opts.excludeNodeModules !== true &&
			!Array.isArray(opts.excludeNodeModules) )
		{
			opts.excludeNodeModules = [opts.excludeNodeModules];
		}
		// Configure default file extensions
		if(!Array.isArray(opts.extensions) ) {
			opts.extensions = opts.extensions ? [opts.extensions] :
				[".js", ".json"];
		}
		// Add ".node" to the list to allow us to find native modules
		opts.extensions.push(".node");
		// Configure default compilers
		opts.compilers = opts.compilers || {};
		if(typeof opts.compilers[".json"] === "undefined") {
			opts.compilers[".json"] =
				(src, options) => "module.exports = " + src;
		}
		/* Use package.json `browser` field instead of `main` if `browser`
			option is set */
		if(opts.browser) {
			opts.packageFilter = (parsedPkgJson, pkgPath) => {
				/* Provide limited support of package `browser` field spec:
					https://github.com/defunctzombie/package-browser-field-spec
				*/
				if(typeof parsedPkgJson.browser === "string") {
					parsedPkgJson.main = parsedPkgJson.browser;
				} else if(typeof parsedPkgJson.browser === "object") {
					for(var key in parsedPkgJson.browser) {
						if(parsedPkgJson.browser[key] === false) {
							opts.excludeFiles.push(path.resolve(
								pkgPath + "/" + key
							) );
						} else if(key === parsedPkgJson.main) {
							parsedPkgJson.main = parsedPkgJson.browser[key];
						}
						// else, unsupported...
					}
				}
				return parsedPkgJson;
			};
		}
		// List of files already included in the project or pending inclusion
		this._files = [path.resolve(entryModulePath)];
		// Index pointing to the next file to included in the project
		this._fileIndex = 0;
		// List of native C/C++ add-ons found that were excluded from the output
		this._addonsExcluded = [];
		// Object containing modules that could not be resolved
		this._unresolvedModules = [];
		// Flag indicating that the header has been written
		this._headerWritten = false;
	}

	/* Called when we should start/continue processing.
		We should stop processing whenever `this.push` returns `false`. */
	_read(size) {
		// Write the project header
		if(!this._headerWritten) {
			this._headerWritten = true;
			if(!this.push(HEADER) )
				return;
		}
		// Write the next file in the project
		while(this._fileIndex < this._files.length) {
			if(!this.push(this._addFile(this._files[this._fileIndex])) ) {
				return;
			}
		}
		// Write the project footer
		this.push(FOOTER);
		// Write EOF
		this.push(null);
	}

	/* Adds the file from the given `filePath` to the project.  Returns the
		modified module contents (with header/footer added), which should be
		added to the stream. */
	_addFile(filePath) {
		try {
			// Create alias for `this._options`
			let opts = this._options;
			// Read the file synchronously from disk
			let code = fs.readFileSync(filePath, {"encoding": "utf8"});
			// Mark this file as included in the project
			this._fileIndex++;
			// Compile this file if needed
			let compiler = opts.compilers[path.extname(filePath)];
			if(compiler) {
				code = compiler(code, opts, filePath);
			}
			// Remove some line comments from code
			code = code.replace(/(?:\r\n?|\n)\s*\/\/.*/g, "");
			/* Scan file for `require(...)`, `__dirname`, and `__filename`
				Quick notes about the somewhat intense `requireRegex`:
				- require('...') and require("...") is matched
					- The single or double quote matched is group 1
				- Whitespace can go anywhere
				- The module path matched is group 2
				- Backslashes are allowed as escape characters only if followed
					by another backlash (to support Windows paths)
			*/
			var requireRegex = /require\s*\(\s*(["'])((?:(?:(?!\1)[^\\]|(?:\\\\)))*)\1\s*\)/g,
				dirnameRegex = /__dirname/g,
				filenameRegex = /__filename/g;
			// Modify `code` by replacing some `require(...)` calls
			code = code.replace(requireRegex, (match, quote, modulePath) => {
				/* Do not replace core modules, but we'll try to do so if
					`browser` flag is set */
				if(resolve.isCore(modulePath) && opts.browser !== true)
				{
					return match;
				}
				// Un-escape backslashes in the path by replacing "\\" with "\"
				modulePath = modulePath.replace("\\\\", "\\");
				/* Prevent including modules in `node_modules` if option is
					set.  Check to see if this require path doesn't begin
					with "./" or "../" or "/"
				*/
				if(opts.excludeNodeModules &&
					modulePath.match(/^\.?\.?\//) == null && (
						/* If `excludeNodeModules` is `true`, exclude all
							node_modules */
						opts.excludeNodeModules === true ||
						/* Otherwise, only exclude the module if it appears in
							the Array of excluded modules */
						opts.excludeNodeModules.indexOf(modulePath) >= 0
					) )
				{
					// Module is excluded; do not replace
					return match;
				}
				// Get ready to resolve the module
				opts.basedir = path.dirname(filePath);
				/* Take a guess on the resolved path and ignore any modules
					found in `excludeFiles` array */
				let estResolvedPath = modulePath.charAt(0) === "/" ?
						modulePath :
						path.resolve(opts.basedir + "/" + modulePath);
				if(opts.excludeFiles.indexOf(estResolvedPath) >= 0 ||
					opts.extensions.some((ext) =>
						opts.excludeFiles.indexOf(estResolvedPath + ext) >= 0) )
				{
					// File is excluded; do not replace
					return match;
				}
				// Thank you, node-resolve for making this easy!
				try {
					// Resolve the module path
					modulePath = resolve.sync(modulePath, opts);
					// Do not replace core modules
					if(resolve.isCore(modulePath) ) {
						return match;
					}
					// If this is a native module, abort
					if(path.extname(modulePath).toLowerCase() === ".node") {
						// This is a native module; do not replace
						this._addonsExcluded.push(modulePath);
						return match;
					}
					// Lookup this module's ID
					var index = this._files.indexOf(modulePath);
					if(index < 0) {
						/* Not added to project yet; try to add it after we
							double check to see if we should exclude it or not.
						*/
						if(opts.excludeFiles.indexOf(modulePath) < 0)
						{
							// Not excluded, so we're good to go!
							index = this._files.push(modulePath) - 1;
						}
						else {
							// File is excluded; do not replace
							return match;
						}
					}
					// Replace the `require` statement with `__require`
					var parentIndex = this._files.indexOf(filePath);
					return "__require(" + index + "," + parentIndex + ")";
				} catch(e) {
					// Could not resolve module path
					if(opts.allowUnresolvedModules) {
						this._unresolvedModules.push({
							"parent": filePath,
							"module": modulePath
						});
						return match;
					} else {
						// Unresolved modules are not allowed; throw the Error
						throw e;
					}
				}
			});
			// Handle `__dirname` and `__filename` replacement
			if(opts.outputPath && opts.browser !== true) {
				let outputPath = opts.outputPath;
				code = code
					// Replace `__dirname` with `__getDirname(...)`
					.replace(dirnameRegex, "__getDirname(" + JSON.stringify(
						path.relative(path.dirname(outputPath), filePath)
						) + ")")
					// Replace `__filename` with `__getFilename(...)`
					.replace(filenameRegex, "__getFilename(" + JSON.stringify(
						path.relative(path.dirname(outputPath), filePath)
						) + ")");
			}
			/* Return the modified module contents, prepending the module header
				and appending the module footer. */
			return FILE_HEADER
					.replace(/\$\{id\}/g, this._files.indexOf(filePath) )
					.replace(/\$\{path\}/g, filePath) +
				code +
				FILE_FOOTER
					.replace(/\$\{id\}/g, this._files.indexOf(filePath) )
					.replace(/\$\{path\}/g, filePath);
		} catch(err) {
			process.nextTick(() => {
				this.emit("error", err);
			});
			// Return EOF
			return null;
		}
	}

	getStats() {
		if(this._fileIndex < this._files.length) {
			throw new Error("Statistics are not yet available.");
		} else {
			return {
				"files": this._files,
				"addonsExcluded": this._addonsExcluded,
				"unresolvedModules": this._unresolvedModules
			};
		}
	}
}

module.exports = ModuleConcatStream;
