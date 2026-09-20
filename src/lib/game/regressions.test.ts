import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createLobbyState,reduce} from './machine.ts';
import {planMatch} from './selection.ts';
import {getLocation} from './locations.ts';

test('quick classic is five distinct stops with a worldwide finale',()=>{
 for(let seed=0;seed<30;seed++){
 const p=planMatch(seed,'quick');assert.equal(p.totalRounds,5);assert.equal(new Set(p.locationIds).size,5);
 assert.equal(getLocation(p.locationIds[4])?.country,'WORLD');assert.ok(p.locationIds.slice(0,4).every(id=>getLocation(id)?.country!=='WORLD'));
 }
});
test('custom city filter never silently widens the map',()=>{
 const p=planMatch(3,'quick',{preset:'za',nations:['ZA'],cities:['Cape Town']});
 assert.ok(p.locationIds.length>0);assert.ok(p.locationIds.every(id=>getLocation(id)?.city==='Cape Town'));
});
test('time origin zero works, invalid pins and late locks cannot earn points',()=>{
 let s=reduce(createLobbyState(),{type:'CREATE_SOLO',playerId:'me',name:'Me',seed:1,now:0,matchLength:'quick'});
 s=reduce(s,{type:'INTRO_DONE',now:0});
 assert.equal(reduce(s,{type:'PLACE_PIN',playerId:'me',guess:{latitude:NaN,longitude:1},now:1}),s);
 assert.equal(reduce(s,{type:'TIMEOUT',now:1000}),s);
 s=reduce(s,{type:'PLACE_PIN',playerId:'me',guess:s.truth!,now:1});
 assert.equal(reduce(s,{type:'LOCK',playerId:'me',now:45000}),s);
 s=reduce(s,{type:'TIMEOUT',now:45000});assert.equal(s.players[0].roundScore!.roundScore,0);
});
test('hotseat timeout hands over, and second timer never alters first response',()=>{
 let s=reduce(createLobbyState(),{type:'CREATE_LOCAL_DUEL',seats:[{id:'a',name:'A'},{id:'b',name:'B'}],hotseat:true,seed:1,now:1,matchLength:'quick'});
 s=reduce(s,{type:'INTRO_DONE',now:100});s=reduce(s,{type:'TIMEOUT',now:45100});assert.equal(s.phase,'waiting_for_opponent');assert.equal(s.activeSeatId,'b');
 s=reduce(s,{type:'HANDOFF_DONE',now:60000});s=reduce(s,{type:'PLACE_PIN',playerId:'b',guess:s.truth!,now:62000});s=reduce(s,{type:'LOCK',playerId:'b',now:63000});
 assert.equal(s.phase,'round_reveal');assert.equal(s.players[0].roundScore!.roundScore,0);assert.equal(s.players[1].roundScore!.responseMs,3000);
 let t=reduce(createLobbyState(),{type:'CREATE_LOCAL_DUEL',seats:[{id:'a',name:'A'},{id:'b',name:'B'}],hotseat:true,seed:1,now:1,matchLength:'quick'});
 t=reduce(t,{type:'INTRO_DONE',now:100});t=reduce(t,{type:'PLACE_PIN',playerId:'a',guess:t.truth!,now:1000});t=reduce(t,{type:'LOCK',playerId:'a',now:5100});
 t=reduce(t,{type:'HANDOFF_DONE',now:60000});t=reduce(t,{type:'PLACE_PIN',playerId:'b',guess:t.truth!,now:61000});t=reduce(t,{type:'LOCK',playerId:'b',now:63000});assert.equal(t.players[0].roundScore!.responseMs,5000);assert.ok(t.players[0].roundScore!.timePoints<10000);
});
