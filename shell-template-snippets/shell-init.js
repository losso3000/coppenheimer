      is_inside_scrollable=(e)=>{
        let inside_modal=false;
        let el=e.target; 
        while(el != document.body)
        {
          if(
            el.id == 'virtual_keyboard'||
            (
              el.classList !== undefined && 
              (
                  el.classList.contains("modal-dialog")
                ||el.classList.contains("modal-header")
                ||el.classList.contains("modal-body")
                ||el.classList.contains("modal-content")
                ||el.classList.contains("modal-footer")
              )
            )
          )
          {
            inside_modal=true;
            break;
          }
          el=el.parentNode;
        }
        return inside_modal;
      }

      //prevent backgroundscroll
      document.body.addEventListener('touchmove',function(e){
        if(!is_inside_scrollable(e))
        {//prevent scrolling except on modals and vbk
          e.preventDefault();
        }
      },{ capture:false ,passive: false });

      var statusElement = document.getElementById('status');
      var progressElement = document.getElementById('progress');
      var spinnerElement = document.getElementById('spinner');
 
      var Module = {
        preRun: [function () {
        }],
        postRun: [InitWrappers],
        print: (function() {
          var outputElement = document.getElementById('output');
          if (outputElement) outputElement.value = ''; // clear browser cache
          return async function(text) {
            console.log(text);
/*            if(typeof live_debug_output == 'undefined') 
              return;
            if(!live_debug_output)
              return;
            if (arguments.length > 1) text = Array.prototype.slice.call(arguments).join(' ');
            //setTimeout((text) => 
            //{
              // These replacements are necessary if you render to raw HTML
              //text = text.replace(/&/g, "&amp;");
              //text = text.replace(/</g, "&lt;");
              //text = text.replace(/>/g, "&gt;");
              //text = text.replace('\n', '<br>', 'g');
              if (outputElement) {
                outputElement.innerHTML += text +'<br>';
                //outputElement.value += text + '\n';
                //outputElement.scrollTop = outputElement.scrollHeight; // focus on bottom
              }              
            //}, 0);
*/
          };
        })(),
        printErr: function(text) {
          if (arguments.length > 1) text = Array.prototype.slice.call(arguments).join(' ');
          console.error(text);
        },
        canvas: (function() {
          var canvas = document.getElementById('canvas');

          // As a default initial behavior, pop up an alert when webgl context is lost. To make your
          // application robust, you may want to override this behavior before shipping!
          // See http://www.khronos.org/registry/webgl/specs/latest/1.0/#5.15.2
          canvas.addEventListener("webglcontextlost", function(e) { alert('WebGL context lost. You will need to reload the page.'); e.preventDefault(); }, false);

          return canvas;
        })(),
        setStatus: function(text) {
          console.log("set status:", text);
          if (!Module.setStatus.last) Module.setStatus.last = { time: Date.now(), text: '' };
          if (text === Module.setStatus.last.text) return;
          var m = text.match(/([^(]+)\((\d+(\.\d+)?)\/(\d+)\)/);
          var now = Date.now();
          if (m && now - Module.setStatus.last.time < 30) return; // if this is a progress update, skip it if too soon
          Module.setStatus.last.time = now;
          Module.setStatus.last.text = text;
          if (m) {
            text = m[1];
            progressElement.value = parseInt(m[2])*100;
            progressElement.max = parseInt(m[4])*100;
            progressElement.hidden = false;
            spinnerElement.hidden = false;
          } else {
            progressElement.value = null;
            progressElement.max = null;
            progressElement.hidden = true;
            if (!text) spinnerElement.hidden = true;
          }
          statusElement.innerHTML = text;
        },
        totalDependencies: 0,
        monitorRunDependencies: function(left) {
          this.totalDependencies = Math.max(this.totalDependencies, left);
          Module.setStatus(left ? 'Preparing... (' + (this.totalDependencies-left) + '/' + this.totalDependencies + ')' : 'All downloads complete.');
        }
      };
      Module.setStatus('Downloading...');
      window.onerror = function(msg, url, lineNo, columnNo, error) {
        console.log("onerror!", error);
        if(msg.startsWith('Uncaught ')){
          _wasm_print_error( JSON.stringify(error));
        }
        var message = [
          'Error-Message: ' + msg,
          'URL: ' + url,
          'Line: ' + lineNo,
          'Column: ' + columnNo,
          'Error object: ' + JSON.stringify(error)
        ].join('\n');
        alert(message + " -- go to settings open live debug console ...");
        document.getElementById('output').value += "\n"+ message + "\n";

        Module.setStatus('Error thrown, see JavaScript console ' + message);
        spinnerElement.style.display = 'none';
        Module.setStatus = function(text) {
          if (text) Module.printErr('[post-exception status] ' + text);
        };
      };

      var db;    
      //ready function
//      $(function () {
//        $('[data-toggle="popover"]').popover();
//        //$('[data-toggle="tooltip"]').tooltip();
//        $("body").tooltip({selector: '[data-toggle="tooltip"]'});
//      });
