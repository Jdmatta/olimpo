import { beforeEach, describe, expect, it } from "vitest";
import { useWindowStore } from "./store";

function resetStore() {
  useWindowStore.setState({
    windows: {},
    focusedId: null,
    nextZ: 1,
    nextInstance: 0,
    savedLayouts: {},
  });
}

const s = () => useWindowStore.getState();

describe("window manager store", () => {
  beforeEach(resetStore);

  it("open cria janela focada com z crescente", () => {
    const a = s().open("files");
    const b = s().open("github");
    expect(s().focusedId).toBe(b);
    expect(s().windows[b].z).toBeGreaterThan(s().windows[a].z);
  });

  it("apps singleton não duplicam: segundo open foca a existente", () => {
    const a = s().open("files");
    const again = s().open("files");
    expect(again).toBe(a);
    expect(Object.keys(s().windows)).toHaveLength(1);
    expect(s().focusedId).toBe(a);
  });

  it("terminal é multi-instância", () => {
    const a = s().open("terminal");
    const b = s().open("terminal");
    expect(a).not.toBe(b);
    expect(Object.keys(s().windows)).toHaveLength(2);
  });

  it("focus traz janela para frente", () => {
    const a = s().open("files");
    const b = s().open("github");
    s().focus(a);
    expect(s().focusedId).toBe(a);
    expect(s().windows[a].z).toBeGreaterThan(s().windows[b].z);
  });

  it("focus em janela minimizada é ignorado", () => {
    const a = s().open("files");
    const b = s().open("github");
    s().minimize(a);
    s().focus(a);
    expect(s().focusedId).toBe(b);
  });

  it("minimize tira foco e promove a próxima do topo", () => {
    const a = s().open("files");
    const b = s().open("github");
    s().minimize(b);
    expect(s().windows[b].minimized).toBe(true);
    expect(s().focusedId).toBe(a);
  });

  it("open de app singleton minimizado restaura", () => {
    const a = s().open("files");
    s().minimize(a);
    s().open("files");
    expect(s().windows[a].minimized).toBe(false);
    expect(s().focusedId).toBe(a);
  });

  it("activateApp abre quando não existe, restaura quando tudo minimizado", () => {
    s().activateApp("focus");
    const id = s().focusedId!;
    expect(s().windows[id].appId).toBe("focus");
    s().minimize(id);
    s().activateApp("focus");
    expect(s().windows[id].minimized).toBe(false);
  });

  it("close remove e repassa foco ao topo restante", () => {
    const a = s().open("files");
    const b = s().open("github");
    s().close(b);
    expect(s().windows[b]).toBeUndefined();
    expect(s().focusedId).toBe(a);
    s().close(a);
    expect(s().focusedId).toBeNull();
  });

  it("toggleMaximize guarda e restaura o rect anterior", () => {
    const a = s().open("files");
    const original = s().windows[a].rect;
    s().toggleMaximize(a);
    expect(s().windows[a].maximized).toBe(true);
    expect(s().windows[a].prevRect).toEqual(original);
    s().toggleMaximize(a);
    expect(s().windows[a].maximized).toBe(false);
    expect(s().windows[a].rect).toEqual(original);
    expect(s().windows[a].prevRect).toBeNull();
  });

  it("setRect atualiza o rect", () => {
    const a = s().open("files");
    const rect = { x: 10, y: 40, w: 700, h: 500 };
    s().setRect(a, rect);
    expect(s().windows[a].rect).toEqual(rect);
  });

  it("open usa layout salvo quando existe (inclusive maximizado)", () => {
    const rect = { x: 33, y: 66, w: 800, h: 500 };
    s().hydrateLayouts({ files: { rect, maximized: true } });
    const a = s().open("files");
    expect(s().windows[a].rect).toEqual(rect);
    expect(s().windows[a].maximized).toBe(true);
    expect(s().windows[a].prevRect).toEqual(rect);
    // Sem layout salvo: usa spawn default.
    const b = s().open("github");
    expect(s().windows[b].maximized).toBe(false);
  });
});
