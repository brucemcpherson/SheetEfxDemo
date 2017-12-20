
var Render = (function(ns) {
  
  ns.state = {
    heatRange: ["#f1f8e9", "#8bc34a"],
    distortion: 2.5,
    radius: 200,
    margin: 10,
    unheat:"#ffffff",
    textColor:"#212121",
    lightTextColor:"#ffffff",
    borderColor:"#fafafa",
    borderWidth:1,
    a1Fill:"#FF5252",
    activeBorderColor:"#3F51B5",
    activeBorderWidth:2,
    scrollerActiveFill:"#0000ff",
    scrollerPassiveFill:"#8bc34a",
    clickFill:'#FF5252',
    scroll: {
      maxc:6,    // max colums to show in a grid
      maxr:20,    // max rows to show in a grid
      size:1.2,   // how much of margin to take up
      scale:2.5    // how much toscale up by on focus
    }
  };
  
  /**
   * update the heat maps
   * @param {[][]} [values] normally already provided
   */
  ns.updateHeat = function(sheetId,values) {
    // initialize if required
    ns.init();

    // make a place
    const h = (ns.state.gridHeat = ns.state.gridHeat || {});

    // accumulate the data
    if (!values) {
      ns.accumulateHeat(sheetId);
    } else {
      //this is for testing
      // as values will  not normally be specified
      h.values = values.map(function(row, ri) {
        return row.map(function(cell, ci) {
          return {
            oc: ci,
            or: ri,
            value: cell
          };
        });
      });
      h.sheetValues = values;
    }

    // redim everything for new data set
    ns.prepareHeat();

    // render it
    return ns.drawHeat();
  };

  /**
   * redim everything for a new dataset
   */
  ns.prepareHeat = function() {
    const h = ns.state.gridHeat;
    h.box = null;
    const values = ns.state.gridHeat.values;
    
    // flatten the data
    const sv = ns.state.gridHeat.sheetValues;
    h.flat = values.reduce (function (p,c) {
      c.forEach (function (d) {
        // attach the sheet values
        d.sheetValue = d.or < sv.length && d.oc < sv[d.or].length ? sv[d.or][d.oc] : "";
        p.push(d);
      });
      return p;
    },[]);

    // setthe color domains
    const extent = d3.extent (h.flat, function (d) {
      return d.value;  
    });

    // heatscale calculator
    h.hs = d3.scaleLinear()
      .domain(extent)
      .range(ns.state.heatRange);
    
    return ns;
  };

  /**
   *sets the active rc
   */
  ns.setActiverc = function (rc) {
    const h = ns.state.gridHeat;
    h.activerc = rc;
    ns.drawHeat();
    return ns;
  };
  /**
   * render it
   */
  ns.drawHeat = function() {
    
    const state = ns.state;
    const h = state.gridHeat;
    const scroll = h.scroll;
    
    // filter the flattened data to hold only max permissibile visible
    h.vizData = h.flat.filter (function (d) {
      return d.oc < scroll.oc + state.scroll.maxc && d.oc >= scroll.oc && 
        d.or < scroll.or + state.scroll.maxr && d.or >= scroll.or;
    });
    
    // the extent of the rows/cols
    const colExtent = d3.extent (h.vizData , function (d) {
      return d.oc;
    });
    const rowExtent = d3.extent (h.vizData , function (d) {
      return d.or;
    });
    
    // dim of each item
    h.idim = {
      width:(h.width - 2 * state.margin)/ (colExtent[1] - colExtent[0] + 1),
      height: (h.height - 2 * state.margin) / (rowExtent[1] - rowExtent[0] + 1)
    };

    // build the width and height & x & y into data - will be useful when appending text
    // row /col = the effective row/col as per the viz
    // or/oc = the actual row/col in the data
    // scroll.or/oc
    h.vizData.forEach(function(d,i) {
      d.row = d.or - scroll.or;
      d.col = d.oc - scroll.oc;
      d.ox = d.col * h.idim.width + state.margin;
      d.oy = d.row * h.idim.height + state.margin;
      d.ow = h.idim.width;
      d.oh = h.idim.height;
      
      // now play with the actual co-ords with fish eye bias
      // vanilla co-ords
      const co = {
        x: d.ox,
        y: d.oy,
        scale: 1
      };
      
      // recalcl if fisheye
      const fc = h.box ? h.fish(co) : co;

      // now apply the fished values
      d.x = fc.x;
      d.y = fc.y;
      d.scale = fc.scale;
      
      // scale up the width/height
      d.width = d.ow * d.scale;
      d.height = d.oh * d.scale;
      
      // heat ramp
      d.fill = filler(d);
    });

    // update the scrollers
    h.scrollPoint.attr ("r",function (d) { return d.or * d.scale;})
      .style ("fill",state.scrollerActiveFill);
    
    h.scrollText.text (function (d) {
        // in focus - show the row/ column depending on which point is selected
        if (d.name === "top") return 1+d3.min ( h.vizData , function (e) { return e.or ;} );
        if (d.name === "bottom") return 1+d3.max ( h.vizData , function (e) { return e.or ;} ); 
        if (d.name === "left") return ns.columnLabelMaker(1+d3.min ( h.vizData , function (e) { return e.oc ;} ));
        if (d.name === "right") return ns.columnLabelMaker(1+d3.max ( h.vizData , function (e) { return e.oc ;} )); 
        console.error ("failed to find scrollpoint", d);
      })
      .style ("font-size", function (d) {
        return d.scale * d.or;
      });
      
    
    // select all the cells
    const boxes = h.selection
      .selectAll(".heatgroup")
      .data(h.vizData);
    
    boxes.exit().remove();
    
    // create new entries
    const genter = boxes.enter()
      .append("g")
      .attr("class", "heatgroup");

   
    // create new items
    genter.append("rect").attr("class", "heatbox");
    genter.append("text").attr("class", "heattext");
    genter.append("circle").attr("class", "heatcircle");
    genter.append("text").attr("class", "heata1");
    
    // merge all that
    const enter = genter
    .merge (boxes)
      .classed ("hbox", function (d) {
        return ishbox(d);
      });
    // and text
    enter.select(".heattext")
      .text(function(d) { return d.sheetValue })
      .style("fill", state.textColor)
      .style("font-size", function(d) { 
        d.textLength = this.getComputedTextLength();
        return d.height / 3 + "px"; 
        
      })
      .attr("x", function(d, i) { return d.x; })
      .attr("y", function(d, i) { return d.y; })
      .attr("dx", function(d) { return ".5em"; })
      .attr("dy", function(d) { return "2em"; });
    
    enter.select (".heatbox")
      .attr("x", function (d) { return d.x; })
      .attr("y", function (d) { return d.y; })
      .attr("width", function (d) { 
        return ishbox(d) ? Math.max(d.width, d.textLength) : d.width; 
       })
      .attr("height", function (d) { return d.height; }) 
      .style("stroke", function (d) { 
        return isharc (d) ? state.activeBorderColor : state.borderColor; 
      })
      .style("stroke-width", function (d) { 
        return isharc (d) ? state.activeBorderWidth : state.borderWidth; 
      })
      .style("opacity", function (d) {
        return ishbox(d) ? 1 : 1; // .8
      })
      .style("fill", function(d) { return  d.clicked ? state.clickFill : filler(d); });
      
   

    
    // and circles
    enter.select(".heatcircle")
      .attr ("r",function (d) {
        return ishbox(d) ? d.height/3 : 0;
      })
      .attr ("cx", function (d) { return !d.col ? d.width : d.x; })
      .attr ("cy", function (d) { return !d.row ? d.height : d.y; })
      .style ("fill",state.a1Fill)
      .style ("opacity", .7);
    
    // and text in the circles
    enter.select(".heata1")
      .attr ("x", function (d) { return !d.col ? d.width : d.x; })
      .attr ("y", function (d) { return !d.row ? d.height : d.y; })
      .style("text-anchor","middle")
      .text(function (d) {
        return ishbox(d) ?  ns.columnLabelMaker(d.oc+1) + (d.or+1) : '';
      })
      .style ("fill",state.lightTextColor)
      .style("font-size", function(d) { return d.height / 3 + "px";  })
      .attr("dy", "0.3em")
      .style ("opacity", .7);

    
    // sort everything
    enter.sort (function (a,b) {
      // we want the one with the biggest
      // scale to be last plotted and therefore on top
      // this will take care of ordering the 
      // fisheyed items properly

      // always on top 
      if (ishbox(a)) return 1;

      if (a.scale === b.scale) {
        // this'll be the normal case so do it in the natural order
        return a.row === b.row ? a.col - b.col : a.row - b.row;
      }
      else {
        return a.scale - b.scale;      
      }
    });
    
    return ns;
    
    
  };

  ns.init = function() {
  
    if (!ns.state.gridHeat) {
      const state= ns.state;    
      const h = (ns.state.gridHeat = {});
      h.div = d3.select("#grid-heat");
      h.panel = d3.select('#heat-panel');
      h.dims = h.div.node().getBoundingClientRect();
      h.height = h.dims.height;
      h.width = h.dims.width;

      // setup svg elem for grid
      h.frame = h.div
        .append("svg")
          .attr("width", h.width)
          .attr("height", h.height)
        .append("g")
          .attr("width", h.width)
          .attr("height", h.height)
          .attr("transform", "translate(" + 0 + "," + 0 + ")");

      
      // this group is the grid rects
      h.selection = h.frame.append("g");
      
      // the group is the scroll section
      h.scrollSelection = h.frame.append ("g");
      
      // scroll points
      h.scroll = h.scroll || {
        or:0,
        oc:0
      };
      const r = state.margin * state.scroll.size;
      
      h.scroller = h.scrollSelection.selectAll(".heatboxscroller")
        .data ([{
          name:"top",
          ox:h.width/2,
          oy:0,
          or:r,
          scale:1,
          ta:"middle",
          ab:"hanging",
          sc:0,
          sr:-1
        }, {
          name:"bottom",
          ox:h.width/2,
          oy:h.height,
          or:r,
          scale:1,
          ta:"middle",
          ab:"ideographic",
          sc:0,
          sr:1
        }, {
          name:"left",
          ox:0,
          oy:h.height/2,
          or:r,
          scale:1,
          ta:"start",
          ab:"middle",
          sc: -1 ,
          sr:0
        }, {
          name:"right",   // which scroll point
          ox:h.width,     // where to put it
          oy:h.height/2,  // ...
          or:r,           // normal radius
          scale:1,        // will scale up when on
          ta:"end",       // text horiz align
          ab:"middle",    // text vertical al
          sc : 1,         // increment col by this amount
          sr : 0          // incrment row by this anount
        }
      ])
      .enter ()
        .append ("g")
          .attr("class", "heatboxscroller")
          .on ("click", function (d) {
         
            // a scroll is required
            h.box = null;
            const colExtent = d3.extent (h.flat, function (d){ return d.oc; });
            const rowExtent = d3.extent (h.flat, function (d){ return d.or; });
            const vizColExtent = d3.extent (h.vizData, function (d){ return d.oc; });
            const vizRowExtent = d3.extent (h.vizData, function (d){ return d.or; });
        
            if (vizColExtent[1] + d.sc <= colExtent[1] && vizColExtent[0] + d.sc >= colExtent[0]) {
              h.scroll.oc += d.sc;
            }
               
            if (vizRowExtent[1] + d.sr <= rowExtent[1] && vizRowExtent[0] + d.sr >= rowExtent[0]) {
              h.scroll.or += d.sr;
            }
           
            ns.drawHeat();

           })
          .on ("mouseover",function (d) {
            d.scale = state.scroll.scale;
            h.box = null;
            h.scrolling = d;
            ns.drawHeat();
          })
          .on ("mouseout", function (d) {
            d.scale = 1;
            h.scrolling = null;
            ns.drawHeat();
          });
      
      h.scrollPoint = h.scroller.append ("circle")
      .attr ("cx", function (d) { return d.ox ; })
      .attr ("cy", function (d) { return d.oy ; });
      
      h.scrollText = h.scroller.append ("text")
        .style("text-anchor",function (d) {
          return d.ta;
        })
        .attr("alignment-baseline", function (d) {
          return d.ab;
        })
        .attr ("x", function (d) { return d.ox;})
        .attr ("y", function (d) { return d.oy;})
        .style ("fill",state.lightTextColor);
      
      // click doesnt work properly, so using mousedown
      // this means to set the sheet to the current cell
      h.frame.on("mousedown", function(d) {
        // dont bother with this if we are scrolling just now
        const mousey = whereMouse (d3.mouse(this));
        if (mousey.scrolling) return;
        
        // set any other clicked to false;
        h.vizData.forEach(function(d) {
          d.clicked = false;
        });
        if (mousey.box) {
          
          // mark as clicked, but set a timer to reset it later.
          mousey.box.clicked = true;
          setTimeout (function () {
            mousey.box.clicked = false;
            ns.drawHeat();
          }, 750);
        
          // set this place as the new active place back in the sheets UI
          Client.setRangeFocus (DomUtils.elem ("sheet-select").value, ns.columnLabelMaker (mousey.box.oc+1) + (mousey.box.or+1), true)
          .then (function (r) {
            ns.prepareHeat();
            ns.drawHeat();
          });
        }
        return ns.drawHeat();
        
      });

      // mouse over selects fisheye for that cell
      h.frame.on("mouseover", function(d) {
        // dont bother with this if we are scrolling just now
        const mousey = whereMouse (d3.mouse(this));
        if (mousey.scrolling) return;
       
        // if we've hit the border, deselect current hbox
        if (mousey.margins) {
          h.box = null;
          return ns.drawHeat();
        }
        
        // we've got a box
        h.box = mousey.box;
        h.fishy = fishy(ns.state.distortion,ns.state.radius); 
        h.fish = h.fishy(mousey.mouseAbout);
        return ns.drawHeat();
        
      });

     

      // having big trouble getting mouseleave to fire consistently so try on the div and the panel
      h.div.on("mouseout", function() {
        h.box =  null;
        ns.drawHeat();
      });
      
      h.panel.on("mouseout", function() {
        h.box =  null;
        ns.drawHeat();
      });
      
      
      /**
       * @param {object} mouse the mouse position
       * @return {object} what's happening
       */
      function whereMouse (mouse) {
        // nowhere if scrolling
        if (h.scrolling) {
          return {
            scrolling:true
          };
        }
       
        const m = {
          x: mouse[0],
          y: mouse[1]
        };
        
        // ignore the margins
        if (m.x < h.margin || m.x > h.width - h.margin || m.y < h.margin || m.y > h.height - m.margin){
          return {
            margins:true
          };
        }
        
        //find the active box
        const box = h.vizData.reduce(function(p,cell) {
          if (!p || (cell.x <= m.x && cell.y <= m.y)) {
            p = cell;
          }
          return p;
        }, null);
        
        if (!box) throw "couldnt find mouseover item at " + JSON.stringify(m);
        return {
          box:box,
          mouseAbout:m
        };
        
      }
      
      return ns;
      
    }
  };
  
  
  function ishbox (item) {
    const h = ns.state.gridHeat;
    return h.box && item.or === h.box.or && item.oc === h.box.oc;
  }

  function isharc (item) {
    const h = ns.state.gridHeat;
    return h.activerc && item.or === h.activerc.or && item.oc === h.activerc.oc;
  }
  
  function filler (item) {
    const h = ns.state.gridHeat;
    return item.value ? h.hs(item.value) : ns.state.unheat;
  }
 
  /**
  * https://github.com/chtefi/fisheye (babeled).
  * Create a factory to initialize a fisheye transformation.
  * It returns a function A that take a origin {x, y} that itself, return a
  * function B you can use to iterate through a list of items {x, y}.
  * 
  * The items must have at least 2 properties { x, y }.
  * The function B returns a item with 3 properties { x, y, scale } according tp
  * the given origin and the parameter of the factory (`
  * and `radius`).
  * 
  * @param  {object} origin     {x,y}
  * @param  {number} distortion default: 2
  * @param  {number} radius     default: 200
  * @return {function}          f(origin = {x, y}) => f(item = {x, y})
  */
  function fishy() {
    var distortion = arguments.length <= 0 || arguments[0] === undefined ? 2 : arguments[0];
    var radius = arguments.length <= 1 || arguments[1] === undefined ? 200 : arguments[1];

    var e = Math.exp(distortion);
    var k0 = e / (e - 1) * radius;
    var k1 = distortion / radius;

    return function (origin) {
      return function (item) {
        var dx = item.x - origin.x;
        var dy = item.y - origin.y;
        var distance = Math.sqrt(dx * dx + dy * dy);

        // too far away ? don't apply anything
        if (!distance || distance >= radius) {
          return {
            x: item.x,
            y: item.y,
            scale: distance >= radius ? 1 : 10
          };
        }

        var k = k0 * (1 - Math.exp(-distance * k1)) / distance * 0.75 + 0.25;
        return {
          x: origin.x + dx * k,
          y: origin.y + dy * k,
          scale: Math.min(k, 10)
        };
      };
    };
  }

 /**
 * create a column label for sheet address, starting at 1 = A, 27 = AA etc..
 * @param {number} columnNumber the column number
 * @return {string} the address label 
 */
  ns.columnLabelMaker = function (columnNumber, s) {
    s = String.fromCharCode(((columnNumber - 1) % 26) + 'A'.charCodeAt(0)) + (s || '');
    return columnNumber > 26 ? ns.columnLabelMaker(Math.floor((columnNumber - 1) / 26), s) : s;
  };
  
  /**
   * accumulate on selection
   */
  ns.accumulateHeat = function (sheetId, selectedChanges) {
    
    const source = Client.state.sheets[sheetId.toString()];
    if (!source) throw 'unknown sheet id selected' + sheetId;
    ns.state.gridHeat.sheetValues = source.sheetValues;
    ns.state.gridHeat.values = source.stats.changes.map (function (row,rin) {
      return row.map (function (cell,cin) {
        return Object.keys(cell).reduce (function(p,c){
          if (!selectedChanges || selectedChanges.indexOf (c) !==-1) p.value = p.value + cell[c];
          return p;
        },{value:0,or:rin,oc:cin});
      });
    });
  };
  

  
  return ns;
})({});