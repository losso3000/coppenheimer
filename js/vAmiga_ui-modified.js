// I've butchered the original vAmiga_ui.js quite a bit, mainly to
// get a grasp of the inner workings of the various parts and remove
// stuff I don't need (phone/table support, snapshot browser, etc.).
//
// If something's broken, it's probably because I've needlessly rewritten
// something that is working just fine in vAmigaWeb. Sorry!
//
// PS: Also, this is all a bit messy, a mix of code styles, native and
// jQuery-based DOM manipulation, unused variables, and other icky stuff.
//
// -- Losso

const vAmigaWeb_version="2.6.0"; //minimum requirement for snapshot version to be compatible
const compatible_snapshot_version_format=/^(2[.]6[.]0)$/g
var running = true;
let global_apptitle="Coppenheimer";
let call_param_openROMS=false;
let call_param_gpu=null;
let call_param_wide=null;
let call_param_border=null;
let call_param_touch=null;
let call_param_dark=null;
let call_param_buttons=[];
let call_param_dialog_on_missing_roms=null;
let call_param_dialog_on_disk=null;
let call_param_mouse=null;
let call_param_warpto=null;
let call_param_url=null;
let call_param_display=null;
let call_param_wait_for_kickstart_injection=null;
let call_param_kickstart_rom_url=null;
let call_param_kickstart_ext_url=null;

let on_ready_to_run=()=>{};
let on_hdr_step=(drive_number, cylinder)=>{};
let df_mount_list=[];//to auto mount disks from zip e.g. ["Batman_Rises_disk1.adf","Batman_Rises_disk2.adf"];
let hd_mount_list=[];

let virtual_keyboard_clipping = true; //keyboard scrolls when it clips
let use_wide_screen=false;
let use_ntsc_pixel=false;
let joystick_button_count=1;

let v_joystick=null;
let v_fire=null;
let fixed_touch_joystick_base=false;
let stationaryBase = false;

const MEMDUMP_MIN_W = 752;
const MEMDUMP_MIN_H = 806;

var MEM_HPIXELS=MEMDUMP_MIN_W;
var MEM_VPIXELS=MEMDUMP_MIN_H;
var MEMPREVIEW_HPIXELS=256;
var MEMPREVIEW_VPIXELS=256;
var memdump_col1 = 0xffdf942a;
var memdump_col2 = 0xff371d20;
var live_memory_dump_enabled = false;
var live_memory_preview_enabled = false;
var memdump_buffer;
var memdump_word_width = MEM_HPIXELS/16;
var memctx=null;
var memimage_data=null;
var memdump_start = 0;
var last_update_memdump_info_start = -1;
var last_update_memdump_width = -1;
var memcanvas_deltastart=0;
var memcanvas_pressed=false;
var mempreview_buffer;
var mempreview_ctx=null;
var mempreview_image_data=null;
var memdump_adapt_size = true;
var lastInsertedDisk={};

var required_roms_loaded = false;

//
// auto snapshot stuff
//

/* TODO
var auto_snapshot_enabled = false;
var frames_without_snapshot = 0;
var auto_snapshot_every = 50;
function SlowRingBuffer(maxLength) {
  this.maxLength = maxLength;
}
SlowRingBuffer.prototype = Object.create(Array.prototype);
SlowRingBuffer.prototype.push = function(element) {
  Array.prototype.push.call(this, element);
  while (this.length > this.maxLength) {
    this.shift();
  }
}
var auto_snaps = new SlowRingBuffer(5);
function checkSnapshotSetting() {
  let setting = document.getElementById("auto-snapshots").value;
  if (setting && parseInt(setting)) {
    auto_snapshot_enabled = true;
    auto_snapshot_every = parseInt(setting);
  } else {
    auto_snapshot_enabled = false;
  }
}
*/

//
// monitoring stuff
//

class MonitorThing {
  constructor(selector) {
    this.selector = selector;
    this.checkVisibility();
    this.canvas = null;
    this.context = null;
    this.values = [];
  }
  checkVisibility() {
    this.visible = $(this.selector).closest("details").attr("open") == "open";
    console.log(`ok checkVisibility of ${this.selector} = ${this.visible}`);
    if (!this.visible) return;
    this.canvas = $(this.selector);
    this.w = Math.round(this.canvas.width());
    this.h = Math.round(this.canvas.height());
    console.log(`w,h of ${this.selector} is ${this.w},${this.h}`);
    this.canvas.width(this.w).height(this.h);
    this.canvas[0].width = this.w;
    this.canvas[0].height = this.h;
    if (this.context == null) {
      this.context = this.canvas[0].getContext("2d");
    }
    this.repaint();
  }
  pushValue(value) {
    if (this.values.unshift(value) >= this.w) {
      this.values.pop();
    }
  }
  repaint() {
      this.context.fillStyle = "#706fbf";
      this.context.fillRect(0,0,this.w,this.h);
      this.context.fillStyle = "white";
  }
}

var monitorBlitter  = new MonitorThing("#monitor-blitter");
var monitorCopper   = new MonitorThing("#monitor-copper");
var monitorDisk     = new MonitorThing("#monitor-disk");
var monitorAudio    = new MonitorThing("#monitor-audio");
var monitorSprite   = new MonitorThing("#monitor-sprite");
var monitorBitplane = new MonitorThing("#monitor-bitplane");
var monitorChipR    = new MonitorThing("#monitor-chip-r");
var monitorChipW    = new MonitorThing("#monitor-chip-w");
var monitorFastR    = new MonitorThing("#monitor-fast-r");
var monitorFastW    = new MonitorThing("#monitor-fast-w");
var monitorRomR     = new MonitorThing("#monitor-rom-r");
var monitorRomW     = new MonitorThing("#monitor-rom-w");

function checkMonitorVisibilities() {
  monitorBlitter.checkVisibility();
  monitorCopper.checkVisibility();
  monitorDisk.checkVisibility();
  monitorAudio.checkVisibility();
  monitorSprite.checkVisibility();
  monitorBitplane.checkVisibility();
  monitorChipR.checkVisibility();
  monitorChipW.checkVisibility();
  monitorFastR.checkVisibility();
  monitorFastW.checkVisibility();
  monitorRomR.checkVisibility();
  monitorRomW.checkVisibility();
}

//
// sound
//

const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioContext = new AudioContext();
let audio_connected = false;
let load_sound = async function(url) {
	let response = await fetch(url);
	let buffer = await response.arrayBuffer();
	let audio_buffer= await audioContext.decodeAudioData(buffer);
	return audio_buffer;
} 
let parallel_playing = 0;
let keyboard_sound_volume = 0.04;
let play_sound = function(audio_buffer, sound_volume = 0.1) {
	if(audio_buffer == null) {                 
		load_all_sounds();
		return;
	}
	if (parallel_playing > 2 && audio_buffer == audio_df_step) {
		//not more than 3 stepper sounds at the same time
		return;
	}
	const source = audioContext.createBufferSource();
	source.buffer = audio_buffer;

	let gain_node = audioContext.createGain();
	gain_node.gain.value = sound_volume; 
	gain_node.connect(audioContext.destination);

	source.addEventListener("ended", () => {
		parallel_playing--;
	});
	source.connect(gain_node);
	parallel_playing++;
	source.start();
}   

let audio_df_insert = null;
let audio_df_eject = null;
let audio_df_step = null;
let audio_hd_step = null;
let audio_key_standard = null;
let audio_key_backspace = null;
let audio_key_space = null;

async function load_all_sounds() {
	if (audio_df_insert == null)		audio_df_insert = await load_sound('sounds/insert.mp3');
	if (audio_df_eject == null)		audio_df_eject = await load_sound('sounds/eject.mp3');
	if (audio_df_step == null)		audio_df_step = await load_sound('sounds/step.mp3');
	if (audio_hd_step == null)		audio_hd_step = await load_sound('sounds/stephd.mp3');
	if (audio_key_standard == null)		audio_key_standard = await load_sound('sounds/key_standard.mp3');
	if (audio_key_backspace == null)	audio_key_backspace = await load_sound('sounds/key_backspace.mp3');
	if (audio_key_space == null)		audio_key_space = await load_sound('sounds/key_space.mp3');
}
load_all_sounds();

//
// helpers
//

const load_script = (url) => {
	return new Promise(resolve => {
		let script = document.createElement("script")
		script.type = "text/javascript";
		script.onload = resolve;
		script.src = url;
		document.getElementsByTagName("head")[0].appendChild(script);
	});
}
function escapeHtml(s) {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}
function escapeFile(s) {
	if (!s) return "_";
	return s.replace(/[^a-zA-Z0-9\.\-_]+/g, " ").trim().replace(/ /g, "_");
}
function shorten(s, len) {
	if (!s) return "";
	if (!s.length || s.length < len) return "" + s;
	return s.substr(0,len) + "...";
}
function ToBase64_small(u8) {
	return btoa(String.fromCharCode.apply(null, u8));
}
function ToBase64(u8) {
	return btoa(new Uint8Array(u8)
		.reduce((data, byte) => data + String.fromCharCode(byte), ""));
}
function FromBase64(str) {
	return atob(str).split("").map(function (c) { return c.charCodeAt(0); });
}
function setCheckbox(selector, onOff) {
	$(selector).prop("checked", !!onOff);
}
function setDisabled(selector, onOff) {
	$(selector).prop("disabled", !!onOff);
}
function is_running() {
	return running;
}

//
// message handling
//

function message_handler(msg, data, data2) {
	//console.log(`js receives msg:${msg} data:${data}`);
	
	if (msg == "MSG_READY_TO_RUN") {
		setTimeout(function() {
			try{
				wasm_run();
				running = true;
			} catch (error) {
				console.error("wasm_run error", error);
			}
		}, 100);
	} else if (msg == "MSG_ROM_MISSING") {        
		//try to load roms from local storage
		setTimeout(async function() {
			//try to load currently user selected kickstart
	                console.log("*** calling loadRoms after MSG_ROM_MISSING message");
			let loaded = await loadRoms(true);
			console.log("*** await loadRoms(true) returned ", loaded);
			if (loaded) {
				console.log("MSG_ROM_MISSING: last user selected kickstart loaded");
				return;
			} else {
				console.log("MSG_ROM_MISSING: open ROM dialog, no last user selected kickstart");
				document.getElementById("dialog-missing-rom").showModal();
			}
		}, 0);
	} else if (msg == "MSG_RUN") {
        	required_roms_loaded = true;
        	emulator_currently_runs = true;
	} else if (msg == "MSG_PAUSE") {
		emulator_currently_runs=false;
	} else if (msg == "MSG_VIDEO_FORMAT") {
		// TODO EMPTY  
	} else if (msg == "MSG_DRIVE_STEP" || msg == "MSG_DRIVE_POLL") {
		if(wasm_has_disk("df" + data)) {
			play_sound(audio_df_step);
			$(`#led-df${data}`).text(data2.toString().padStart(2, '0'));
		} else if (data == 0) {
			//only for df0: play stepper sound in case of no disk
			play_sound(audio_df_step);
		}
	} else if(msg == "MSG_DISK_INSERT") {
		let driveNum = data;
		play_sound(audio_df_insert);
		$(`#desc-df${driveNum}`).text(lastInsertedDisk[driveNum]);
	} else if(msg == "MSG_DISK_EJECT") {
		console.log("MSG_DISK_EJECT", data, data2);
		let driveNum = data;
		$(`#desc-df${driveNum}`).text("");
		$("#drop_zone").html(`file slot`);
		play_sound(audio_df_eject); 
	} else if(msg == "MSG_HDR_STEP") {
		play_sound(audio_hd_step);
		$("#drop_zone").html(`dh${data} ${data2}`);
		on_hdr_step(data, data2);
	} else if(msg == "MSG_SNAPSHOT_RESTORED") {
		
	} else if(msg == "MSG_SER_OUT") {
		// serial_port_out_handler(data);
		// $("#serial-out").val($("#serial-out").val() + String.fromCharCode(data));
	} else if(msg == "MSG_CTRL_AMIGA_AMIGA") {
		wasm_reset();
	} else if (msg == "MSG_DMA_DEBUG") {
		setCheckbox("#checkbox-dma", data);
	} else if (msg == "MSG_WARP") {
		setCheckbox("#checkbox-warp", data);
	} else if (msg == "MSG_POWER_LED_ON") {
		$("#power-led").addClass("red");
	} else if (msg == "MSG_POWER_LED_DIM") {
		$("#power-led").removeClass("red");
	} else if (msg == "MSG_DRIVE_LED") {
		// df0 on/off --> MSG_DRIVE_LED 65536 0,  MSG_DRIVE_LED 1 0
		// df1 on/off --> MSG_DRIVE_LED 65537 0,  MSG_DRIVE_LED 1 0
		//
		// so, data == ON | DRIVE_NO with ON==0x10000
		let num = data & 0x00003;
		let on  = data & 0x10000;
		if (on) $(`#led-df${num}`).addClass("yellow"); else $(`#led-df${num}`).removeClass("yellow");
	}
	//else {console.log("unhandled message:", msg, data, data2);}
}

