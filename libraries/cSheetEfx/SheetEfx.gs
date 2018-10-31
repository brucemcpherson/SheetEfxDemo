var SheetEfx = (function (ns) {


  ns.settings = {
    itemSeconds:15 * 60
  };
  
  /**
   * construct an item alias
   * @return {string} the alias to use
   */
  ns.getItemAlias = function () {
    return "sfEfx_" + ns.getSSId(); 
  };
  
  /**
   * get spreadsheet id
   * @return {string} spreadsheet id
   */
  ns.getSSId = function () {
    // get the spreadsheet id- we'll be using this as an alias
    const sid = ns.fetchKeys && ns.fetchKeys.getId && ns.fetchKeys.getId();
    if (!sid) throw 'need spreadsheet id';
    return sid;
  };
  
  /**
   * get a handle, and set a shosrtcut & emulate node api
   * @return {object} efx
   */
  ns.getHandle = function () { 
    return cEffexApiClient.EffexApiClient.setNodeMode(true);
  };
  
  /**
   * generate some once off keys given a boss
   * @param {string} boss
   * @return {object} some keys to write to prop store
   */
  ns.generateKeys = function (boss, params) {
    const efx = ns.getHandle();
    const result = efx.makeKeys (boss);
    return result.data;
  };
  
  /**
   * assume the boss key is already in the script propertystore
   * @param {object} options
     * @param {string} boss a bosskey
     * @param {object} store a property or cache store
     * @param (boolean} clear existing keys
   */
  ns.init = function (options) {
  
    const efx = ns.getHandle();
    ns.fetchKeys = options.fetchKeys;

    if (typeof ns.fetchKeys !== "object") throw "supply a fetchKeys object";
    const methods = ["getAccessKeys" , "getId"];
    if (!methods.every (function (d) {
      return typeof ns.fetchKeys[d] ==="function";
    })) throw "supply a fetchKeys object with these methods " + methods.join(",");
    

    // this is how long an item lasts
    ns.itemSeconds = options.itemSeconds || ns.settings.itemSeconds;

    // lets get the keys we'll need
    const s = ns.fetchKeys.getAccessKeys();
    if (!s) throw 'didnt find any access keys';
    
    // make into an ob
    var keys = JSON.parse (s);
    keys.alias = ns.getItemAlias ();
    // for convenience
    efx.setKeys(keys); ;

    return ns;
    
  };
  
  
  /**
   * check prep has been done
   * @return {object} the keys
   */
  ns.checkInit = function () {
    const efx = ns.getHandle();
    if (!efx.getKeys()) throw 'keys not set up';
    return efx.getKeys();
  };
  
  /**
   * check prep for item has been done
   * @return {objects} the  keys object
   */
  ns.checkInitItem = function () {

     // check prep is done
     const keys = ns.checkInit();

     // make sure we have an item
     if (!keys.alias) throw 'first write an item';
     return keys;
    
  };
  
  /**
   * fire a notification
   * @param {object|null} [data] any data to be written on initialwrite
   * @return {object} efx.data result
   */
   ns.create = function (data) {
   
     const efx = ns.getHandle();
     
     // make sure been init()
     const keys = ns.checkInit();

     // write the new item and allow known keys to read/update
     var result = efx.writeAlias ( { 
       content: data 
     } , keys.alias , keys.writer , "POST" , { 
       updaters:[keys.updater], 
       readers:[keys.reader, keys.updater],
       lifetime:ns.itemSeconds
     });
     
     return result.data;

   };
   
   /**
    * update 
    * @param {object|null} [data] any data to be written on update
    * @return {object} efx.data result
   */
   ns.update = function (data) {
   
     const efx = ns.getHandle();

     // make sure been init()
     const keys = ns.checkInitItem();
     
     // write the updated item
     var result = efx.update ( { 
       content: data 
     },keys.alias);

     return result.data;

   };
   
  /**
    * read 
    * @param {string} [id] otherwise use the default one
    * @return {object} efx.data result
   */
   ns.read = function (id) {
   
     const efx = ns.getHandle();
     // make sure been init()
     const keys = ns.checkInitItem(id);
     
     // write the updated item
     var result = efx.read (keys.alias);

     return result.data;

   };
   
   //--utilities for dealing with common kinds of data
  
  /*
  * digest
  * @param {[*]} arguments unspecified number and type of args
  * @return {string} a digest of the arguments to use as a key
  */
  ns.digest = function () {
    
    // convert args to an array and digest them
    return  Utilities.base64EncodeWebSafe (
      Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_1,Array.prototype.slice.call(arguments).map(function (d) {
        return (Object(d) === d) ? JSON.stringify(d) : d.toString();
      }).join("-"),Utilities.Charset.UTF_8));
  };
  
  /*
  * onchange event packags
  * @param {object} event an onChange event from a sheet
  * @param {string} valueType to check
  * @param {object} alt alternative values for sheet and range
  * @return {object} a package describing the event
  */
  ns.ssChangePack = function (event,valueType) {
  
    valueType = valueType || "getValues";
    const ss = event.source;

    
    // this describes the event and the current status.
    // activeSheet.digest can be checked to see if the data on the sheet has changed
    const s = ns.findRange (ss.getId() , event.sheetId , event.a1Range, ss);
    const ar = s.range;
    const dr = s.sheet.getDataRange();
    
    const pack = {
    
      activeSheet:{
        name:s.sheet.getName(),
        sheetId:s.sheet.getSheetId(),
        activeRange:mad(ar),
        dataRange:mad(dr),
        digest:ns.digest(dr[valueType]())
      },
    
      spreadsheet: {
        id:s.ss.getId(),
        sheets: ss.getSheets().map(function(d) { return{ name:d.getName() , sheetId:d.getSheetId()}})
      },
      
      changeType: event.changeType
  
    };
    
    // now an overall digest that can be used to see if anything has changed at all
    pack.packDigest = ns.digest (pack);
    return pack;
    
    function mad (range) {
    
      return {
        a1:range.getA1Notation(),
        startRowIndex:range.getRow(),
        startColumnIndex:range.getColumn(),
        numOfRows:range.getNumRows(),
        numOfColumns:range.getNumColumns()
      };
      
    }
   
    
  }
  
  ns.findSheet = function ( ssId , sheetId, sap) {
    const ss =  sap.getActiveSpreadsheet ? sap.getActiveSpreadsheet() : sap;  
    if (ssId && ssId !== ss.getId()) throw 'this is not the spreadsheet ' + ss.getId() + ' you are looking for ' + ssId;
    
    const sheet = sheetId ? 
      ss.getSheets()
      .filter(function (d) {
        // have to convert to string as
        // it will come over from a select as a string
        return d.getSheetId().toString() === sheetId.toString();
      })[0] : 
      ss.getActiveSheet();
    
    if (!sheet) throw 'sheet id ' + sheetId + ' not found in ' + ssId;
    return {
      ss:ss,
      sheet:sheet
    };
  }
  
  ns.findRange = function ( ssId , sheetId , a1Range, sap) {
    const s = ns.findSheet (ssId, sheetId, sap);
    s.range = a1Range ? s.sheet.getRange (a1Range) : s.sheet.getActiveRange();
    return s;
  }
  
  return ns;
}) ({});
