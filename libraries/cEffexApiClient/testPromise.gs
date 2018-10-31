
function testEfxPromise() {
  
  // set up client 
  var efx = EffexApiClient.setProd().setVerbose(true);
  efx.setPromiseMode (true).setNodeMode (true);
  
  // boss key comes from console /// replace this with your own
  var bossKey ="bx490-tlvauk1-4106o9401c4j";  
  //---reading and writing
  var someData = {name:'xyz',a:[1,2,3],b:2000};
  var otherTextData = 'anything at all';
  
  // now do all that with some text data
  var textData = "some text data";
  var yetAlias = "mickymouse"
  
  // check service is up
  efx.ping().then (function (result) {
    assure ( result.data && result.data.ok ,"ping", result);
   });

  // get some service info
  efx.info().then (function (result) {
    assure ( result.data && result.data.ok ,"info", result);
  });
  
  // check boss key hasnt expired
  efx.validateKey(bossKey).then (function (result) {
    assure ( result.data && result.data.ok ,"validate bosskey", result);
  });
  
  // get 1 writer key expiringin in 5 minutes
  Promise.all ( [ 
    efx.generateKey (bossKey,"writer", {seconds:5*60}), 
    efx.generateKey (bossKey,"reader", {seconds:5*60, count:2}) ,
    efx.generateKey (bossKey,"updater", {seconds:5*60})
    ])
  .then (function (r) {
    var readers = r[1].data;
    var updaters = r[2].data;
    var writers = r[0].data;
    assure ( readers && readers.ok && readers.keys.length === 2 ,"readerkeys", readers);
    assure ( writers && writers.ok && writers.keys.length === 1 ,"writerkeys", writers);
    assure ( updaters && updaters.ok && updaters.keys.length === 1 ,"updaterkeys", updaters);
    efx.setKeys ({
      updater:updaters.keys[0],
      writer:writers.keys[0],
      reader:readers.keys[0]
    });
  })
  .then (function () {
    efx.makeKeys (bossKey , {seconds:5*60})
    .then (function (keys) {
      assure ( keys  ,"makekeys", keys);
    })
  })
  .then (function () {
    return efx.write(someData)
    .then (function (result) {
      assure ( result.data && result.data.ok ,"write-post", result.data);
      return result.data;
    })
  })
  .then (function (data) {
    return efx.read( data.id, efx.getKeys().writer)
    .then (function (r) {
      var result = r.data;
      assure ( result && result.ok && JSON.stringify(result.value) === JSON.stringify(someData) ,"read", result);
      return result;
    })
  })
  .then (function (data) {
    return efx.write( someData, efx.getKeys().writer, "get")
    .then (function (r) {
      var data = r.data;
      assure (  data && data.ok ,"write-get", data);
      return data;
    })
  })
  .then (function (data) {
    return efx.read(  data.id, efx.getKeys().writer, "get")
    .then (function (r) {
      var data = r.data;
      assure (  data && data.ok ,"read-get", data);
      return data;
    })
  })
  .then (function (data) {
    var keys = efx.getKeys();
    return efx.write(someData,keys.writer,"post",{readers:keys.reader,updaters:keys.updater})
    .then (function (r) {
      var data = r.data;
      assure (  data && data.ok ,"write-for-others", data);
      return data;
    })
  })
  .then (function (data) {
    var keys = efx.getKeys();
    return efx.read(data.id)
    .then (function (r) {
      var result = r.data;
      assure (  result && result.ok && JSON.stringify(result.value) === JSON.stringify(someData) ,"read-reader", result);
      return result;
    })
  })
  .then (function (data) {
    var keys = efx.getKeys();
    return efx.read(data.id, keys.updater)
    .then (function (r) {
      var result = r.data;
      assure (  result && result.ok && JSON.stringify(result.value) === JSON.stringify(someData) ,"read-updater", result);
      return result;
    })
  })
  .then (function (data) {
    var keys = efx.getKeys();
    return efx.update (textData , data.id)
    .then (function (r) {
      var result = r.data;
      assure (  result && result.ok ,"update", result);
      return result;
    })
  })
  .then (function (data) {
    var keys = efx.getKeys();
    return efx.read (data.id)
    .then (function (r) {
      var result = r.data;
      assure (result && result.ok && result.value === textData ,"read-updated", result);
      return result;
    })
  })
  .then (function (data) {
    var keys = efx.getKeys();
    return efx.registerAlias( keys.writer, keys.reader, data.id, "somename")
    .then (function (r) {
      var alias = r.data;
      assure (alias && alias.ok ,"alias", result);
      return result;
    })
  })
  .then (function (alias) {
    var keys = efx.getKeys();
    return efx.read( alias.alias)
    .then (function (r) {
      var result = r.data;
      assure (result && result.ok && result.value === textData ,"assign-alias", result);
      return result;
    })
  })
  .then (function (alias) {
    var keys = efx.getKeys();
    return efx.write(someData,keys.writer,"post",{readers:keys.reader,updaters:keys.updater})
    .then (function (r) {
      var otherData = r.data;
      assure (otherData && otherData.ok ,"write-for-others-alias", otherData);
      return otherData;
    })
  })
  .then (function (otherData) {
    var keys = efx.getKeys();
    return efx.registerAlias( keys.writer, keys.reader, otherData.id, "somename")
    .then (function (r) {
      var otherAlias = r.data;
      assure (otherAlias && otherAlias.ok && otherAlias.alias === "somename" ,"other-alias", otherAlias);
      return otherAlias;
    })
  })
return;

 // read it back with a reader key, using the data alias
  var result = efx.read( alias.alias);
  assure ( result && result.ok && JSON.stringify(result.value) === JSON.stringify(someData) ,"read-otheralias", result);
  
  // assign and update alias to an updater key
  var updateAlias = efx.registerAlias( keys.writer, keys.updater, otherData.id, alias.alias);
  assure ( updateAlias && updateAlias.ok && updateAlias.alias === alias.alias ,"updater-alias", updateAlias);
  
  // update it
  var result = efx.update(textData , alias.alias);
  assure ( result && result.ok ,"update-alias-write", result);
  
  // read it back using the reader alias
  var result = efx.read (alias.alias);
  assure ( result && result.ok && result.value===textData,"read-update-alias", result);
  
  // try deleting the underlying data item using the alias.. should fail because we didnt assign an alias to the writer key
  var result = efx.remove (alias.alias);
  assure ( !result.ok ,"remove-should-fail", result);
  
  // assign alias to the writer key
  var writerAlias = efx.registerAlias( keys.writer, keys.writer, otherData.id, alias.alias);
  assure ( writerAlias && writerAlias.ok && writerAlias.alias === alias.alias ,"writer-alias", updateAlias);
  
  // now this should work
  var result = efx.remove (alias.alias);
  assure ( result && result.ok ,"remove-should-work", result);
  
  // check the underlying is gone
  var result = efx.read (alias.alias, keys.writer);
  assure ( !result.ok,"read-should-fail", result);  
  
  // write some data as an alias
  var walias = efx.writeAlias (textData , yetAlias, keys.writer, "POST" , {readers:keys.reader,updaters:keys.updater});
  assure ( walias.ok,"writealias", walias); 
  
  // make sure ee can read with them all
  var result = efx.read (walias.alias);
  assure ( result && result.ok && result.value===textData,"read-writealias-reader", result);
  
  // make sure ee can read with them all
  var result = efx.read (walias.alias, keys.writer);
  assure ( result && result.ok && result.value===textData,"read-writealias-writekey", result);
 
  var result = efx.read (walias.alias, keys.updater);
  assure ( result && result.ok && result.value===textData,"read-writealias-updater", result);
  
  var result = efx.update (otherTextData, walias.alias);
  assure ( result && result.ok,"update-writealias-updater", result);
  

  //'write post'
  var writePost = efx.write(textData,keys.writer,"post", {
    updaters: keys.updater,
    readers: keys.reader
  });
  assure (writePost && writePost.ok,'write post', writePost); 
  
  //'read with intent'
  var intentRead = efx.read(writePost.id,keys.updater,{
    intention:"update"
  });
  assure (intentRead && intentRead.ok && textData === intentRead.value,'read with intent', intentRead);
  
  //'intervening read with no intent'
  var result = efx.read(writePost.id,keys.updater);
  assure (result && result.ok && textData === result.value,'intervening read with no intent', result);
  
  //'validate intent key not expired'
  var result = efx.validateKey(intentRead.intent);
  assure (result && result.ok ,'validate intent key not expired', result);
  
 //'update intent - should fail - using a different key'
  var result = efx.update(otherTextData, writePost.id , keys.writer, "post" , {
    intent:intentRead.intent
  });
  assure (result && !result.ok && result.code === 423,'update intent - should fail - using a different key', result);
  
  //'update intent - should fail - using an invalid key'
  var result = efx.update(otherTextData, writePost.id , keys.updater, "post" , {
    intent:"rubbish"
  });
  assure (result && !result.ok && result.code === 400,'update intent - should fail - using an invalid key', result);
  
  //'update intent - should fail - using the same key, but no intent'
  var result = efx.update(otherTextData, writePost.id , keys.updater);
  assure (result && !result.ok && result.code === 423,'update intent - should fail - using the same key, but no intent', result);
  
  //'update intent - should succeed - using the same key plus intent'
  var result = efx.update(someData, writePost.id , keys.updater, "post" , {
    intent:intentRead.intent
  });
  assure (result && result.ok,'update intent - should succeed - using the same key plus intent', result);
  
  //'update intent - check what was updated'
  var result = efx.read(writePost.id);
  assure (result && result.ok && JSON.stringify(someData) === JSON.stringify(result.value),'update intent - check what was updated', result);
    
  //'read writealias with writer - and set intent'
  var intentAlias = efx.read(walias.alias,keys.writer,{
    intention:"update"
  });
  assure (intentAlias && intentAlias.ok && otherTextData === intentAlias.value,'read writealias with writer - and set intent', intentAlias);
  
  //'update intent with alias - should succeed - using the same key plus intent'
  var result = efx.update(textData, intentAlias.alias , keys.writer, "post" , {
    intent:intentAlias.intent
  });
  assure (result && result.ok,'update intent - should succeed - using the same key plus intent', result);
  
  //'update intent with alias - should fail - because intent is used up'
  var result = efx.update(textData, intentAlias.alias , keys.writer, "post" , {
    intent:intentAlias.intent
  });
  assure (result && !result.ok && result.code === 410,'update intent with alias - should fail - because intent is used up', result);
  
  
}
function assure (b , message , result) {
  verbose = true;
  if (!b) {
    throw ("failed:"+message + ' : result : ' + (result ? JSON.stringify(result) : ""));
  }
  if (verbose && b) {
    Logger.log ("passed:"+message);
  }
  return b;
}


