
@import "util.js";


//-------------------------------------------------------------------------------------------------------------
// Save palette
//-------------------------------------------------------------------------------------------------------------


function savePalette(context) {
	
	var doc = context.document;
	var app = NSApp.delegate();
	var version = context.plugin.version().UTF8String();
	
	// Create dialog
	var dialog = NSAlert.alloc().init();
	dialog.setMessageText("Save Palette");
	dialog.addButtonWithTitle("Save");
	dialog.addButtonWithTitle("Cancel");
	
	// Create custom view and fields
	var customView = NSView.alloc().initWithFrame(NSMakeRect(0, 0, 200, 180));
	
	var labelSource = createLabel(NSMakeRect(0, 150, 200, 25), 12, false, 'Source:');
	customView.addSubview(labelSource);

	var selectSource = createSelect(NSMakeRect(0, 125, 200, 25), ["Document Presets", "Global Presets"])
	customView.addSubview(selectSource);

	var labelFillTypes = createLabel(NSMakeRect(0, 83, 200, 25), 12, false, 'Fill Types:');
	customView.addSubview(labelFillTypes);
	
	var checkboxColors = createCheckbox(NSMakeRect(0, 60, 200, 25), "Flat Colors", "colors", true, true);
	customView.addSubview(checkboxColors);
	
	var checkboxGradients = createCheckbox(NSMakeRect(0, 37, 200, 25), "Gradients", "gradients", true, true);
	customView.addSubview(checkboxGradients);
	
	var checkboxImages = createCheckbox(NSMakeRect(0, 14, 200, 25), "Pattern Fills", "images", true, true);
	customView.addSubview(checkboxImages);

	// Set checkboxes to disabled if no presets exist in selected section
	function setCheckboxStates(selectSource) {
		if (selectSource.indexOfSelectedItem() == 0) {
			var assets = doc.documentData().assets();
		} else if (selectSource.indexOfSelectedItem() == 1) {
			var assets = app.globalAssets();
		}
		
		var showColors = (assets.colors().length > 0 ? true : false);
		checkboxColors.setState(showColors ? NSOnState : NSOffState);
		checkboxColors.setEnabled(showColors);
		
		var showGradients = (assets.gradients().length > 0 ? true : false);
		checkboxGradients.setState(showGradients ? NSOnState : NSOffState);
		checkboxGradients.setEnabled(showGradients);

		var showImages = (assets.images().length > 0 ? true : false);
		checkboxImages.setState(showImages ? NSOnState : NSOffState);
		checkboxImages.setEnabled(showImages);
	}
	
	// set initial chekcbox states
	setCheckboxStates(selectSource);
	
	// Listen for select box change event
	selectSource.setCOSJSTargetFunction(function(sender) {
		setCheckboxStates(selectSource)
	});
	
	// Add custom view to dialog
	dialog.setAccessoryView(customView);
	
	// Open dialog and exit if user selects Cancel
	if (dialog.runModal() != NSAlertFirstButtonReturn) {
		return;
	}
	
	// Get Presets from selected section
	if (selectSource.indexOfSelectedItem() == 0) {
		var assets = doc.documentData().assets();
	} else if (selectSource.indexOfSelectedItem() == 1) {
		var assets = app.globalAssets();
	}
	
	var colors = checkboxColors.state() ? assets.colors() : [];
	var gradients = checkboxGradients.state() ? assets.gradients() : [];
	var images = checkboxImages.state() ? assets.images() : [];
	
	// Check to make sure there are presets available
	if (colors.length <= 0 && images.length <= 0 && gradients.length <= 0) {
		NSApp.displayDialog("No presets available!");
		return;
	}
	
	// Create save dialog and set properties
	var save = NSSavePanel.savePanel();
	save.setNameFieldStringValue("untitled.sketchpalette");
	save.setAllowedFileTypes(["sketchpalette"]);
	save.setAllowsOtherFileTypes(false);
	save.setExtensionHidden(false);
		
	// Open save dialog and run if Save was clicked
	if (save.runModal()) {
		
		// Build palettes
		var colorPalette = [], gradientPalette = [], imagePalette = [];
		
		// Colors	
		for (var i = 0; i < colors.length; i++) {
			colorPalette.push({
				red: colors[i].red(),
				green: colors[i].green(),
				blue: colors[i].blue(),
				alpha: colors[i].alpha()	
			});
		}
		
		// Pattern fills
		for (var i = 0; i < images.length; i++) {	
			var data = images[i].data()
			var nsdata = NSData.dataWithData(data);
			var base64Color = nsdata.base64EncodedStringWithOptions(0).UTF8String();
			imagePalette.push({data: base64Color});
		}
		
		// Gradients
		for (var i = 0; i < gradients.length; i++) {
			var gradient_stops = [];
			for (var j = 0; j < gradients[i].stops().length; j++) {
				stop_color = {
					_class: "color",
					red: gradients[i].stops()[j].color().red(),
					green: gradients[i].stops()[j].color().green(),
					blue: gradients[i].stops()[j].color().blue(),
					alpha: gradients[i].stops()[j].color().alpha()
				};
				gradient_stops.push({
					_class: "gradientStop",
					color: stop_color,
					position: gradients[i].stops()[j].position()
				});
			}
			
			gradientPalette.push({
				_class: "gradient",
				elipseLength: gradients[i].elipseLength(),
				from: "{" + gradients[i].from().x + "," + gradients[i].from().y + "}",
				to: "{" + gradients[i].to().x + "," + gradients[i].to().y + "}",
				stops: gradient_stops,
				gradientType: gradients[i].gradientType()
				// shouldSmoothenOpacity: gradients[i].shouldSmoothenOpacity() ? true : false
			});
		}
		
		// Assemble file contents
		
		var fileData = {
			"compatibleVersion": "2.0", // min plugin version to load palette
			"pluginVersion": version, //  plugin version used to save palette
			"colors": colorPalette,
			"gradients": gradientPalette,
			"images":  imagePalette
		};
		
		// Write file to chosen file path
		
		var filePath = save.URL().path();
		var file = NSString.stringWithString(JSON.stringify(fileData));
		
		file.writeToFile_atomically_encoding_error(filePath, true, NSUTF8StringEncoding, null);

	}
}


