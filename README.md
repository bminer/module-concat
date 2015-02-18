# node-module-concat
Node.js module concatenation library

## What is it?
This library exposes a single function that concatenates Node.js modules
within a project.  This can be used to obfuscate an entire project into a
single file.  It can also be used to write client-side JavaScript code where
each file is written just like a Node.js module.

## Install
npm install node-module-concat

## Usage

```javascript
var modConcat = require("node-module-concat");
var outputFile = "./project/concatenated.js";
modConcat("./project/index.js", outputFile, function(err, files) {
	if(err) throw err;
	console.log(files.length + " were combined into " + outputFile);
});
```

## Known limitations
- Dynamic `require()` statements don't work
	(i.e. `require("./" + variable)`)
- `require.resolve` calls are not modified
- `require.cache` statements are not modified
