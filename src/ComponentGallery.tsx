import DockviewDemo from "./components/DockviewDemo";
import { useState, type ReactNode } from "react";
import * as A from "antd";
import * as M from "@mui/material";
import { FloatingSelect } from "./components/FloatingSelect";
import BasicComparison from "./BasicComparison";
import { FloatingInput, FormFloatingInput } from "./components/FloatingInput";
import "./App.css";

function Pair({ title, note, ant, mui }: { title: string; note: string; ant: ReactNode; mui: ReactNode }) {
  return <section className="demo-section"><h2>{title}</h2><p className="section-note">{note}</p><div className="comparison-grid"><article className="library-panel"><h3 className="column-title">Ant Design</h3>{ant}</article><article className="library-panel"><h3 className="column-title">Material UI</h3>{mui}</article></div></section>;
}

function UnifiedPreview() {
  const [size, setSize] = useState<"small" | "middle" | "large">("middle");
  const [name, setName] = useState("");
  const [role, setRole] = useState("design");
  const [saved, setSaved] = useState("");
  return <section className="library-panel unified-preview"><h2>统一风格预览</h2><p className="section-note">相同尺寸、圆角和主题色；浮动标签保留。切换尺寸可检查同排对齐。</p><A.Radio.Group aria-label="组件尺寸" value={size} onChange={(e) => setSize(e.target.value)} options={[{label:"小号 32",value:"small"},{label:"默认 40",value:"middle"},{label:"大号 48",value:"large"}]} optionType="button" /><div className="unified-controls"><FloatingInput label="姓名" value={name} onChange={(e) => setName(e.target.value)} size={size} allowClear /><FloatingSelect label="岗位" value={role} onChange={setRole} size={size} options={[{value:"design",label:"设计"},{value:"development",label:"开发"}]} /><A.Button type="primary" size={size} onClick={() => setSaved(`已保存演示设置：${name || "访客"} · ${role === "design" ? "设计" : "开发"}`)}>保存</A.Button></div><p role="status">{saved}</p></section>;
}
function InputLab() {
  const [value, setValue] = useState("");
  const [disabled, setDisabled] = useState(false);
  const [error, setError] = useState(false);
  const [brand, setBrand] = useState("#1677ff");
  const [saved, setSaved] = useState("");
  const [form] = A.Form.useForm();
  return <>
    <UnifiedPreview />
    <A.Alert type="info" showIcon title="推荐组合：Ant Design 整体界面 + 自定义浮动标签输入框" description="下方第三个输入框仅依赖 Ant Design。它保留 value / onChange / ref，可直接放进 Form.Item。不是把 MUI 的源码转换成 Ant Design，而是在 Ant Input 上实现同类交互。" />
    <div className="toolbar"><A.Checkbox checked={disabled} onChange={(e) => setDisabled(e.target.checked)}>禁用</A.Checkbox><A.Checkbox checked={error} onChange={(e) => setError(e.target.checked)}>错误状态</A.Checkbox><span>定制组件主题</span><A.Select aria-label="定制组件主题" value={brand} onChange={setBrand} options={[{value:"#1677ff", label:"蓝色"}, {value:"#722ed1", label:"紫色"}, {value:"#138568", label:"绿色"}]} /><A.Button onClick={() => setValue("")}>清空内容</A.Button></div>
    <div className="input-trio">
      <article className="library-panel"><h3>Ant 原版</h3><label className="field-label" htmlFor="original-name">姓名</label><A.Input id="original-name" value={value} onChange={(e) => setValue(e.target.value)} disabled={disabled} status={error ? "error" : undefined} allowClear placeholder="请输入姓名" /><p className="field-help">标签始终在输入框外。</p></article>
      <article className="library-panel"><h3>MUI 原版</h3><M.TextField id="material-name" fullWidth label="姓名" value={value} onChange={(e) => setValue(e.target.value)} disabled={disabled} error={error} helperText={error ? "请检查姓名" : "聚焦时标签上浮。"} /></article>
      <article className="library-panel"><h3>Ant 定制版 <A.Tag color="green">推荐</A.Tag></h3><A.ConfigProvider theme={{ token: { colorPrimary: brand } }}><FloatingInput label="姓名" value={value} onChange={(e) => setValue(e.target.value)} disabled={disabled} status={error ? "error" : undefined} allowClear helperText={error ? "请检查姓名" : "浮动标签 + Ant Design 能力。"} /></A.ConfigProvider></article>
    </div>
    <section className="library-panel form-demo"><h2>真实表单：校验、回填与重置</h2><p className="section-note">直接提交空表单可看错误状态；输入邮箱后提交，或试试回填与重置。</p><A.ConfigProvider theme={{ token: { colorPrimary: brand } }}><A.Form noValidate form={form} onFinish={(values) => setSaved(`已提交：${values.email}`)}><A.Form.Item name="email" rules={[{required:true, message:"请输入邮箱"}, {type:"email", message:"请输入有效邮箱"}]}><FormFloatingInput label="邮箱" type="email" autoComplete="email" allowClear /></A.Form.Item><div className="button-row"><A.Button type="primary" htmlType="submit">提交</A.Button><A.Button onClick={() => form.setFieldsValue({email:"hello@example.com"})}>回填示例</A.Button><A.Button onClick={() => { form.resetFields(); setSaved(""); }}>重置表单</A.Button></div></A.Form></A.ConfigProvider><p role="status">{saved}</p><FloatingInput label="小尺寸 / 非受控输入" size="small" defaultValue="可以编辑这段文字" helperText="也支持 defaultValue。" /></section>
  </>;
}

