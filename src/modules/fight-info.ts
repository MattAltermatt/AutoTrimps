// TRUE TS (Phase 1 · #28): converted from the faithful port under strict.
// Was: relocated verbatim from legacy/modules/fight-info.js.
// Self-contained IIFE ;(function(M){...})(MODULES) that registers MODULES.fightinfo.Update()
// (called by AutoTrimps2 guiLoop when EnhanceGrids is on). No exports, no converted deps —
// load-time code only touches game DOM (getElementById) + MODULES. Side-effect import.

;(function(M)
{
	M["fightinfo"] = {};
	M["fightinfo"].$worldGrid = document.getElementById('grid');
	M["fightinfo"].$mapGrid = document.getElementById('mapGrid');

	// Powerful imps
	M["fightinfo"].powerful =
	[
		"Improbability",
		"Omnipotrimp",
		"Mutimp",
		"Hulking_Mutimp"
	];

	// Exotic imps
	M["fightinfo"].exotics =
	[
		"Feyimp",
		"Tauntimp",
		"Venimp",
		"Whipimp",
		"Magnimp",
		"Goblimp",
		"Flutimp",
		"Jestimp",
		"Titimp",
		"Chronoimp"
	];
  
        // Fast imps
	M["fightinfo"].fast =
	[
		"Snimp",
    		"Kittimp",
    		"Gorillimp",
    		"Squimp",
    		"Shrimp",
    		"Chickimp",
    		"Frimp",
    		"Slagimp",
    		"Lavimp",
    		"Kangarimp",
    		"Entimp",
    		"Carbimp",
	];

	//Colors for special imps (This has been disabled)
	M["fightinfo"].colors =
	{
		bone: '#ffffff',
		exotic: '#000000',
		powerful: '#000000',
    		fast : '#000000'
	}

	// #192 — this was `lastProcessedWorld`, keyed on game.global.world. See Update() below.
	M["fightinfo"].lastProcessedGrid = null;
	M["fightinfo"].lastProcessedMap = null;

	function Update()
	{
		// Check if we should update world or map info
		if(game.global.mapsActive)
		{
			// Check if current map already infoed
			// Can't do this because of map repeating
			/*if(M["fightinfo"].lastProcessedMap === null || M["fightinfo"].lastProcessedMap !== game.global.lookingAtMap)
				M["fightinfo"].lastProcessedMap = game.global.lookingAtMap;
			else
				return;*/

			// Cell data
			var cells = game.global.mapGridArray;

			// DOM rows
			var $rows = Array.prototype.slice.call(M["fightinfo"].$mapGrid.children);
		}
		else
		{
			// Check if current world already infoed
			// #192 — this once-per-zone cache was keyed on game.global.world, which is blind to the two
			// U2-Spire paths that rebuild the world grid WITHOUT advancing the zone: nextU2SpireFloor
			// (.trimps-game/main.js:13131-13139) does `gridArray = []; grid.innerHTML = ''; buildGrid();
			// drawGrid();` and finishU2Spire (main.js:13731-13734) does `buildGrid(); drawGrid();`.
			// Neither touches game.global.world, so the freshly drawn DOM carried no glyphs while the
			// cache reported "already processed" — floors 2-10 of the U2 Spire, plus the whole remainder
			// of the post-Spire zone, rendered with the feature silently off.
			//
			// buildGrid() ends with `game.global.gridArray = array` — a NEW array object on every call —
			// so the array's IDENTITY is an exact grid-identity signal. It changes on a zone advance
			// (nextWorld calls buildGrid too) and on both Spire rebuilds, and on nothing else, which is
			// precisely the invalidation this cache wanted in the first place.
			if(M["fightinfo"].lastProcessedGrid !== game.global.gridArray)
				M["fightinfo"].lastProcessedGrid = game.global.gridArray;
			else
				return;

			// Cell data
			var cells = game.global.gridArray;

			// DOM rows
			var $rows = Array.prototype.slice.call(M["fightinfo"].$worldGrid.children);
		}

		// Rows are in inverse order somewhy
		$rows = $rows.reverse();

		// DOM cells
		var $cells: any[] = [];

		// Loop through DOM rows and concat each row's cell-element into $cells
		$rows.forEach(function(x)
		{
			$cells = $cells.concat(Array.prototype.slice.call(x.children));
		});

		// Process all cells
		for(var i = 0; i < $cells.length; i++)
		{
			// DOM cell
			var $cell = $cells[i];

			// Cell data
			var cell = cells[i];


			if(cell.name.toLowerCase().indexOf('skele') > -1)					// Skeletimp cell
			{
				if(cell.special.length === 0)
					$cell.innerHTML = "<span class=\"glyphicon glyphicon-italic\"></span> ";

				$cell.title = cell.name;
				//$cell.style.color = M["fightinfo"].colors.bone; //(This changes the colour of the glyph - bad bc it overrides trimps and looks bad against corruption etc)
				$cell.style.textShadow = '0px 0px 10px #ffffff';
			}

			else if(M["fightinfo"].exotics.indexOf(cell.name) > -1)				// Exotic cell
			{
				if(cell.special.length === 0)
					$cell.innerHTML = "<span class=\"glyphicon glyphicon-sunglasses\"></span> ";

				$cell.title = cell.name;
				//$cell.style.color = M["fightinfo"].colors.exotic; //(This changes the colour of the glyph - bad bc it overrides trimps and looks bad against corruption etc)
				$cell.style.textShadow = '0px 0px 10px #fb753f';
			}

			else if(M["fightinfo"].powerful.indexOf(cell.name) > -1)			// Powerful imp
			{
				if(cell.special.length === 0)
					$cell.innerHTML = "<span class=\"glyphicon glyphicon-hazard\"></span> ";

				$cell.title = cell.name;
				//$cell.style.color = M["fightinfo"].colors.powerful; //(This changes the colour of the glyph - bad bc it overrides trimps and looks bad against corruption etc)
				$cell.style.textShadow = '0px 0px 10px #8c0000';
			}
      
      			else if(M["fightinfo"].fast.indexOf(cell.name) > -1)				// Fast imp
			{
				// #181 — this guard was commented out with its body left behind, so the write ran
				// unconditionally and was the sole outlier among this file's seven glyph sites. The
				// game stores the "there is an upgrade / loot here" indicator as MARKUP in cell.text
				// (findHomeForSpecial, .trimps-game/main.js:10460-10464) and renders it as the cell's
				// innerHTML in drawGrid (main.js:10552) — so overwriting it destroys the cue for the
				// rest of the zone, and fight-info never restores it. Any cell can carry both: the
				// world unlock table puts Shield at level 4 and Dagger/…/Gigastation at 19, and all 12
				// fast imps spawn on world and map grids alike with no location restriction.
				if(cell.special.length === 0)
					$cell.innerHTML = "<span class=\"glyphicon glyphicon-forward\"></span> ";

				$cell.title = cell.name;
				//$cell.style.color = M["fightinfo"].colors.fast; //(This changes the colour of the glyph - bad bc it overrides trimps and looks bad against corruption etc)
				$cell.style.textShadow = '0px 0px 10px #ffffff';
			}

			//This shit doesn't work and I don't know why (What is the celltitle??? is it the name of the nature? Imps are labelled Toxic/Gusty/Frozen but that didin't work either)
			if(cell.name.toLowerCase().indexOf('poison') > -1)				// Poison Token cell
			{
			  if(cell.special.length === 0)
			    $cell.innerHTML = "<span class=\"glyphicon glyphicon-flask\"></span> ";

			  $cell.title = cell.name;
			  //$cell.style.color = M["fightinfo"].colors.exotic; //(This changes the colour of the glyph - bad bc it overrides trimps and looks bad against corruption etc)
			  $cell.style.textShadow = '0px 0px 10px #ffffff';
			}
			if(cell.name.toLowerCase().indexOf('wind') > -1)				// Wind Token cell
			{
			  if(cell.special.length === 0)
			    $cell.innerHTML = "<span class=\"icomoon icon-air\"></span> ";

			  $cell.title = cell.name;
			  //$cell.style.color = M["fightinfo"].colors.exotic; //(This changes the colour of the glyph - bad bc it overrides trimps and looks bad against corruption etc)
			  $cell.style.textShadow = '0px 0px 10px #ffffff';
			}
			if(cell.name.toLowerCase().indexOf('ice') > -1)				// Ice Token cell
			{
			  if(cell.special.length === 0)
			    $cell.innerHTML = "<span class=\"glyphicon glyphicon-certificate\"></span> ";

			  $cell.title = cell.name;
			  //$cell.style.color = M["fightinfo"].colors.exotic; //(This changes the colour of the glyph - bad bc it overrides trimps and looks bad against corruption etc)
			  $cell.style.textShadow = '0px 0px 10px #ffffff';
			}
		}
	}

	M["fightinfo"].Update = Update;
})(MODULES);

// This file publishes everything through MODULES.fightinfo rather than through exports, which left it
// a SCRIPT rather than a module as far as tsc is concerned — so a test could not `await import` it
// without a type error. An empty export list makes it a module and emits nothing.
export {}
