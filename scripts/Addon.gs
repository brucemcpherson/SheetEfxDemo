'use strict';
/**
 * Adds a custom menu with items to show the sidebar and dialog.
 *
 * @param {Object} e The event parameter for a simple onOpen trigger.
 */
function onOpen(e) {

  SpreadsheetApp.getUi()
      .createAddonMenu()
      .addItem('Sheets efx demo', 'vizSefx')
      .addToUi();
      
}

/**
 * Runs when the add-on is installed; calls onOpen() to ensure menu creation and
 * any other initializion work is done immediately.
 *
 * @param {Object} e The event parameter for a simple onInstall trigger.
 */
function onInstall(e) {
  onOpen(e);
}


/**
 * Opens a sidebar. 
 */
function vizSefx() {

  var ui = HtmlService.createTemplateFromFile('index.html')
      .evaluate()
      .setSandboxMode(HtmlService.SandboxMode.IFRAME)
      .setTitle("Sheets Efx demo");


  SpreadsheetApp.getUi().showSidebar(ui);
}

/**
 * for container script  testing
 */
function libGetUi() {

  return HtmlService.createTemplateFromFile('index.html')
      .evaluate()
      .setSandboxMode(HtmlService.SandboxMode.IFRAME)
      .setTitle("Sheets Efx demo");

}

// example fo how to make keys
// assuming I have my boss key in property store
function makeNewKeys () {

  const sf = cSheetEfx.SheetEfx;
  const keys = sf.generateKeys (PropertiesService.getScriptProperties().getProperty("efx_bosskey"));
  // now write these somewhere that corresponds with the fetchkeys place
  PropertiesService.getScriptProperties().setProperty ("sf_efx_keys" , JSON.stringify(keys));

}



