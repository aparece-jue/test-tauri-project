# 定制 Ant Design 组件说明

本项目以 Ant Design 为主要 UI 库，借鉴 MUI 的浮动标签交互。这里的“定制组件”是项目内的 React 封装，不是单独发布的 npm 库。MUI 保留在对比页面中；FloatingInput 和 FloatingSelect 本身不依赖 MUI。

## 文件位置

| 文件 | 用途 |
| --- | --- |
| `src/theme.ts` | 集中维护 Ant Design 主题、尺寸、字体和组件 Token |
| `src/main.tsx` | 用 ConfigProvider 将主题应用到整个应用 |
| `src/components/FloatingInput.tsx` | FloatingInput，以及用于 Form.Item 的 FormFloatingInput |
| `src/components/FloatingInput.css` | 浮动标签、边框、聚焦和错误状态样式 |
| `src/components/FloatingSelect.tsx` | 单选浮动标签下拉框 |
| `src/components/FloatingSelect.css` | 下拉框外观、浮动标签和聚焦状态 |
| `src/ComponentGallery.tsx` | 组件对比、统一风格预览、标签页与折叠面板演示 |
| `src/App.css` | 演示布局、roomy-tabs 标签页样式、折叠箭头动画 |
| `src/BasicComparison.tsx` | 原有基础组件和 Tauri Rust 调用示例 |

## 统一风格

- 主色：`#1677ff`。
- 圆角：6px。
- 字体：Segoe UI / Microsoft YaHei；基础字号 14px。
- 控件高度：small 32px、middle（默认）40px、large 48px。
- 输入框和下拉框聚焦时改变边框颜色，不增加额外外圈阴影。
- 定制组件通过 `theme.useToken()` 读取主题，避免单独维护颜色与尺寸。
- MUI 对比区保留自己的主题，便于观察差别。

修改全局风格优先编辑 `src/theme.ts`。局部颜色可用嵌套的 ConfigProvider 覆盖。定制组件需要显式传递 `size` 来切换尺寸；目前没有读取 ConfigProvider 的 componentSize 上下文。

## FloatingInput

以下示例假设调用文件位于 `src/`。

```tsx
import { useState } from "react";
import { FloatingInput } from "./components/FloatingInput";

export function NameField() {
  const [name, setName] = useState("");
  return (
    <FloatingInput
      label="姓名"
      value={name}
      onChange={(event) => setName(event.target.value)}
      helperText="请输入姓名"
      allowClear
      size="middle"
    />
  );
}
```

`label` 必填，`helperText` 可选。支持 Ant Input 的常用属性，如 value、defaultValue、onChange、disabled、status、size、type、allowClear，以及 InputRef。聚焦或有内容时标签上浮，空内容失焦后标签回到框内。

当前封装不支持 prefix、suffix、addonBefore、addonAfter 和 variant；多行输入和密码可见性切换也没有单独封装。不要将它当作所有 Ant 输入组件的直接替代品。

### 接入表单

Form.Item 内使用 FormFloatingInput，它会读取表单校验状态并传给 FloatingInput。

```tsx
import { Form, Button } from "antd";
import { FormFloatingInput } from "./components/FloatingInput";

export function EmailForm() {
  return (
    <Form noValidate onFinish={(values) => console.log(values)}>
      <Form.Item
        name="email"
        rules={[
          { required: true, message: "请输入邮箱" },
          { type: "email", message: "请输入有效邮箱" },
        ]}
      >
        <FormFloatingInput label="邮箱" type="email" allowClear />
      </Form.Item>
      <Button type="primary" htmlType="submit">提交</Button>
    </Form>
  );
}
```

表单中的值交给 Form.Item 管理；通过 form.setFieldsValue 回填，通过 form.resetFields 重置。浮动标签已承担可见标签作用，通常不再给 Form.Item 配置重复的可见 label。noValidate 将示例校验统一交给 Ant Form。

### 边框实现

使用一个绝对定位的边框层和带背景的 label，在标签位置遮出完整缺口。之前的 fieldset/legend 方案已移除，避免两套缺口重叠。调整时需同时检查空值聚焦、有值聚焦、有值失焦以及小尺寸状态。

## FloatingSelect

```tsx
import { useState } from "react";
import { FloatingSelect } from "./components/FloatingSelect";

export function RoleField() {
  const [role, setRole] = useState("design");
  return (
    <FloatingSelect
      label="岗位"
      value={role}
      onChange={setRole}
      options={[
        { value: "design", label: "设计" },
        { value: "development", label: "开发" },
      ]}
      size="middle"
    />
  );
}
```

当前接口：label、value（可选字符串）、onChange、options（字符串 value / label）、disabled、size。底层是 Ant Select，保留其单选与键盘交互，箭头随展开状态旋转。

这是精简的单选接口，尚未封装多选、搜索、清空、分组选项、校验状态和 ref，也未提供专用的表单适配组件。需要这些功能时，应扩展类型与属性透传后再使用，而不是直接传入未支持的 Select 属性。

## 其他定制

### 标签页

目前仍直接使用 Ant Tabs，尚未提取独立组件：

```tsx
<Tabs className="roomy-tabs" tabBarGutter={0} items={items} />
```

roomy-tabs 的 CSS 在 App.css：标签最小宽度 90px、最小高度 48px、左右各 20px 留白、字重 500。指示条跟随加宽后的标签项。复用到其他项目时需要同时带上这段样式。

### 折叠面板

ComponentGallery.tsx 中通过 Collapse 的 expandIcon 自定义 SVG，位置设为 end：收起向下，展开旋转 180 度向上。collapse-chevron 的旋转动画在 App.css，减少动态效果偏好下禁用动画。尚未提取独立组件。

### 数据表格

主题中的 Table.bodySortBg 设置为 transparent，headerSortActiveBg 与 headerBg 一致。只去掉排序列的额外底色，保留排序逻辑、箭头与悬停高亮。此设置影响全局 Ant Table。

## 查看与验证

在项目根目录运行：

```sh
pnpm tauri dev   # 桌面窗口，支持 Rust 调用
pnpm dev         # 浏览器预览，无法直接执行桌面 Rust 命令
pnpm build       # TypeScript 检查与前端构建
```

“定制输入框”页顶部有统一风格预览，可切换三个尺寸；“更多组件”里包含定制下拉框、标签页和折叠面板。

修改后的人工检查建议：

- 三种尺寸下输入框、下拉框、按钮是否对齐。
- 浮动标签在聚焦、输入、清空和失焦后的位置与边框是否正确。
- 表单必填、邮箱格式校验、回填和重置是否正常。
- 下拉框键盘选择、Escape 关闭与禁用状态是否正常。
- 窄窗口中控件是否溢出。

当前演示仍同时包含 Ant Design 与 MUI，构建存在较大 chunk 提示。选型完成后可移除不用的对比代码和依赖；本说明不代表全部组件已完成所有状态的自动化测试。

