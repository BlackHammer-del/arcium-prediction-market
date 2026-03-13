export type XorWasmExports = {
  memory: WebAssembly.Memory;
  xor: (ptr: number, len: number, keyPtr: number, keyLen: number) => void;
};

let wasmPromise: Promise<XorWasmExports | null> | null = null;

function isBrowserWasmReady(): boolean {
  return typeof window !== "undefined" && typeof WebAssembly !== "undefined";
}

async function loadXorWasm(): Promise<XorWasmExports | null> {
  if (!isBrowserWasmReady()) return null;
  if (wasmPromise) return wasmPromise;

  wasmPromise = (async () => {
    try {
      const response = await fetch("/crypto/xor.wasm", { cache: "force-cache" });
      if (!response.ok) return null;
      const bytes = await response.arrayBuffer();
      const { instance } = await WebAssembly.instantiate(bytes, {});
      const exports = instance.exports as unknown as XorWasmExports;
      if (!exports?.memory || typeof exports.xor !== "function") return null;
      return exports;
    } catch {
      return null;
    }
  })();

  return wasmPromise;
}

function ensureMemory(exports: XorWasmExports, requiredBytes: number): void {
  const memory = exports.memory;
  const current = memory.buffer.byteLength;
  if (current >= requiredBytes) return;
  const missing = requiredBytes - current;
  const pages = Math.ceil(missing / 65536);
  memory.grow(pages);
}

function alignOffset(value: number, alignment: number): number {
  if (alignment <= 1) return value;
  return Math.ceil(value / alignment) * alignment;
}

export async function xorBytesWasm(data: Uint8Array, key: Uint8Array): Promise<Uint8Array> {
  const wasm = await loadXorWasm();
  if (!wasm) {
    throw new Error("WASM module unavailable");
  }

  if (key.length === 0) return data.slice();

  const dataPtr = 0;
  const keyPtr = alignOffset(data.length + 1, 8);
  const total = keyPtr + key.length + 1;
  ensureMemory(wasm, total);

  const memory = new Uint8Array(wasm.memory.buffer);
  memory.set(data, dataPtr);
  memory.set(key, keyPtr);
  wasm.xor(dataPtr, data.length, keyPtr, key.length);

  const out = memory.slice(dataPtr, dataPtr + data.length);
  memory.fill(0, dataPtr, dataPtr + data.length);
  memory.fill(0, keyPtr, keyPtr + key.length);
  return out;
}
