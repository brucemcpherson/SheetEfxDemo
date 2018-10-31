
/**
* basic rough driver for effex api
* @namespace EffexApiClient
* v2.3.2
*/
var EffexApiClient =  (function (ns) {
  

  var FB = 'https://efxapi.com/v2';
  var PROD = 'https://effex-fb.firebaseapp.com/v2';
  var DEBUG = FB;
  var DEV = FB;
  
  // generate a unique number for the session id
  var session = Math.round(Math.random() * 2048).toString(32) + new Date().getTime().toString(32);
  var pushId = session;
  var promiseMode = false;
  var nodeMode = false;

  /**
   * set to return promises in the same places as the node and javascript client versions
   * @param {boolean} usePromises whether to return results as promises
   * @return {object} self
   */
  ns.setPromiseMode = function (usePromises) {
    promiseMode = usePromises;
    return ns;
  };
  
  /**
   * set to return nodeMode data versions
   * @param {boolean} useNodeMode whether to return results in similar format to the node client (this means results.data.ok rather than just result.ok
   * @return {object} self
   */
  ns.setNodeMode = function (useNodeMode) {
    nodeMode = useNodeMode;
    return ns;
  };
  
   /**
   * check a thing is a promise and make it so if not
   * @param {*} thing the thing
   * @param {Promise}
   */
  ns.promify = function(thing) {

    // is it already a promise
    var isPromise = !!thing &&
      (typeof thing === 'object' || typeof thing === 'function') &&
      typeof thing.then === 'function';

    // is is a function
    var isFunction = !isPromise && !!thing && typeof thing === 'function';

    // create a promise of it .. will also make a promise out of a value
    return Promise.resolve(isFunction ? thing() : thing);
  };
  
  
  /**
  * gets the session name
  * this is a unique number assigned to this session
  * its main use is to see whether items returned by push modifications were chnged by this session or another
  * @return {string} the session if
  */
  ns.getSession = function() {
    return session;
  };      
  /**
  * allows setting of a custom session name
  * not normally required
  * @param {string} sessionName the name to give this session
  * @return {object} self
  */
  ns.setSession = function(sessionName) {
    session = sessionName;
    return ns;
  };
  
  /**
   * convert result to differnt kind of modes if required
   * @param {*} result
   * @param {error} error whether it failed
   * @return {Promise|*}
   */
  ns.wrapResult = function (result, error) {
    
    // this contains a data property
    if (nodeMode) {
      result = {data:result};
    }
   
    
    // see if promise is required
    if (promiseMode) {
     
      return new Promise (function (resolve, reject) {
        if (error) {
          reject (error);
        }
        else {
          resolve (result);
        }
      })
    }
    else {
      return result;
    }
  };
        
  // the api base url
  function gasAxios () {
    var self = this;
    
    self.create= function (options) {
      self.options = options;
      return self;
    };
    
    self.get = function (url) {
      return self.exec (url);
    };
    
    self.remove = function (url) {
      return self.exec(url,"delete" );
    };
    
    self.post = function (url,payload) {
      return self.exec(url,"post" , payload);
    };
    
    self.exec = function (url , method , payload) {
      
      // all interactions are from here
      var u = self.options.baseURL + url;
      var options = {
        method:(method || "get").toUpperCase(),
        muteHttpExceptions:true
      };
      
      // if there's a payload it will always be JSON
      if (payload) {
        options.payload = JSON.stringify(payload);
        options.contentType = "application/JSON";
      }
      var error = "";
      
      // do the fetch
      var response = UrlFetchApp.fetch (u, options);
      
      // verbose means to log the url
      if (self.options.verbose) {
        Logger.log(options.method + ":" + u);
      }
      
      // do the parse, and fail over if its garbled
      var ob;
      try {
        ob = JSON.parse (response.getContentText());
      }
      catch(err) {
        error = err;
        ob = {
          ok:false,
          content:response.getContentText()
        }
      }
      
      // finally add a message about failure if needed
      if (Math.floor(response.getResponseCode() /100) !== 2) {
        ob.code = response.getResponseCode;
        ob.content = response.getContentText();
        ob.ok = false;
      }
      return ns.wrapResult (ob , error);
    }
    
  };
  
  function clone (ob) {
    return JSON.parse(JSON.stringify(ob || {}));
  }
  
  var ax = new gasAxios()
  .create ({
    baseURL:PROD,
    verbose:false
  });
  var keys = {};
  
  ns.setKeys = function (pkeys){
    keys = pkeys;
    return ns;
  };
  
  ns.getKeys = function () {
    return keys;
  };  
  
  ns.setDev = function () {
    return ns.setBase (DEV);
  };
  
  ns.setProd = function () {
    // fb is now prod
    return ns.setBase (PROD);
  };
  
  ns.setDebug = function () {
    return ns.setBase (DEBUG);
  };
  
   ns.setFb = function () {
    return ns.setBase (FB);
  };
  
  ns.setVerbose = function (verbose) {
    ax.options.verbose = verbose;
    return ns;
  };
  
  ns.setBase = function (base) {
    ax.options.baseURL = base;
    return ns;
  };
  
  function clone (ob) {
    return JSON.parse(JSON.stringify(ob || {}));
  }
  
  /**
  * make a set of keys that can be stored to props service
  * @param {string} boss the boss key to use
  * @param {object|null} [params] any params to pass on to the API
  * @return {object} containg {keySet:{}, results:{}}
  */
  ns.makeKeys = function (boss,params) {
    
    // special treatment for promise and node mode - turn them off for a bit
    var p = promiseMode;
    var n = nodeMode;
    promiseMode = false;
    nodeMode= false;
    try {
      var r = ns.setKeys(['writer','reader','updater']
                        .reduce (function (p,c) {
                          var result = ns.generateKey (boss, c, params);
                          if (!result.ok) throw 'failed to generate key ' + JSON.stringify(result);
                          p[c] = result.keys[0];
              
                          return p;
                        },{}))
      promiseMode = p;
      nodeMode = n;
      return ns.wrapResult (r.getKeys());
    }
    catch (err) {
      promiseMode = p;
      nodeMode = n;
      throw err;
    }
    
  };
  
  /**
  * turns a params object into a url
  * @param {object} params the params
  * @return {string} the uri
  */
  function makeParams(params) {
    params = params || {};
    var pa = Object.keys(params).reduce(function(p, c) {
      p.push(c + "=" + encodeURIComponent(params[c]));
      return p;
    }, []);
    
    return pa.length ? ("?" + pa.join("&")) : "";
  }
  
  ns.checkKeys = function (preview) {
    if (!Array.isArray(preview)) preview = [preview];
    return preview.every(function(d){ return keys[d]});
  };
  
  /**
  * @param {string} boss the boss key
  * @param {string} mode the type like writer/reader/updater
  * @param {object} params the params 
  * @return {Promise} to the result
  */
  ns.generateKey = function (boss, mode,params) {
    return ax.get ('/generate/' + boss  + '/' + mode + makeParams(params));
  };
  
  /**
  * ping the service
  * @return {object} "PONG"
  */
  ns.ping = function() {
    return ax.get('/ping');
  };
  
  /**
  * info the service
  * @return {object} result
  */
  ns.info = function() {
    return ax.get('/info');
  };
  
  /**
  * get quotas 
  * @return {object} the quotas
  */
  ns.getQuotas = function() {
    return ax.get('/quotas');
  };
  
  /**
  * update an item
  * @param {string} id the item id
  * @param {string} updater the updater key
  * @param {object} data what to write
  * @param {string} method the to use (post,get)
  * @param {object} params the params 
  * @return {Promise} to the result
  */
  ns.update = function (data, id, updater, method  , params) {
    method = (method || "post").toLowerCase();
    params = params || {};
    
    if (method === "get") {
      params = clone(params);
      params.data = JSON.stringify(data);
    }
    var url = "/updater/" + ns.checkKey("updater",updater) + "/" + ns.checkKey("item",id) + makeParams(params);
    return ax[method] (url, {data:data}); 
  };
  
  /**
  * @param {string} writer the writer key
  * @param {object} data what to write
  * @param {string} method the to use (post,get)
  * @param {object} params the params 
  * @return {Promise} to the result
  */
  ns.write = function (data, writer, method  , params) {
   
    method = (method || "post").toLowerCase();
    params = params || {};
    
    if (method === "get") {
      params = clone(params);
      params.data = JSON.stringify(data);
    }
    var url = "/writer/" + ns.checkKey("writer",writer)  + makeParams(params);
    return ax[method] (url, {data:data}); 
  };
  
  /**
  * @param {string} writer the writer key
  * @param {string} alias the alias 
  * @param {object} data what to write
  * @param {string} method the to use (post,get)
  * @param {object} params the params 
  * @return {Promise} to the result
  */
  ns.writeAlias = function (data, alias, writer, method  , params) {
    method = (method || "post").toLowerCase();
    params = params || {};
    if (!alias) throw 'alias required';
    
    if (method === "get") {
      params = clone(params);
      params.data = JSON.stringify(data);
    }
    var url = "/writer/" + ns.checkKey("writer",writer) +"/alias/" + alias + makeParams(params);
    return ax[method] (url, {data:data}); 
  };
  
  ns.checkKey = function (type, value) {
    var k=  value || keys[type];
    if (!k) console.log ("failed key check", type, value);
    return k;
  };
  
  
  /**
  * @param {string} id the item id
  * @param {string} writer the writer key
  * @param {object} params the params 
  * @return {Promise} to the result
  */
  ns.remove = function (id, writer  , params) {
    return ax.remove ('/writer/' + ns.checkKey("writer",writer) + '/' +  ns.checkKey("item",id) + makeParams(params));
  };
  
  /**
   * @param {string} id the item id
   * @param {string} updater the access key id
   * @param {string} intent the intent id
   * @param {object} params the params 
   * @return {Promise} to the result
   */
  ns.release = function(id, updater , intent, params) {
    params = params || {};
    return ax.remove('/release/' + 
      ns.checkKey("item",id) + '/' + 
      ns.checkKey("updater",updater) + '/' +  
      intent + 
      makeParams(params));
  };
  
  /**
  * @param {string} id the item id
  * @param {string} reader the reader key
  * @param {object} params the params 
  * @return {Promise} to the result
  */
  function read_ (id, reader, params) {
    params = params || {};
    id = id || keys.item;
    reader = reader || keys.reader;
    return ax.get('/reader/' + ns.checkKey("reader",reader) + '/' + ns.checkKey("item",id) + makeParams(params));
  }
  
  /**
  * @param {string} id the item id
  * @param {string} reader the reader key
  * @param {object} params the params 
  * @return {Promise} to the result
  */
  ns.read = function (id, reader, params) {
    params = params || {};
    
    // we'll use backoff in case there's an intent that needs looking at
    return ns.expBackoff(
      
      // read an item and decalre an intention to update
      function () { return read_(id, reader, params); },
      
      // function for checking if we want to do a retry, because we got a lock 
      function (lastResult) { return params.backoff &&  lastResult.code === 423 || (lastResult.data && lastResult.data.code === 423); }, {
        
        // we have a custom wait time to leverage info about lock lifetime
        setWaitTime: function (waitTime, passes, result, proposed) {
          return Math.min(proposed, ((result && result.intentExpires) || 0) * 1000);
        }
        
      });
  };
  
     /**
   * expbackoff
   * @param {function | Promise} action what to do 
   * @param {function} doRetry whether to retry
   * @param {object} [options]
   * @param {number} [options.maxPasses=5] how many times to try
   * @param {number} [options.waitTime=500] how long to wait on failure
   * @param {number} [options.passes=0] how many times we've gone
   * @param {function} [options.setWaitTime=function(waitTime, passes,result,proposed) { ... return exptime.. }]
   * @return {Promise} when its all over
   */
  ns.expBackoff= function(action, doRetry, options)  {
    return promiseMode ? ns.expBackoffPromise (action, doRetry , options) : ns.expBackoffPlain (action, doRetry , options);
  }
  
   /**
   * expbackoff
   * @param {function | Promise} action what to do 
   * @param {function} doRetry whether to retry
   * @param {object} [options]
   * @param {number} [options.maxPasses=5] how many times to try
   * @param {number} [options.waitTime=500] how long to wait on failure
   * @param {number} [options.passes=0] how many times we've gone
   * @param {function} [options.setWaitTime=function(waitTime, passes,result,proposed) { ... return exptime.. }]
   * @return {Promise} when its all over
   */
  ns.expBackoffPromise = function(action, doRetry, options) {

    options = options || {};


    // this is the default waittime
    function defaultWaitTime (waitTime, passes, result) {
      return Math.pow(2, passes) * waitTime + Math.round(Math.random() * 73);
    }

    // default calculation can be bypassed with a custom function
    var setWaitTime =  function(waitTime, passes, result ,proposed) {
      return options.setWaitTime ? options.setWaitTime (waitTime, passes, result,proposed) : 0;
    };
    
    // the defaults
    var waitTime = options.waitTime || 500;
    var passes = options.passes || 0;
    var maxPasses = options.maxPasses || 6;

    // keep most recent result here
    var lastResult;

    // the result will actually be a promise
    // resolves, or rejects if there's an uncaught failure or we run out of attempts
    return new Promise(function(resolve, reject) {

      // start
      worker(waitTime);

      // recursive 
      function worker(expTime) {

        // give up
        if (passes >= maxPasses) {

          // reject with last known result
          reject(lastResult);
        }
        // we still have some remaining attempts

        else {

          // call the action with the previous result as argument
          // turning it into a promise.resolve will handle both functions and promises
          ns.promify(action)
            .then(function(result) {
              // store what happened for later
              lastResult = result;
              
              // pass the result to the retry checker and wait a bit and go again if required
              if (doRetry(lastResult, passes++)) {
                return ns.handyTimer(expTime)
                  .then(function() {
                    var proposedWaitTime = defaultWaitTime(waitTime , passes , result );
                    worker(setWaitTime(waitTime, passes, lastResult,proposedWaitTime) || proposedWaitTime);
                  });
              }
              else {
                // finally
                resolve(lastResult);
              }
            });

        }
      }

    });
  };
  /**
  * expbackoff
  * @param {function | Promise} action what to do 
  * @param {function} doRetry whether to retry
  * @param {object} [options]
  * @param {number} [options.maxPasses=5] how many times to try
  * @param {number} [options.waitTime=500] how long to wait on failure
  * @param {number} [options.passes=0] how many times we've gone
  * @param {function} [options.setWaitTime=function(waitTime, passes,result,proposed) { ... return exptime.. }]
  * @return {Promise} when its all over
  */
  ns.expBackoffPlain = function(action, doRetry, options) {
    
    options = options || {};
    
    // this is the default waittime
    function defaultWaitTime (waitTime, passes, result) {
      return Math.pow(2, passes) * waitTime + Math.round(Math.random() * 73);
    }
    
    // default calculation can be bypassed with a custom function
    var setWaitTime =  function(waitTime, passes, result ,proposed) {
      return options.setWaitTime ? options.setWaitTime (waitTime, passes, result,proposed) : 0;
    };
    
    // the defaults
    var waitTime = options.waitTime || 500;
    var passes = options.passes || 0;
    var maxPasses = options.maxPasses || 6;
    
    // keep most recent result here
    var lastResult;

    // start
    worker(waitTime);
    
    // this will contain the result of the last action to happen
    return lastResult;

    
    // recursive 
    function worker(expTime) {
      
      // give up
      if (passes >= maxPasses) {
        // reject with last known result
        return lastResult;
      }
      
      // we still have some remaining attempts
      else {
        
        // call the action with the previous result as argument
        // turning it into a promise.resolve will handle both functions and promises
        var result = action ();
        
        // store what happened for later
        lastResult = result;
        
        // pass the result to the retry checker and wait a bit and go again if required
        if (doRetry(lastResult, passes++)) {
          Utilities.sleep (expTime);
          var proposedWaitTime = defaultWaitTime(waitTime , passes , result );
          worker(setWaitTime(waitTime, passes, lastResult,proposedWaitTime) || proposedWaitTime);
        }
        else {
          // finally
          return lastResult;
        }
      }
    }
  };
  
  /**
  * this handy timer is ported from js, and to keep the syntax intent pretends its a promise, but actually its blocking
  * as settimeout doesnt happen in GAS
  *
  * a handly timer
  * @param {*} [packet] something to pass through when time is up
  * @param {number} ms number of milliseconds to wait
  * @return {Promise} when over
  */
  ns.handyTimer = function(ms, packet) {
    
    // wait some time then resolve
    Utilities.sleep (ms);
    
    return {
      then: function () {
        return packet;
      }
    };
  };    
  
  
  /**
  * @param {string} coupon the coupon code
  * @return {Promise} to the result
  */
  ns.validateKey = function (coupon) {
    return ax.get ('/validate/' + coupon);
  };
  
  /**
  * @param {string} id the item id
  * @param {string} writer the writer key
  * @param {string} key the key to assign the alias for
  * @param {string} alias the alias to assign
  * @param {object} params the params 
  * @return {Promise} to the result
  */
  ns.registerAlias = function (writer, key, id , alias, params) {
    return ax.get('/'+ ns.checkKey("writer",writer) + '/' + key + 
      '/alias/' + encodeURIComponent(alias) + '/' + ns.checkKey("item",id) + makeParams(params));
  };
  
  
  
  return ns;
})({});