//-------------------------------------------------------------------------------------------------------------
// Load palette
//-------------------------------------------------------------------------------------------------------------


function loadPalette(context) {
	
	var app = NSApp.delegate();
	var doc = context.document;
	var version = context.plugin.version().UTF8String();
	var fileTypes = ["sketchpalette"];
		
	// Open file picker to choose palette file
	var open = NSOpenPanel.openPanel();
	open.setAllowedFileTypes(fileTypes);
	open.setCanChooseDirectories(true);
	open.setCanChooseFiles(true);
	open.setCanCreateDirectories(true);
	open.setTitle("Choose a file");
	open.setPrompt("Choose");
	open.runModal();
	
	// Read contents of file into NSString, then to JSON
	var filePath = open.URLs().firstObject().path();
	var fileContents = NSString.stringWithContentsOfFile(filePath);
	var paletteContents = JSON.parse(fileContents.toString());
	var compatibleVersion = paletteContents.compatibleVersion;
	
	// Check for presets in file, else set to empty array
	var colorPalette = paletteContents.colors ? paletteContents.colors : [];
	var gradientPalette = paletteContents.gradients ? paletteContents.gradients : [];
	var imagePalette = paletteContents.images ? paletteContents.images : [];
	var colors = [], gradients = [], images = [];
	
	// Check if plugin is out of date and incompatible with a newer palette version
	if (compatibleVersion && compatibleVersion > version) {
		NSApp.displayDialog("Your plugin is out of date. Please update to the latest version of Sketch Palettes.");
		return;
	}
	
	// Check for older hex code palette version
	if (!compatibleVersion || compatibleVersion < 1.4) {
		// Convert hex colors to MSColors
		for (var i = 0; i < colorPalette.length; i++) {
			colors.push(MSImmutableColor.colorWithSVGString(colorPalette[i]).newMutableCounterpart());
		}
	} else {
		
		// Colors Fills: convert rgba colors to MSColors
		if (colorPalette.length > 0) {
			for (var i = 0; i < colorPalette.length; i++) {
				colors.push(MSColor.colorWithRed_green_blue_alpha(
					colorPalette[i].red,
					colorPalette[i].green,
					colorPalette[i].blue,
					colorPalette[i].alpha
				));	
			}
		}
		
		// Pattern Fills: convert base64 strings to MSImageData objects
		if (imagePalette.length > 0) {
			for (var i = 0; i < imagePalette.length; i++) {
				var nsdata = NSData.alloc().initWithBase64EncodedString_options(imagePalette[i].data, 0);
				var nsimage = NSImage.alloc().initWithData(nsdata);
				// var msimage = MSImageData.alloc().initWithImageConvertingColorSpace(nsimage);
				var msimage = MSImageData.alloc().initWithImage(nsimage);
				images.push(msimage);	
			};
		}
		
		// Gradient Fills: build MSGradientStop and MSGradient objects		
		if (gradientPalette.length > 0) {
			for (var i = 0; i < gradientPalette.length; i++) {
				
				// Create gradient stops
				var gradient = gradientPalette[i];
				var stops = [];
				for (var j = 0; j < gradient.stops.length; j++) {
					var color = MSColor.colorWithRed_green_blue_alpha(
						gradient.stops[j].color.red,
						gradient.stops[j].color.green,
						gradient.stops[j].color.blue,
						gradient.stops[j].color.alpha
					);
					stops.push(MSGradientStop.stopWithPosition_color_(gradient.stops[j].position, color));
				}

				// Create gradient object and set basic properties
				var msgradient = MSGradient.new();
				msgradient.setGradientType(gradient.gradientType);
				// msgradient.shouldSmoothenOpacity = gradient.shouldSmoothenOpacity;
				msgradient.elipseLength = gradient.elipseLength;
				msgradient.setStops(stops);

				// Parse From and To values into arrays e.g.: from: "{0.1,-0.43}" => fromValue = [0.1, -0.43]
				var fromValue = gradient.from.slice(1,-1).split(",");
				var toValue = gradient.to.slice(1,-1).split(",");

				// Set CGPoint objects as From and To values
				msgradient.setFrom({ x: fromValue[0], y: fromValue[1] });
				msgradient.setTo({ x: toValue[0], y: toValue[1] });

				gradients.push(msgradient);
				
			}
		}
		
	}
	
	// Create dialog
	var dialog = NSAlert.alloc().init();
	dialog.setMessageText("Load Palette");
	dialog.addButtonWithTitle("Load");
	dialog.addButtonWithTitle("Cancel");
	
	// Create custom view and fields
	var customView = NSView.alloc().initWithFrame(NSMakeRect(0, 0, 200, 180));
	
	var labelSource = createLabel(NSMakeRect(0, 150, 200, 25), 12, false, 'Source:');
	customView.addSubview(labelSource);

	var selectSource = createSelect(NSMakeRect(0, 125, 200, 25), ["Document Presets", "Global Presets"])
	customView.addSubview(selectSource);

	var labelFillTypes = createLabel(NSMakeRect(0, 83, 200, 25), 12, false, 'Fill Types:');
	customView.addSubview(labelFillTypes);
	
	var showColors = (colorPalette.length > 0) ? true : false);
	var checkboxColors = createCheckbox(NSMakeRect(0, 60, 200, 25), "Flat Colors", "colors", showColors, showColors);
	customView.addSubview(checkboxColors);
	
	var showGradients = (gradientPalette.length > 0) ? true : false);
	var checkboxGradients = createCheckbox(NSMakeRect(0, 37, 200, 25), "Gradients", "gradients", showGradients, showGradients);
	customView.addSubview(checkboxGradients);
	
	var showImages = (imagePalette.length > 0 ? true : false);
	var checkboxImages = createCheckbox(NSMakeRect(0, 14, 200, 25), "Pattern Fills", "images", showImages, showImages);
	customView.addSubview(checkboxImages);
	
	// Add custom view to dialog
	dialog.setAccessoryView(customView);
	
	// Open dialog and exit if user hits cancel.
	if (dialog.runModal() != NSAlertFirstButtonReturn) return;
	
	// Get target picker section
	if (selectSource.indexOfSelectedItem() == 0) {
		var assets = doc.documentData().assets();
	} else if (selectSource.indexOfSelectedItem() == 1) {
		var assets = app.globalAssets();
	}
	
	// Append presets
	if (colors.length > 0) assets.addColors(colors);
	if (images.length > 0) assets.setImages(assets.images().slice().concat(images));
	if (gradients.length > 0) assets.addGradients(gradients);
	
	doc.inspectorController().closeAnyColorPopover();
	app.refreshCurrentDocument();
	
}