async function fetchOpenROMS(){
	var installer = async function(suffix, response) {
		try {
			var arrayBuffer = await response.arrayBuffer();
			var byteArray = new Uint8Array(arrayBuffer);
			var rom_url_path = response.url.split('/');
			var rom_name = rom_url_path[rom_url_path.length-1];
			
			var romtype = wasm_loadfile(rom_name + suffix, byteArray);
			if(romtype != "") {
				local_storage_set(romtype, rom_name);
				await save_rom(rom_name,romtype, byteArray);
			}
		} catch(e) {
			console.error("could not install system rom file: " + response.url, e);
		}  
	}
	
	let response = await fetch("roms/aros.bin");
	await installer('.rom_file', response);
	response = await fetch("roms/aros_ext.bin");
	await installer('.rom_ext_file', response);   
	console.log("*** calling loadRoms in fetchOpenROMS");
	await loadRoms(true);
}

async function fetchSnapshot(url) {
	var installer = async function(suffix, response) {
		try {
			var arrayBuffer = await response.arrayBuffer();
			var byteArray = new Uint8Array(arrayBuffer);
			var snapPath = response.url.split('/');
			var snapName = snapPath[snapPath.length-1];
			wasm_loadfile(snapName + suffix, byteArray);
			let m = /M([0-9a-fA-F]+)W([0-9]+)/.exec(response.url);
			if (m) {
				let newPos = parseInt(m[1], 16);
				let newW   = Math.floor(parseInt(m[2], 10) / 2);
				memdump_start = newPos & 0xffffffe;
				if (newW > 0) memdump_word_width = newW;
			}
		} catch (e) {
			console.log ("could not install snapshot file", e);
			alert("Error loading snapshot from URL:\n" + e);
		}  
	}

	await fetchOpenROMS(); // TODO shouldn't be necessary?

	let response = await fetch(url);
	//if (is_running()) doPause();
	await installer('.vAmiga', response);
	memdump();
	mempreview();
	//doUnpause();

	$("#desc-df0").text(wasm_has_disk("df0") ? "(disk from snapshot)" : "");
	$("#desc-df1").text(wasm_has_disk("df1") ? "(disk from snapshot)" : "");
}

function dragover_handler(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    ev.dataTransfer.dropEffect = 'copy';
}

file_slot_file_name = null;
file_slot_file =null;

last_zip_archive_name = null
last_zip_archive = null


var port1 = 'none';
var port2 = 'none';
joystick_keydown_map=[];
joystick_keydown_map[1]={
    'ArrowUp':'PULL_UP',
    'ArrowDown':'PULL_DOWN',
    'ArrowLeft':'PULL_LEFT',
    'ArrowRight':'PULL_RIGHT',
    'Space':'PRESS_FIRE',
} 
joystick_keydown_map[2]=Object.assign({}, joystick_keydown_map[1]);
joystick_keydown_map[2].KeyB='PRESS_FIRE2';
joystick_keydown_map[3]=Object.assign({}, joystick_keydown_map[2]);
joystick_keydown_map[3].KeyN='PRESS_FIRE3';
joystick_keyup_map=[]
joystick_keyup_map[1] = {
    'ArrowUp':'RELEASE_Y',
    'ArrowDown':'RELEASE_Y',
    'ArrowLeft':'RELEASE_X',
    'ArrowRight':'RELEASE_X',
    'Space':'RELEASE_FIRE',
}
joystick_keyup_map[2]=Object.assign({}, joystick_keyup_map[1]);
joystick_keyup_map[2].KeyB='RELEASE_FIRE2';
joystick_keyup_map[3]=Object.assign({}, joystick_keyup_map[2]);
joystick_keyup_map[3].KeyN='RELEASE_FIRE3';

function is_any_text_input_active() {
	if(typeof editor !== 'undefined' && editor.hasFocus()) return true;
	
	var active = false;
	var element = document.activeElement;
	if (element != null) {                 
		if(element.tagName != null) {
			var type_name = element.tagName.toLowerCase();
			active = type_name == 'input' || type_name == 'textarea';
		}     
	}
	return active;
}

function serialize_key_code(e){
	let mods = "";
	let code = e.code;
	if (e.altKey && !code.startsWith('Alt')) mods+="Alt+";
	if (e.metaKey && !code.startsWith('Meta')) mods+="Meta+";
	if (e.shiftKey && !code.startsWith('Shift')) mods+="Shift+";
	if (e.ctrlKey && !code.startsWith('Control')) mods+="Ctrl+";
	return mods + code;
}

function keydown(e) {
	if (is_any_text_input_active()) return;
	e.preventDefault();
	
	if (port1=="keys" || port2=="keys") {
		var joystick_cmd = joystick_keydown_map[joystick_button_count][e.code];
		if(joystick_cmd !== undefined) {
			emit_joystick_cmd((port1 == "keys" ? "1" : "2") + joystick_cmd);
			return;
		}
	}
	
	var key_code = translateKey2(e.code, e.key);
	if (key_code !== undefined && key_code.raw_key[0] != undefined) {
		if (key_code.modifier != null) {
			wasm_schedule_key(key_code.modifier[0], key_code.modifier[1], 1, 0);
		}
		wasm_schedule_key(key_code.raw_key[0], key_code.raw_key[1], 1, 0);
	}
}

function keyup(e) {
	if (is_any_text_input_active()) return;
	
	e.preventDefault();
	
	if (port1=="keys" || port2=="keys") {
		var joystick_cmd = joystick_keyup_map[joystick_button_count][e.code];
		if (joystick_cmd !== undefined) {
			let port_id = port1 == "keys" ? "1" : "2";
			if (joystick_cmd.startsWith("RELEASE_FIRE")
				||
				//only release axis on key_up if the last key_down for that axis was the same direction
				//see issue #737
				port_state[port_id+"x"] == joystick_keydown_map[joystick_button_count][e.code]
				||
				port_state[port_id+"y"] == joystick_keydown_map[joystick_button_count][e.code]
			) {
				emit_joystick_cmd(port_id + joystick_cmd);
			}
			return;
		}
	}
	
	var key_code = translateKey2(e.code, e.key);
	if (key_code !== undefined && key_code.raw_key[0] != undefined) {
		wasm_schedule_key(key_code.raw_key[0], key_code.raw_key[1], 0, 1);
		if (key_code.modifier != null ) {
			wasm_schedule_key(key_code.modifier[0], key_code.modifier[1], 0, 1);
		}
	}
}

timestampjoy1 = null;
timestampjoy2 = null;
last_touch_cmd = null;
last_touch_fire= null;

/* callback for wasm mainsdl.cpp */
function draw_one_frame() {
	// was: gamepad handling
}

var port_state={};
function emit_joystick_cmd(command) {
	var port = command.substring(0,1);
	var cmd  = command.substring(1); 
	
	if (cmd == "PULL_RIGHT") {
		port_state[port+"x"] = cmd;
	} else if (cmd == "PULL_LEFT") {
		port_state[port+"x"] = cmd;
	} else if (cmd == "RELEASE_X") {
		port_state[port+"x"] = cmd;
	} else if (cmd == "PULL_UP") {
		port_state[port+"y"] = cmd;
	} else if (cmd == "PULL_DOWN") {
		port_state[port+"y"] = cmd;
	} else if (cmd == "RELEASE_Y") {
		port_state[port+"y"] = cmd;
	} else if (cmd == "RELEASE_XY") {
		port_state[port+"x"] = "RELEASE_X";
		port_state[port+"y"] = "RELEASE_Y";
	} else if (cmd=="PRESS_FIRE") {
		port_state[port+"fire"]= cmd;
	} else if (cmd=="RELEASE_FIRE") {
		port_state[port+"fire"]= cmd;
	} else if (cmd=="PRESS_FIRE2") {
		port_state[port+"fire2"]= cmd;
	} else if (cmd=="RELEASE_FIRE2") {
		port_state[port+"fire2"]= cmd;
	} else if (cmd=="PRESS_FIRE3") {
		port_state[port+"fire3"]= cmd;
	} else if (cmd=="RELEASE_FIRE3") {
		port_state[port+"fire3"]= cmd;
	}
	send_joystick(PORT_ACCESSOR.MANUAL, port, command);
	/*
	console.log("portstate["+port+"x]="+port_state[port+'x']);
	console.log("portstate["+port+"y]="+port_state[port+'y']);
	*/
}

const PORT_ACCESSOR = {
    MANUAL: 'MANUAL',
    BOT: 'BOT'
}

var current_port_owner = {
    1:PORT_ACCESSOR.MANUAL,
    2:PORT_ACCESSOR.MANUAL,
}; 

function set_port_owner(port, new_owner)
{
    var previous_owner=current_port_owner[port];
    current_port_owner[port]=new_owner;
    if(new_owner==PORT_ACCESSOR.MANUAL)
    {
       restore_manual_state(port);
    }
    return previous_owner;
}
function send_joystick( accessor, port, command )
{
    if(accessor == current_port_owner[port])
    {
        wasm_joystick(command);
    }
}

function restore_manual_state(port)
{
    if(port_state[port+'x'] !== undefined && !port_state[port+'x'].includes("RELEASE")) 
    {
        wasm_joystick( port + port_state[port+'x'] );
    }
    if(port_state[port+'y'] !== undefined && !port_state[port+'y'].includes("RELEASE")) 
    {
        wasm_joystick( port + port_state[port+'y'] );
    }
    if(port_state[port+'fire'] !== undefined && !port_state[port+'fire'].includes("RELEASE")) 
    {
        wasm_joystick( port + port_state[port+'fire'] );
    }
}


