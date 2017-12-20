function testEfx() {
  
  // set up client 
  var efx = EffexApiClient.setProd().setVerbose(false);
  
  // boss key comes from console /// replace this with your own
  var bossKey ="bx490-tlvauk1-4106o9401c4j";  
  
  // check service is up
  var result = efx.ping();
  assure ( result && result.ok ,"ping", result);
  
  // give up if its not
  if (!result.ok) {
    throw 'service is not up:' + JSON.stringify(result);
  }
  
  // get some service info
  var result = efx.info();
  assure ( result && result.ok ,"info", result);
  
  // check boss key hasnt expired
  var result = efx.validateKey(bossKey);
  assure ( result && result.ok ,"validate bosskey", result);
  
  // get 1 writer key expiringin in 5 minutes
  var writers = efx.generateKey (bossKey,"writer", {seconds:5*60});
  assure ( writers && writers.ok && writers.keys.length === 1 ,"writerkeys", writers);
  
  // get 2 readr keys  expiringin in 5 minutes
  var readers = efx.generateKey (bossKey,"reader", {seconds:5*60, count:2});
  assure ( readers && readers.ok && readers.keys.length === 2 ,"readerkeys", readers);
  
  // get 1 updater keys  expiringin in 5 minutes
  var updaters = efx.generateKey (bossKey,"updater", {seconds:5*60});
  assure ( updaters && updaters.ok && updaters.keys.length === 1 ,"updaterkeys", updaters);
  
  // set the keys up as default so we dont have to bother specifying them later
  efx.setKeys ({
    updater:updaters.keys[0],
    writer:writers.keys[0],
    reader:readers.keys[0]
  });
  // more convenient for later
  // or just use makeKeys
  var keys = efx.makeKeys (bossKey , {seconds:5*60});
  assure ( keys  ,"makekeys", keys);
  
  //---reading and writing
  var someData = {name:'xyz',a:[1,2,3],b:2000};
  var otherTextData = 'anything at all';
  
  var data = efx.write(someData);
  assure ( data && data.ok ,"write-post", data);
  
  // read it back with the same key
  var result = efx.read( data.id, keys.writer);
  assure ( result && result.ok && JSON.stringify(result.value) === JSON.stringify(someData) ,"read", result);
  
  // do it again, but use a GET for writing
  var data = efx.write(someData, keys.writer, "get");
  assure ( data && data.ok ,"write-get", data);
  
  // read it back with the same key
  var result = efx.read( data.id, keys.writer);
  assure ( result && result.ok && JSON.stringify(result.value) === JSON.stringify(someData) ,"read-get", result);
 
  // now do all that with some text data
  var textData = "some text data";
  var yetAlias = "mickymouse"
  
  var data = efx.write(textData);
  assure ( data && data.ok ,"write-post-text", data);
  
  // read it back with the same key
  var result = efx.read( data.id, keys.writer);
  assure ( result && result.ok && result.value === textData ,"read-text", result);
  
  // do it again, but use a GET for writing
  var data = efx.write(textData, keys.writer, "get");
  assure ( data && data.ok ,"write-get-text", data);
  
  // read it back with the same key
  var result = efx.read( data.id, keys.writer);
  assure ( result && result.ok && result.value === textData ,"read-get-text", result);
  
  //-- assigning readers and updaters
  var data = efx.write(someData,keys.writer,"post",{readers:keys.reader,updaters:keys.updater});
  assure ( data && data.ok ,"write-for-others", data);
  
  // read it back with a reader key
  var result = efx.read( data.id);
  assure ( result && result.ok && JSON.stringify(result.value) === JSON.stringify(someData) ,"read-reader", result);
  
  
  // read it back with an updater key
  var result = efx.read( data.id, keys.updater);
  assure ( result && result.ok && JSON.stringify(result.value) === JSON.stringify(someData) ,"read-updater", result);
  
  // update it
  var result = efx.update (textData , data.id);
  assure ( result && result.ok ,"update", result);
  
  // check it took - i'll just use the reader key
  var result = efx.read( data.id);
  assure ( result && result.ok && result.value === textData ,"read-updated", result);
  
  //----work with aliases
  // assign an alias for the reader key to use
  var alias = efx.registerAlias( keys.writer, keys.reader, data.id, "somename");
  assure ( alias && alias.ok ,"alias", result);
  
  // read it back with a reader key, using the data alias
  var result = efx.read( alias.alias);
  assure ( result && result.ok && result.value === textData ,"assign-alias", result);
  
  // write another rec to the same alias
  var otherData = efx.write(someData,keys.writer,"post",{readers:keys.reader,updaters:keys.updater});
  assure ( otherData && otherData.ok ,"write-for-others-alias", otherData);
  
  // assign the alias to the new data
  var otherAlias = efx.registerAlias( keys.writer, keys.reader, otherData.id, alias.alias);
  assure ( otherAlias && otherAlias.ok && otherAlias.alias === alias.alias ,"other-alias", otherAlias);

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





function assurex (b , message , result) {
  verbose = true;
  if (!b) {
    Logger.log ("failed:"+message + ' : result : ' + (result ? JSON.stringify(result) : ""));
  }
  if (verbose && b) {
    Logger.log ("passed:"+message);
  }
  return b;
}
