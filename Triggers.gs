var Triggers = (function(ns) {

  /*
   * install onchange trigger
   * @param {string} name the name
   * @return {Trigger}
   */
  ns.installChangeTrigger = function (name) {
  
    if (typeof this[name] !== "function") throw name + " needs to be a function to be installed on change";
    
  // first delete any instances already installed
    ScriptApp.getProjectTriggers().slice()
    .forEach (function (d) {
      if (d.getHandlerFunction() === name) ScriptApp.deleteTrigger(d);
    });
  
  // now install freshly
    return ScriptApp.newTrigger(name)
      .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
      .onChange()
      .create();
  };
  
   
 /** 
   * @param {object} event the event from an onchange (needs at least source:(the spreadsheetapp) & changeType: properties)
   * @param {string} [method=getDisplayValues]  for future expansion, the type of data to get
   */
  ns.efxChanger = function(event, method) {
  
    // get a shortcut
    const sf = Server.sfInit();
  
    // get the digest package - summarize current state of spreadsheet
    const pack = sf.ssChangePack (event,method);
  
    // and write it to efx
    var result = sf.update (pack);

    return result;
  }

  return ns;
} ) ({});
