let TPP=1;
let HBLANK_MIN=0x12*TPP;
let HPIXELS=912*TPP;
let PAL_EXTRA_VPIXELS=140;
let VPIXELS=313;
let xOff = HBLANK_MIN;//252
let yOff=26 + 6;
let clipped_width=HPIXELS-xOff-8*TPP;
let clipped_height=VPIXELS-yOff ;

let ctx=null;

function create2d_context() {
	const canvas = document.getElementById('canvas');
	ctx = canvas.getContext('2d');
	image_data=ctx.createImageData(HPIXELS,VPIXELS);
}

function render_canvas() {
	let pixels = Module._wasm_pixel_buffer() + yOff*(HPIXELS<<2);
	let pixel_buffer=new Uint8Array(Module.HEAPU32.buffer, pixels, HPIXELS*clipped_height<<2);
	image_data.data.set(pixel_buffer);
	
	// putImageData(imageData, dx, dy, dirtyX, dirtyY, dirtyWidth, dirtyHeight)
	ctx.putImageData(image_data,
		-xOff,		// dx
		0,		// dy
		xOff,		// dirtyX
		0,		// ditryY 
		clipped_width,	// dirtyWidth
		clipped_height	// dirtyHeight
		);
}

function js_set_display(_xOff, _yOff, _clipped_width,_clipped_height) {
	// console.log("js_set_display",xOff,yOff,_clipped_width,_clipped_height);
	xOff = _xOff-HBLANK_MIN*4;
	yOff = _yOff;
	clipped_width  =_clipped_width;
	clipped_height =_clipped_height;
	if (clipped_height % 2 != 0) clipped_height++; //when odd make the height even 
	if (clipped_height+yOff > VPIXELS) {
		clipped_height = (VPIXELS-yOff) & 0xfffe;
	}
	const canvas = document.getElementById("canvas");
	canvas.width = clipped_width;
	if(typeof gl != 'undefined' && gl != null) {
		canvas.height = clipped_height*2;
		let VPOS_CNT = VPIXELS;
		let HPOS_CNT = HPIXELS;
		updateTextureRect(xOff /HPOS_CNT, yOff / VPOS_CNT, (xOff+clipped_width) / HPOS_CNT, (yOff+clipped_height)/VPOS_CNT); 
	} else {
		canvas.height = clipped_height;
	}
}

function scaleVMCanvas() {
	$("#canvas").css("width", `${clipped_width}px`).css("height", `${clipped_height*2}px`).css("top", "0px");
};
