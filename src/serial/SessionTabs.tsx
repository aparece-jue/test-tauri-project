import { useEffect, useRef, useState, type ReactNode, type DragEvent } from "react";
import { flushSync } from "react-dom";
import { Alert, Button, Input } from "antd";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { dragNativeSession, publishPeer, waitForPeer, NATIVE_PEER, NATIVE_REQUEST, NATIVE_HINT } from "./nativeSessionDrag";
import type { DataMode, LineEnding, RecordEntry } from "./model";

export type SessionSnapshot = {
  config: {port:string;baud:string;bits:string;parity:string;stop:string;flow:string};
  demo: {connected:boolean;records:RecordEntry[];paused:boolean;snapshot:RecordEntry[];rx:number;tx:number;dropped:number;draft:string;sendMode:DataMode;ending:LineEnding;error:string;notice:string;history:{text:string;mode:DataMode;ending:LineEnding}[];sequence:number;totalRows:number};
};
export type SessionViewProps = {initial?:SessionSnapshot;onSnapshot:(snapshot:SessionSnapshot)=>void;onPortChange:(port:string)=>void;transferring:boolean};
type Session = {id:string;name:string;custom:boolean;initial?:SessionSnapshot};
type Transfer = {token:string;source:string;session:Session;expires:number};
const NATIVE_INBOX="serial-native-inbox:";
const nativeWindows=isTauri() && navigator.userAgent.includes("Windows");
const MIME="application/x-serial-session";
const PREFIX="serial-transfer:";
const CLAIM="serial-transfer-claim:";
const ACK="serial-transfer-ack:";
const makeSession=(name:string):Session=>({id:crypto.randomUUID(),name,custom:false});