//-------------------------------------------------------------------------------------------------------------
// Clear palette
//-------------------------------------------------------------------------------------------------------------


function clearPalette(context) {
	
	var doc = context.document;
	var selection = context.selection;
	var app = NSApp.delegate();
	var version = context.plugin.version().UTF8String();
	
	// Create dialog
	var dialog = NSAlert.alloc().init();
	dialog.setMessageText("Clear Palette");
	dialog.addButtonWithTitle("Clear");
	dialog.addButtonWithTitle("Cancel");
	
	// Create view to hold custom fields
	var customView = NSView.alloc().initWithFrame(NSMakeRect(0, 0, 200, 180));
	
	var labelSource = createLabel(NSMakeRect(0, 150, 200, 25), 12, false, 'Source:');
	customView.addSubview(labelSource);

	var selectSource = createSelect(NSMakeRect(0, 125, 200, 25), ["Document Presets", "Global Presets"])
	customView.addSubview(selectSource);

	var labelFillTypes = createLabel(NSMakeRect(0, 83, 200, 25), 12, false, 'Fill Types:');
	customView.addSubview(labelFillTypes);
	
	var checkboxColors = createCheckbox(NSMakeRect(0, 60, 200, 25), "Flat Colors", "colors", true, true);
	customView.addSubview(checkboxColors);
	
	var checkboxGradients = createCheckbox(NSMakeRect(0, 37, 200, 25), "Gradients", "colors", true, true);
	customView.addSubview(checkboxGradients);

	var checkboxImages = createCheckbox(NSMakeRect(0, 14, 200, 25), "Pattern Fills", "images", true, true);
	customView.addSubview(checkboxImages);
	
	// Add custom view to dialog
	dialog.setAccessoryView(customView);
	
	// Open dialog and exit if user hits cancel.
	if (dialog.runModal() != NSAlertFirstButtonReturn) return;
	
	// Get target picker section
	if (selectSource.indexOfSelectedItem() == 0) {
		var assets = doc.documentData().assets();
	} else if (selectSource.indexOfSelectedItem() == 1) {
		var assets = app.globalAssets();
	}
	
	// Clear presets in chosen sections
	if (checkboxColors.state()) assets.setColors([]);
	if (checkboxImages.state()) assets.setImages([]);
	if (checkboxGradients.state()) assets.setGradients([]);
	
	doc.inspectorController().closeAnyColorPopover();
	app.refreshCurrentDocument();

}
