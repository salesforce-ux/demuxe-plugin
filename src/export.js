// documentation: https://developer.sketchapp.com/reference/api/
const dom = require('sketch/dom');
const UI = require('sketch/ui');
const sketch = require('sketch');
const fm = NSFileManager.defaultManager();

const absPath = (path) => NSString.stringWithString(path).stringByExpandingTildeInPath();
const combinePath = (a, b) => NSString.stringWithString(a).stringByAppendingPathComponent(b);

const startedRunning = new Date();

const sinceStart = () => {
	const now = new Date();

	return `${(now - startedRunning) / 1000}s`;
}

// It takes a full FIVE SECONDS every time you write to console.log in sketch.
// Here we gather all of the logs up and just spit them out at the end.
const finalLog = ['Logs:', '\n'];
const finalDebug = ['Debugs:', '\n'];
const finalError = ['Errors:', '\n'];

const log = (msg) => finalLog.push(sinceStart(), msg, '\n');
const debug = (msg) => finalDebug.push(sinceStart(), msg, '\n');
const error = (msg) => finalError.push('ERROR:', sinceStart(), msg, '\n');
const inform = (msg) => UI.message(msg);
const finalAlert = (msg, title = 'Magick Flows') =>{
	finalLog.length > 2 && UI.alert(title, finalLog.join(' '));
	finalDebug.length > 2 && UI.alert(title, finalDebug.join(' '));
	finalError.length > 2 && UI.alert(title, finalError.join(' '));
	UI.alert(title, msg);
}


// Takes a multi-line string of key/val pair separated by "=" and creates an object containing them
const parseSettingsFromString = (string, settings) => {
	string.split('\n').forEach((line) => {
		let pos = line.indexOf('=');
		if (pos >= 0) {
			settings[line.substr(0, pos)] = line.substr(pos + 1);
		}
	});

	return settings;
}

const fixName = (settings, layer) => {
	if (settings.magick_flows_path && layer.name === 'settings-main') {
		layer.name = 'magick-flows-path';
		layer.text = `magick_flows_path=${settings.magick_flows_path}`;
	}

	if (settings.magick_flows_path && layer.text.match(/\/(main(\/)?)?$/i)) {
		layer.text = layer.text.replace(/\/(main(\/)?)?$/i, '');
		settings.magick_flows_path = settings.magick_flows_path.replace(/\/(main(\/)?)?$/i, '');
	}

	if (settings.magick_flows_path && settings.magick_flows_path.includes('url-slug')) {
		UI.getInputFromUser(
			'It appears you have not yet set your path! Open Demuxe and click the "copy path" icon for your Magick Flow and supply it here.',
			{
				initialValue: settings.magick_flows_path,
				numberOfLines: 3
			},
			(err, value) => {
				if (err) {
					// most likely the user canceled the input
					return;
				}

				if (value.includes('url-slug')) {
					UI.alert('Warning', `It looks like you did not update your path. Your demo-slug is almost certainly not "url-slug".`);
				}

				// not Text Layer
				if (layer.type !== String(sketch.Types.Text)) {
					// console.log(JSON.stringify(layer, null, '  '));

					console.log('something is wrong here', layer.type);
				}

				// https://github.com/tgfjt/sketch-add-trailing-space/blob/master/src/my-command.js
				// remove trailing slash and/or /main
				const correctedValue = value.replace(/\/(main(\/)?)?$/i, '');
				layer.text = `magick_flows_path=${correctedValue}`;
				layer.name = 'magick-flows-path';

				settings.magick_flows_path = correctedValue;
			}
		)
	}

	return {settings, layer};
}

