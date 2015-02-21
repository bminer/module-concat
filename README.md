# node-module-concat
Node.js module concatenation library

## What is it?
This library exposes a single function that concatenates Node.js modules
within a project.  This can be used to obfuscate an entire project into a
single file.  It can also be used to write client-side JavaScript code where
each file is written just like a Node.js module.

## Install

`npm install node-module-concat`

## Usage

```javascript
var modConcat = require("node-module-concat");
var outputFile = "./project/concatenated.js";
modConcat("./project/index.js", outputFile, function(err, files) {
	if(err) throw err;
	console.log(files.length + " were combined into " + outputFile);
});
```

## API

`var modConcat = require("node-module-concat");`

**`modConcat(entryModule, outputFile, [options,] cb)`**

- `entryModule` - the path to the entry point of the project to be
	concatenated.  This might be an `index.js` file, for example.
- `outputFile` - the path where the concatenated project file will be
	written.
- `options` - Optional.  An Object containing any of the following:
	- `outputStreamOptions` - Options passed to `fs.createWriteStream` call
		when the `outputFile` is opened for writing.
	- `excludeFiles` - An Array of files that should be excluded from the
		project even if they were referenced by a `require(...)`.

		Note: These `require` statements should probably be wrapped in a
		try, catch block to prevent uncaught exceptions.
- `cb` - Callback of the form `cb(err, files)` where `files` is an Array
	of files that have been included in the project.

## Known limitations
- Dynamic `require()` statements don't work
	(i.e. `require("./" + variable)`)
- `require.resolve` calls are not modified
- `require.cache` statements are not modified