export default function SessionTabs({renderSession}:{renderSession:(props:SessionViewProps)=>ReactNode}) {
  const owner=useRef(crypto.randomUUID());
  const [incoming]=useState<Transfer|null>(()=>{
    const token=new URLSearchParams(location.search).get("transfer");
    if(!token) return null;
    try {const value=JSON.parse(localStorage.getItem(PREFIX+token) ?? "null") as Transfer|null;return value && value.expires>Date.now()?value:null;} catch {return null;}
  });
  const [tabs,setTabs]=useState<Session[]>(()=>incoming?[incoming.session]:new URLSearchParams(location.search).has("transfer")?[]:[1,2,3].map(n=>makeSession(`演示设备 ${n}`)));
  const [active,setActive]=useState(tabs[0]?.id ?? "");
  const [editing,setEditing]=useState<string|null>(null);
  const [name,setName]=useState("");
  const [error,setError]=useState("");
  const [browserDragging,setBrowserDragging]=useState(false);
  const lastDragPoint=useRef<{x:number;y:number}|null>(null);
  const leftPage=useRef(false);
  const [pending,setPending]=useState<string|null>(null);
  const [detached,setDetached]=useState<string|null>(null);
  const bar=useRef<HTMLDivElement>(null);
  const originalActive=useRef("");
  const [over,setOver]=useState<string|null>(null);
  const snapshots=useRef(new Map<string,SessionSnapshot>());
  const pendingTransfer=useRef<Transfer|null>(null);
  const dragged=useRef<Transfer|null>(null);
  const accepted=useRef<Transfer|null>(null);
  const dragCancelled=useRef(false);
  const currentTabs=useRef(tabs);currentTabs.current=tabs;
  const shouldClose=useRef(false);
  const nativeBusy=useRef(false);
  useEffect(()=>{
    if(!nativeWindows)return;
    let alive=true;
    const publish=()=>{if(alive && bar.current)void publishPeer(owner.current,bar.current,!!pendingTransfer.current,currentTabs.current.length).catch(()=>{});};
    publish();const timer=window.setInterval(publish,500);
    const receive=(event:StorageEvent)=>{
      if(event.key===NATIVE_HINT+owner.current){setOver(event.newValue);return;}
      if(!event.newValue)return;
      try {
        if(event.key===NATIVE_REQUEST+owner.current){
          const request=JSON.parse(event.newValue) as {id:string;target:string;before?:string};
          const tab=currentTabs.current.find(t=>t.id===request.id);
          if(!tab || pendingTransfer.current)return;
          const transfer=pack(tab);prepare(transfer);setDetached(tab.id);
          setActive(currentTabs.current.find(t=>t.id!==tab.id)?.id ?? "");
          localStorage.setItem(NATIVE_INBOX+request.target,JSON.stringify({transfer,before:request.before}));
          localStorage.removeItem(event.key);
        }
        if(event.key===NATIVE_INBOX+owner.current){
          const request=JSON.parse(event.newValue) as {transfer:Transfer;before?:string};
          acceptTransfer(request.transfer,request.before);localStorage.removeItem(event.key);
        }
      }catch{setError("窗口会话合并失败，会话保留在来源窗口。");}
    };
    window.addEventListener("storage",receive);
    const clean=()=>{localStorage.removeItem(NATIVE_PEER+owner.current);localStorage.removeItem(NATIVE_HINT+owner.current);};
    window.addEventListener("pagehide",clean);
    return ()=>{alive=false;clearInterval(timer);window.removeEventListener("storage",receive);window.removeEventListener("pagehide",clean);clean();};
  },[]);
  async function beginNative(tab:Session,event:React.PointerEvent) {
    if(!nativeWindows || event.button!==0 || editing || pendingTransfer.current || nativeBusy.current || !(event.target as HTMLElement).closest("[role=tab]"))return;
    const tabRect=event.currentTarget.getBoundingClientRect();
    const grabX=event.clientX-tabRect.left,grabY=event.clientY-tabRect.top;
    const order=[...currentTabs.current];originalActive.current=active;nativeBusy.current=true;setActive(tab.id);
    await dragNativeSession({id:tab.id,owner:owner.current,bar:bar.current!,single:order.length===1,grabX,grabY,tabWidth:tabRect.width,tabHeight:tabRect.height,startClientX:event.clientX,startClientY:event.clientY,
      create:async()=>{
        const transfer=pack(tab);prepare(transfer);setDetached(tab.id);setActive(currentTabs.current.find(t=>t.id!==tab.id)?.id ?? "");
        const url=new URL(location.href);url.search="";url.searchParams.set("transfer",transfer.token);
        const win=getCurrentWindow();const [size,scale]=await Promise.all([win.innerSize(),win.scaleFactor()]);
        const child=new WebviewWindow(`serial-${transfer.token}`,{url:url.toString(),title:"串口调试工具",width:size.width/scale,height:size.height/scale,visible:false,focus:false,dragDropEnabled:false});
        void child.once("tauri://error",()=>fail(transfer,"独立窗口创建失败，会话已恢复。"));
        try {await waitForPeer(child.label);return child;}catch(error){if(pendingTransfer.current?.token===transfer.token){await child.close().catch(()=>{});fail(transfer,"独立窗口未就绪，原会话已保留。");}else await child.show().catch(()=>{});throw error;}
      },
      reorder:before=>setTabs(items=>{if(before===tab.id)return items;const item=items.find(t=>t.id===tab.id);if(!item)return items;const next=items.filter(t=>t.id!==tab.id);const index=before?next.findIndex(t=>t.id===before):-1;next.splice(index<0?next.length:index,0,item);return next.every((t,i)=>t.id===items[i]?.id)?items:next;}),
      cancelOrder:()=>{if(currentTabs.current.some(t=>t.id===tab.id)){setTabs(order);setActive(originalActive.current);}},
      error:message=>setError(message),finished:()=>{nativeBusy.current=false;}
    });
  }

  useEffect(()=>{
    if(tabs.length || !shouldClose.current)return;
    shouldClose.current=false;
    if(isTauri())void getCurrentWindow().close().catch(()=>setError("窗口关闭失败，请使用窗口右上角关闭按钮。"));
    else {window.close();setError("浏览器不允许页面关闭手动打开的窗口，请关闭此浏览器标签。由应用创建的独立窗口会自动关闭。");}
  },[tabs.length]);
  function remove(id:string) {
    shouldClose.current=currentTabs.current.length===1 && currentTabs.current[0].id===id;
    setTabs(previous=>{const index=previous.findIndex(t=>t.id===id);const rest=previous.filter(t=>t.id!==id);setActive(current=>current===id?(rest[Math.min(index,rest.length-1)]?.id ?? ""):current);return rest;});
    snapshots.current.delete(id);
  }
  function acknowledge(transfer:Transfer) {localStorage.setItem(ACK+transfer.token,transfer.source);}
  useEffect(()=>{
    if(incoming) {acknowledge(incoming);localStorage.removeItem(PREFIX+incoming.token);history.replaceState(null,"",location.pathname);}
    const cancel=(event:KeyboardEvent)=>{if(event.key==="Escape") dragCancelled.current=true;};
    const receive=(event:StorageEvent)=>{
      const transfer=pendingTransfer.current;
      if(transfer && event.key===ACK+transfer.token && event.newValue===owner.current) {
        remove(transfer.session.id);pendingTransfer.current=null;setPending(null);setDetached(null);localStorage.removeItem(ACK+transfer.token);localStorage.removeItem(CLAIM+transfer.token);localStorage.removeItem(PREFIX+transfer.token);
      }
    };
    const leave=(event:globalThis.DragEvent)=>{if(dragged.current && !event.relatedTarget && (event.clientX<=0 || event.clientY<=0 || event.clientX>=innerWidth || event.clientY>=innerHeight))leftPage.current=true;};
    const enter=()=>{leftPage.current=false;};
    window.addEventListener("dragleave",leave);window.addEventListener("dragover",enter);
    window.addEventListener("storage",receive);window.addEventListener("keydown",cancel);
    return ()=>{window.removeEventListener("dragleave",leave);window.removeEventListener("dragover",enter);window.removeEventListener("storage",receive);window.removeEventListener("keydown",cancel);};
  },[incoming]);
  useEffect(()=>{
    if(!pending || browserDragging) return;
    const timer=window.setTimeout(()=>{const t=pendingTransfer.current;if(t){localStorage.removeItem(PREFIX+t.token);pendingTransfer.current=null;}setPending(null);setDetached(null);setActive(originalActive.current);setError("目标窗口未确认接收，会话保留在原窗口。请重试。");},15000);
    return ()=>clearTimeout(timer);
  },[pending,browserDragging]);
  useEffect(()=>{const transfer=accepted.current;if(transfer && tabs.some(t=>t.id===transfer.session.id)){acknowledge(transfer);accepted.current=null;}},[tabs]);
  function pack(tab:Session):Transfer {return {token:crypto.randomUUID(),source:owner.current,session:{...tab,initial:snapshots.current.get(tab.id) ?? tab.initial},expires:Date.now()+15000};}
  function prepare(transfer:Transfer) {
    pendingTransfer.current=transfer;setPending(transfer.session.id);
    localStorage.setItem(PREFIX+transfer.token,JSON.stringify(transfer));
  }
  function fail(transfer:Transfer,message:string) {
    if(pendingTransfer.current?.token!==transfer.token)return;
    pendingTransfer.current=null;setPending(null);setDetached(null);localStorage.removeItem(PREFIX+transfer.token);setActive(transfer.session.id);setError(message);
  }
  function detach(tab:Session,existing?:Transfer) {
    if(pending && pending!==tab.id)return;
    const transfer=existing ?? pack(tab);transfer.expires=Date.now()+15000;prepare(transfer);
    const url=new URL(location.href);url.search="";url.searchParams.set("transfer",transfer.token);
    if(isTauri()) {
      const child=new WebviewWindow(`serial-${transfer.token}`,{url:url.toString(),title:"串口调试工具",width:1134,height:874,dragDropEnabled:false});
      void child.once("tauri://error",()=>fail(transfer,"独立窗口创建失败，会话已保留。"));
    } else {
      const child=window.open(url.toString(),`serial-${transfer.token}`,"popup,width=1134,height=874");
      if(!child)fail(transfer,"浏览器阻止了弹窗。请允许此站点弹窗后重新拖出标签；原会话已保留。");
    }
  }
  function drop(event:DragEvent,before?:string) {
    event.preventDefault();event.stopPropagation();setOver(null);
    try {
      const token=event.dataTransfer.getData(MIME);
      const transfer=JSON.parse(localStorage.getItem(PREFIX+token) ?? "null") as Transfer|null;
      if(transfer)acceptTransfer(transfer,before);
      dragged.current=null;
    } catch {setError("无法读取拖入的会话，原窗口中的内容不会被删除。");}
  }
  function acceptTransfer(transfer:Transfer,before?:string) {
      if(!transfer || transfer.expires<Date.now())return;
      if(pendingTransfer.current && transfer.source!==owner.current){setError("请等待当前会话移动完成后再合并。");return;}
      if(transfer.source!==owner.current && currentTabs.current.length>=16){setError("本窗口最多 16 个会话，请先关闭一个标签。");return;}
      if(transfer.source!==owner.current)localStorage.setItem(CLAIM+transfer.token,owner.current);
      setTabs(previous=>{
        if(before===transfer.session.id)return previous;
        const next=previous.filter(t=>t.id!==transfer.session.id);
        const index=before?next.findIndex(t=>t.id===before):-1;
        const original=previous.find(t=>t.id===transfer.session.id);
        next.splice(index<0?next.length:index,0,original ?? transfer.session);return next;
      });setActive(transfer.session.id);
      if(transfer.source===owner.current){pendingTransfer.current=null;setPending(null);setDetached(null);localStorage.removeItem(PREFIX+transfer.token);}else accepted.current=transfer;

  }
  function preview(tab:Session,event:DragEvent) {
    originalActive.current=active;
    flushSync(()=>setActive(tab.id));
    const source=document.getElementById(`session-panel-${tab.id}`);
    if(!source)return;
    const bounds=source.getBoundingClientRect();
    const frame=document.createElement("div");
    frame.className="session-drag-image";frame.setAttribute("aria-hidden","true");
    frame.style.width=`${bounds.width}px`;frame.style.height=`${bounds.height+36}px`;
    const heading=document.createElement("div");heading.className="session-drag-heading";heading.textContent=tab.name;
    const content=source.cloneNode(true) as HTMLElement;
    content.removeAttribute("hidden");content.removeAttribute("inert");content.removeAttribute("id");content.style.height=`${bounds.height}px`;
    content.querySelectorAll("[id]").forEach(el=>el.removeAttribute("id"));
    const inputs=source.querySelectorAll<HTMLInputElement|HTMLTextAreaElement>("input,textarea");
    content.querySelectorAll<HTMLInputElement|HTMLTextAreaElement>("input,textarea").forEach((el,i)=>{el.value=inputs[i].value;});
    frame.append(heading,content);document.body.append(frame);
    event.dataTransfer.setDragImage(frame,140,18);
    window.setTimeout(()=>frame.remove(),0);
  }
  function trackDrag(event:DragEvent) {
    const transfer=dragged.current;const rect=bar.current?.getBoundingClientRect();
    if(!transfer || !rect || (!event.clientX && !event.clientY))return;
    lastDragPoint.current={x:event.clientX,y:event.clientY};
    if(transfer.expires<Date.now()+30000){transfer.expires=Date.now()+60000;localStorage.setItem(PREFIX+transfer.token,JSON.stringify(transfer));}
    const outside=event.clientY<rect.top-18 || event.clientY>rect.bottom+18 || event.clientX<rect.left-18 || event.clientX>rect.right+18;
    setDetached(outside?transfer.session.id:null);
    if(outside)setActive(current=>current===transfer.session.id?(currentTabs.current.find(t=>t.id!==transfer.session.id)?.id ?? ""):current);
    else setActive(transfer.session.id);
  }
  function finishName(save:boolean) {
    if(save && name.trim())setTabs(items=>items.map(t=>t.id===editing?{...t,name:name.trim(),custom:true}:t));
    setEditing(null);
  }
  return <section className="serial-shell">
    {error && <Alert type="warning" title={error} closable onClose={()=>setError("")}/>}
    <div ref={bar} className={`browser-tabbar ${over?"receiving":""}`} role="tablist" aria-label="串口会话" onDragOver={e=>{if(e.dataTransfer.types.includes(MIME)){e.preventDefault();e.dataTransfer.dropEffect="move";setOver("end");}}} onDrop={e=>drop(e)}>
      {tabs.map((tab,index)=><div key={tab.id} aria-hidden={detached===tab.id || undefined} className={`browser-tab ${active===tab.id?"active":""} ${over===tab.id?"drop-before":""} ${detached===tab.id?"drag-detached":""}`} onPointerDown={e=>{void beginNative(tab,e);}} draggable={!nativeWindows && !editing && (!pending || pending===tab.id)} onDragStart={e=>{
        setBrowserDragging(true);leftPage.current=false;lastDragPoint.current={x:e.clientX,y:e.clientY};preview(tab,e);const transfer=pack(tab);transfer.expires=Date.now()+60000;dragged.current=transfer;dragCancelled.current=false;prepare(transfer);e.dataTransfer.setData(MIME,transfer.token);e.dataTransfer.effectAllowed="move";
      }} onDrag={trackDrag} onDragOver={e=>{if(e.dataTransfer.types.includes(MIME)){e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect="move";setOver(tab.id);}}} onDrop={e=>drop(e,tab.id)} onDragEnd={e=>{
        setBrowserDragging(false);setOver(null);const transfer=dragged.current;dragged.current=null;
        if(!transfer || pendingTransfer.current?.token!==transfer.token)return;
        if(localStorage.getItem(CLAIM+transfer.token))return;
        const point=(e.clientX || e.clientY)?{x:e.clientX,y:e.clientY}:lastDragPoint.current;
        const bounds=bar.current?.getBoundingClientRect();
        const outside=leftPage.current || !!point && !!bounds && (point.x<bounds.left || point.x>bounds.right || point.y<bounds.top || point.y>bounds.bottom);
        if(!dragCancelled.current && outside)detach(tab,transfer);
        else {pendingTransfer.current=null;setPending(null);setDetached(null);localStorage.removeItem(PREFIX+transfer.token);setActive(originalActive.current);}
      }}>
        {editing===tab.id?<Input autoFocus aria-label="标签名称" value={name} maxLength={40} onChange={e=>setName(e.target.value)} onBlur={()=>finishName(true)} onKeyDown={e=>{if(e.nativeEvent.isComposing)return;if(e.key==="Enter")finishName(true);if(e.key==="Escape")finishName(false);}}/>:<button role="tab" aria-selected={active===tab.id} aria-controls={`session-panel-${tab.id}`} id={`session-tab-${tab.id}`} data-session-id={tab.id} onClick={()=>setActive(tab.id)} onDoubleClick={()=>{setEditing(tab.id);setName(tab.name);}} onKeyDown={e=>{
          if(e.key==="F2"){setEditing(tab.id);setName(tab.name);}
          if(e.altKey && (e.key==="ArrowLeft" || e.key==="ArrowRight")){e.preventDefault();const target=index+(e.key==="ArrowLeft"?-1:1);if(target>=0 && target<tabs.length)setTabs(items=>{const next=[...items];[next[index],next[target]]=[next[target],next[index]];return next;});}
        }}>{tab.name}</button>}
        <button className="tab-tool" aria-label={`关闭 ${tab.name}`} disabled={!!pending} onClick={()=>remove(tab.id)}><svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 4 8 8m0-8-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg></button>
      </div>)}
      <button className="tab-add" aria-label="新建会话" title="新建会话" disabled={tabs.length>=16 || !!pending} onClick={()=>{const tab=makeSession("新会话");setTabs(items=>[...items,tab]);setActive(tab.id);}}><svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg></button>
    </div>
    <div className="browser-session-body">{tabs.map(tab=><div className="browser-session" key={tab.id} hidden={active!==tab.id || detached===tab.id} inert={pending===tab.id} role="tabpanel" id={`session-panel-${tab.id}`} aria-labelledby={`session-tab-${tab.id}`}>
      
      {renderSession({initial:tab.initial,transferring:pending===tab.id,onSnapshot:snapshot=>snapshots.current.set(tab.id,snapshot),onPortChange:port=>setTabs(items=>items.map(t=>t.id===tab.id && !t.custom?{...t,name:port}:t))})}
    </div>)}{detached && tabs.length===1 && <div className="empty-sessions">会话已拖出，松开以拆分；按 Esc 返回。</div>}{!tabs.length && <div className="empty-sessions">将其他窗口的标签拖到上方，或点击 ＋ 新建会话。<Button onClick={()=>{const tab=makeSession("新会话");setTabs([tab]);setActive(tab.id);}}>新建会话</Button></div>}</div>
  </section>;
}