const getSettings = (context) => {
	let settings = {
		mainDirName: 'main',
		assetsDirName: 'assets'
	};

	const doc = sketch.fromNative(context.document);

	doc.pages.forEach((page) => {
		if (page.name.toLowerCase() === 'magick-flows-export') {
			page.layers.forEach((artboard) => {
				artboard.layers.forEach((layer) => {
					if (layer.name.toLowerCase() === "magick-flows-path") {
						settings = parseSettingsFromString(layer.text, settings);

						({settings, layer} = fixName(settings, layer));
					} else if (layer.name.toLowerCase() === "settings-main") {
						let silentPath = parseSettingsFromString(layer.text, settings);

						settings.magick_flows_path = silentPath.silent_path_main;
						({settings, layer} = fixName(settings, layer));
					} else if (layer.name.toLowerCase() === "settings-assets") {
						UI.getInputFromUser(
							'Delete deprecated "settings-assets" layer?',
							{
								type: UI.INPUT_TYPE.selection,
								possibleValues: ['Yes', 'No', 'Choose for me'],
							},
							(err, value) => {
								if (err) {
									// most likely the user canceled the input
									return;
								}

								if (value !== 'No') {
									layer.remove();
								} else {
									UI.alert('Darth Says', '"That name has no longer has any meaning for me."\n\nhttps://tenor.com/view/darth-vader-star-wars-luke-skywalker-dont-say-that-name-no-meaning-gif-17565881');
								}
							}
						)
					}
				})
			})
		}
	});

	return settings;
}

const fixSpaces = (name) => {
	const spaceRegex = / /g;
	if(spaceRegex.test(name)) {
		log(`artboard contains spaces: ${name}`);
		log('it has been fixed for you!');
	}

	/*
		- Trim spaces at beginning/end.
		- Replace " copy" with "-1" and " copy N" with "-N"
		- Replace all other spaces with "-"
		- Replace others with "-".
	*/
	name = name.replace(/^ /, '');
	name = name.replace(/ $/, '');
	name = name.replace(/ copy$/i, '-1');
	const endsWithCopyN = / copy( \d)$/i;
	const copyN = name.match(endsWithCopyN);
	if (copyN) {
		name = name.replace(endsWithCopyN, copyN[1]);
	}
	name = name.replace(spaceRegex, '-');

	return name;
}

const fixQuotes = (name) => {
	const quotesRegex = /([''""])/;
	if(quotesRegex.test(name)) {
		log(`artboard contains quotes: ${name}`);
		log('it has been fixed for you!');
	}

	let sqi = 0;
	let dqi = 0;
	let found = -1;
	while (found = name.match(quotesRegex)) {
		let replacement = '‘'
		if (found[1] === "'") {
			replacement = sqi % 2 === 0 ? "‘" : "’";
			sqi++;
		} else {
			replacement = dqi % 2 === 0 ? "“" : "”";
			dqi++
		}
		name = name.replace(quotesRegex, replacement);
	}

	return name;
}

const fixDashes = (name) => {
	const dashRegex = /[\—\–]/g;
	if(dashRegex.test(name)) {
		log(`artboard contains dashes: ${name}`);
		log('it has been fixed for you!');
	}

	name = name.replace(dashRegex, '-');

	return name;
}

const validateName = (artboard) => {
	debug(`inspecting "${artboard.name}"`)

	artboard.name = fixSpaces(artboard.name);
	artboard.name = fixQuotes(artboard.name);
	artboard.name = fixDashes(artboard.name);

	debug(`should be clean "${artboard.name}"`);
	return !/[\—\–''"" ]/.test(artboard.name);
}

const makeExportName = (artboard, format) => [].concat(
	format.prefix ? format.prefix : '',
	artboard.name,
	format.suffix ? format.suffix : '',
	'.',
	format.fileFormat,
).join('');


