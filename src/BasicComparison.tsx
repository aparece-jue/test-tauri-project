import { useState } from "react";
import { Alert, Button, Input, Modal, Switch, Tag } from "antd";
import { Alert as MuiAlert, Button as MuiButton, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Switch as MuiSwitch, TextField } from "@mui/material";
import { invoke, isTauri } from "@tauri-apps/api/core";
import "./App.css";

function App() {
  const [name, setName] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [dialog, setDialog] = useState<"ant" | "mui" | null>(null);
  const [greetMsg, setGreetMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function greet() {
    if (!isTauri()) {
      setGreetMsg("当前是浏览器预览。请运行 pnpm tauri dev，在桌面窗口中调用 Rust。");
      return;
    }
    setBusy(true);
    try {
      setGreetMsg(await invoke<string>("greet", { name }));
    } catch (error) {
      setGreetMsg(`调用失败：${String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="comparison">
      <header>
        <span className="eyebrow">TAURI · REACT · UI LAB</span>
        <h1>Ant Design 与 MUI</h1>
        <p>相同内容，两种默认组件风格。试试输入、开关、按钮和弹窗。</p>
      </header>
      <div className="comparison-grid">
        <section className="library-panel" aria-labelledby="ant-title">
          <div className="panel-heading"><span className="library-number">01</span><h2 id="ant-title">Ant Design</h2><Tag color="blue">antd</Tag></div>
          <p className="intro">观察紧凑的控件、独立的表单标签与按钮边框。</p>
          <div className="sample"><h3>按钮</h3><div className="button-row"><Button type="primary" onClick={() => setDialog("ant")}>打开弹窗</Button><Button onClick={() => setName("")}>重置</Button><Button disabled>不可用</Button></div></div>
          <div className="sample"><h3>输入框</h3><label className="field-label" htmlFor="ant-name">姓名</label><Input id="ant-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="请输入姓名" /><p className="field-help">两侧共享输入内容，方便比较。</p></div>
          <div className="sample"><h3>开关与标签</h3><div className="control-row"><Switch checked={enabled} onChange={setEnabled} aria-label="启用通知" /><span>启用通知</span><Tag color={enabled ? "success" : "default"}>{enabled ? "已启用" : "已关闭"}</Tag></div></div>
          <div className="sample"><h3>提示</h3><Alert title="更改已自动同步到右侧" type="info" showIcon /></div>
          <form onSubmit={(e) => { e.preventDefault(); void greet(); }}><Button type="primary" htmlType="submit" loading={busy}>调用 Rust 问候</Button></form>
        </section>
        <section className="library-panel" aria-labelledby="mui-title">
          <div className="panel-heading"><span className="library-number">02</span><h2 id="mui-title">Material UI</h2><Chip label="MUI" color="primary" size="small" variant="outlined" /></div>
          <p className="intro">观察浮动标签、按钮阴影与点击时的涟漪反馈。</p>
          <div className="sample"><h3>按钮</h3><div className="button-row"><MuiButton variant="contained" onClick={() => setDialog("mui")}>打开弹窗</MuiButton><MuiButton variant="outlined" onClick={() => setName("")}>重置</MuiButton><MuiButton disabled>不可用</MuiButton></div></div>
          <div className="sample"><h3>输入框</h3><TextField id="mui-name" label="姓名" placeholder="请输入姓名" value={name} onChange={(e) => setName(e.target.value)} helperText="两侧共享输入内容，方便比较。" fullWidth /></div>
          <div className="sample"><h3>开关与标签</h3><div className="control-row"><FormControlLabel control={<MuiSwitch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />} label="启用通知" /><Chip label={enabled ? "已启用" : "已关闭"} color={enabled ? "success" : "default"} size="small" /></div></div>
          <div className="sample"><h3>提示</h3><MuiAlert severity="info">更改已自动同步到左侧</MuiAlert></div>
          <form onSubmit={(e) => { e.preventDefault(); void greet(); }}><MuiButton variant="contained" type="submit" disabled={busy}>{busy ? "调用中…" : "调用 Rust 问候"}</MuiButton></form>
        </section>
      </div>
      <p className="result" role="status">{greetMsg || "在任意一侧输入姓名，点击「调用 Rust 问候」可测试原来的 Tauri 功能。"}</p>
      <footer>对比保留组件默认尺寸与配色，仅统一外层布局。两套组件都可以进一步定制主题。</footer>
      <Modal title="Ant Design 弹窗" open={dialog === "ant"} onCancel={() => setDialog(null)} onOk={() => setDialog(null)} okText="确定" cancelText="取消"><p>你好，{name || "访客"}。观察弹窗的标题、按钮排列和关闭入口。</p></Modal>
      <Dialog open={dialog === "mui"} onClose={() => setDialog(null)} aria-labelledby="mui-dialog-title" fullWidth maxWidth="sm"><DialogTitle id="mui-dialog-title">Material UI 弹窗</DialogTitle><DialogContent>你好，{name || "访客"}。观察弹窗的标题、按钮排列和关闭方式。</DialogContent><DialogActions><MuiButton onClick={() => setDialog(null)}>取消</MuiButton><MuiButton onClick={() => setDialog(null)}>确定</MuiButton></DialogActions></Dialog>
    </main>
  );
}

export default App;
