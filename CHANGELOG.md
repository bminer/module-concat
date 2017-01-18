# 2.1.0

- Now defaults to throwing an Error when a required module is not found, but
	this behavior can be changed by setting `options.allowUnresolvedModules`
- `options.excludeNodeModules` can now be set to `true` or to an Array
	containing modules to be excluded from the project
- `stats.unresolvedModules` contains information about modules that could not
	be found.  Only relevant when `options.allowUnresolvedModules` is `true`.

# 2.0.0

Almost a complete re-write of the original project.

- Supports streaming CommonJS modules to a Readable stream
- Supports bundling for the browser, Node.js, and others
- Added Promise support
- Dropped support for Node < 4
- Changed `options` a bit (i.e. `excludeNodeModules` instead of
	`includeNodeModules`)
- Added `options.extensions` and `options.compilers` (see README)
- Changed format of `cb`: now `cb(err, stats)` where `stats` exposes files
	included / excluded in the project build
- Now depends on NPM `resolve` package
- Fixed a few bugs
- Updated docs and added a bit more complexity to the test_project

# 1.x

It's old now, and I'm too lazy to fill in the changelog. :)