/*
	Each of the provided "Layers" can either be a Page or an Artboard.
	Since we are only looking for artboards, but pages might have gotten thrown
	in there, when/if we come across a page, we need to drill down into that page
	and redo the search on all of it's artboards.

	Returns a single flattened [] result of all found artboards.
*/
// TODO: Should we also filter by some sort of "exportable" option? CAN we even?
const getArtboardsFromLayers = (layers, filters = { selectedOnly: false, excludeHidden: false }) =>
	layers.flatMap((layer) => {
		switch (layer.type) {
			case 'Page':
				debug('Page');
				if (layer.layers) {
					debug('has layers');
					return getArtboardsFromLayers(layer.layers, filters);
				}
				break;
			case 'Artboard':
				debug('Artboard');
				if (filters.selectedOnly && !layer.selected) {
					debug(`${layer.name} is not selected, skipping`);
					return [];
				}

				if (filters.excludeHidden && layer.hidden) {
					debug(`${layer.name} is hidden, skipping`);
					return [];
				}

				debug(`found Artboard for export ${layer.name}`);
				return [ layer ];
				break;
			case 'Group':
			case 'Symbol':
			default:
				debug(`Not exporting ${layer.type} named ${layer.name}`);
				return [];
		}
	});

const getExportableArtboards = (doc) => {
	return {
		main: getArtboardsFromLayers(doc.getLayersNamed('main')),
		assets: getArtboardsFromLayers(doc.getLayersNamed('assets'))
	}
}

const deleteOldAssets = (dir) => {
	const errorPtr = MOPointer.alloc().init();
	const files = fm.contentsOfDirectoryAtPath_error_(dir, errorPtr);

	if (files && files.count()) {
		files.forEach(file => {
			if (file.match(/\.(png|svg)$/)) {
				fm.removeItemAtPath_error_(combinePath(dir, '/' + file), errorPtr);
			}
		});
	}
}

/*
EXPORT PROCESS:
	Delete all from temporary directory.
	Export all assets into a temporary directory.
	If all export successfully,
		delete all .png & .svg from "final" directories
		move all .png & .svg from temp to final.
	Otherwise
		error and leave everything in place.
*/
const exportAsset = (dir, artboard, exportCount) => {
	let success = artboard.exportFormats.every((format) => {
		try {
			const outputPath = format.fileFormat === 'png' ? absPath(dir + '-tmp') : absPath(dir + '-src-tmp');
			const tempPath = combinePath(outputPath, '/~~~');

			dom.export(artboard, {
				output: tempPath,
				formats: format.fileFormat,
				scales: format.size,
				overwriting: true
			});

			const errorPtr = MOPointer.alloc().init();
			const files = fm.contentsOfDirectoryAtPath_error_(tempPath, errorPtr);

			// Files are exported with @2x appended as a suffix regardless of user's setting in sketch. Correct that.
			if (files && files.count()) {
				const tempFilePath = combinePath(tempPath, files.firstObject());

				// assets
				let outputFilePath = combinePath(outputPath, makeExportName(artboard, format));
				outputFilePath = outputFilePath.replace(/null/g, '');

				// Delete old file (shouldn't exist, but let's be safe)
				fm.removeItemAtPath_error_(outputFilePath, errorPtr);
				// Create the target directory (just in case they deleted)
				fm.createDirectoryAtPath_withIntermediateDirectories_attributes_error_(outputPath, true, null, errorPtr);
				// Move file from temp directory to new directory
				fm.moveItemAtPath_toPath_error_(tempFilePath, outputFilePath, errorPtr);
				// Delete temp /~~~ directory
				fm.removeItemAtPath_error_(tempPath, errorPtr);
			}

			exportCount[format.fileFormat] = exportCount[format.fileFormat] + 1 || 1;
		} catch (err) {
			error(`${artboard.name} ${format.fileFormat} could not be exported`);
			error(err);
			return false;
		}

		log(`${artboard.name} ${format.fileFormat} exported`)

		return true;
	});

	return { success, exportCount };
}

const exportAssets = (artboards, dir, exportCount) => {
	deleteOldAssets(absPath(dir + '-tmp'));
	deleteOldAssets(absPath(dir + '-src-tmp'));

	const success = artboards.every(artboard => {
		const results = exportAsset(dir, artboard, exportCount);
		exportCount = results.exportCount;
		return results.success;
	});

	return { success, exportCount };
}

