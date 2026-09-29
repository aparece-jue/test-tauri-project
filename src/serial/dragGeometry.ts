export type Rect={left:number;right:number;top:number;bottom:number};
export type DockTarget = Rect & {owner:string;label:string;busy:boolean;count:number;visible:boolean;tabs:({id:string;middle:number}&Rect)[]};
export function windowAtPointer(point:{x:number;y:number},offset:{x:number;y:number}) {
  return {x:Math.round(point.x-offset.x),y:Math.round(point.y-offset.y)};
}
export function overlapArea(a:Rect,b:Rect) {
  return Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
}
export function dockTargetAt<T extends DockTarget>(targets:T[],movingLabel:string,dragged:Rect) {
  let result:{target:T;before:string|undefined}|undefined;
  let largest=0;
  for(const target of targets){
    if(target.label===movingLabel || !target.visible || target.busy || target.count>=16)continue;
    const area=overlapArea(dragged,target);
    if(area<=largest)continue;
    largest=area;
    const center=(dragged.left+dragged.right)/2;
    result={target,before:target.tabs.find(tab=>center<tab.middle)?.id};
  }
  return result;
}
export function shouldFinishBeforeDetach(input:{pressed:boolean;started:boolean;single:boolean;outside:boolean}) {
  return !input.pressed && (!input.started || (!input.single && !input.outside));
}
