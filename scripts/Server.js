
/**
 * installs the changer
 * public tag because we cant address namespaces here
 */
function efxChanger(event) {
  return Triggers.efxChanger (event);
}

/**
 * 
 * all server side from this namespace
 */
var Server = (function(ns) {
  
  ns.fetchKeys = {
    
    // where to get keys
    getAccessKeys: function () {
      return PropertiesService.getScriptProperties().getProperty('sf_efx_keys');
    },
      
    // how to get the spreadsheet ID
    getId: function () {
      return SpreadsheetApp.getActiveSpreadsheet().getId()
    }
      
  };

  ns.sfInit = function () {
  
      // get a shortcut
    const sf = cSheetEfx.SheetEfx;
    
    // start off an item that'll be used for tracking
    return sf.init({
      
      // this should be how to get the writerkeys
      fetchKeys:ns.fetchKeys,
      
      // how long new created data items shuld live for
      itemSeconds:30 * 60,
  
    });
    
  };
  
  // initialize
  ns.init = function () {
  
    const sf = ns.sfInit();
    
    // create an empty item by simulating an event
    const pack = sf.create (sf.ssChangePack ({
      source: SpreadsheetApp.getActiveSpreadsheet(),
      changeType:"INITIALISE"
    }));
    
    if (!pack.ok) throw JSON.stringify (pack);
    

    // add the trigger
    Triggers.installChangeTrigger ("efxChanger");
    
    // just return the alias and reader keys since we wont be allowing writing
    return {
      reader:pack.readers[0],
      alias:pack.alias
    };
  
  };
  
  /**
   * set the active sheet and cell
   * @param {string} ssid the ss
   * @param {string} sheetId the sheet id
   * @param {string} the a1range to set
   * @param {string} method the method to use
   * @param {boolean} goThere whether to go there
   */
  ns.makeRangeFocus = function (ssId , sheetId , a1Range ,method, goThere) {
   
         // get a shortcut
    const sf = cSheetEfx.SheetEfx;
    const s  = sf.findSheet (ssId , sheetId, SpreadsheetApp);
   
    // if there's a range given
    if (a1Range && s.sheet) {
      s.range =  s.sheet.getRange (a1Range);
    }
    
    // use the active range, but we'll need to set the sheet first to find it    
    else if (s.sheet) {
      const currentSheet = s.ss.getActiveSheet();
      const currentRange = currentSheet.getActiveRange();
      s.ss.setActiveSheet(s.sheet);
      s.range = s.sheet.getActiveRange();
      if (!goThere) {
        currentSheet.setActiveRange(currentRange);
      }
    }
    
    //set it
    var pack;
    if (goThere){

      s.sheet.setActiveRange(s.range);
      
      pack = Triggers.efxChanger({
        source:s.ss
      }, method);
    }
    
    else {
      // don't actually go there but make it look like a change
      // for the client
      // this allows it to show a different sheet
      // than the one on screen
      pack = Triggers.efxChanger({
        source:s.ss,
        sheetId:s.sheet.getSheetId(),
        a1Range:s.range.getA1Notation()
      },method);
    }

    return pack;

  };


  
  /**
   * will be called from the client to get the sheet values of a given sheet
   */
  ns.getSheetValues = function (ssId , sheetId , a1Range, method) {
      // get a shortcut
    const sf = cSheetEfx.SheetEfx;
    var range = sf.findRange (ssId , sheetId , a1Range, SpreadsheetApp).range;
    method = method || "getValues";
    if (typeof range[method] !== "function") throw 'method ' + method + ' is invalid';
    return range[method]();
    
  };

  return ns;
})(Server || {});