const people = [
  {key:1, name:"林晓", role:"产品设计", progress:78, status:"进行中"},
  {key:2, name:"陈雨", role:"前端开发", progress:100, status:"已完成"},
  {key:3, name:"周宁", role:"后端开发", progress:46, status:"进行中"},
  {key:4, name:"许安", role:"质量测试", progress:20, status:"待确认"},
  {key:5, name:"苏禾", role:"项目管理", progress:92, status:"进行中"},
  {key:6, name:"沈言", role:"交互设计", progress:100, status:"已完成"},
];
function DataLab() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(1);
  const [page, setPage] = useState(1);
  const [ascending, setAscending] = useState(true);
  const filtered = people.filter((p) => `${p.name}${p.role}`.includes(query));
  const sorted = [...filtered].sort((a,b) => ascending ? a.progress-b.progress : b.progress-a.progress);
  const visible = sorted.slice((page-1)*3, page*3);
  return <>
    <div className="toolbar"><A.Input.Search aria-label="搜索成员" placeholder="搜索姓名或岗位，两侧同步" value={query} onChange={(e) => {setQuery(e.target.value); setPage(1);}} allowClear style={{maxWidth:360}} /><span>已选：{people.find((p) => p.key === selected)?.name}</span></div>
    <Pair title="联系人列表" note="Ant Listy 负责列表渲染，行内容可自行组合；MUI 通过 ListItemButton 组合可点击行。点击任意成员，两侧同步选择。" ant={<>{filtered.length ? <A.Listy rowKey="key" items={filtered} itemRender={(p) => <div className={`person-row ${selected === p.key ? "selected-person" : ""}`}><A.Avatar style={{background:"#e6f4ff", color:"#1677ff"}}>{p.name[0]}</A.Avatar><div className="person-copy"><strong>{p.name}</strong><span>{p.role}</span></div><A.Button type="link" onClick={() => setSelected(p.key)} aria-pressed={selected === p.key}>{selected === p.key ? "已选择" : "选择"}</A.Button></div>} /> : <A.Empty description="没有匹配成员" />}</>} mui={<M.List>{filtered.map((p) => <M.ListItemButton key={p.key} selected={selected === p.key} onClick={() => setSelected(p.key)}><M.ListItemAvatar><M.Avatar>{p.name[0]}</M.Avatar></M.ListItemAvatar><M.ListItemText primary={p.name} secondary={p.role} /></M.ListItemButton>)}{!filtered.length && <M.Typography color="text.secondary">没有匹配成员</M.Typography>}</M.List>} />
    <Pair title="数据表格" note="同一份数据、相同分页。点击进度表头排序。Ant Table 用列配置描述行为；MUI 基础 Table 由多个组件组合，本例手动连接排序与分页。" ant={<A.Table size="small" rowKey="key" dataSource={filtered} pagination={{current:page, pageSize:3, onChange:setPage, showSizeChanger:false}} onChange={(_pagination,_filters,sorter) => {if (!Array.isArray(sorter)) setAscending(sorter.order !== "descend");}} columns={[{title:"姓名", dataIndex:"name"}, {title:"状态", dataIndex:"status", render:(s:string) => <A.Tag color={s === "已完成" ? "success" : "processing"}>{s}</A.Tag>}, {title:"进度", dataIndex:"progress", sorter:(a,b) => a.progress-b.progress, sortOrder:ascending ? "ascend" : "descend", sortDirections:["ascend","descend","ascend"], render:(n:number) => `${n}%`}]} />} mui={<><M.TableContainer><M.Table size="small" aria-label="成员进度"><M.TableHead><M.TableRow><M.TableCell>姓名</M.TableCell><M.TableCell>状态</M.TableCell><M.TableCell><M.TableSortLabel active direction={ascending ? "asc" : "desc"} onClick={() => {setAscending(!ascending); setPage(1);}}>进度</M.TableSortLabel></M.TableCell></M.TableRow></M.TableHead><M.TableBody>{visible.map((p) => <M.TableRow key={p.key}><M.TableCell>{p.name}</M.TableCell><M.TableCell><M.Chip size="small" label={p.status} color={p.status === "已完成" ? "success" : "primary"} variant="outlined" /></M.TableCell><M.TableCell>{p.progress}%</M.TableCell></M.TableRow>)}{!visible.length && <M.TableRow><M.TableCell colSpan={3}>没有匹配成员</M.TableCell></M.TableRow>}</M.TableBody></M.Table></M.TableContainer><M.Pagination sx={{mt:2}} count={Math.max(1,Math.ceil(filtered.length/3))} page={page} onChange={(_,n) => setPage(n)} /></>} />
  </>;
}

