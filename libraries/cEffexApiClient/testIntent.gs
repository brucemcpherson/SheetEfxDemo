function tin() {
 
  // set up client 
 var efx = EffexApiClient.setProd().setVerbose(false);
  
 // boss key comes from console /// replace this with your own
  var bossKey ="bx490-tlvauk1-4106o9401c4j";  


 //Check service is up
  var result = efx.ping();
  if (!result.ok) throw 'problem with the service:' + result.error;
  
  //get an access key
  var result = efx.generateKey (bossKey, "writer");
  if (!result.ok) throw 'problem with the service:' + result.error;
  
  // store that for later
  var writer = result.keys[0];
  
  // write something
  var result = efx.write ("something",writer);
  if (!result.ok) throw 'problem with writing :' + result.error;
  
  // save for later
  var id = result.id;
  
  // read it back normally
  var result = efx.read (id, writer);
  if (!result.ok) throw 'problem with reading :' + result.error;
  
  // read it back but put a hold on it
  var result = efx.read (id, writer, {intention:"update"});
  if (!result.ok) throw 'problem with intention reading :' + result.error;
  
  // save it for later
  var intent = result.intent;

  // try to write to it without the intention, it'll fail
  var result = efx.update ("some more data", id, writer);
  if (result.ok) throw 'should have blocked update';
  
  
  // if you want to wait till its available
  //Utilities.sleep (result.intentExpires * 1000 );
 ///var result = efx.update ("some more data", id, writer);
  //if (!result.ok) throw 'lock should have cleared :' + result.error;

  // .. or if you do it with the intent
  var result = efx.update ("some more data", id, writer, "post" , {
    intent:intent
  });
  if (!result.ok) throw 'problem with intention updating :' + result.error;
  
  
  // .. take an intent  
  var result = efx.read (id, writer, {intention:"update"});
  if (!result.ok) throw 'problem with intention reading :' + result.error;
  
  // .. and again but expbackoff
  var r = efx.read (id, writer, {intention:"update"});
  if (r.ok) throw 'should have failed problem with intention reading :' + r.error;

  
  // .. exp backoff
  var r = efx.read (id, writer, {intention:"update",backoff:true});
  if (!r.ok) throw 'should have waited for intent :' + JSON.stringify(r);

}