const moveExports = (settings) => {
	const errorPtr = MOPointer.alloc().init();

	['main', 'main-src', 'assets', 'assets-src'].forEach(dir => {
		// clear out old assets to get ready for new
		const absDir = absPath(`${settings.magick_flows_path}/${dir}`);
		deleteOldAssets(absDir);

		const absTempDir = absPath(`${settings.magick_flows_path}/${dir}-tmp`);
		const files = fm.contentsOfDirectoryAtPath_error_(absTempDir, errorPtr);
		if (files && files.count()) {
			// Make sure target directory exists
			fm.createDirectoryAtPath_withIntermediateDirectories_attributes_error_(absDir, true, null, errorPtr);
			// Copy contents of temp directory into target directory (probably could move the whole directory at once instead of files individually?)
			files.forEach(file => fm.moveItemAtPath_toPath_error_(absPath(`${absTempDir}/${file}`), absPath(`${absDir}/${file}`), errorPtr));
			// Delete the temporary directory
			fm.removeItemAtPath_error_(absTempDir, errorPtr);
		}
	});

	// Put back all of the default asset images that were deleted just now
	const assetsDir = absPath(`${settings.magick_flows_path}/assets`);
	const backupAssets = absPath(`${settings.magick_flows_path}/assets-backup-in-case-you-accidentally-delete-your-scss-files`);
	const files = fm.contentsOfDirectoryAtPath_error_(backupAssets, errorPtr);
	if (files && files.count()) {
		files.forEach(file => {
			if (file.match(/\.(png|svg)$/)) {
				fm.copyItemAtPath_toPath_error_(absPath(`${backupAssets}/${file}`), absPath(`${assetsDir}/${file}`), errorPtr);
			}
		});
	}

	return { success: true };
}

const doExport = (context) => {
	const settings = getSettings(context);
	if (!settings.magick_flows_path) {
		error('settings are not set', settings);
		finalAlert('settings are not set');
		return;
	}
	debug('magick_flows_path', settings.magick_flows_path);

	const doc = dom.getSelectedDocument();
	const artboards = getExportableArtboards(doc);

	debug(`artboards main: ${artboards.main.length} assets: ${artboards.assets.length}`);

	const allNamesValid = Object.entries(artboards).every(([groupName, artboards]) => artboards.every(artboard => validateName(artboard)));
	if (!allNamesValid) {
		error('export failed');
		finalAlert('failed to export because not all artboard names were valid');
		return;
	}

	let exportCount = {};
	const mainExportResults = exportAssets(artboards.main, absPath(settings.magick_flows_path + '/main'), exportCount);
	debug('mainExportResults.exportCount', mainExportResults.exportCount)
	if (!mainExportResults.success) {
		error(`export failed`, mainExportResults);
		finalAlert(`failed to export main [because why]?`);
		return;
	}
	exportCount = mainExportResults.exportCount;

	const assetsExportResults = exportAssets(artboards.assets, absPath(settings.magick_flows_path + '/assets'), exportCount);
	if (!assetsExportResults.success) {
		error(`export failed`, assetsExportResults);
		finalAlert(`failed to export assets [because why]?`);
		return;
	}
	exportCount = assetsExportResults.exportCount;

	const moveExportsResults = moveExports(settings);
	if (!moveExportsResults.success) {
		error(`moving exports failed`, moveExportsResults);
		finalAlert(`failed to move exports [because why]?`);
		return;
	}

	inform(`${Object.entries(exportCount).reduce((totalCount, [groupName, count]) => totalCount + count, 0)} assets exported successfully`);
	// finalAlert(`
	// 	Export Succeeded!

	// 	${Object.entries(exportCount).reduce((totalCount, [groupName, count]) => `${totalCount}${count} ${groupName}s exported\n`, '')}
	// `)
	return;
}

export default function() {
	doExport(context);
}