function memdump_update_from_drag() {
	if (live_memory_dump_enabled && running) return;
	memdump();
	mempreview();
}
function memdump() {
	if (memcanvas_pressed) {
		memdump_dragging(memdump_start + memcanvas_deltastart);
	} else {
		memdump_do(memdump_start, memdump_col1, memdump_col2);
	}
}
function pad_string(s,len) {
	if (s.length >= len) return s;
	return "0000000000".substring(0,len-s.length) + s;
}
function update_memdump_info(start,w) {
	if (start != last_update_memdump_info_start) {
		last_update_memdump_info_start = start;
		document.getElementById("memdump-info-start").value = pad_string(start.toString(16), 6);
	}
	if (w != last_update_memdump_width) {
		last_update_memdump_width = w;
		document.getElementById("memdump-info-width").value = w.toString(10);
	}
}
function memdump_dragging(pos) {
	memdump_do(pos, memdump_col1 ^ 0x77000000, memdump_col2 ^ 0x77000000);
}
function memdump_do(start0,col1,col2) {
	if (!memdump_buffer || memdump_buffer.length != memimage_data.width * memimage_data.height * 4) {
		let msg = `weird: memdump_buffer ${memdump_buffer ? "size mismatch" : "was null"}, ` + 
			`creating array of size ${MEM_HPIXELS} * ${MEM_VPIXELS} * 4 = ${MEM_HPIXELS*MEM_VPIXELS*4}\n` +
			`memimage_data.width * memimage_data.height = ${memimage_data.width} * ${memimage_data.height}; w*h*4=${memimage_data.width*memimage_data.height*4})\n` +
			`MEM_HPIXELS * MEM_VPIXELS                  = ${MEM_HPIXELS} * ${MEM_VPIXELS}; MEM_HPIXELS*MEM_VPIXELS*4=${MEM_HPIXELS*MEM_VPIXELS*4})`;
		if (memdump_buffer) {
			msg += `\nold memdump_buffer.length was ${memdump_buffer.length} instead of ${memimage_data.width*memimage_data.height*4}`;
		}
		console.error(msg)
		memdump_buffer = new Uint8Array(MEM_HPIXELS*MEM_VPIXELS*4);
	}
	let start = (start0 < 0) ? 0 : start0;
	// idea: if the displayed width is smaller than the memory-dump area, use columns
	let column_size = memdump_word_width*2*MEM_VPIXELS;
	let next_column_addr = start + column_size;
	for (let y=0; y<MEM_VPIXELS; y++) {
		let addr = start + y * memdump_word_width * 2; // word = 2 bytes
		let visible_words = MEM_HPIXELS/16;
		for (let w=0; w<visible_words; w++) {
			let column = Math.floor(w/memdump_word_width);
			let value = wasm_peek16(addr + w * 2 + column * column_size);
			memdump_plotword(w*16, y, value, col1, col2);
		}
	}
	memimage_data.data.set(memdump_buffer);
	memctx.putImageData(memimage_data,0,0,0,0,MEM_HPIXELS,MEM_VPIXELS);
	update_memdump_info(start,memdump_word_width*2);
}
function mempreview() {
	if (!mempreview_buffer) {
		mempreview_buffer = new Uint8Array(MEMPREVIEW_HPIXELS*MEMPREVIEW_VPIXELS*4);
	}
	let memdump_pos = memdump_start;
	let memdump_end = memdump_start + MEM_HPIXELS/8*MEM_VPIXELS;
	// +------+
	// | chip |
	// +------+
	// | fast |
	// +------+
	//
	// 1024*1024 bytes --> shrunk to 256*256 --> 1 px = 4*4 bytes
	//
	for (let y=0; y<MEMPREVIEW_VPIXELS; y++) {
		let base = y >= 128 ? 0xC00000 : 0;
		let peekY = y % 128;
		for (let x=0; x<MEMPREVIEW_HPIXELS; x++) {
			let word_addr = base + peekY*4*1024 + x*4;
			let base_col = word_addr >= memdump_pos && word_addr < memdump_end ? 0xffff0000 : 0xff000000;
			let val = wasm_peek16(word_addr);
			mempreviewset(x,y,base_col|val);
		}
	}
	mempreview_image_data.data.set(mempreview_buffer);
	mempreview_ctx.putImageData(mempreview_image_data,0,0,0,0,MEMPREVIEW_HPIXELS,MEMPREVIEW_VPIXELS);
}
function memdump_plotword(x,y,word,col1,col2) {
	memdumpset(x+ 0,y,(word&0x8000)?col1:col2);
	memdumpset(x+ 1,y,(word&0x4000)?col1:col2);
	memdumpset(x+ 2,y,(word&0x2000)?col1:col2);
	memdumpset(x+ 3,y,(word&0x1000)?col1:col2);
	memdumpset(x+ 4,y,(word&0x0800)?col1:col2);
	memdumpset(x+ 5,y,(word&0x0400)?col1:col2);
	memdumpset(x+ 6,y,(word&0x0200)?col1:col2);
	memdumpset(x+ 7,y,(word&0x0100)?col1:col2);
	memdumpset(x+ 8,y,(word&0x0080)?col1:col2);
	memdumpset(x+ 9,y,(word&0x0040)?col1:col2);
	memdumpset(x+10,y,(word&0x0020)?col1:col2);
	memdumpset(x+11,y,(word&0x0010)?col1:col2);
	memdumpset(x+12,y,(word&0x0008)?col1:col2);
	memdumpset(x+13,y,(word&0x0004)?col1:col2);
	memdumpset(x+14,y,(word&0x0002)?col1:col2);
	memdumpset(x+15,y,(word&0x0001)?col1:col2);
}
function memdumpset(x,y,argb) {
	memdump_buffer[MEM_HPIXELS*4*y + x*4 + 3] = 0xff & (argb >> 24); // alpha
	memdump_buffer[MEM_HPIXELS*4*y + x*4 + 0] = 0xff & (argb >> 16); // R
	memdump_buffer[MEM_HPIXELS*4*y + x*4 + 1] = 0xff & (argb >> 8); // G
	memdump_buffer[MEM_HPIXELS*4*y + x*4 + 2] = 0xff & (argb); // B
}
function mempreviewset(x,y,argb) {
	mempreview_buffer[MEMPREVIEW_HPIXELS*4*y + x*4 + 3] = 0xff & (argb >> 24); // alpha
	mempreview_buffer[MEMPREVIEW_HPIXELS*4*y + x*4 + 0] = 0xff & (argb >> 16); // R
	mempreview_buffer[MEMPREVIEW_HPIXELS*4*y + x*4 + 1] = 0xff & (argb >> 8); // G
	mempreview_buffer[MEMPREVIEW_HPIXELS*4*y + x*4 + 2] = 0xff & (argb); // B
}
function setButtonPaused() {
	$('#button-pause').addClass("paused");
	$('#button-step').removeAttr("disabled");
}
function setButtonUnPaused() {
	$('#button-pause').removeClass("paused");
	$('#button-step').attr("disabled", "disabled");
}
function doPause() {
	wasm_halt();
	try { audioContext.suspend(); } catch(e){ console.error(e);}
	running = false;
	setButtonPaused();
}
function doUnpause() {
	setButtonUnPaused();

	//have to catch an intentional "unwind" exception here, which is thrown
	//by emscripten_set_main_loop() after emscripten_cancel_main_loop();
	//to simulate infinity gamelloop see emscripten API for more info ... 
	try {wasm_run();} catch(e) {}        
	try {connect_audio_processor();} catch(e){ console.error(e);}
	running = true;
}
function doStep() {
	if (running) return;
	Module._wasm_run();
	Module._wasm_execute(); 
	let now = document.timeline.currentTime;
	if (current_renderer=="gpu shader") {
		render_canvas_gl(now);
	} else {
		render_canvas(now);
	}
	memdump();
	mempreview();
}


function InitWrappers() {
	console.log("Module._wasm_is_worker_built()", Module._wasm_is_worker_built());
    wasm_loadfile = function (file_name, file_buffer, drv_number=0) {
        var file_slot_wasmbuf = Module._malloc(file_buffer.byteLength);
        Module.HEAPU8.set(file_buffer, file_slot_wasmbuf);
        var retVal=Module.ccall('wasm_loadFile', 'string', ['string','number','number', 'number'], [file_name,file_slot_wasmbuf,file_buffer.byteLength, drv_number]);
        Module._free(file_slot_wasmbuf);
        return retVal;                    
    }
    wasm_write_bytes_to_ser = function (bytes_to_send) {
        for(let b of bytes_to_send)
        {
            Module._wasm_write_byte_to_ser(b);
        }
    }
    wasm_write_byte_to_ser = function (byte_to_send) {
            Module._wasm_write_byte_to_ser(byte_to_send);
    }
    wasm_key = Module.cwrap('wasm_key', 'undefined', ['number', 'number']);
    wasm_toggleFullscreen = Module.cwrap('wasm_toggleFullscreen', 'undefined');
    wasm_joystick = Module.cwrap('wasm_joystick', 'undefined', ['string']);
    wasm_reset = Module.cwrap('wasm_reset', 'undefined');
    wasm_shell = Module.cwrap('wasm_shell','string',['string']);
    wasm_peek16 = Module.cwrap('wasm_peek16', 'number', ['number']);
    wasm_peek_custom = Module.cwrap('wasm_peek_custom', 'number', ['number']);

    stop_request_animation_frame=true;
    wasm_halt=function () {
        Module._wasm_halt();
        stop_request_animation_frame=true;
    }
    wasm_draw_one_frame= Module.cwrap('wasm_draw_one_frame', 'undefined');

    do_animation_frame=null;
    queued_executes=0;
    
    wasm_run = function () {
        Module._wasm_run();       
        if(do_animation_frame == null)
        {
            execute_amiga_frame=()=>{
                Module._wasm_execute(); 
                queued_executes--;
            };

            render_frame= (now)=>{
                if(current_renderer=="gpu shader")
                    render_canvas_gl(now);
                else
                    render_canvas(now);
            }
            if(Module._wasm_is_worker_built()){
                rendered_frame_id=0;
                calculate_and_render=(now)=>
                {
                    draw_one_frame(); // to gather joystick information 
                    Module._wasm_worker_run();                    
                    let current_rendered_frame_id=Module._wasm_frame_info();
                    if(rendered_frame_id !== current_rendered_frame_id)
                    {
                        render_frame(now);
                        rendered_frame_id = current_rendered_frame_id;
                    }
                }
            }
            else
            {
                calculate_and_render=(now)=>
                {
                    draw_one_frame(); // to gather joystick information 
                    let behind = Module._wasm_draw_one_frame(now);
                    if(behind<0)
                        return;
                    render_frame(now);
                    while(behind>queued_executes)
                    {
                        queued_executes++;
                        setTimeout(execute_amiga_frame);
                    }
                }
            }

            do_animation_frame = function(now) {
                calculate_and_render(now);
		if (live_memory_dump_enabled && is_running()) {
			memdump();
		}
		if (live_memory_preview_enabled && is_running()) {
			mempreview();
		}

                // request another animation frame
                if(!stop_request_animation_frame)
                {
                    requestAnimationFrame(do_animation_frame);   
                }
            }
        }  
        if(stop_request_animation_frame)
        {
            stop_request_animation_frame=false;
            requestAnimationFrame(do_animation_frame);   
        }
    }

    wasm_take_user_snapshot = Module.cwrap('wasm_take_user_snapshot', 'undefined');
    wasm_pull_user_snapshot_file = Module.cwrap('wasm_pull_user_snapshot_file', 'string');
    wasm_delete_user_snapshot = Module.cwrap('wasm_delete_user_snapshot', 'undefined');

    wasm_create_renderer = Module.cwrap('wasm_create_renderer', 'number', ['string']);
    wasm_set_warp = Module.cwrap('wasm_set_warp', 'undefined', ['number']);
    wasm_warp_on_off = Module.cwrap('wasm_warp_on_off', 'undefined', ['number']);
    wasm_sprite_info = Module.cwrap('wasm_sprite_info', 'string');
    wasm_first_bpl_info = Module.cwrap('wasm_first_bpl_info', 'string', ['number']);

    wasm_cut_layers = Module.cwrap('wasm_cut_layers', 'undefined', ['number']);
    wasm_rom_info = Module.cwrap('wasm_rom_info', 'string');

    wasm_get_cpu_cycles = Module.cwrap('wasm_get_cpu_cycles', 'number');
    wasm_set_color_palette = Module.cwrap('wasm_set_color_palette', 'undefined', ['string']);

    wasm_schedule_key = Module.cwrap('wasm_schedule_key', 'undefined', ['number', 'number', 'number', 'number']);

    wasm_peek = Module.cwrap('wasm_peek', 'number', ['number']);
    wasm_poke = Module.cwrap('wasm_poke', 'undefined', ['number', 'number']);
    wasm_has_disk = Module.cwrap('wasm_has_disk', 'number', ['string']);
    wasm_eject_disk = Module.cwrap('wasm_eject_disk', 'undefined', ['string']);
    wasm_export_disk = Module.cwrap('wasm_export_disk', 'string', ['string']);
    wasm_configure = Module.cwrap('wasm_configure', 'string', ['string', 'string']);
    wasm_write_string_to_ser = Module.cwrap('wasm_write_string_to_ser', 'undefined', ['string']);
    wasm_print_error = Module.cwrap('wasm_print_error', 'undefined', ['number']);
    wasm_power_on = Module.cwrap('wasm_power_on', 'string', ['number']);
    wasm_get_sound_buffer_address = Module.cwrap('wasm_get_sound_buffer_address', 'number');
    wasm_copy_into_sound_buffer = Module.cwrap('wasm_copy_into_sound_buffer', 'number');
    wasm_set_sample_rate = Module.cwrap('wasm_set_sample_rate', 'undefined', ['number']);
    wasm_mouse = Module.cwrap('wasm_mouse', 'undefined', ['number','number','number']);
    wasm_mouse_button = Module.cwrap('wasm_mouse_button', 'undefined', ['number','number','number']);
    wasm_set_display = Module.cwrap('wasm_set_display', 'undefined',['string']);
    wasm_auto_type = Module.cwrap('wasm_auto_type', 'undefined', ['number', 'number', 'number']);

    wasm_set_target_fps = Module.cwrap('wasm_set_target_fps', 'undefined', ['number']);
    wasm_get_renderer = Module.cwrap('wasm_get_renderer', 'number');
    wasm_get_config_item = Module.cwrap('wasm_get_config_item', 'number', ['string']);
    wasm_get_core_version = Module.cwrap('wasm_get_core_version', 'string');

    connect_audio_processor_standard = async () => {
        if(audioContext.state !== 'running') {
            await audioContext.resume();  
        }
        if(audio_connected==true)
            return; 
        if(audioContext.state === 'suspended') {
            return;  
        }
        audio_connected=true;
        wasm_set_sample_rate(audioContext.sampleRate);
        console.log("try connecting audioprocessor...");
        if(audioContext.audioWorklet==undefined)
        {
            console.error("audioContext.audioWorklet == undefined");
            return;
        }
        await audioContext.audioWorklet.addModule('js/vAmiga_audioprocessor.js');
        worklet_node = new AudioWorkletNode(audioContext, 'vAmiga_audioprocessor', {
            outputChannelCount: [2],
            numberOfInputs: 0,
            numberOfOutputs: 1
        });

        init_sound_buffer=function(){
            console.log("get wasm sound buffer adresses");
            let sound_buffer_address = wasm_get_sound_buffer_address();
            soundbuffer_slots=[];
            for(slot=0;slot<16;slot++)
            {
                soundbuffer_slots.push(
                    new Float32Array(Module.HEAPF32.buffer, sound_buffer_address+(slot*2048)*4, 2048));
            }
        }
        init_sound_buffer();

        empty_shuttles=new RingBuffer(16);
        worklet_node.port.onmessage = (msg) => {
            //direct c function calls with preceeding Module._ are faster than cwrap
            let samples=Module._wasm_copy_into_sound_buffer();
            let shuttle = msg.data;
            if(samples<1024)
            {
                if(shuttle!="empty")
                {
                    empty_shuttles.write(shuttle);
                }
                return;
            }
            let slot=0;
            while(samples>=1024)
            {
                if(shuttle == null || shuttle=="empty")
                {
                    if(!empty_shuttles.isEmpty())
                    {
                        shuttle = empty_shuttles.read();
                    }
                    else
                    {
                      return;
                    }
                }
                let wasm_buffer_slot = soundbuffer_slots[slot++];
                if(wasm_buffer_slot.byteLength==0)
                {//slot can be detached when wasm had grown memory, adresses are wrong then so lets reinit
                    init_sound_buffer();
                    wasm_buffer_slot = soundbuffer_slots[slot-1];
                }
                shuttle.set(wasm_buffer_slot);
                worklet_node.port.postMessage(shuttle, [shuttle.buffer]);
                shuttle=null;
                samples-=1024;
            }            
        };
        worklet_node.port.onmessageerror = (msg) => {
            console.log("audio processor error:"+msg);
        };
        worklet_node.connect(audioContext.destination);        
    }

    connect_audio_processor_shared_memory= async ()=>{
        if(audioContext.state !== 'running') {
            await audioContext.resume();  
        }
        if(audio_connected==true)
            return; 
        if(audioContext.state === 'suspended') {
            return;  
        }
        audio_connected=true;

        audioContext.onstatechange = () => console.log('Audio Context: state = ' + audioContext.state);
        let gainNode = audioContext.createGain();
        gainNode.gain.value = 0.15;
        gainNode.connect(audioContext.destination);
        wasm_set_sample_rate(audioContext.sampleRate);
        await audioContext.audioWorklet.addModule('js/vAmiga_audioprocessor_sharedarraybuffer.js');
        const audioNode = new AudioWorkletNode(audioContext, 'vAmiga_audioprocessor_sharedarraybuffer', {
            outputChannelCount: [2],
            processorOptions: {
                pointers: [Module._wasm_leftChannelBuffer(), Module._wasm_rightChannelBuffer()],
                buffer: Module.HEAPF32.buffer,
                length: 2048
            }
        });
        audioNode.port.onmessage = (e) => {
            Module._wasm_update_audio(e.data);
        };
        audioNode.connect(audioContext.destination);
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }
    }

    if(Module._wasm_is_worker_built())
    {
        connect_audio_processor=connect_audio_processor_shared_memory;
    }
    else
    {
        connect_audio_processor=connect_audio_processor_standard;
    }

    //when app becomes hidden/visible
    window.addEventListener("visibilitychange", async () => {
        if(document.visibilityState == "hidden") {
           console.log("visibility=hidden");
           let is_full_screen=document.fullscreenElement!=null;
           console.log("fullscreen="+is_full_screen);
           if(!is_full_screen)
           {//safari bug: goes visible=hidden when entering fullscreen
            //in that case don't disable the audio 
               try { audioContext.suspend(); } catch(e){ console.error(e);}
           }
        }
        else if(emulator_currently_runs)
        {
            try { await connect_audio_processor(); } catch(e){ console.error(e);}
            add_unlock_user_action();
        }
        if(document.visibilityState === "visible" && wakeLock !== null)
        {
            if(is_running())
            {
//                alert("req wakelock again "+document.visibilityState);
                set_wake_lock(true);
            }
        }
    });

    //when app is going to background either visible or hidden