function MoreLab() {
  const [role, setRole] = useState("design");
  const [tab, setTab] = useState("overview");
  const [expanded, setExpanded] = useState(false);
  const [progress, setProgress] = useState(45);
  const [rating, setRating] = useState<number | null>(3);
  const [drawer, setDrawer] = useState<"ant" | "mui" | null>(null);
  const [toast, setToast] = useState(false);
  const [message, context] = A.message.useMessage();
  const roles = [{value:"design",label:"设计"},{value:"development",label:"开发"},{value:"testing",label:"测试"}];
  return <>{context}
    <Pair title="下拉选择" note="比较下拉面板、选中项和标签位置。选择结果同步。" ant={<FloatingSelect label="岗位" value={role} onChange={setRole} options={roles} />} mui={<M.TextField select fullWidth label="岗位" value={role} onChange={(e) => setRole(e.target.value)}>{roles.map((r) => <M.MenuItem key={r.value} value={r.value}>{r.label}</M.MenuItem>)}</M.TextField>} />
    <Pair title="标签页" note="比较激活下划线、文字间距与切换反馈。" ant={<A.Tabs className="roomy-tabs" tabBarGutter={0} activeKey={tab} onChange={setTab} items={[{key:"overview",label:"概览",children:"项目概览：当前有 6 位成员。"},{key:"activity",label:"动态",children:"最新动态：组件对比页已更新。"}]} />} mui={<><M.Tabs value={tab} onChange={(_,v:string) => setTab(v)} aria-label="项目标签页"><M.Tab id="mui-tab-overview" aria-controls="mui-tab-panel" value="overview" label="概览" /><M.Tab id="mui-tab-activity" aria-controls="mui-tab-panel" value="activity" label="动态" /></M.Tabs><p role="tabpanel" id="mui-tab-panel" aria-labelledby={`mui-tab-${tab}`}>{tab === "overview" ? "项目概览：当前有 6 位成员。" : "最新动态：组件对比页已更新。"}</p></>} />
    <Pair title="折叠面板" note="Ant 默认带边框分区；MUI 默认表现为带阴影的面板。" ant={<A.Collapse expandIconPosition="end" expandIcon={({ isActive }) => <svg className="collapse-chevron" style={{ transform: isActive ? "rotate(180deg)" : "rotate(0deg)" }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>} activeKey={expanded ? ["details"] : []} onChange={(keys) => setExpanded(keys.length > 0)} items={[{key:"details",label:"查看项目详情",children:"这是一个 Tauri 桌面应用，界面使用 React 构建。"}]} />} mui={<M.Accordion expanded={expanded} onChange={(_,v) => setExpanded(v)}><M.AccordionSummary expandIcon={<span>⌄</span>} id="mui-details-header" aria-controls="mui-details-content">查看项目详情</M.AccordionSummary><M.AccordionDetails id="mui-details-content">这是一个 Tauri 桌面应用，界面使用 React 构建。</M.AccordionDetails></M.Accordion>} />
    <Pair title="滑块与进度" note="拖动滑块观察轨道、滑块形状与进度反馈；两侧数值同步。" ant={<><A.Slider aria-label="Ant 进度" value={progress} onChange={setProgress} /><A.Progress percent={progress} /></>} mui={<><M.Slider aria-label="MUI 进度" value={progress} onChange={(_,v) => setProgress(v as number)} valueLabelDisplay="auto" /><M.LinearProgress variant="determinate" value={progress} /><p>{progress}%</p></>} />
    <Pair title="评分" note="比较星形、悬停和选中效果。" ant={<A.Rate value={rating ?? 0} onChange={setRating} />} mui={<M.Rating name="mui-rating" value={rating} onChange={(_,v) => setRating(v)} />} />
    <Pair title="侧边抽屉与消息" note="点击打开抽屉或显示短消息。两套组件的位置、留白和动效不同。" ant={<div className="button-row"><A.Button onClick={() => setDrawer("ant")}>打开抽屉</A.Button><A.Button onClick={() => message.success("Ant Design：保存成功")}>显示消息</A.Button></div>} mui={<div className="button-row"><M.Button variant="outlined" onClick={() => setDrawer("mui")}>打开抽屉</M.Button><M.Button onClick={() => setToast(true)}>显示消息</M.Button></div>} />
    <A.Drawer title="Ant Design 抽屉" open={drawer === "ant"} onClose={() => setDrawer(null)}><p>可以在这里放详情、设置或编辑表单。</p><A.Button onClick={() => setDrawer(null)}>关闭</A.Button></A.Drawer>
    <M.Drawer anchor="right" open={drawer === "mui"} onClose={() => setDrawer(null)}><div className="drawer-content"><h2>Material UI 抽屉</h2><p>可以在这里放详情、设置或编辑表单。</p><M.Button onClick={() => setDrawer(null)}>关闭</M.Button></div></M.Drawer>
    <M.Snackbar open={toast} autoHideDuration={3000} onClose={() => setToast(false)} message="Material UI：保存成功" action={<M.Button color="inherit" onClick={() => setToast(false)}>关闭</M.Button>} />
  </>;
}

export default function App() {
  return <main className="gallery"><header className="gallery-header"><span className="eyebrow">COMPONENT EXPLORER · TAURI + REACT</span><h1>找到你喜欢的界面语言</h1><p>以 Ant Design 为主，借鉴 MUI 的浮动标签。先试输入框，再比较数据与交互组件。</p></header><A.Tabs className="roomy-tabs" tabBarGutter={0} defaultActiveKey="dockview" items={[{key:"dockview",label:"Dockview 演示",children:<DockviewDemo />},{key:"inputs",label:"定制输入框",children:<InputLab />},{key:"data",label:"列表与表格",children:<DataLab />},{key:"more",label:"更多组件",children:<MoreLab />},{key:"basic",label:"基础组件与 Rust",children:<BasicComparison />}]} /><footer className="gallery-footer">本页使用演示数据。列表和表格可以搜索、选择、排序与分页；不会写入外部数据。</footer></main>;
}







