import {test} from 'node:test';
import assert from 'node:assert/strict';
import {windowAtPointer,dockTargetAt,shouldFinishBeforeDetach} from '../src/serial/dragGeometry.ts';
const target={owner:'a',label:'a',visible:true,busy:false,count:2,left:90,right:800,top:20,bottom:54,tabs:[{id:'first',middle:150,left:100,right:200,top:20,bottom:54},{id:'second',middle:260,left:210,right:310,top:20,bottom:54}]};
test('negative screen coordinates preserve the grab point',()=>{assert.deepEqual(windowAtPointer({x:-1200,y:220},{x:140,y:180}),{x:-1340,y:40});});
test('physical coordinates at 150% scale are not scaled twice',()=>{assert.deepEqual(windowAtPointer({x:1950,y:480},{x:210,y:270}),{x:1740,y:210});});
test('tab rectangles overlap even when the pointer is outside the target tab',()=>{assert.equal(dockTargetAt([target],'moving',{left:50,right:120,top:25,bottom:59})?.before,'first');});
test('blank tab-bar area merges at the end',()=>{const hit=dockTargetAt([target],'moving',{left:350,right:470,top:20,bottom:54});assert.equal(hit?.target.owner,'a');assert.equal(hit?.before,undefined);});
test('touching edges without overlap never merges',()=>{assert.equal(dockTargetAt([target],'moving',{left:800,right:900,top:20,bottom:54}),undefined);});
test('vertical separation never merges',()=>{assert.equal(dockTargetAt([target],'moving',{left:100,right:200,top:55,bottom:89}),undefined);});
test('hidden, busy, full and source windows never accept',()=>{for(const patch of [{visible:false},{busy:true},{count:16},{label:'moving'}])assert.equal(dockTargetAt([{...target,...patch}],'moving',{left:100,right:200,top:20,bottom:54}),undefined);});
test('largest overlap determines target and insertion side',()=>{assert.equal(dockTargetAt([target],'moving',{left:185,right:285,top:20,bottom:54})?.before,'second');});

test('fast release beyond the tabs still completes a split',()=>{assert.equal(shouldFinishBeforeDetach({pressed:false,started:true,single:false,outside:true}),false);});
test('ordinary click must not create a window',()=>{assert.equal(shouldFinishBeforeDetach({pressed:false,started:false,single:false,outside:false}),true);});
test('release over existing tabs completes reordering without splitting',()=>{assert.equal(shouldFinishBeforeDetach({pressed:false,started:true,single:false,outside:false}),true);});

test('partial overlap with the bar qualifies even outside individual tabs',()=>{assert.equal(dockTargetAt([target],'moving',{left:750,right:850,top:40,bottom:74})?.target.owner,'a');});
test('horizontal gap from the bar does not merge',()=>{assert.equal(dockTargetAt([target],'moving',{left:801,right:901,top:20,bottom:54}),undefined);});
test('empty window tab bar can receive a session',()=>{assert.equal(dockTargetAt([{...target,count:0,tabs:[]}],'moving',{left:100,right:200,top:20,bottom:54})?.target.owner,'a');});