//    window.addEventListener('blur', ()=>{});

    //when app is coming to foreground again
    window.addEventListener('focus', async ()=>{
        if(emulator_currently_runs)
        {
            try { await connect_audio_processor(); } catch(e){ console.error(e);}
            add_unlock_user_action();
        }
    });

    add_unlock_user_action = function(){
        //in case we did go suspended reinstall the unlock events
        document.removeEventListener('click',click_unlock_WebAudio);
        document.addEventListener('click',click_unlock_WebAudio, false);
    }
    remove_unlock_user_action = function(){
        //if it runs we dont need the unlock handlers, has no effect when handler already removed 
        document.removeEventListener('click',click_unlock_WebAudio);
    }

    audioContext.onstatechange = () => {
        let state = audioContext.state;
        console.error(`audioContext.state=${state}`);
        if(state!=='running'){
            add_unlock_user_action();
        }
        else {
            remove_unlock_user_action();
        }
    }

    click_unlock_WebAudio=async function() {
        try { 
            await connect_audio_processor(); 
            if(audioContext.state=="running")
                remove_unlock_user_action();
        } catch(e){ console.error(e);}
    }
    add_unlock_user_action();
    
    get_audio_context=function() {
        if (typeof Module === 'undefined'
        || typeof Module.SDL2 == 'undefined'
        || typeof Module.SDL2.audioContext == 'undefined')
        {
            return null;
        }
        else
        {
            return Module.SDL2.audioContext;
        }
    }
    window.addEventListener('message', event => {
    console.log("window.message", event.data); // TODODEBUG
        if(event.data == "poll_state")
        {
            window.parent.postMessage({ msg: 'render_run_state', value: is_running()},"*");
            window.parent.postMessage({ msg: 'render_current_audio_state', 
                value: audioContext == null ? 'suspended' : audioContext.state},"*"); 
        }
        else if(event.data == "button_run()")
        {
            if(required_roms_loaded)
            {
                $('#button_run').click();
                window.parent.postMessage({ msg: 'render_run_state', value: is_running()},"*");
            }
        }
        else if(event.data == "toggle_audio()")
        {
            var context = audioContext; //get_audio_context();
            if (context !=null)
            {
                if(context.state == 'suspended') {
                    context.resume();
                }
                else if (context.state == 'running')
                {
                    context.suspend();
                }
            }
            window.parent.postMessage({ msg: 'render_current_audio_state', 
                value: audioContext == null ? 'suspended' : audioContext.state },"*");
        }
        else if(event.data == "open_zip()")
        {
        	console.warn("no impl: open_zip() event");
        }
        else if(event.data.cmd == "script")
        {
            let AsyncFunction = Object.getPrototypeOf(async function(){}).constructor
            let js_script_function=new AsyncFunction(event.data.script);
            js_script_function();
        }
        else if(event.data.cmd == "load")
        {
        	// TODO when does this occur?
            async function copy_to_local_storage(romtype, byteArray)
            {
                if(romtype != "")
                {
                    try{
                        local_storage_set(romtype+".bin", ToBase64(byteArray));
                        await save_rom(romtype+".bin", romtype,  byteArray);                    
	                console.log("*** calling loadRoms in message listener (load received)");
                        await loadRoms(false);
                    }
                    catch(e){
                        console.error(e.message)
                    }
                }
            }

            let with_reset=false;
            //put whdload kickemu into disk drive
            if(event.data.mount_kickstart_in_dfn &&
                event.data.mount_kickstart_in_dfn >=0 )
            {
                wasm_loadfile("kick-rom.disk", event.data.kickemu_rom, event.data.mount_kickstart_in_dfn);
            }
            //check if any roms should be preloaded first... 
            if(event.data.kickstart_rom !== undefined)
            {
                wasm_loadfile("kick.rom_file", event.data.kickstart_rom);
                //copy_to_local_storage(rom_type, byteArray);
                if(event.data.kickstart_ext !== undefined)
                {
                    wasm_loadfile("kick.rom_ext_file", event.data.kickstart_ext);
                }
                with_reset=true;
            }
            if(with_reset){
                wasm_reset();
            }
            if(event.data.file_name !== undefined && event.data.file !== undefined)
            {
                file_slot_file_name = event.data.file_name;
                file_slot_file = event.data.file;
                //if there is still a zip file in the fileslot, eject it now
                $("#button_eject_zip").click();
                configure_file_dialog(reset=false);
            }
        }
        else if(event.data.cmd == "ser:")
        {
            if(event.data.text !== undefined)
            {
                wasm_write_string_to_ser(event.data.text);
            }
            else if (event.data.byte !== undefined )
            {
                Module._wasm_write_byte_to_ser(event.data.byte);
            }
            else if (event.data.bytes !== undefined )
            {
                wasm_write_bytes_to_ser(event.data.bytes);
            }
        }
    });
    
    // dark_switch = document.getElementById('dark_switch');

	$(".button-select-rom").on("click", function() {	
		document.getElementById("dialog-rom").showModal();
	});
	$("#dialog-missing-rom button").on("click", function() {
		document.getElementById("dialog-missing-rom").close();
	});

    
    //--- mouse pointer lock
    canvas = document.querySelector('canvas');
    canvas.requestPointerLock = canvas.requestPointerLock ||
                                canvas.mozRequestPointerLock;

    document.exitPointerLock = document.exitPointerLock ||
                            document.mozExitPointerLock;

    has_pointer_lock=false;
    try_to_lock_pointer=0;
    has_pointer_lock_fallback=false;
    window.last_mouse_x=0;
    window.last_mouse_y=0;

    request_pointerlock = async function() {
        if(canvas.requestPointerLock === undefined)
        {
            if(!has_pointer_lock_fallback)
            {
                add_pointer_lock_fallback();      
            }
            return;
        }
        if(!has_pointer_lock && try_to_lock_pointer <20)
        {
            try_to_lock_pointer++;
            try {
                if(has_pointer_lock_fallback) {remove_pointer_lock_fallback();}
                await canvas.requestPointerLock();
                try_to_lock_pointer=0;
            } catch (error) {
                await sleep(100);
                await request_pointerlock();                
            }
        }
    };
    
    window.add_pointer_lock_fallback=()=>{
        document.addEventListener("mousemove", updatePosition_fallback, false); 
        document.addEventListener("mousedown", mouseDown, false);
        document.addEventListener("mouseup", mouseUp, false);
        has_pointer_lock_fallback=true;
    };
    window.remove_pointer_lock_fallback=()=>{
        document.removeEventListener("mousemove", updatePosition_fallback, false); 
        document.removeEventListener("mousedown", mouseDown, false);
        document.removeEventListener("mouseup", mouseUp, false);
        has_pointer_lock_fallback=false;
    };
    document.addEventListener('pointerlockerror', add_pointer_lock_fallback, false);

    // Hook pointer lock state change events for different browsers
    document.addEventListener('pointerlockchange', lockChangeAlert, false);
    document.addEventListener('mozpointerlockchange', lockChangeAlert, false);

    function lockChangeAlert() {
        if (document.pointerLockElement === canvas ||
            document.mozPointerLockElement === canvas) {
            has_pointer_lock=true;
//            console.log('The pointer lock status is now locked');
            document.addEventListener("mousemove", updatePosition, false);
            document.addEventListener("mousedown", mouseDown, false);
            document.addEventListener("mouseup", mouseUp, false);

        } else {
//            console.log('The pointer lock status is now unlocked');  
            document.removeEventListener("mousemove", updatePosition, false);
            document.removeEventListener("mousedown", mouseDown, false);
            document.removeEventListener("mouseup", mouseUp, false);

            has_pointer_lock=false;
        }
    }
    var mouse_port=1;
    function updatePosition(e) {
        Module._wasm_mouse(mouse_port,e.movementX,e.movementY);
    }
    function updatePosition_fallback(e) {
        let movementX=e.screenX-window.last_mouse_x;
        let movementY=e.screenY-window.last_mouse_y;
        window.last_mouse_x=e.screenX;
        window.last_mouse_y=e.screenY;
        let border_speed=4;
        let border_pixel=2;
    
        if(e.screenX<=border_pixel)
          movementX=-border_speed;
        if(e.screenX>=window.innerWidth-border_pixel)
          movementX=border_speed;
        if(e.screenY<=border_pixel)
          movementY=-border_speed;
        if(e.screenY>=window.innerHeight-border_pixel)
          movementY=border_speed;        
        Module._wasm_mouse(mouse_port,movementX,movementY);  
    }
    function mouseDown(e) {
        Module._wasm_mouse_button(mouse_port,e.which, 1/* down */);
    }
    function mouseUp(e) {
        Module._wasm_mouse_button(mouse_port,e.which, 0/* up */);
    }

    window.addEventListener("resize", function() {
        setTimeout(()=>wasm_set_display(""), 0);
        // console.log("resize!");
        checkMemcanvasSize();
    });
    

