/**
* sets up all listeners
* @constructor Home
*/

var Home = (function (ns) {
  'use strict';

  // The initialize function must be run to activate elements
  ns.init = function () {

    // change in sheet selection
    // best way to do this to provoke a change
    // server side and it'll come back as a push notification
    DomUtils.elem ("sheet-select").addEventListener ("change", function (e) {
      Client.setRangeFocus (this.value);
    });
    
  };

  
  return ns;
  
})(Home || {});
