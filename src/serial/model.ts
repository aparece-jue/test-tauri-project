export type DataMode = "text" | "hex";
export type LineEnding = "none" | "lf" | "crlf";
export type RecordEntry = { id: number; time: string; direction: "RX" | "TX"; bytes: number[] };
export const MAX_RECORDS = 500;
export function encodeMessage(value: string, mode: DataMode, ending: LineEnding): number[] {
  if (!value.trim()) throw new Error("请输入要发送的内容");
  let bytes: number[];
  if (mode === "hex") {
    const hex = value.replace(/\s/g, "");
    if (!/^[\da-f]+$/i.test(hex) || hex.length % 2 !== 0) throw new Error("HEX 必须是完整字节，例如 01 03 00 FF");
    bytes = hex.match(/../g)!.map((part) => parseInt(part, 16));
  } else {
    bytes = Array.from(new TextEncoder().encode(value));
    if (ending === "lf") bytes.push(10);
    if (ending === "crlf") bytes.push(13, 10);
  }
  if (bytes.length > 4096) throw new Error("单次演示发送最多 4096 字节");
  return bytes;
}
export function formatBytes(bytes: number[], mode: DataMode): string {
  return mode === "hex" ? bytes.map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join(" ") : new TextDecoder().decode(new Uint8Array(bytes)).replace(/\r/g, "\\r").replace(/\n/g, "\\n");
}
