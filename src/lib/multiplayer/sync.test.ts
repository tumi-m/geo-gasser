import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createLobbyState, reduce, toPublicSnapshot} from '../game/machine.ts';
import {mergeHostSnapshot, matchesQuestion} from './sync.ts';
import {isWireMessage} from './protocol.ts';

function room() {
 let s=reduce(createLobbyState(),{type:'CREATE_DUEL',playerId:'host',name:'Host',seed:9,roomCode:'ABC234',matchLength:'escape',now:0});
 s=reduce(s,{type:'PLAYER_JOIN',playerId:'guest',name:'Guest',now:1});
 s=reduce(s,{type:'START_MATCH',now:2});
 return reduce(s,{type:'INTRO_DONE',now:3});
}
test('guest draft preserves only its own pin without hiding host revision',()=>{
 const host=room(); const guest=mergeHostSnapshot(createLobbyState(),toPublicSnapshot(host),'guest');
 const draft={...guest,players:guest.players.map(p=>p.id==='guest'?{...p,guess:{latitude:1,longitude:2}}:p)};
 const next=reduce(host,{type:'PLACE_PIN',playerId:'host',guess:host.truth!,now:4});
 const synced=mergeHostSnapshot(draft,toPublicSnapshot(next),'guest');
 assert.equal(synced.seq,next.seq);assert.deepEqual(synced.players[1].guess,{latitude:1,longitude:2}); assert.equal(synced.players[0].guess,undefined);
});
test('five complete online rounds reset guest lock and reject delayed actions',()=>{
 let host=room();let guest=createLobbyState();let time=4;
 for(let q=0;q<5;q++){
  if(host.phase==='round_intro')host=reduce(host,{type:'INTRO_DONE',now:time++});
  guest=mergeHostSnapshot(guest,toPublicSnapshot(host),'guest');
  assert.equal(guest.questionIndex,q);assert.equal(guest.players[1].locked,false);assert.equal(guest.players[1].guess,undefined);
  for(const id of ['guest','host']){host=reduce(host,{type:'PLACE_PIN',playerId:id,guess:host.truth!,now:time++});host=reduce(host,{type:'LOCK',playerId:id,now:time++});}
  guest=mergeHostSnapshot(guest,toPublicSnapshot(host),'guest');assert.equal(guest.phase,'round_reveal');assert.ok(guest.players.every(p=>p.roundScore!.roundScore>0));
  host=reduce(host,{type:'CONTINUE',now:time++});assert.equal(matchesQuestion(host,{roundStartedAtMs:host.roundStartedAtMs,questionIndex:q}),q===4);
 }
 guest=mergeHostSnapshot(guest,toPublicSnapshot(host),'guest');assert.equal(guest.phase,'final_reveal');assert.equal(guest.roundHistory.length,5);
 const old=toPublicSnapshot(host);host=reduce(host,{type:'REMATCH',seed:10,now:time++});guest=mergeHostSnapshot(guest,toPublicSnapshot(host),'guest');
 assert.equal(guest.seed,10);assert.equal(guest.roundHistory.length,0);assert.equal(mergeHostSnapshot(guest,old,'guest'),guest);
});
test('wire protocol rejects unknown messages, invalid coordinates, malformed snapshots and unscoped locks',()=>{
 assert.equal(isWireMessage({t:'anything'}),false);
 assert.equal(isWireMessage({t:'lock',lat:0,lng:0}),false);
 assert.equal(isWireMessage({t:'lock',lat:NaN,lng:0,seed:1,questionIndex:0}),false);
 assert.equal(isWireMessage({t:'lock',lat:0,lng:200,seed:1,questionIndex:0}),false);
 assert.equal(isWireMessage({t:'snapshot',state:{}}),false);
 assert.equal(isWireMessage({t:'snapshot',state:toPublicSnapshot(room()),sentAt:100}),true);
});
