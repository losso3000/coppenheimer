<?php

// What's this?
//
// - replaces shell.html
// - includes register-sw.js, shell-init.js and keeps this file somewhat small
// - after build, run "php -S 0.0.0.0:3000" or something

define("COPPENHEIMER_VERSION", "0.1.1");
define("COPPENHEIMER_TIMESTAMP", "2024-06-21");

?><!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>Coppenheimer <?php echo COPPENHEIMER_VERSION; ?></title>
	<style>
	:root{--text:#000;--distext:#00000044;--dark:#53493a;--light:#fff;--bg:#c8b9a1;--bghi:#d3c8b4;--blue:#706fbf;--bluetrans:#706fbf88;}
	body{margin:0;padding:4px;font-family:sans-serif;color:var(--text);background-color:var(--bg);font-size:12px;}
	button,label,select,dialog{font-size:12px;color:var(--text);}
	small{font-size:11px;}
	h2{font-size:16px;margin:0 0 8px;}
	h3{font-size:14px;margin:0 0 8px;}
	button{border-image:url("img/button1-b.png") 2;background-color:var(--bg);border-width:2px;text-align:left;}
	button:disabled,button:disabled:hover,button:disabled:active:hover{background-color:var(--bg);color:var(--distext);border-image:url("img/button3-b.png") 2;}
	select{border-image:url("img/button1-b.png") 2;background-color:var(--bg);border-width:2px;}
	select:hover,button:hover{background-color:var(--bghi);}
	#select-bpls{overflow:auto;}
	button:active{border-image:url("img/button2-b.png") 2;background-color:var(--blue);}	
	canvas{border-image:url("img/button2-b.png") 2;border-style:outset;border-width:2px;}
	a{color:var(--dark);}
	a:hover{color:var(--light);}
	#main{display:flex;gap:4px;padding:4px;}
	#mem-div{}
	[type="text"]{border-image:url("img/string-gadget-b.png") 4;border-width:4px;background-color:var(--bg);}
	[type="text"]:focus{border-width:4px;background-color:var(--bghi);}
	[type="checkbox"]{display:none;}
	[type="checkbox"]+label{background:url('img/check2-b.png') no-repeat;display:inline-block;padding:5px 4px 1px 30px;;user-select:none;height:16px;}
	[type="checkbox"]:checked+label{background-image:url('img/check1-b.png');}
	[type="checkbox"]:checked:disabled+label{background-image:url('img/check3-b.png');}
	input.mono{font-size:12px;}
	#virtual_keyboard,#replace-me{display:none;}
	dialog{font-size:14px;background-color:var(--bg);border-image:url("img/button1-b.png") 2;border-width:2px;}
	dialog[open]::backdrop{background-color:var(--bluetrans);}
	dialog h2{margin-top:0;}
	.dialog-bottom{margin-top:8px;display:flex;gap:4px;justify-content:end;}
	.dialog-top{margin-bottom:8px;display:flex;gap:4px;justify-content:space-between;}
	*:focus{outline:none;}
	.w-xl{width:256px;}
	.w-lg{width:192px;}
	.w-mid{width:128px;}
	.w-mid2{width:260px;}
	.w-sm{width:64px;}
	.vpad{padding-top:3px;padding-bottom:3px;}
	.drop-area{width:188px;height:128px;border-image:url("img/button2-b.png") 2;border-width:2px;border-style:solid;display:flex;align-items:center;justify-content:space-around;}
	.lowered-border{border-image:url("img/button2-b.png") 2;border-width:2px;border-style:solid;}
	.hw-led{background-color:#444;height:16px;padding-top:2px;width:54px;text-align: center;color: #991;font-family:monospace;}
	.hw-led.red{background-color:#f23;}
	.hw-led.yellow{background-color:#fe1;}
	.floppy-area{width:252px;height:18px;overflow:hidden}
	.center{text-align:center;}
	.blue-center{text-align:center;background-color:var(--blue);color:var(--light);}
	.floppy-area+.d-flex{justify-content:space-between;margin-top:2px;}
	.mono{font-family:monospace;}
	.d-none{display:none !important;}
	.d-flex{display:flex;gap:4px;}
	.d-vflex{display:flex;gap:4px;flex-direction:column;}
	.d-btw{justify-content:space-between;}
	.d-col{flex:1;}
	.d-end{align-items:end;}
	.d-cnt{align-items:center;}
	.mb-0{margin-bottom:0;}
	.mt-1{margin-top:4px;}
	#maincontrols>div{display:flex;gap:4px;width:479px;}
	#snapshot-list{overflow:auto;max-height:67vh;}
	#retroshell-input{font-family:monospace;}
	#retroshell-output{width:1024px;height:67vh;}
	</style>
	<script>
	var COPPENHEIMER_VERSION = "<?php echo COPPENHEIMER_VERSION; ?>";
	<?php include("shell-template-snippets/register-sw.js"); ?>
	</script>
	<script src="js/jquery-3.6.0.min.js"></script>
	<script src="js/bootstrap.bundle.min.js"></script>
	<script src="js/ringbuffer.js"></script>
	<script src="js/vAmiga_canvas-modified.js"></script>
	<script src="js/vAmiga_canvas_gl_fast.js"></script>
	<script src="js/vAmiga_ui-modified.js?<?php echo COPPENHEIMER_VERSION; ?>"></script>
	<script src="js/vAmiga_storage.js"></script>
	<script src="js/vAmiga_keyboard.js"></script>
	<script src="js/jszip.min.js"></script>
</head>
<body>
	<dialog id="dialog-missing-rom">
		<h2>Welcome!</h2>
		<div class="d-vflex">
			<p>Please select a Kickstart ROM or load a snapshot to get started.<br>Kickstart 1.3 recommended!</p>
			<button class="button-select-rom w-mid vpad">Kickstart ROM…</button>
			<button class="button-snapshot-from-url w-mid vpad" data-fetch-aros="true" data-url="snapshots/transhuman_snapshot_M3fd8W40.vAmiga">Demo: Transhuman</button>
			<button class="button-snapshot-from-url w-mid vpad" data-fetch-aros="true" data-url="snapshots/9fingers_snapshot_M1a396W44.vAmiga">Demo: 9 Fingers</button>
			<button class="button-snapshot-from-url w-mid vpad" data-fetch-aros="true" data-url="snapshots/Rink_a_Dink_snapshot_M6002cW42.vAmiga">Demo: Rink-A-Dink</button>
		</div>
		<div class="dialog-bottom">
			<button class="js-close-containing-dialog">Close</button>
		</div>
	</dialog>
	<dialog id="dialog-examples">
		<h2>Example snapshots</h2>
		<div class="d-vflex">
			<button class="button-snapshot-from-url w-mid vpad" data-fetch-aros="true" data-url="snapshots/transhuman_snapshot_M3fd8W40.vAmiga">Demo: Transhuman</button>
			<button class="button-snapshot-from-url w-mid vpad" data-fetch-aros="true" data-url="snapshots/9fingers_snapshot_M1a396W44.vAmiga">Demo: 9 Fingers</button>
			<button class="button-snapshot-from-url w-mid vpad" data-fetch-aros="true" data-url="snapshots/Rink_a_Dink_snapshot_M6002cW42.vAmiga">Demo: Rink-A-Dink</button>
		</div>
		<div class="dialog-bottom">
			<button class="js-close-containing-dialog">Close</button>
		</div>
	</dialog>
	<dialog id="dialog-rom">
		<h2>Select Kickstart ROM</h2>
		<div class="d-flex">
			<div class="d-col">
				<p>Kickstart</p>
				<p>
					<select id="select-stored-rom" class="w-lg"></select>
					<br>
					<button id="button-delete-rom" disabled="disabled">Delete slot</button>
					<form id="file-form-kickstart" class="d-none"><input id="file-kickstart" type="file" accept=".rom"></form>
				</p>
				<div id="drop-kickstart" class="drop-area"><span>Drop file or click</span></div>
			</div>
			<div class="d-col">
				<p>Kickstart ext. (optional)</p>
				<p>
					<select id="select-stored-rom-ext" class="w-lg"></select>
					<br>
					<button id="button-delete-rom-ext" disabled="disabled">Delete slot</button>
					<form id="file-form-kickstart-ext" class="d-none"><input id="file-kickstart-ext" type="file" accept=".rom"></form>
				</p>
				<div id="drop-kickstart-ext" class="drop-area"><span>Drop file or click</span></div>
			</div>
		</div>
		<p>
			<button id="button_fetch_open_roms">Install AROS m68k ROMS</button> <a href="https://en.wikipedia.org/wiki/AROS_Research_Operating_System" target="_blank">Learn more…</a><br>
		</p>
		<div class="dialog-bottom">
			<button class="js-close-containing-dialog">Close</button>
		</div>
	</dialog>
	<dialog id="dialog-snapshots">
		<h2>Select snapshot</h2>
		<div id="snapshot-list">
		</div>
		<div class="dialog-bottom">
			<button id="button-load-snapshot-file">Load from file…</button>
			<form id="file-form-snapshot" class="d-none"><input id="file-snapshot" type="file" accept=".vAmiga"></form>
			<button class="js-close-containing-dialog">Close</button>
		</div>
	</dialog>
	<dialog id="dialog-debugger">
		<h2>Debugger (vAmiga Retro Shell)</h2>
		<p>Note: This is very rudimentary, but you can talk to the shell a little…</p>
		<div class="d-vflex">
			<textarea id="retroshell-output"></textarea>
			<input type="text" id="retroshell-input">
		</div>
		<div class="dialog-bottom">
			<button class="js-close-containing-dialog">Close</button>
		</div>
	</dialog>
	<dialog id="dialog-about">
		<h2>Coppenheimer</h2>
		<p>Version <?php echo COPPENHEIMER_VERSION; ?> (<?php echo COPPENHEIMER_TIMESTAMP; ?>)</p>
		<div class="lowered-border" style="padding:0 16px">
			<p>An alternative UI for vAmigaWeb and some vAmiga patches – because I was jealous of <a href="https://sourceforge.net/projects/c64-debugger/" target="_blank">C64 65XE NES Debugger</a> and the likes.</p>
			<p>This is very alpha and a hack. Read all about it on <a href="https://heckmeck.de/amigastyle/coppenheimer/" target="_blank">heckmeck.de</a>.</p>
	 		<p><strong>Note:</strong> I did not write the emulator, or any of the cool stuff! <code>:)</code> Credits:</p>
			<ul>
				<li><a href="https://dirkwhoffmann.github.io/vAmiga/" target="_blank">vAmiga</a> by Dirk Hoffmann</li>
				<li><a href="https://vamigaweb.github.io/doc/about.html" target="_blank">vAmigaWeb</a> by mithrendal</li>
				<li>Using <a href="https://aros.sourceforge.io/introduction/ports.php#aros-amiga-m68k" target="_blank">AROS m68 replacement ROMS</a> by the AROS team</li>
				<li>Repo with my modifications on <a href="https://github.com/losso3000/coppenheimer" target="_blank">GitHub</a></li>
			</ul>
			<p>To get started, you may try this:</p>
			<ul>
				<li>Load one of the example snapshots</li>
				<li>Drag the large memory area around</li>
				<li>Adjust display width using the mouse wheel</li>
				<li>Use “Guess” to identify current bitmap areas</li>
				<li>Click into the memory overview to jump around</li>
				<li>Use up/down arrows and shift in address/width fields</li>
			</ul>
			
			<p>Also check out the other browser-based Amiga emulators:<br>
			    <a href="https://vamiganet.github.io/" target="_blank">vAmiga.net</a>,
			    <a href="https://vamigaweb.github.io/" target="_blank">vAmigaWeb</a>,
			    <a href="https://www.neoartcr.com/vamiga/index.htm" target="_blank">neoartcr’s vAmiga port</a>,
			    <a href="https://scriptedamigaemulator.net/" target="_blank">Scripted Amiga Emulator</a>
			</p>
			<p>Happy peeking!<br>Losso/AttentionWhore</p>
		</div>
		<div class="dialog-bottom">
			<button class="js-close-containing-dialog">Close</button>
		</div>
	</dialog>
	<dialog id="dialog-guesses" style="margin:0;">
		<h2>Possible bitplane areas</h2>
		<select id="select-bpls" size="20" class="w-xl lowered-border mono">
		</select>
		<div class="dialog-bottom">
			<button id="button-guess-again">Guess again</button>
			<button class="js-close-containing-dialog">Close</button>
		</div>
	</dialog>
	<div id="replace-me">
		<input type="text" id="search">
		<textarea id="output"></textarea>
		<div id="spinner">spinner</div>
		<progress value="0" max="100" id="progress" hidden=1></progress>
		<div id="status">status</div>
		<div class="collapse" style="user-select: none;" id="virtual_keyboard">
			<div class="justify-content-center" id="vbk_scroll_area"
			     style="display: flex;flex-wrap: nowrap;overflow-x: auto;overflow-y: hidden">
				<div style="display:flex;padding-top:2px;position: relative;min-width: 0;max-width: 100%">
					<div id="divKeyboardRows"></div>
				</div>
			</div>
		</div>
						<p>Debug</p>
						<!--<button id="button-settings">Settings</button>-->
			
						<form id="theFileInput" style="display: inline-block;">
							<div id="drop_zone" class="px-1 u-full-width mr-1" data-toggle="tooltip" data-placement="bottom" title="drop .adf, .dms, .exe, .hdf .vAmiga or .zip files into here, or just click into the drop zone">
							CLICK TO INSERT DISK
							</div>
							<!-- iOS won't work with accept=".g64,.d64,.crt,.prg,.bin" on d64 files -->
							<input id="filedialog" name="theFileDialog" type="file" style="display:none"">
						</form>
						<div id="div_drive_select" ontouchstart="event.stopPropagation()"></div>
	</div>
	<div class="d-flex">
		<div class="d-vflex">
			<canvas width="739" height="572" id="canvas" tabindex="-1"></canvas>
			<div class="d-flex d-btw" style="max-width:743px">
				<div id="maincontrols" class="d-vflex">
					<div>
						<button id="button-reset" class="w-mid">Reset</button>
						<button id="button-pause" class="w-mid">Pause</button>
						<button id="button-step"  class="w-mid" disabled>Step</button>
						<input id="checkbox-warp" type="checkbox"><label for="checkbox-warp">Warp</label>
					</div>
					<div>
						<button id="button-snapshot"  class="w-mid">Take snapshot</button>
						<button id="button-snapshots" class="w-mid">Snapshots…</button>
						<button id="button-debugger"  class="w-mid">Debugger</button>
						<input id="checkbox-dma" type="checkbox"><label for="checkbox-dma">DMA</label>
					</div>
					<div>
						<button class="button-select-rom w-mid">Kickstart ROM…</button>
						<select id="port1" class="w-mid" data-toggle="tooltip" data-placement="left" title="game port 1">
							<option value="none">Game port 1</option>
							<option value="keys">cursor key (move) space (fire)</option>
							<!--option value="touch">touch joystick (move|fire)</option>-->
							<option value="mouse">mouse </option>
							<!--<option value="mouse touchpad">mouse touchpad (btn|move|btn)</option>-->
							<!--<option value="mouse touchpad2">mouse touchpad (move|btn/btn)</option>-->
						</select>
						<select id="port2" class="w-mid" data-toggle="tooltip" data-placement="left" title="game port 2">
							<option value="none">Game port 2</option>
							<option value="keys">cursor key (move) space (fire)</option>
							<!--<option value="touch">touch joystick (move|fire)</option>-->
							<option value="mouse">mouse</option>
							<!--<option value="mouse touchpad">mouse touchpad (btn|move|btn)</option>-->
							<!--<option value="mouse touchpad2">mouse touchpad (move|btn/btn)</option>-->
						</select>
						<div id="power-led" class="d-col hw-led lowered-border"></div>
					</div>
					<div>
						<div class="w-sm"><input id="checkbox-df0" type="checkbox" checked="checked" disabled="disabled"><label for="checkbox-df0">DF0:</label><form id="file-form-df0" class="d-none"><input id="file-df0" type="file" accept=".adf,.dms,.exe"></form></div>
						<div id="drop-df0" class="drop-area floppy-area"><span id="desc-df0">Drop file or click</span></div>
						<button id="eject-df0" class="w-sm">Eject</button>
						<div id="led-df0" class="d-col hw-led disk lowered-border"></div>
					</div>
					<div>
						<div class="w-sm"><input id="checkbox-df1" type="checkbox"><label for="checkbox-df1">DF1:</label><form id="file-form-df1" class="d-none"><input id="file-df1" type="file" accept=".adf,.dms,.exe"></form></div>
						<div id="drop-df1" class="drop-area floppy-area"><span id="desc-df1">Drop file or click</span></div>
						<button id="eject-df1" class="w-sm">Eject</button>
						<div id="led-df1" class="d-col hw-led disk lowered-border"></div>
					</div>
					<div class="d-btw">
						<input id="spritesdisable" class="layer" type="checkbox"><label for="spritesdisable">Disable Sprites</label>
						<input id="playfield1" class="layer" type="checkbox"><label for="playfield1">Disable playfield 1</label>
						<input id="playfield2" class="layer" type="checkbox"><label for="playfield2">Disable playfield 2</label>
						<input id="checkbox-mute" class="layer" type="checkbox"><label for="checkbox-mute">Mute</label>
					</div>
					<!--
						Auto snapshots
						Sprite collisions
						Playfield collisions
						Agnus
						Denise
						Prev snapshot
					-->
					<div class="d-col">
					</div>
					<div>
						<div class="w-mid2 lowered-border" style="height:82px;background-image:url('img/coppenheimer.png');background-repeat:no-repeat;background-position:center center;"></div>
						<div class="d-col d-vflex d-btw" style="height:86px">
							<div class="d-vflex">
								<div><strong>Coppenheimer <?php echo COPPENHEIMER_VERSION; ?></strong></div>
								<div>Realtime Amiga monitor</div>
								<div>Powered by vAmiga and vAmigaWeb</div>
							</div>
							<div class="d-flex">
								<button id="button-about" class="d-col">About</button>
								<button id="button-examples" class="d-col">Examples</button>
							</div>
						</div>
					</div>
				</div>
				<div>
					<canvas id="mempreview" width="256" height="256"></canvas>
					<div>	
						<input id="checkbox-livepreview" type="checkbox" checked="checked"><label for="checkbox-livepreview">Live overview (chip+fast)</label>
					</div>
				</div>
			</div>
		</div>
		<div id="mem-div">
			<canvas id="memcanvas" width="704" height="806" ></canvas>
			<div class="d-flex d-btw">
				<div class="d-vflex">
					<div class="d-flex">
						<input id="checkbox-livedump" type="checkbox" checked="checked"><label for="checkbox-livedump">Live monitor</label>
						<input id="checkbox-livedump-adapt" type="checkbox" checked="checked"><label for="checkbox-livedump-adapt">Adapt to window</label>
					</div>
					<select id="select-livedump-colors" class="w-lg vpad">
						<option value="df942a,371d20">Amber</option>
						<option value="53493a,c8b9a1">Beige</option>
						<option value="ffffff,000000">White on black</option>
						<option value="000000,ffffff">Black on white</option>
						<option value="ffffff,0055aa">Kick 1.x</option>
						<option value="000000,aeaeae">Kick 2.x</option>
						<!--<option value="00459a,1065ba">rez 1</option>wp1.gif from chiptune.com, 1.x blue-->
						<!--<option value="818181,a1a1a1">rez 2</option>wp2.gif from chiptune.com, gray-->
						<!--<option value="707090,9090b0">rez 3</option>wp3.gif from chiptune.com, blueish-->
						<!--<option value="507090,305070">rez 4</option>wp4.gif from chiptune.com, cyan-blue-->
						<!--<option value="a49484,bcac9c">rez 5</option>wp5.gif from chiptune.com, cyan-blue-->
					</select>
				</div>
				<div class="d-vflex">
					<button id="button-guess-bitplanes" class="w-mid d-col center">Guess!</button>
				</div>
				<div class="d-vflex d-end">
					<div class="d-flex d-cnt">
						<div>Address:</div>
						<input id="memdump-info-start" type="text" value="000000" class="w-sm mono">
						<button class="w-sm vpad" id="button-memdump-chip">Chip</button>
						<button class="w-sm vpad" id="button-memdump-fast">Fast</button>
					</div>
					<div class="d-flex d-cnt">
						<div>Width:</div>
						<input id="memdump-info-width" type="text" value="0" class="w-sm mono">
						<button class="w-sm vpad" id="mempreview-reset-width">Reset</button>
						<button class="w-sm vpad" id="mempreview-width-40">40</button>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div id="botr" style="width:1px;height:1px;position:fixed;right:0;bottom:0"></div>
	<script>
	<?php include("shell-template-snippets/shell-init.js"); ?>
	</script>
	<script async type="text/javascript" src="vAmiga.js"></script>
</body>
</html>