//--
//----
    set_renderer_choice = function (choice) {
        $(`#button_renderer`).text('video renderer='+choice);
        save_setting("renderer",choice);
    }
    current_renderer=load_setting("renderer", "gpu shader");
    set_renderer_choice(current_renderer);

    if(call_param_gpu==true)
    {
        current_renderer="gpu shader";
    }
    let got_renderer=false;
    if(current_renderer=="gpu shader")
    {
        try{
            initWebGL();
            got_renderer=true;
        }
        catch(e){ console.error(e)}
    }
    else
    {
        create2d_context();
    }
    //got_renderer=wasm_create_renderer(current_renderer); 
    if(!got_renderer && current_renderer!='software')
    {
        alert('MESSAGE: gpu shader can not be created on your system configuration... switching back to software renderer...');
        set_renderer_choice('software')
        current_renderer='software';
        create2d_context();
    }
	memctx = document.getElementById('memcanvas').getContext('2d');
	memimage_data = memctx.createImageData(MEM_HPIXELS,MEM_VPIXELS);
	memdump_buffer = new Uint8Array(MEM_HPIXELS*MEM_VPIXELS*4);

	mempreview_ctx = document.getElementById('mempreview').getContext('2d');
	mempreview_image_data = memctx.createImageData(MEMPREVIEW_HPIXELS,MEMPREVIEW_VPIXELS);
	document.getElementById('mempreview').addEventListener("click", (e) => {
		let x = e.offsetX;
		let y = e.offsetY;
		let base = y < 128 ? 0 : 0xc00000;
		y %= 128;
		memdump_start = base + y * 1024 * 4;
		memdump();
		mempreview();
	});
	$("#mempreview-reset-width").on("click", () => {memdump_word_width = MEM_HPIXELS/16;memdump();mempreview();});
	$("#mempreview-width-40").on("click", () => {memdump_word_width = 20;memdump();mempreview();});
	$("#button-memdump-chip").on("click", () => {memdump_start = 0;memdump();mempreview();});
	$("#button-memdump-fast").on("click", () => {memdump_start = 0xc00000;memdump();mempreview();});

	$(".js-close-containing-dialog").on("click", (e) => {
		$(e.target).closest("dialog").get(0).close();
	});

	document.getElementById("memdump-info-start").addEventListener("keypress", e => {
		if (e.which == 13) {
			e.preventDefault();
			try {
				let value = document.getElementById("memdump-info-start").value;
				value = parseInt(value, 16) & 0xfffffffe;
				if (value > 0) memdump_start = value;
				memdump();
				mempreview();
			} catch (e) {
				console.error("Parse error", e);
			}
		}
	});
	document.getElementById("memdump-info-width").addEventListener("keypress", e => {
		if (e.which == 13) {
			e.preventDefault();
			try {
				let value = document.getElementById("memdump-info-width").value;
				value = Math.floor(parseInt(value, 10)/2);
				if (value >= 1) memdump_word_width = value;
				memdump();
				mempreview();
			} catch (e) {
				console.error("Parse error", e);
			}
		}
	});
	function combinedMemoryAndWithKeyHandler(e) {
		let addrDelta = 0;
		let widthDelta = 0;
		if (e.shiftKey && e.key == "ArrowLeft") {
			e.preventDefault();
			widthDelta = -2;
		} else if (e.shiftKey && e.key == "ArrowRight") {
			e.preventDefault();
			widthDelta = 2;
		} else if (e.key == "ArrowUp") {
			e.preventDefault();
			addrDelta = -2 * (e.shiftKey ? 32*memdump_word_width : 1);
		} else if (e.key == "ArrowDown") {
			e.preventDefault();
			addrDelta = 2 * (e.shiftKey ? 32*memdump_word_width : 1);
		}
		if (addrDelta || widthDelta) {
			let new_start = memdump_start + addrDelta;
			let new_width = memdump_word_width + widthDelta;
			if (new_start < 0) new_start = 0;
			if (new_width >= 1) memdump_word_width = new_width;
			memdump_start = new_start;
			memdump();
			mempreview();
		}
	}
	document.getElementById("memdump-info-start").addEventListener("keydown", combinedMemoryAndWithKeyHandler);
	document.getElementById("memdump-info-width").addEventListener("keydown", combinedMemoryAndWithKeyHandler);

//----

set_display_choice = function (choice) {
    $(`#button_display`).text('visible display area='+choice);
    wasm_set_display(choice);
}
let current_display=load_setting("display", "overscan");
set_display_choice(current_display);
//---

function setColorScheme(val) {
	if (!val) return;
	let m = /([0-9a-fA-F]{6}),([0-9a-fA-F]{6})/.exec(val);
	if (!m) return;
	let col1 = parseInt(m[1], 16) | 0xff000000;
	let col2 = parseInt(m[2], 16) | 0xff000000;
	console.log("cols", col1, col2);
	memdump_col1 = col1;
	memdump_col2 = col2;
	memdump();
	mempreview();
}

// current_vjoy_touch=load_setting("vjoy_touch", "base moves");

    warp_switch = $('#warp_switch');
    var use_warp=load_setting('use_warp', false);

	setCheckbox("#warp_switch", use_warp);

    wasm_set_warp(use_warp ? 1:0);
    warp_switch.change( function() {
        wasm_set_warp(this.checked ? 1:0);
        save_setting('use_warp', this.checked);
    });

	warp_on_off_switch = $("#checkbox-warp");
	warp_on_off_switch.change(function(){
		wasm_set_warp(0); // does wrapper->amiga->configure(OPT_WARP_MODE, WARP_NEVER); in main.cpp to prevent disabling warp when floppy is finished
		wasm_warp_on_off(this.checked ? 1:0);
	});

	$("#checkbox-mute").on("change", function() {
		let vol = $("#checkbox-mute").is(":checked") ? "0" : "100";
		wasm_configure("AUDVOL", vol);
	});
	$("#checkbox-dma").on("change", function(e) {
	    wasm_configure("DMA_DEBUG_ENABLE",$("#checkbox-dma").is(":checked") ? "1" : "0");
	});
	$("#select-livedump-colors").on("change", function(e) {
		let val = $("#select-livedump-colors option:selected").val();
		setColorScheme(val);
		if (val) save_setting("colorscheme", val);
	});
	let currentCols = load_setting("colorscheme", "df942a,371d20");
	if (currentCols) {
		setColorScheme(currentCols);
		$("#select-livedump-colors").val(currentCols);
	}
	$("#checkbox-livedump-adapt").on("change", function(e) {
		memdump_adapt_size = $("#checkbox-livedump-adapt").is(":checked");
		save_setting("adaptsize", memdump_adapt_size);
		checkMemcanvasSize();
	});
	function checkMemcanvasSize() {
		if (!memdump_adapt_size) return; 
		// document.getElementById("memcanvas").getBoundingClientRect().right, .bottom
		// vs
		// window.innerWidth, window.innerHeight
		try {
			let ughDiv = document.getElementById("botr").getBoundingClientRect();
			let innerW = ughDiv.left; // window.innerWidth;
			let innerH = ughDiv.top;  // window.innerHeight;

			let rect = document.getElementById("memcanvas").getBoundingClientRect();
			let availableW = innerW - rect.left - 8;
			let availableH = innerH - rect.top - 72;
			availableW = (availableW-4) & 0xfff0;
			if (availableW < MEMDUMP_MIN_W) availableW = MEMDUMP_MIN_W;
			if (availableH < MEMDUMP_MIN_H) availableH = MEMDUMP_MIN_H;
			document.getElementById("memcanvas").width  = availableW;
			document.getElementById("memcanvas").height = availableH;
			MEM_HPIXELS = Math.round(availableW);
			MEM_VPIXELS = Math.round(availableH);
			console.info(`resize event: using ${MEM_HPIXELS} * ${MEM_VPIXELS} as canvas/buffer size`)
			memimage_data = memctx.createImageData(MEM_HPIXELS,MEM_VPIXELS);
			memdump_buffer = new Uint8Array(MEM_HPIXELS*MEM_VPIXELS*4);
			memdump();
		} catch (e) {
			console.warn("canvas resize handler oopsie", e);
		}
	}
	memdump_adapt_size = load_setting("adaptsize", true);
	setCheckbox("#checkbox-livedump-adapt", memdump_adapt_size);
	if (memdump_adapt_size) {
		checkMemcanvasSize();
	}
	function peek_custom_long(addr) {
		let hi = wasm_peek_custom(addr);
		let lo = wasm_peek_custom(addr+2);
		return (hi<<16) + lo;
	}
	// function guessBitplane(which) {
	// 	let bpl1 = peek_custom_long(0xdff0e0+0*4);
	// 	let bpl2 = peek_custom_long(0xdff0e0+1*4);
	// 	let bpl3 = peek_custom_long(0xdff0e0+2*4);
	// 	let bpl4 = peek_custom_long(0xdff0e0+3*4);
	// 	let bpl5 = peek_custom_long(0xdff0e0+4*4);
	// 	let bpl6 = peek_custom_long(0xdff0e0+5*4);
	// 	let mod1 = wasm_peek_custom(0xdff108);
	// 	let mod2 = wasm_peek_custom(0xdff10a);
	// 	let ddf1 = wasm_peek_custom(0xdff092);
	// 	let ddf2 = wasm_peek_custom(0xdff094);
	// 
	// 	let ddfW = ddf2-ddf1;
	// 	let ddfPixels = ddfW*2+16; // TODO hires
	// 	let ddfBytes = ddfPixels / 8;
	// 
	// 	let modBytes = which == 1 ? mod1 : mod2;
	// 
	// 	if (modBytes & 0xf000) {
	// 		modBytes = (modBytes ^ 0xffff) + 1 - ddfBytes; // naah, that's no help
	// 	}
	// 
	// 	let bytes = ddfBytes + modBytes;
	// 	let words = Math.floor(bytes / 2) & 0xffffffe;
	// 	
	// 	console.log(`guess: ddfstop-strt = \$${(ddf2).toString(16)}-\$${(ddf1).toString(16)}=${ddf2}-${ddf1}=${ddfW}, ${ddfW}*2+16=${ddfPixels}, ${ddfPixels}/8=${ddfBytes}, modBytes=${modBytes} --> guessing ${ddfBytes}+${modBytes}=${bytes} bytes=${words} words`);
	// 	
	// 	if (bpl1 > 0 && words > 0 && words < 160*6) {
	// 		memdump_start = which == 1 ? bpl1 : bpl2;
	// 		memdump_word_width = words;
	// 		memdump();
	// 		mempreview();
	// 	}
	// }
	// $("#button-guess-bitplane1").on("click", () => guessBitplane(1));
	// $("#button-guess-bitplane2").on("click", () => guessBitplane(2));
	const VPOS_MAX_PAL_LF =    312;
	const VPOS_MAX_PAL =       VPOS_MAX_PAL_LF;

	function findBitmapChunks(bpls) {
		$("#select-bpls").find("option").remove();
		for (let bplNum=0; bplNum<bpls.length; bplNum++) {
			let y = 0;
			while (y<VPOS_MAX_PAL_LF-2) {
				let bplValue = bpls[bplNum][y];
				if (bplValue == 0xffffffff || isNaN(bplValue)) {
					y++;
					continue;
				}
//if (bplNum == 0) console.log("bplstrt y=" + y.toString().padStart(3) + " bpl " + bplValue.toString(16));
				let delta     = bpls[bplNum][y+1] - bplValue;
				let deltaNext = bpls[bplNum][y+2] - bpls[bplNum][y+1];
				if (isNaN(delta) || isNaN(deltaNext) || delta == 0 || delta != deltaNext) {
					y++;
					continue;
				}

				let h = 1;
				while (delta == bpls[bplNum][y+h] - bpls[bplNum][y+h-1]) {
					h++;
				}
				
				if (delta < 0) {
					bplValue += delta * h;
					delta = -delta;
				}
				let w = delta * 8;
				let chunkOption = $("<option></option>");
				chunkOption.val(`${bplValue} ${delta}`);
				chunkOption.text(`${bplValue.toString(16).padStart(6,"0")} - width ${delta.toString(10).padStart(4, "\xa0")} height ${h.toString(10).padStart(3, "\xa0")}`);
				$("#select-bpls").append(chunkOption);

				y += h;
			}
		}
	}
	$("#button-guess-bitplanes,#button-guess-again").on("click", function() {
		let dia = document.getElementById("dialog-guesses");
		dia.show();
		let rec = dia.getBoundingClientRect();
		let rightX = document.getElementById("memcanvas").getBoundingClientRect().left;
		let leftX = rightX - rec.width - 4;
		dia.style.left = leftX + "px";

		let bpls = [];
		for (let y=0; y<VPOS_MAX_PAL_LF; y++) {
			let bplInfo = wasm_first_bpl_info(y);
			// console.log(y.toString().padStart(4)+": " + bplInfo);
			let vals = bplInfo.split(/,/);
			for (let i=0; i<vals.length; i++) {
				if (!bpls[i]) bpls[i] = [];
				bpls[i][y] = parseInt(vals[i], 16);
			}
		}
		findBitmapChunks(bpls);
	});
	$("#select-bpls").on("change", function() {
		let val = $("#select-bpls").val();
		if (!val) return;
		let m = /(\d+) (\d+)/.exec(val);
		if (!m) return;
		let mem = parseInt(m[1], 10);
		let w   = parseInt(m[2], 10);
		if (mem > 0) memdump_start = mem;
		if (w >= 2) memdump_word_width = Math.floor(w/2);
		memdump();
		mempreview();
	});
	memdumpi = $("#button-mem");
	memdumpi.click(function(e){
		e.preventDefault();
		memdump_word_width = MEM_HPIXELS/16;
		memdump_start = 0;
		memcanvas_deltastart=0;
		memdump();
	});
	var memcanvas_startx=-1;
	var memcanvas_starty=-1;
	var memcanvas_deltax=0;
	var memcanvas_deltay=0;
	function memcanvas_startdrag(x,y){
		memcanvas_pressed=true;
		memcanvas_startx = x;
		memcanvas_starty = y;
		memcanvas_updatedrag(x,y);
	}
	function memcanvas_updatedrag(x,y){
		if (memcanvas_pressed) {
			memcanvas_deltax = memcanvas_startx-x;
			memcanvas_deltay = memcanvas_starty-y;
			// horizontal drag beyond the current memdump_word_width
			if (memcanvas_deltax < 0 && memcanvas_deltax < memdump_word_width*-16) {
				let extraColumns = Math.floor(-memcanvas_deltax / (memdump_word_width*16));
				memcanvas_deltax -= extraColumns * memdump_word_width * 16 * MEM_VPIXELS;
			} else if (memcanvas_deltax > 0 && memcanvas_deltax > memdump_word_width*16) {
				let extraColumns = Math.floor(memcanvas_deltax / (memdump_word_width*16));
				memcanvas_deltax += extraColumns * memdump_word_width * 16 * MEM_VPIXELS;
			}
			memcanvas_deltastart = memcanvas_deltax/8 + memcanvas_deltay*memdump_word_width*2;
			memcanvas_deltastart = Math.round(memcanvas_deltastart) & 0xfffffffe;
			memdump_update_from_drag();
		}
	}
	function memcanvas_enddrag(){
		if (memcanvas_pressed) {
			memcanvas_pressed = false;
			memdump_start += memcanvas_deltastart;
			if (memdump_start < 0) memdump_start = 0;
			memdump_update_from_drag();
		}
	}
	memcan = $("#memcanvas");
	memcan.on("mousedown", e => {
		// console.log("mousedown memcanvas", e);
		if (e.buttons != 1) return; // only leftie
		memcanvas_startdrag(e.clientX, e.clientY);
	});
	memcan.on("mouseup", e => {
		// console.log("mousedown memcanvas", e);
		memcanvas_enddrag();
	});
	memcan.on("mouseleave", e => {
		// console.log("mousedown memcanvas", e);
		memcanvas_enddrag();
	});
	memcan.on("mousemove", e => {
		// console.log("mousemove memcanvas", e.buttons);
		if (e.buttons == 1) {
			memcanvas_updatedrag(e.clientX,e.clientY);
		} else if (e.buttons == 0) {
			memcanvas_enddrag();
		}
		
	});
	// haha, good old jquery times -- this doesn't have wheel events?!
	document.getElementById("memcanvas").addEventListener("wheel", e => {
		// console.log("wheeeel", e);
		e.preventDefault();
		if (e.deltaY < 0) {
			if (memdump_word_width > 1) {
				memdump_word_width--;
				memdump();
			}
		} else if (e.deltaY > 0) {
			memdump_word_width++;
			memdump_update_from_drag();
		}
	});

	let livemem_switch = $("#checkbox-livedump");
	live_memory_dump_enabled = livemem_switch.is(":checked");
	livemem_switch.change(function(){
		live_memory_dump_enabled = this.checked;
		memdump();
		mempreview();
	});
	let livepreview_switch = $("#checkbox-livepreview");
	live_memory_preview_enabled = livepreview_switch.is(":checked");
	livepreview_switch.change(function(){
		live_memory_preview_enabled = this.checked;
		memdump();
		mempreview();
	});
	
	$(".button-snapshot-from-url").on("click", async function() {
		let url = $(this).data("url");
		console.log("Load snapshot from url: " + url);
		fetchSnapshot(url);
	});



