const dom = require('sketch/dom');
const UI = require('sketch/ui');
const sketch = require('sketch');
const fm = NSFileManager.defaultManager();

const Text = require('sketch/dom').Text;

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
	// finalLog.length > 2 && UI.alert(title, finalLog.join(' '));
	// finalDebug.length > 2 && UI.alert(title, finalDebug.join(' '));
	// finalError.length > 2 && UI.alert(title, finalError.join(' '));
	// UI.alert(title, msg);
	finalLog.length > 2 && console.log(finalLog.join(' '));
	finalDebug.length > 2 && console.log(finalDebug.join(' '));
	finalError.length > 2 && console.log(finalError.join(' '));
	console.log(msg);
}

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
			case 'SymbolInstance':
				console.log('SymbolInstance');
				if (filters.selectedOnly && !layer.selected) {
					console.log(`${layer.name} is not selected, skipping`);
					return [];
				}

				if (filters.excludeHidden && layer.hidden) {
					console.log(`${layer.name} is hidden, skipping`);
					return [];
				}

				console.log(`found Symbol for export ${layer.name}`);
				return [ layer ];
				break;
			case 'Artboard':
				debug('Artboard');
			case 'Group':
				console.log('Group');
			default:
				console.log(`Not exporting ${layer.type} named ${layer.name}`);
				return [];
		}
	});

const getExportableArtboards = (doc) => {
	return {
		main: getArtboardsFromLayers(doc.getLayersNamed('Demuxe Slack Demos'))
	}
}

const exportAsset = (dir, artboard) => {
	// console.log('artboard', artboard);

	let blocks = artboard.overrides.reduce((blocks, override) => {

		// console.log('override', override);

		// blocks.x = override.affectedLayer.frame.x;
		// blocks.y = override.affectedLayer.frame.y;
		blocks[override.affectedLayer.name] = override.value;

		return blocks;
	}, { x: artboard.frame.x, y: artboard.frame.y, width: artboard.frame.width, height: artboard.frame.height });

	// console.log(blocks);

	return { blocks };
}

const exportAssets = (artboards, dir, exportCount) => {
	const aggregatedMessages = [];
	const blocks = artboards.reduce((steps, artboard, count) => {
		const results = exportAsset(dir, artboard);

		aggregatedMessages.push(results.blocks);

		steps.push({ step: count, data: JSON.parse(JSON.stringify(aggregatedMessages))});

		return steps;
	}, []);

	return { blocks };
}

const settings = { magick_flows_path: `~/demuxe/slack-demos-web-root/slack-demos/chat-bot/main/` }

const doc = dom.getSelectedDocument();
const artboards = getExportableArtboards(doc);

debug(`artboards main: ${artboards.main.length}`);

let exportCount = {};
const mainExportResults = exportAssets(artboards.main, absPath(settings.magick_flows_path + '/main'), exportCount);


mainExportResults.blocks.forEach(block => {
	const text = new Text({
		text: JSON.stringify(block.data)
	})

	const options = { formats: 'json', 'use-id-for-name': true, output: settings.magick_flows_path }
	const sketchJSON = sketch.export(text, options);

	const errorPtr = MOPointer.alloc().init();

	const filePath = absPath(settings.magick_flows_path + '00' + block.step + '0.json');
	fm.removeItemAtPath_error_(filePath, errorPtr);
	fm.moveItemAtPath_toPath_error_(absPath(settings.magick_flows_path + text.id + '.json'), filePath, errorPtr);
})





// Instead of making the designer design each step screen in its entirety,
// take what they have built and create each step in it's entirety for them.
// So, if there are 4 messages, make:
// 0000 - one message (message A)
// 0001 - two messages (message A + B)
// 0002 - three messages (mesage A + B + C)
// 0003 - four messages (message A + B + C + D)




