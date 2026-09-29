import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Alert, AutoComplete, Button, Checkbox, Empty, Input, Segmented, Space, Tag } from "antd";
import { DockviewReact, themeLight, type DockviewReadyEvent, type DockviewApi } from "dockview-react";
import SessionTabs, { type SessionSnapshot, type SessionViewProps } from "./SessionTabs";
import { FloatingSelect } from "../components/FloatingSelect";
import { encodeMessage, formatBytes, MAX_RECORDS, type DataMode, type LineEnding, type RecordEntry } from "./model";
import "dockview/dist/styles/dockview.css";
import "./SerialWorkbench.css";

function useSerialDemo(initial?: SessionSnapshot["demo"], transferring = false) {
  const [connected, setConnected] = useState(initial?.connected ?? false);
  const [records, setRecords] = useState<RecordEntry[]>(initial?.records ?? []);
  const [paused, setPaused] = useState(initial?.paused ?? false);
  const [snapshot, setSnapshot] = useState<RecordEntry[]>(initial?.snapshot ?? []);
  const [rx, setRx] = useState(initial?.rx ?? 0);
  const [tx, setTx] = useState(initial?.tx ?? 0);
  const [dropped, setDropped] = useState(initial?.dropped ?? 0);
  const [draft, setDraft] = useState(initial?.draft ?? "AT");
  const [sendMode, setSendMode] = useState<DataMode>(initial?.sendMode ?? "text");
  const [ending, setEnding] = useState<LineEnding>(initial?.ending ?? "crlf");
  const [error, setError] = useState(initial?.error ?? "");
  const [notice, setNotice] = useState(initial?.notice ?? "尚未连接，点击「连接模拟端口」开始体验。");
  const [history, setHistory] = useState<{text:string;mode:DataMode;ending:LineEnding}[]>(initial?.history ?? []);
  const sequence = useRef(initial?.sequence ?? 0);
  const totalRows = useRef(initial?.totalRows ?? 0);
  function append(direction: "RX" | "TX", bytes: number[]) {
    const row: RecordEntry = {id:++sequence.current, time:new Date().toLocaleTimeString("zh-CN",{hour12:false}) + "." + String(new Date().getMilliseconds()).padStart(3,"0"), direction, bytes};
    totalRows.current++;
    setDropped(Math.max(0,totalRows.current-MAX_RECORDS));
    setRecords((previous) => [...previous, row].slice(-MAX_RECORDS));
    if (direction === "RX") setRx((n) => n+bytes.length); else setTx((n) => n+bytes.length);
  }
  useEffect(() => {
    if (!connected || transferring) return;
    let tick = 0;
    const timer = window.setInterval(() => {
      tick++;
      append("RX", Array.from(new TextEncoder().encode(`[DEMO] frame=${tick} temperature=${(24 + Math.sin(tick)*2).toFixed(1)} C\r\n`)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [connected, transferring]);
  function send() {
    if (!connected) {setError("请先连接模拟端口"); return;}
    try {
      const bytes = encodeMessage(draft,sendMode,ending);
      append("TX",bytes);
      append("RX",[...bytes]);
      setHistory((items) => [{text:draft,mode:sendMode,ending},...items].slice(0,10));
      setError(""); setNotice(`模拟发送 ${bytes.length} 字节，并生成回显。`);
    } catch (e) {setError(e instanceof Error ? e.message : String(e));}
  }
  function togglePause() { if (!paused) setSnapshot(records); setPaused(!paused); }
  function clear() {setRecords([]);setSnapshot([]);totalRows.current=0;setDropped(0);setNotice("日志已清空，收发计数保留。");}
  function toggleConnect() {setConnected(!connected);setError("");setNotice(connected ? "模拟端口已断开。" : "模拟端口已连接，每秒生成一条示例数据。");}
  return {saved:{connected,records,paused,snapshot,rx,tx,dropped,draft,sendMode,ending,error,notice,history,sequence:sequence.current,totalRows:totalRows.current},connected,records,visible:paused?snapshot:records,paused,rx,tx,dropped,draft,setDraft,sendMode,setSendMode,ending,setEnding,error,notice,history,send,togglePause,clear,toggleConnect,resetCounters:()=>{setRx(0);setTx(0);}};
}
type Demo = ReturnType<typeof useSerialDemo>;
const DemoContext = createContext<Demo | null>(null);
function useDemo() { const demo = useContext(DemoContext); if (!demo) throw new Error("Missing serial demo provider"); return demo; }
function Panel({children}: {children:ReactNode}) { return <div className="serial-panel">{children}</div>; }
function LogPanel() {
  const demo = useDemo();
  const [mode,setMode] = useState<DataMode>("text");
  const [query,setQuery] = useState("");
  const [autoScroll,setAutoScroll] = useState(true);
  const viewport = useRef<HTMLDivElement>(null);
  const rows = demo.visible.filter((row) => formatBytes(row.bytes,mode).toLowerCase().includes(query.toLowerCase()));
  useEffect(() => {if(autoScroll && viewport.current) viewport.current.scrollTop=viewport.current.scrollHeight;},[demo.visible,autoScroll,query,mode]);
  return <Panel><div className="serial-log-toolbar"><Segmented aria-label="接收显示格式" options={[{label:"文本",value:"text"},{label:"HEX",value:"hex"}]} value={mode} onChange={setMode}/><Input aria-label="搜索日志" placeholder="搜索当前显示内容" value={query} onChange={(e)=>setQuery(e.target.value)} allowClear className="serial-search"/><Checkbox checked={autoScroll} onChange={(e)=>setAutoScroll(e.target.checked)}>自动滚动</Checkbox><Button size="small" onClick={demo.togglePause}>{demo.paused?"继续显示":"暂停显示"}</Button><Button size="small" onClick={demo.clear}>清空</Button></div>{demo.paused && <div className="serial-hint">显示已冻结，模拟接收与计数继续；恢复后展示最新缓存。</div>}{demo.dropped>0 && <div className="serial-hint">显示缓存最多 {MAX_RECORDS} 条，已淘汰 {demo.dropped} 条；本演示不录制数据。</div>}<div className="serial-log" ref={viewport} role="region" aria-label="收发日志">{rows.length ? rows.map((row)=><div className="serial-log-row" key={row.id}><time>{row.time}</time><span className={`serial-direction ${row.direction.toLowerCase()}`}>{row.direction}</span><code>{formatBytes(row.bytes,mode)}</code><small>{row.bytes.length} B</small></div>):<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={query?"没有匹配的日志":demo.connected?"等待模拟数据…":"连接模拟端口后，接收内容会显示在这里"}/>}</div><div className="serial-log-footer">显示 {rows.length} 条 · 时间戳 / 方向 / 数据 / 字节数</div></Panel>;
}
function SendPanel() {
  const demo=useDemo();
  let preview="";
  try {preview=formatBytes(encodeMessage(demo.draft,demo.sendMode,demo.ending),"hex");} catch {preview="等待有效内容";}
  return <Panel><div className="serial-log-toolbar"><Segmented aria-label="发送格式" options={[{label:"文本",value:"text"},{label:"HEX",value:"hex"}]} value={demo.sendMode} onChange={demo.setSendMode}/><span className="serial-caption">行尾</span><Segmented disabled={demo.sendMode==="hex"} options={[{label:"无",value:"none"},{label:"LF",value:"lf"},{label:"CRLF",value:"crlf"}]} value={demo.ending} onChange={demo.setEnding}/><Button type="primary" disabled={!demo.connected} onClick={demo.send}>发送</Button></div><Input.TextArea aria-label="发送内容" value={demo.draft} onChange={(e)=>demo.setDraft(e.target.value)} placeholder={demo.sendMode==="hex"?"例如：01 03 00 FF":"输入文本，Ctrl + Enter 发送"} autoSize={{minRows:3,maxRows:6}} onKeyDown={(e)=>{if(e.ctrlKey && e.key==="Enter"){e.preventDefault();demo.send();}}}/><div className="serial-byte-preview">字节预览：{preview}</div>{demo.error && <Alert type="error" title={demo.error} showIcon/>}<div role="status" className="serial-caption">{demo.notice}</div></Panel>;
}
function CommandsPanel() {
  const demo=useDemo();
  return <Panel><h3>快捷命令</h3><p className="serial-caption">点击填入发送区，不会自动发送。</p><Space direction="vertical" style={{width:"100%"}}>{["AT","AT+VERSION?","AT+RESET"].map((command)=><Button block key={command} onClick={()=>{demo.setDraft(command);demo.setSendMode("text");}}>{command}</Button>)}</Space><h3>发送历史</h3>{demo.history.length?demo.history.map((entry,index)=><button className="serial-history" key={index} onClick={()=>{demo.setDraft(entry.text);demo.setSendMode(entry.mode);demo.setEnding(entry.ending);}}><Tag>{entry.mode.toUpperCase()}</Tag><span>{entry.text}</span></button>):<p className="serial-caption">成功模拟发送后显示，最多保留 10 条。</p>}</Panel>;
}
const panels = {logs:LogPanel,send:SendPanel,commands:CommandsPanel};
function layout(api:DockviewApi) {
  api.clear();
  api.addPanel({id:"logs",component:"logs",title:"接收与发送日志"});
  api.addPanel({id:"commands",component:"commands",title:"命令",position:{referencePanel:"logs",direction:"left"},initialWidth:200});
  api.addPanel({id:"send",component:"send",title:"发送数据",position:{referencePanel:"logs",direction:"below"},initialHeight:230});
}

function SerialSession({initial,onSnapshot,onPortChange,transferring}:SessionViewProps) {
  const demo=useSerialDemo(initial?.demo,transferring);
  const api=useRef<DockviewApi|null>(null);
  const [port,setPort]=useState(initial?.config.port ?? "DEMO-01");
  const [baud,setBaud]=useState(initial?.config.baud ?? "115200");
  const [bits,setBits]=useState(initial?.config.bits ?? "8");
  const [parity,setParity]=useState(initial?.config.parity ?? "无");
  const [stop,setStop]=useState(initial?.config.stop ?? "1");
  const [flow,setFlow]=useState(initial?.config.flow ?? "无");
  useEffect(()=>{onSnapshot({config:{port,baud,bits,parity,stop,flow},demo:demo.saved});});
  const validBaud=/^[0-9]+$/.test(baud) && Number(baud)>=1 && Number(baud)<=4294967295;
  const options=(values:string[])=>values.map((value)=>({value,label:value}));
  return <DemoContext.Provider value={demo}><section className="serial-workbench"><div className="serial-connection"><FloatingSelect label="端口" value={port} onChange={setPort} onSelect={onPortChange} disabled={demo.connected} options={options(["DEMO-01","DEMO-02"])}/><div className="serial-baud"><span>波特率</span><AutoComplete aria-label="波特率" value={baud} onChange={setBaud} disabled={demo.connected} options={options(["9600","19200","38400","57600","115200","230400","460800","921600"])} status={validBaud?undefined:"error"} placeholder="选择或输入波特率" style={{width:"100%"}}/>{!validBaud && <small role="alert">请输入 1–4294967295 的整数</small>}</div><FloatingSelect label="数据位" value={bits} onChange={setBits} disabled={demo.connected} options={options(["5","6","7","8"])}/><FloatingSelect label="校验位" value={parity} onChange={setParity} disabled={demo.connected} options={[...options(["无","奇","偶"]),{value:"mark",label:"MARK（暂未支持）",disabled:true},{value:"space",label:"SPACE（暂未支持）",disabled:true}]}/><FloatingSelect label="停止位" value={stop} onChange={setStop} disabled={demo.connected} options={options(["1","2"])}/><FloatingSelect label="流控制" value={flow} onChange={setFlow} disabled={demo.connected} options={[...options(["无","RTS/CTS","XON/XOFF"]),{value:"dsr",label:"DTR/DSR（暂未支持）",disabled:true},{value:"dsr-xon",label:"DTR/DSR + XON/XOFF（暂未支持）",disabled:true},{value:"rts-xon",label:"RTS/CTS + XON/XOFF（暂未支持）",disabled:true}]}/><Button disabled={!demo.connected && !validBaud} type="primary" danger={demo.connected} onClick={demo.toggleConnect}>{demo.connected?"断开连接":"连接模拟端口"}</Button></div><div className="serial-workspace" ><DockviewReact components={panels} theme={themeLight} onReady={(event:DockviewReadyEvent)=>{api.current=event.api;layout(event.api);}}/></div><footer className="serial-status"><span><i className={demo.connected?"connected":""}/>{demo.connected?`${port} 已连接` : "未连接"}</span><span>{baud} · {bits} 数据位 · {parity}校验 · {stop} 停止位 · {flow}流控制（模拟配置）</span><strong>RX {demo.rx} B</strong><strong>TX {demo.tx} B</strong><Button size="small" onClick={demo.resetCounters}>计数归零</Button><Button size="small" onClick={()=>api.current && layout(api.current)}>恢复面板布局</Button></footer><p className="serial-caption">模拟端口每秒生成一条数据；发送会立即模拟回显。配置不会影响真实硬件，所有记录刷新后清除。</p></section></DemoContext.Provider>;
}

export default function SerialWorkbench() {
  return <SessionTabs renderSession={(props)=><SerialSession {...props}/>}/>;
}