function bind_config(key, default_value){
    let config_switch = $('#'+key);
    let use_config=load_setting(key, default_value);
    config_switch.prop('checked', use_config);
    wasm_configure(key.substring(4),''+use_config);
    config_switch.change( function() {
        wasm_configure(key.substring(4),''+this.checked);
        save_setting(key, this.checked);
    });
}
// who needs those collisions
bind_config("OPT_CLX_SPR_SPR", false);
bind_config("OPT_CLX_SPR_PLF", false);
bind_config("OPT_CLX_PLF_PLF", false);


function set_hardware(key, value)
{
    save_setting(key,value);
    wasm_configure(key.substring(4),value);
}

function validate_hardware()
{
    let agnes=load_setting("OPT_AGNUS_REVISION", 'ECS_1MB');
    let chip_ram=load_setting("OPT_CHIP_RAM", '512');
    if(agnes.startsWith("OCS") && chip_ram > 512)
    {
        alert(`${agnes} agnus can address max. 512KB. Correcting to highest possible setting.`);
        set_hardware("OPT_CHIP_RAM", '512');
        $(`#button_${"OPT_CHIP_RAM"}`).text("chip ram"+'='+'512 (corrected)');
    }
    else if(agnes== "ECS_1MB" && chip_ram > 1024)
    {
        alert(`${agnes} agnus can address max. 1024KB. Correcting to highest possible setting.`);
        set_hardware("OPT_CHIP_RAM", '1024');
        $(`#button_${"OPT_CHIP_RAM"}`).text("chip ram"+'='+'1024 (corrected)');
    }
}

validate_hardware();

function bind_config_choice(key, name, values, default_value, value2text=null, text2value=null, targetElement=null, updated_func=null){
    value2text = value2text == null ? (t)=>t: value2text;
    text2value = text2value == null ? (t)=>t: text2value;
    
    let set_choice = function (choice) {
        $(`#button_${key}`).text(`${name}${name.length>0?'=':''}${choice}`);
        save_setting(key, text2value(choice));
        validate_hardware();

        let result=wasm_configure(key.substring(4),`${text2value(choice)}`);
        if(result.length>0)
        {
            alert(result);
            validate_hardware();
            wasm_power_on(1);
            return;
        }
        if(updated_func!=null)
            updated_func(choice);
    }
    set_choice(value2text(load_setting(key, default_value)));
}


bind_config_choice("OPT_BLITTER_ACCURACY", "blitter accuracy",['0','1','2'],'2');

show_drive_config = (c)=>{
    $('#div_drives').html(`
    ${wasm_get_config_item("DRIVE_CONNECT",0)==1?"<span>df0</span>":""} 
    ${wasm_get_config_item("DRIVE_CONNECT",1)==1?"<span>df1</span>":""} 
    ${wasm_get_config_item("DRIVE_CONNECT",2)==1?"<span>df2</span>":""} 
    ${wasm_get_config_item("DRIVE_CONNECT",3)==1?"<span>df3</span>":""}
    <br>(kickstart needs a reset to recognize new connected drives)
    `);
}

bind_config_choice("OPT_floppy_drive_count", "floppy drives",['1', '2', '3', '4'],'1',
null,null,null,show_drive_config);
$('#hardware_settings').append(`<div id="div_drives"style="font-size: smaller" class="ml-3 vbk_choice_text"></div>`);
show_drive_config();

bind_config_choice("OPT_DRIVE_SPEED", "floppy drive speed",['-1', '1', '2', '4', '8'],'1');

$('#hardware_settings').append(`<div class="mt-4">hardware settings</div><span style="font-size: smaller;">(shuts machine down on agnus model or memory change)</span>`);

bind_config_choice("OPT_AGNUS_REVISION", "agnus revision",['OCS_OLD','OCS','ECS_1MB','ECS_2MB'],'ECS_2MB');
bind_config_choice("OPT_DENISE_REVISION", "denise revision",['OCS','ECS'],'OCS');
bind_config_choice("OPT_CHIP_RAM", "chip ram",['256', '512', '1024', '2048'],'512', (v)=>`${v} KB`, t=>parseInt(t));
bind_config_choice("OPT_SLOW_RAM", "slow ram",['0', '256', '512'],'512', (v)=>`${v} KB`, t=>parseInt(t));
bind_config_choice("OPT_FAST_RAM", "fast ram",['0', '256', '512','1024', '2048', '8192'],'0', (v)=>`${v} KB`, t=>parseInt(t));

// avoid confusion, force 512+512
set_hardware("OPT_CHIP_RAM", '512');
set_hardware("OPT_SLOW_RAM", '512');
set_hardware("OPT_FAST_RAM", '0');
set_hardware("OPT_floppy_drive_count", '1');


$('#hardware_settings').append("<div id='divCPU' style='display:flex;flex-direction:row'></div>");
bind_config_choice("OPT_CPU_REVISION", "CPU",[0,1,2], 0, 
(v)=>{ return (68000+v*10)},
(t)=>{
    let val = t;
    val = (val-68000)/10;
    return val;
}, "#divCPU");

bind_config_choice("OPT_CPU_OVERCLOCKING", "",[0,2,3,4,5,6,8,12,14], 0, 
(v)=>{ return Math.round((v==0?1:v)*7.09)+' MHz'},
(t)=>{
    let val =t.replace(' MHz','');
    val = Math.round(val /7.09);
    return val == 1 ? 0: val;
},"#divCPU");
$('#hardware_settings').append(`<div style="font-size: smaller" class="ml-3 vbk_choice_text">
<span>7.09 Mhz</span> is the original speed of a stock A1000 or A500 machine. For effective overclocking be sure to enable fast ram and disable slow ram otherwise the overclocked CPU will get blocked by chipset DMA. CPU speed is proportional to energy consumption.
</div>`);




wasm_set_display("pal");

  // create a reference for the wake lock
  wakeLock = null;


check_wake_lock = async () => {
    if(is_running())
    {
        if(wakeLock != null)
        {
//            alert("req");
            requestWakeLock();
        }
    }
    else
    {
        if(wakeLock != null)
        {
//            alert("release");
            wakeLock.release();
        }
    }
}

// create an async function to request a wake lock
requestWakeLock = async () => {
    try {
      wakeLock = await navigator.wakeLock.request('screen');

      // change up our interface to reflect wake lock active
      $("#wake_lock_status").text("(wake lock active, app will stay awake, no auto off)");
      wake_lock_switch.prop('checked', true);

      // listen for our release event
      wakeLock.onrelease = function(ev) {
        console.log(ev);
      }
      wakeLock.addEventListener('release', () => {
        // if wake lock is released alter the button accordingly
        if(wakeLock==null)
            $("#wake_lock_status").text(`(no wake lock, system will probably auto off and sleep after a while)`);
        else
            $("#wake_lock_status").text(`(wake lock released while pausing, system will probably auto off and sleep after a while)`);
        wake_lock_switch.prop('checked', false);

      });
    } catch (err) {
      // if wake lock request fails - usually system related, such as battery
      $("#wake_lock_status").text(`(no wake lock, system will probably auto off and sleep after a while). ${err.name}, ${err.message}`);
      wake_lock_switch.prop('checked', false);
      console.error(err);
//      alert(`error while requesting wakelock: ${err.name}, ${err.message}`);
    }
}

