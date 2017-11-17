# module-concat
Fairly lightweight CommonJS module concatenation tool

## What is it?
This library exposes a single function and stream API that concatenates CommonJS
modules within a project.  This can be used to obfuscate an entire project into
a single file.  It can also be used to write client-side JavaScript code where
each file is written just like a Node.js module.

## Why?
Because projects like Webpack and Browserify are cool, but they are a little
heavy for my taste.  I just wanted something to compile CommonJS modules into a
single JavaScript file.  This project has one dependency:
[resolve](https://github.com/substack/node-resolve)

## Install

`npm install module-concat`

**Note**: Used to be called `node-module-concat` but has since been renamed.

## Usage

```javascript
var modConcat = require("module-concat");
var outputFile = "./project/concatenated.js";
modConcat("./project/index.js", outputFile, function(err, stats) {
	if(err) throw err;
	console.log(stats.files.length + " were combined into " + outputFile);
});
```

## API

`var modConcat = require("module-concat");`

**`var stream = new modConcat.ModuleConcatStream(entryModulePath [, options])`**

Constructs a [Readable Stream](https://nodejs.org/api/stream.html#stream_class_stream_readable)
of the concatenated project.
- `entryModulePath` - the path to the entry point of the project to be
	concatenated.  This might be an `index.js` file, for example.
- `options` - object to specify any of the following options:
	- `outputPath` - the path where the concatenated project file will be
		written.  Provide this whenever possible to ensure that instances
		of `__dirname` and `__filename` are replaced properly.  If
		`__dirname` and `__filename` are not used in your project or your
		project dependencies, it is not necessary to provide this path.  This
		has no effect when the `browser` option is set.
	- `excludeFiles` - An Array of files that should be excluded from the
		project even if they were referenced by a `require(...)`.

		Note: These `require` statements should probably be wrapped with a
		conditional or a try/catch block to prevent uncaught exceptions.
	- `excludeNodeModules` - (boolean or Array) Set to `true` if all modules
		loaded from `node_modules` folders should be excluded from the project.
		Alternatively, set to an Array of module names to be excluded from the
		project.

		For example, `require("foobar")` will not be replaced if
		`excludeNodeModules` is set to an Array containing `"foobar"` or if
		`excludeNodeModules` is set to `true`.
	- `extensions` - An Array of extensions that will be appended to the
		required module path to search for the module in the file system.
		Defaults to `[".js", ".json"]`.

		For example, `require("./foo")` will search for:
		- `./foo`
		- `./foo.js`
		- `./foo.json`
		in that order, relative to the file containing the require statement.

		Another example, `require("./foo.js")` will search for:
		- `./foo.js`
		- `./foo.js.js`
		- `./foo.js.json`

		**Note**: ".node" file extensions are considered to be native C/C++
		addons and are always excluded from the build.
	- `compilers` - An Object describing how files with certain file extensions
		should be compiled to JavaScript before being included in the project.
		The example below will allow module-concat to handle `require`
		statements pointing to *.coffee files (i.e. `require("./foo.coffee")`).
		These modules are compiled using the coffee-script compiler before
		they are included in the project.
		```javascript
		{
			// Sample compiler for coffee-script
			".coffee": (src, options, path) => require("coffee-script").compile(src),
			// Sample compiler for Riot.js tags
			".tag": (src, options, path) =>
				// Note: Variable `riot` needs to be available in the tag module
				"const riot = require('riot');" +
					// The compiled tag will contain references to `riot`
					riot.compile(src, {
						// Maybe the *.tag files are Pug templates?
						"template": "pug",
						// And maybe scoped styles are written in Stylus?
						"style": "stylus",
						"compact": true
					}, path)
		}
		```
		`options` are passed along to the compiler function, as shown above.
		`path` is the path of the file being processed.

		**Note**: By default, ".json" files are prepended with
		`module.exports = `.  This behavior can be overwritten by explicitly
		specifying the ".json" key in the `compilers` Object.

		**Note**: By default, the file extensions specified in `compilers` are
		not added to the `extensions` option, so `require("./foo")` will not
		find `./foo.coffee` unless ".coffee" is explicitly added to `extensions`
		(see above).
	- `browser` - Set to `true` when concatenating this project for the
		browser.  In this case, whenever a required library is loaded from
		`node_modules`, the `browser` field in the `package.json` file (if
		found) is used to determine which file to actually include in the
		project.

		module-concat provides limited support of the package.json
		[`browser` field spec](https://github.com/defunctzombie/package-browser-field-spec).
		More specifically, it will properly handle the "basic" case where
		`browser` is a string.  When `browser` is an Object, module-concat
		only works properly in certain instances.  For example, if the specific
		file replaced matches the `main` field, it works fine.  Also, if a
		specific file is ignored (i.e. value is set to `false`), its resolved
		path is simply added to the `excludeFiles` array.

		Unfortunately, ignoring module names (i.e. not specific files) is not
		supported.  Also, replacing module names (or specific files) do not work
		if the replaced file does not match the `main` field.  This might be
		improved in the future...
	- `allowUnresolvedModules` - Set to `true` to prevent unresolved modules
		from throwing an Error; instead, the `require(...)` expression will not
		be replaced, and the unresolved module will be added to
		`stats.unresolvedModules` (see below).  Defaults to `false` so Errors
		are thrown for unresolved modules.
	- Any [option supported by resolve.sync](https://github.com/substack/node-resolve#resolvesyncid-opts) except
		`basedir` and `packageFilter`, which can be overwritten.
	- Any [option supported by the Readable class](https://nodejs.org/api/stream.html#stream_new_stream_readable_options)

**`stream.getStats()`**

Returns an Object containing statistics about the files included in the
project.  This object is available after the 'end' event is fired and there
is no more data to consume.  Properties include:
- `files` - An Array of files included in the project
- `addonsExcluded` - An Array of files excluded from the project because
	they are native C/C++ add-ons.
- `unresolvedModules` - An Array of modules that could not be included in the
	project because they could not be found.  Each element in the Array is an
	Object containing these properties:
	- `parent` - the full path of the file containing the require expression
	- `module` - the name or path to the module that could not be found

**`modConcat(entryModule, outputPath, [options, cb])`**

Helper function that constructs a new `ModuleConcatStream` (see above) with
the following options and pipes the concatenated project to the `outputPath`.

- `entryModule` - the path to the entry point of the project to be
	concatenated.  This might be an `index.js` file, for example.
- `outputFile` - the path where the concatenated project file will be
	written.
- `options` - See `options` for `ModuleConcatStream` above.
- `cb` - Callback of the form `cb(err, stats)`.  If no callback is provided,
	a Promise is returned instead, which resolves to the `stats` Object returned
	by `stream.getStats()` (see above).

## Known limitations
- Dynamic `require()` statements don't work
	(i.e. `require("./" + variable)`)
- `require.resolve` calls are not modified
- `require.cache` statements are not modified
- Limited support of [package `browser` field spec](https://github.com/defunctzombie/package-browser-field-spec)
- Won't add any horsepower to your sports car.  :(
