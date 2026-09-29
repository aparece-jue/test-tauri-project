import { windowAtPointer, dockTargetAt, overlapArea, shouldFinishBeforeDetach } from "./dragGeometry";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow, PhysicalPosition, type Window } from "@tauri-apps/api/window";
export const NATIVE_PEER="serial-native-peer:";
export const NATIVE_REQUEST="serial-native-request:";
export const NATIVE_HINT="serial-native-hint:";
export type Peer={owner:string;label:string;updated:number;busy:boolean;count:number;visible:boolean;left:number;right:number;top:number;bottom:number;tabs:{id:string;middle:number;left:number;right:number;top:number;bottom:number}[]};
type Pointer={x:number;y:number;pressed:boolean;cancelled:boolean};
const delay=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
export function peers():Peer[] {
  const list:Peer[]=[];
  for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(!key?.startsWith(NATIVE_PEER))continue;try{const value=JSON.parse(localStorage.getItem(key) ?? "null") as Peer;if(value && Date.now()-value.updated<5000)list.push(value);}catch{/* An interrupted window registration is ignored. */}}
  return list;
}
export async function publishPeer(owner:string,bar:HTMLElement,busy:boolean,count:number) {
  const win=getCurrentWindow();const [origin,scale]=await Promise.all([win.innerPosition(),win.scaleFactor()]);
  const r=bar.getBoundingClientRect();const visible=await win.isVisible() && !await win.isMinimized();
  const peer:Peer={owner,label:win.label,updated:Date.now(),busy,count,visible,left:origin.x+r.left*scale,right:origin.x+r.right*scale,top:origin.y+r.top*scale,bottom:origin.y+r.bottom*scale,tabs:Array.from(bar.querySelectorAll<HTMLElement>("[role=tab]")).map(el=>{const rect=(el.closest(".browser-tab") ?? el).getBoundingClientRect();return {id:el.dataset.sessionId!,middle:origin.x+(rect.left+rect.width/2)*scale,left:origin.x+rect.left*scale,right:origin.x+rect.right*scale,top:origin.y+rect.top*scale,bottom:origin.y+rect.bottom*scale};})};
  localStorage.setItem(NATIVE_PEER+owner,JSON.stringify(peer));
}
function requestMove(owner:string,request:object) {
  const key=NATIVE_REQUEST+owner;const newValue=JSON.stringify(request);
  localStorage.setItem(key,newValue);
  // A storage event is delivered to other documents, never to its sender.
  window.dispatchEvent(new StorageEvent("storage",{key,newValue}));
}
export async function waitForPeer(label:string) {
  const until=Date.now()+12000;
  while(Date.now()<until){const peer=peers().find(p=>p.label===label);if(peer)return peer;await delay(30);}
  throw new Error("独立窗口尚未准备好，会话保留在已有窗口中。");
}
export async function dragNativeSession(options:{id:string;owner:string;bar:HTMLElement;single:boolean;grabX:number;grabY:number;tabWidth:number;tabHeight:number;startClientX:number;startClientY:number;create:()=>Promise<Window>;reorder:(before?:string)=>void;cancelOrder:()=>void;error:(message:string)=>void;finished:()=>void}) {
  const source=getCurrentWindow();let moving:Window|null=null;let hintOwner:string|null=null;
  try {
    const [original,inner,scale]=await Promise.all([source.outerPosition(),source.innerPosition(),source.scaleFactor()]);
    // Use the actual pointer-down coordinates; IPC may finish after a fast release.
    const initial={x:inner.x+options.startClientX*scale,y:inner.y+options.startClientY*scale};
    const bounds=options.bar.getBoundingClientRect();

    let offset={x:initial.x-original.x,y:initial.y-original.y};
    let started=false;let shown=false;let releasedDuringCreation:Pointer|null=null;
    const clearHint=()=>{if(hintOwner){localStorage.removeItem(NATIVE_HINT+hintOwner);hintOwner=null;}};
    for(;;) {
      const point=await invoke<Pointer>("session_drag_pointer");
      if(point.cancelled) {
        clearHint();options.cancelOrder();
        if(moving?.label===source.label)await source.setPosition(original);
        else if(moving){const peer=await waitForPeer(moving.label);requestMove(peer.owner,{id:options.id,target:options.owner,before:null,nonce:crypto.randomUUID()});}
        break;
      }
      if(!started && Math.hypot(point.x-initial.x,point.y-initial.y)>=6*scale)started=true;
      const ownPeer=peers().find(p=>p.owner===options.owner);
      const left=point.x-options.grabX*scale,top=point.y-options.grabY*scale;
      const draggedRect={left,right:left+options.tabWidth*scale,top,bottom:top+options.tabHeight*scale};
      const outside=ownPeer ? overlapArea(draggedRect,ownPeer)===0 : point.y<inner.y+bounds.top*scale || point.y>inner.y+bounds.bottom*scale;
      if(!moving && shouldFinishBeforeDetach({pressed:point.pressed,started,single:options.single,outside}))break;
      if(started && !moving) {
        if(options.single || outside) {
          if(options.single)moving=source;
          else {
            if(!point.pressed)releasedDuringCreation=point;
            let done=false;let created:Window|undefined;let failure:unknown;
            const creating=options.create().then(win=>{created=win;},error=>{failure=error;}).finally(()=>{done=true;});
            while(!done){
              if(!releasedDuringCreation){const sample=await invoke<Pointer>("session_drag_pointer");if(!sample.pressed || sample.cancelled)releasedDuringCreation=sample;}
              await delay(16);
            }
            await creating;
            if(failure)throw failure;
            if(!created)throw new Error("独立窗口创建未完成");
            moving=created;
            if(releasedDuringCreation?.cancelled){const peer=await waitForPeer(moving.label);requestMove(peer.owner,{id:options.id,target:options.owner,nonce:crypto.randomUUID()});break;}
          }
          if(await moving.isMaximized()){await moving.unmaximize();const size=await moving.outerSize();offset.x=Math.min(offset.x,size.width-40);}
          if(moving.label!==source.label) {
            const [outer,client,newScale]=await Promise.all([moving.outerPosition(),moving.innerPosition(),moving.scaleFactor()]);
            offset={x:client.x-outer.x+(bounds.left+7+options.grabX)*newScale,y:client.y-outer.y+(bounds.top+4+options.grabY)*newScale};
          }
        } else {
          const peer=peers().find(p=>p.owner===options.owner);
          options.reorder(peer?.tabs.filter(t=>t.id!==options.id).find(t=>point.x<t.middle)?.id);
        }
      }
      if(moving) {
        const latest=releasedDuringCreation ?? await invoke<Pointer>("session_drag_pointer");
        // The last frame uses exactly the same physical coordinate path as all previous frames.
        const position=windowAtPointer(latest,offset);
        await moving.setPosition(new PhysicalPosition(position.x,position.y));
        if(!shown){await moving.show();shown=true;}
        const movingScale=await moving.scaleFactor();
        const left=latest.x-options.grabX*movingScale,tabTop=latest.y-options.grabY*movingScale;
        const destination=dockTargetAt(peers(),moving.label,{left,right:left+options.tabWidth*movingScale,top:tabTop,bottom:tabTop+options.tabHeight*movingScale});
        const target=destination?.target;
        if(hintOwner!==target?.owner)clearHint();
        const before=destination?.before;
        if(target){hintOwner=target.owner;localStorage.setItem(NATIVE_HINT+target.owner,before ?? "end");}
        if(!latest.pressed) {
          clearHint();
          if(target){const from=await waitForPeer(moving.label);requestMove(from.owner,{id:options.id,target:target.owner,before,nonce:crypto.randomUUID()});}
          else await moving.setFocus();
          break;
        }
      }
      await delay(16);
    }
  } catch(error){if(moving)await moving.show().catch(()=>{});options.error(error instanceof Error?error.message:String(error));}
  finally {if(hintOwner)localStorage.removeItem(NATIVE_HINT+hintOwner);options.finished();}
}
