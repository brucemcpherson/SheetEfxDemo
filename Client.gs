/**
* manage client side activity
* @namespace Client
*/
var Client = (function(ns) {
  ns.state = {
    sheets: {},
    minGridRows:12,
    minGridColumns:6
  };
  
  ns.init = function() {
    // handle for efx
    ns.state.efx = EffexApiClient;
    spinCursor();

    //first init the server
    return Provoke.run("Server", "init")
      .then(function(keys) {
        resetCursor();
  
        // now we can save those keys for later
        ns.state.efx.setKeys(keys);
       
        // and start watching for changes
        return ns.state.efx.on("update", keys.alias, keys.reader, Client.poked, {
          type: "push"
        });

      })
      ["catch"](function(err) {
        resetCursor();
        App.showNotification("failed to init server", err);
      });
  };

  /**
   * this will set the active range back on the server
   */
  ns.setRangeFocus = function (sheetId, a1Range, follow) {
    const h = ns.state.sheets [sheetId.toString()];

    // set the default range to be the known one
    a1Range = a1Range || h&&h.content.activeSheet.activeRange.a1 || "";
    
    return Provoke.run ("Server" , "makeRangeFocus" , h&&h.content.spreadsheet.id || "", sheetId, a1Range, "getDisplayValues",follow || false)
    .then (function (result) {
      // nothing to do
    })
    ['catch'] (function (err) {
      App.showNotification ("server error setting focus", err);
    })
    
    
  };
  
  /**
   * go to the server and get sheet values
   */
  ns.getSheetValues = function (ssId , sheetId, a1Range, method ) {
  
    const csh = (ns.state.sheets[sheetId.toString()] =
     ns.state.sheets[sheetId.toString()] || {});
     
    csh.promiseSheetValues = Provoke.run(
      "Server",
      "getSheetValues",
      ssId,
      sheetId,
      a1Range,
      method || "getDisplayValues"
    )
    .then(function(result) {
      csh.sheetValues = result;
    })
    ["catch"](function(err) {
      App.showNotification("Error getting sheet data ", err);
    });
    
    return csh.promiseSheetValues;
    
  };
  /**
  * will be called each time theres a change
  * @param {object} poked efxchange object
  */
  ns.poked = function(wid, pack) {
 
    ns.state.poked = pack;
    
    
    // now we can get the latest data- we already have a reader key
    ns.state.efx.read(pack.id).then(function(result) {
      if (!result.data.ok) {
        App.showNotification("failed to get " + pack.id, result.data);
      }

      //latest content
      const content = result.data.value.content;
      ns.state.content = content;
      const cnew = content.activeSheet;

      // record this
      const csh = (ns.state.sheets[cnew.sheetId.toString()] =
        ns.state.sheets[cnew.sheetId.toString()] || {});
      const cold = csh.content && csh.content.activeSheet;

      // if its a an actual change of data then, go get it
      // but we'll do it in parallel to all of that.
      // promise will be resolved with null if there was no change in values
      if (!cold || cnew.digest !== cold.digest) {
        ns.getSheetValues (content.spreadsheet.id , cnew.sheetId, cnew.dataRange.a1);
      }
      else {
        // data hasnt changed
        csh.promiseSheetValues = Promise.resolve(null);
      }

      // move on and start viz while that's happening
      csh.content = content;

      // update counts
      csh.stats = csh.stats || {
        changes: []
      };

      // update the sheet selector
      const cv = DomUtils.elem ('sheet-select').value;
    
      DomUtils.changeOptions (
        'sheet-select' , 
         content.spreadsheet.sheets.map (function (d) { return {text:d.name , value:d.sheetId};}),
         typeof cv === undefined || cv === "" ? content.activeSheet.sheetId : cv );
         
      // make the grid big enough
      const dataRange = content.activeSheet.dataRange;
      adjustGrid(dataRange, csh.stats.changes);

      // next need to accumulate changes
      const activeRange = content.activeSheet.activeRange;
      accumulateChanges(content.changeType, activeRange, csh.stats.changes);

      // update the activity heat map
      csh.promiseSheetValues
        .then(function(result) {
          Render.updateHeat(DomUtils.elem ('sheet-select').value)
          .setActiverc ({
            or:activeRange.startRowIndex -1 ,
            oc:activeRange.startColumnIndex -1
          });
        })
        ["catch"](function(err) {
          App.showNotification("error getting " + pack.id, err);
        });
    });
    /**
    * make the grid big enough for the new data range
    */
    function adjustGrid(dims, grid) {
    
      const targetRows = Math.max (dims.numOfRows ,ns.state.minGridRows );
      const targetColumns = Math.max (dims.numOfColumns ,ns.state.minGridColumns );
      
      // extend no of rows
      while (targetRows > grid.length) grid.push([]);
      
      // extend no of columns
      grid.forEach(function(d) {
        while (targetColumns > d.length) d.push({});
      });

      // but its possible that the grid has shrunk, so we're going to discard previous changes
      if (grid.length > targetRows ) {
        grid = targetRows ? grid.slice (targetRows -1) : [];
      }
      
      return grid.map (function (row){
        return row.length > targetColumns ? row.slice (targetColumns -1) : row;
      })

      return grid;
    }

    /**
    * add observations
    */
    function accumulateChanges(changeType, activeRange, grid) {
      for (
        var i = activeRange.startRowIndex;
        i < activeRange.startRowIndex + activeRange.numOfRows;
        i++
      ) {
        for (
          var j = activeRange.startColumnIndex;
          j < activeRange.startColumnIndex + activeRange.numOfColumns;
          j++
        ) {
          const cell = grid[i - 1][j - 1];
          cell[changeType] = (cell[changeType] || 0) + 1;
          
        }
      }
      return grid;
    }
  };

  function resetCursor() {
    DomUtils.hide("spinner", true);
  }
  function spinCursor() {
    DomUtils.hide("spinner", false);
  }

  return ns;
})(Client || {});