set_wake_lock = (use_wake_lock)=>{
    let is_supported=false;
    if ('wakeLock' in navigator) {
        is_supported = true;
    } else {
        wake_lock_switch.prop('disabled', true);
        $("#wake_lock_status").text("(wake lock is not supported on this browser, your system will decide when it turns your device off)");
    }
    if(is_supported && use_wake_lock)
    {
        requestWakeLock();
    }
    else if(wakeLock != null)
    {
        let current_wakelock=wakeLock;
        wakeLock = null;
        current_wakelock.release();
    }
}

wake_lock_switch = $('#wake_lock_switch');
let use_wake_lock=load_setting('wake_lock', false);
set_wake_lock(use_wake_lock);
wake_lock_switch.change( function() {
    let use_wake_lock  = this.checked;
    set_wake_lock(use_wake_lock);
    save_setting('wake_lock', this.checked);
});
//---

$('.layer').change( function(event) {
    //recompute stencil cut out layer value
    const layers={
        spritesdisable: 0xff,
        playfield1: 0x100,
        playfield2: 0x200        
    };

    var layer_value = 0;
    for(var layer_id in layers)
    {
        if(document.getElementById(layer_id).checked)
        {
            layer_value |= layers[layer_id];
        }
    }
    wasm_cut_layers( layer_value );
});

//------
    // wasm_configure("log_on", live_debug_output.toString()); <-- re-enable some time


    // allow Amiga canvas right-click when paused (to enable "save PNG")
    document.getElementById("canvas").addEventListener("contextmenu", function(e) {
    	if (is_running()) e.preventDefault();
    });
    
    document.getElementById('button-reset').onclick = function() {
        wasm_reset();

        if(!is_running())
        {
            $("#button-pause").click();
        }
    }


    running=false;
    emulator_currently_runs=false;
    $("#button-pause").click(function() {
        if(running)
        {
		doPause();
        }
        else
        {
        	doUnpause();
        }
        check_wake_lock();        
        //document.getElementById('canvas').focus();
    });
    $("#button-step").click(doStep);


//---------- update management --------

    set_settings_cache_value = async function (key, value)
    {
        let settings = await caches.open('settings');
        await settings.put(key, new Response(value) );
    }
    get_settings_cache_value= async function (key)
    {
        try {
            let settings = await caches.open('settings');
            let response=await settings.match(key)
            if(response==undefined)
                return null;
            return await response.text();    
        }
        catch(e){
            console.error(e);
            return "can't read version";
        }
    }
    has_installed_version=async function (cache_name){
        let cache_names=await caches.keys();
        for(c_name of cache_names)
            if(c_name == cache_name)
                return true;        
        return false;
    }
    get_current_ui_version = async function (){
        current_version = await get_settings_cache_value("active_version");
        
        current_ui='unkown';
        if(current_version != null)
        {
            current_ui=current_version.split('@')[1];
        }
    }
    try{
        //when the serviceworker talks with us ...  
        navigator.serviceWorker.addEventListener("message", async (evt) => {
            await get_current_ui_version();
            let cache_names=null;
            try{
                cache_names=await caches.keys();
            }
            catch(e)
            {
                console.error(e);
                return;
            }
            let version_selector = `
            manage already installed versions:
            <br>
            <div style="display:flex">
            <select id="version_selector" class="ml-2">`;
            for(c_name of cache_names)
            {
                let name_parts=c_name.split('@');
                let core_name= name_parts[0];
                let ui_name= name_parts[1];
                let selected=c_name==current_version?"selected":"";

                if(c_name.includes('@'))
                {   
                    if(//uat version should not show regular versions and vice versa
                        location.pathname.startsWith("/uat") ?
                            ui_name.endsWith("uat")
                        :
                            !ui_name.endsWith("uat")
                    )
                    {
                        version_selector+=`<option ${selected} value="${c_name}">core ${core_name}, ui ${ui_name}</option>`;
                    }
                }
            }
            version_selector+=
            `</select>
            
            <button type="button" id="activate_version" disabled class="btn btn-primary btn-sm px-1 mx-1">activate</button>
            <button type="button" id="remove_version" class="btn btn-danger btn-sm px-1 mx-1"><svg style="width:1.5em;height:1.5em"><use xlink:href="img/sprites.svg#trash"/></svg>
            </button>
            </div>
            `;

            //2. diese vergleichen mit der des Service workers
            sw_version=evt.data;
        });


        // ask service worker to send us a version message
        // wait until it is active
        navigator.serviceWorker.ready
        .then( (registration) => {
            if (registration.active) {
                registration.active.postMessage('version');
            }
        });

    } catch(e)
    {
        console.error(e.message);
    }
