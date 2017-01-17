# node-module-concat
CommonJS module concatenation library

## What is it?
This library exposes a single function that concatenates CommonJS modules
within a project.  This can be used to obfuscate an entire project into a
single file.  It can also be used to write client-side JavaScript code where
each file is written just like a Node.js module.

## Install

`npm install node-module-concat`

## Usage

```javascript
var modConcat = require("node-module-concat");
var outputFile = "./project/concatenated.js";
modConcat("./project/index.js", outputFile, function(err, stats) {
	if(err) throw err;
	console.log(stats.files.length + " were combined into " + outputFile);
});
```

## API

`var modConcat = require("node-module-concat");`

**`var stream = new modConcat.ModuleConcatStream(entryModulePath [, options])`**

Constructs a [Readable Stream](https://nodejs.org/api/stream.html#stream_class_stream_readable)
of the concatenated project.
- `entryModulePath` - the path to the entry point of the project to be
	concatenated.  This might be an `index.js` file, for example.
- `options` - object to specify any of the following options
	- `outputPath` - the path where the concatenated project file will be
		written.  Provide this whenever possible to ensure that instances
		of `__dirname` and `__filename` are replaced properly.  If
		`__dirname` and `__filename` are not used in your project or your
		project dependencies, it is not necessary to provide this path.  This
		has no effect when `browser` option is set.
	- `excludeFiles` - An Array of files that should be excluded from the
		project even if they were referenced by a `require(...)`.

		Note: These `require` statements should probably be wrapped with a
		conditional or a try/catch block to prevent uncaught exceptions.
	- `excludeNodeModules` - Set to `true` if modules loaded from
		`node_modules` folders should be excluded from the project.
	- `browser` - Set to `true` when concatenating this project for the
		browser.  In this case, whenever a required library is loaded from
		`node_modules`, the `browser` field in the `package.json` file (if
		found) is used to determine which file to actually include in the
		project.
	- Any [option supported by the Readable class]
		(https://nodejs.org/api/stream.html#stream_new_stream_readable_options)

**`stream.getStats()`**

Returns an Object containing statistics about the files included in the
project.  This object is available after the 'end' event is fired and there
is no more data to consume.  Properties include:
- `files` - An Array of files included in the project
- `addonsExcluded` - An Array of files excluded from the project because
	they are native C/C++ add-ons.

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