//------- update management end ---

    // setup_browser_interface(); // too complex for us

    document.getElementById('port1').onchange = function() {
        port1 = document.getElementById('port1').value; 
        if(port1 == port2)
        {
            port2 = 'none';
            document.getElementById('port2').value = 'none';
        }
        //document.getElementById('canvas').focus();

        if(port1 == 'mouse')
        {                
            mouse_port=1;    
            canvas.addEventListener('click', request_pointerlock);
            request_pointerlock();
        }
        else if(port2 != 'mouse')
        {
            canvas.removeEventListener('click', request_pointerlock);
            remove_pointer_lock_fallback();
        }
        this.blur();
    }
    document.getElementById('port2').onchange = function() {
        port2 = document.getElementById('port2').value;
        if(port1 == port2)
        {
            port1 = 'none';
            document.getElementById('port1').value = 'none';
        }
        //document.getElementById('canvas').focus();

        if(port2 == 'mouse')
        {                
            mouse_port=2;
            canvas.addEventListener('click', request_pointerlock);
            request_pointerlock();
        }
        else if(port1 != 'mouse')
        {
            canvas.removeEventListener('click', request_pointerlock);
            remove_pointer_lock_fallback();
        }
        this.blur();
    }


    document.getElementById('theFileInput').addEventListener("submit", function(e) {
        e.preventDefault();
        handleFileInput();
    }, false);

	//
	// specialized df0/df1 drop handling instead of generic drop zone -- also to figure out how this works :)
	//
	function diskFileCallback(file, fileInputId, fileNameId, drive) {
		var fileReader = new FileReader();
		fileReader.onload  = function() {
			if (file.name.match(/[.](adf|hdf|dms|exe|vAmiga|disk)$/i)) {
				document.getElementById(fileNameId).innerText = file.name;
				global_apptitle = file.name;
				let data = new Uint8Array(this.result);
				lastInsertedDisk[parseInt(drive)] = file.name;
				var filetype = wasm_loadfile(file.name, data, drive);
				console.log("wasm_loadfile returned", filetype);
			} else {
				document.getElementById(fileNameId).innerHTML = "<strong>Error</strong> " + escapeHtml(file.name);
			}
			document.getElementById(fileInputId).value = null;
		};
		fileReader.readAsArrayBuffer(file);
	}
	function configureDiskDrop(dropZoneId, fileInputId, fileNameId, ejectId, drive) {
		document.getElementById(dropZoneId).addEventListener("click", function(e) {
			e.preventDefault();
			document.getElementById(fileInputId).click();
		});
		document.getElementById(fileInputId).addEventListener("change", function(e) {
			if (e.target.files.length > 0) {
				diskFileCallback(e.target.files[0], fileInputId, fileNameId, drive);
			}
		});
		document.getElementById(dropZoneId).addEventListener("dragover", function(e) {
			e.preventDefault();
			e.stopPropagation();
			e.dataTransfer.dropEffect = "copy";
		}, false);
		document.getElementById(dropZoneId).addEventListener("drop", function(e) {
			e.preventDefault();
			e.stopPropagation();
			var dt = e.dataTransfer;
			if (dt.items) {
				for (item of dt.items) {
					if (item.kind == "file") { 
						var f = item.getAsFile();
						diskFileCallback(f, fileInputId, fileNameId, drive);
						return;
					}
				}
			} else if (dt.files.length > 0) {
				diskFileCallback(dt.files[0], fileInputId, fileNameId, drive);
			}
			
		}, false);
		document.getElementById(ejectId).addEventListener("click", function(e) {
			e.preventDefault();
			wasm_eject_disk("df" + drive);
		});
	}
	configureDiskDrop("drop-df0", "file-df0", "desc-df0", "eject-df0", 0);
	configureDiskDrop("drop-df1", "file-df1", "desc-df1", "eject-df1", 1);
	document.getElementById("checkbox-df1").addEventListener("change", function(e) {
		set_hardware("OPT_floppy_drive_count", "" + ($("#checkbox-df1").is(":checked") ? 2 : 1));
	});
	//
	// end of df0/df1 handling 
	//
	
	//
	// custom ROM file handling
	//
	loadRoms = async function(installToCore) {
		var loadStoredItem = async function (name, type) {
			if (name == null) return null;
			let storedItem = await load_rom(name);
			if (storedItem == null) return null;
			let data = storedItem.data;
			if (installToCore) {
				let romType = wasm_loadfile(name + type, data);
				if (!romType.endsWith("rom") && !romType.endsWith("rom_ext")) {
					//in case the core thinks rom is not valid anymore delete it
					delete_rom(name);
					return null;
				}
			}
			return data;
		}
		fillRomSelects();
		let loaded = true;
		try {
			let selected = local_storage_get("rom");
			if (selected) {
				let rom = await loadStoredItem(selected, ".rom_file");
				if (rom == null) {
					$("#select-stored-rom").val("");
					console.error(`Error loading stored rom "${selected}"`);
				}
			} else {
				loaded = false;
			}
		} catch(e) {
			console.error(e);
			loaded = false;
		}
		try {
			let selected = local_storage_get("rom_ext");
			if (selected) {
				let rom = await loadStoredItem(selected, ".rom_ext_file");
				if (rom == null) {
					$("#select-stored-rom-ext").val("");
					console.error(`Error loading stored ext rom "${selected}"`);
				}
			}
		} catch(e) {
			console.error(e);
		}
		updateRomSelectDeleteButtons();
		return loaded;
	}
	fillRomSelects = function() {
		fillRomSelectsForType("rom", "#select-stored-rom");
		fillRomSelectsForType("rom_ext", "#select-stored-rom-ext");
	};
	initRomSelects = function() {
		$("#select-stored-rom").on("change", function() {
			let selected = $("#select-stored-rom").val();
			save_setting("rom", selected);
	                console.log("*** calling loadRoms in #select-stored-rom change handler");
			loadRoms(true);
			updateRomSelectDeleteButtons();
		});
		$("#select-stored-rom-ext").on("change", function() {
			let selected = $("#select-stored-rom-ext").val();
			save_setting("rom_ext", selected);
	                console.log("*** calling loadRoms in #select-stored-rom-ext change handler");
			loadRoms(true);
			updateRomSelectDeleteButtons();
		});
		$("#button-delete-rom").on("click", function() {
			let selected = local_storage_get("rom");
			save_setting("rom", null);
			$("#select-stored-rom").val("");
			delete_rom(selected);
	                console.log("*** calling loadRoms in #button-delete-rom click handler");
			loadRoms(true);
		});
		$("#button-delete-rom-ext").on("click", function() {
			let selected = local_storage_get("rom_ext");
			save_setting("rom_ext", null);
			$("#select-stored-rom-ext").val("");
			delete_rom(selected);
	                console.log("*** calling loadRoms in #button-delete-rom-ext click handler");
			loadRoms(true);
		});
	};
	updateRomSelectDeleteButtons = function() {
		let val1 = $("#select-stored-rom").val();
		let val2 = $("#select-stored-rom-ext").val();
		setDisabled("#button-delete-rom", !val1 || val1 == "");
		setDisabled("#button-delete-rom-ext", !val2 || val2 == "");
		
	};
	fillRomSelectsForType = async function(type, selectSelector) {
		let roms = await list_rom_type_entries(type);
		let $select = $(selectSelector);
		$select.empty();
		$select.append($(`<option value="">empty</option>`));

		//  if(rom_restored_from_snapshot) ...

		let selectedRom = local_storage_get(type);
		for (rom of roms) {
			$select.append($(`<option value="${rom.id}" ${selectedRom == rom.id ? "selected" : ""}>${rom.id}</option>`));
		}

		updateRomSelectDeleteButtons();
	};
	function romFileCallback(file, fileInputId, ext) {
		var fileReader = new FileReader();
		fileReader.onload  = async function() {
			if (file.name.match(/\.rom$/i)) {
				let data = new Uint8Array(this.result);
				let romName = file.name;
				var romtype = wasm_loadfile(romName + ext, data);
				if (romtype != "") {
					local_storage_set(romtype, romName);
					await save_rom(romName, romtype, data);
			                console.log("*** calling loadRoms in " + fileInputId + " onload handler");
					await loadRoms(true);
				}
				var filetype = wasm_loadfile(file.name + ext, data);
				console.log("wasm_loadfile ", file.name + ext, data, ", returned", filetype);
			} else {
				document.getElementById(fileNameId).innerHTML = "<strong>Error</strong> " + escapeHtml(file.name);
			}
			document.getElementById(fileInputId).value = null;
		};
		fileReader.readAsArrayBuffer(file);
	}
	function configureRomDrop(dropZoneId, fileInputId, ext) {
		document.getElementById(dropZoneId).addEventListener("click", function(e) {
			e.preventDefault();
			document.getElementById(fileInputId).click();
		});
		document.getElementById(fileInputId).addEventListener("change", function(e) {
			if (e.target.files.length > 0) {
				romFileCallback(e.target.files[0], fileInputId, ext);
			}
		});
		document.getElementById(dropZoneId).addEventListener("dragover", function(e) {
			e.preventDefault();
			e.stopPropagation();
			e.dataTransfer.dropEffect = "copy";
		}, false);
		document.getElementById(dropZoneId).addEventListener("drop", function(e) {
			e.preventDefault();
			e.stopPropagation();
			var dt = e.dataTransfer;
			if (dt.items) {
				for (item of dt.items) {
					if (item.kind == "file") { 
						var f = item.getAsFile();
						romFileCallback(f, fileInputId, ext);
						return;
					}
				}
			} else if (dt.files.length > 0) {
				romFileCallback(dt.files[0], fileInputId, ext);
			}
			
		}, false);
	}
	configureRomDrop("drop-kickstart", "file-kickstart", ".rom_file");
	configureRomDrop("drop-kickstart-ext", "file-kickstart-ext", ".rom_ext_file");
	//
	// end of custom ROM file handling
	//
	
	//
	// take snapshot
	//
	document.getElementById("button-snapshot").addEventListener("click", async function(e) {
		e.preventDefault();
		let name = shorten(global_apptitle.replace(/ M[0-9a-fA-F]+W[0-9]+/g, ""), 40);
		// Encode current mem dump pos + width in snapshot title
		let app_name = name + " M" + memdump_start.toString(16) + "W" + (memdump_word_width*2);
		wasm_halt();
		wasm_take_user_snapshot();
		var snapshot_json= wasm_pull_user_snapshot_file();
		var snap_obj = JSON.parse(snapshot_json);
		//        var ptr=wasm_pull_user_snapshot_file();
		//        var size = wasm_pull_user_snapshot_file_size();
		var snapshot_buffer = new Uint8Array(Module.HEAPU8.buffer, snap_obj.address, snap_obj.size);
		
		//snapshot_buffer is only a typed array view therefore slice, which creates a new array with byteposition 0 ...
		console.log("save snapshot:", app_name);
		await save_snapshot(app_name, snapshot_buffer.slice(0,snap_obj.size));
		wasm_delete_user_snapshot();
		$("#button-snapshot").text("Saved!");
		setTimeout(function() {$("#button-snapshot").text("Take snapshot");}, 500);
		if(is_running()) {
			setTimeout(function(){ try{wasm_run();} catch(e) {} },1);
		}
	});
	async function getSnapshots(callback) {
		let transaction = (await db()).transaction("snapshots"); // readonly
		let apps = transaction.objectStore("snapshots");
		let request = apps.getAll();
		request.onsuccess = function() {
			if (request.result !== undefined) {
				callback(request.result);
			} else {
				console.log("No titles found");
			}
		}
	}
	function createSnapshotImage(src_data) {
		// return $("<p>img for " + (typeof data) + "</p>");
		let version = src_data[6] +'.'+src_data[7]+'.'+src_data[8];
		let width=src_data[13]*256+ src_data[12];
		let height=src_data[17]*256+ src_data[16];
		if(width==0) { //width is 0 if there is structure padding for 8 byte aligment instead of 4
			width=src_data[13+4]*256+ src_data[12+4];
			height=src_data[17+4]*256+ src_data[16+4];
		}
		if (!width || !height) {
			return $("<div class='lowered-border w-lg' style='height:136px;text-align:center;'><p>(no image)</p<</span>");
		}
		var teaser_canvas = document.createElement("canvas"); // $("<canvas></canvas>");
		var ctx = teaser_canvas.getContext("2d");
		teaser_canvas.width = width;
		teaser_canvas.height = height;
		teaser_canvas.classList.add("w-lg");
		if (ctx!=null) {
			// console.log("createImageData", width, height, typeof width, typeof height);
			let imgData=ctx.createImageData(width,height);
			var data = imgData.data;
			let snapshot_data = new Uint8Array(src_data, 40/* offset .. this number was a guess... */, data.length);
			data.set(snapshot_data.subarray(0, data.length), 0);
			ctx.putImageData(imgData,0,0); 
		}
		return teaser_canvas;
	}
	document.getElementById("button-snapshots").addEventListener("click", async function(e) {
		e.preventDefault();
		console.log("button-snapshots");
		document.getElementById("dialog-snapshots").showModal();
		if (is_running()) {
			// wasm_halt();
			doPause();
		}
		// await this.wait_until_finish();
		let listContent = $("#snapshot-list");
		listContent.html("<p><em>Loading…</em></p>");
		await getSnapshots(async function(app_snaps) {
			console.log("snapshots", app_snaps);
			if (!app_snaps || app_snaps.length == 0) {
				listContent.html("No snapshots found.");
				return;
			}
			console.log("app_snaps", app_snaps.length);
			let ul = $("<div></div>");
			try {
				// get_data_collector('snapshots').total_count+=app_snaps.length;
				// row_renderer(latest_load_query_context, app_title, app_snaps);
				for (var z=app_snaps.length-1; z>=0; z--) {
					let snapId = app_snaps[z].id;
					let snapTitle = app_snaps[z].title;
					let snapDiv = $("<div class='d-flex'></div>");
					let snapImg = $("<div></div>");
					let snapAct = $("<div class='d-vflex'></div>");
					 
					let snapTit = $(`<h3>${escapeHtml(snapTitle)} #${snapId}</h3>`);
					let snapLod = $("<button class='w-mid'>Go there!</button>");
					let snapDel = $("<button class='w-mid'>Delete</button>");
					let snapExp = $("<button class='w-mid'>Export to file</button>");

					snapImg.append(createSnapshotImage(app_snaps[z].data));

					snapAct.append(snapTit);
					snapAct.append(snapLod);
					snapAct.append(snapDel);
					snapAct.append(snapExp);

					snapDiv.append(snapImg);
					snapDiv.append(snapAct);

					snapLod.on("click", function() {
						console.log("load snapshot", snapId);
						get_snapshot_per_id(snapId, function (snapshot) {
							var version = snapshot.data[6] +'.'+snapshot.data[7]+'.'+snapshot.data[8];
							if(snapshot.data[9]>0) {
								version += `_beta${snapshot.data[9]}`;
							}
							if(!version.match(compatible_snapshot_version_format))
							{
								alert(`This snapshot has been taken with vAmiga version ${version} and can not be loaded with the current version ${vAmigaWeb_version}, sorry.`);
								return;
							}

							// Try to decode mem dump pos + width from snapshot title
							let m = / M([0-9a-fA-F]+)W([0-9]+)$/.exec(snapshot.title);
							if (m) {
								let newPos = parseInt(m[1], 16);
								let newW   = Math.floor(parseInt(m[2], 10) / 2);
								memdump_start = newPos & 0xffffffe;
								if (newW > 0) memdump_word_width = newW;
							}

							wasm_loadfile(snapshot.title + ".vAmiga", snapshot.data);
							document.getElementById("dialog-snapshots").close();
							global_apptitle=snapshot.title;
							if (!is_running()) {
								doUnpause();
							}
							$("#desc-df0").text(wasm_has_disk("df0") ? "(disk from snapshot)" : "");
							$("#desc-df1").text(wasm_has_disk("df1") ? "(disk from snapshot)" : "");
						});
					});
					snapDel.on("click", function() {
						console.log("delete snapshot", snapId);
						delete_snapshot_per_id(snapId);
                                                snapDiv.remove();
					});
					snapExp.on("click", function() {
						console.log("export snapshot", snapId);
						get_snapshot_per_id(snapId, function(snapshot) {
							let blob_data = new Blob([snapshot.data], {type: 'application/octet-binary'});
							const url = window.URL.createObjectURL(blob_data);
							const a = document.createElement('a');
							a.style.display = 'none';
							a.href = url;
							
							let app_name = escapeFile(snapshot.title).replace(/_M[0-9a-fA-F]+W[0-9]+/g, "");
							let extension_pos = app_name.indexOf(".");
							if (extension_pos >=0) {
								app_name = app_name.substring(0,extension_pos);
							}
							// Encode current mem dump pos + width in file name
							a.download = app_name + '_snap' + snapshot.id +  "_M" + memdump_start.toString(16) + "W" + (memdump_word_width*2) + '.vAmiga';
							document.body.appendChild(a);
							a.click();
							window.URL.revokeObjectURL(url);
						});
					});
					ul.append(snapDiv);
				}
			} catch (error) {
				console.error(error);
				alert(error.message);
				listContent.html("<strong>Error:</strong> " + escapeHtml(error.message));
				return;
			}
			listContent.empty().append(ul);
		});
	});
	document.getElementById("button-load-snapshot-file").addEventListener("click", function(e) {
		if (is_running()) doPause();
		document.getElementById("file-snapshot").click();
	});
	document.getElementById("file-snapshot").addEventListener("change", function(e) {
		if (e.target.files.length == 0) {
			return;
		}
		let file = e.target.files[0];
		let fileReader = new FileReader();
		fileReader.onload = function() {
			if (file.name.match(/[.](vAmiga)$/i)) {
				let data = new Uint8Array(this.result);
				wasm_loadfile(file.name, data);
				
				// Try to decode mem dump pos + width from file name
				let m = /_M([0-9a-fA-F]+)W([0-9]+)\.vAmiga/.exec(file.name);
				if (m) {
					let newPos = parseInt(m[1], 16);
					let newW   = Math.floor(parseInt(m[2], 10) / 2);
					memdump_start = newPos & 0xffffffe;
					if (newW > 0) memdump_word_width = newW;
				}
				
				doStep();
				document.getElementById("dialog-snapshots").close();
			} else {
				alert("Error: Expecting an .vAmiga file")
			}
			document.getElementById("file-snapshot").value = null;
		};
		fileReader.readAsArrayBuffer(file);
	});
	document.getElementById("button-about").addEventListener("click", function(e) {
		document.getElementById("dialog-about").showModal();
	});
	document.getElementById("button-examples").addEventListener("click", function(e) {
		document.getElementById("dialog-examples").showModal();
	});
	document.getElementById("button-debugger").addEventListener("click", function(e) {
		if (is_running()) doPause();

		let out = document.getElementById("retroshell-output");
		out.value = wasm_shell("");
		document.getElementById("dialog-debugger").showModal();
		$("#retroshell-input").focus();
	});

   document.getElementById('button_fetch_open_roms').addEventListener("click", function(e) {
       fetchOpenROMS();
   }, false);

   

//---- rom dialog end

    document.addEventListener('keyup', keyup, false);
    document.addEventListener('keydown', keydown, false);

    scaleVMCanvas();


// Losso

$("details").on("toggle", e => {checkMonitorVisibilities();});

var lastShell = "";
var shellInput = document.getElementById("retroshell-input");
var shellOutput = document.getElementById("retroshell-output");
shellInput.addEventListener("keydown", (e) => {
	if (e.key === "Enter") {
		lastShell = shellInput.value;
		let contents = wasm_shell(shellInput.value + "\n");
		// doStep(); // otherwise commands like "i copper list 1" return nothing?!
		// let contents = wasm_shell("");		
		shellOutput.value = contents;
		shellOutput.scrollTop = shellOutput.scrollHeight;
		e.preventDefault();
		shellInput.value = "";
	} else if (e.key === "ArrowUp") {
		shellInput.value = lastShell;
		window.setTimeout(() => {shellInput.selectionStart = shellInput.selectionEnd = lastShell.length;}, 50);
	}
});

	fillRomSelects();
	initRomSelects();

    return;
} // InitWrappers

//---- end custom key ----
