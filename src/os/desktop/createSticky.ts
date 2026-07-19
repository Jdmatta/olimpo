import { noteAdd } from "../../lib/ipc";
import { useFocusStore } from "../focus/focusStore";
import { STICKY_COLORS } from "./StickyLayer";

/**
 * Cria um post-it no desktop. Tópico herda a tarefa em foco (se houver) —
 * é o elo estudo → nota → flashcard.
 */
export async function createSticky(): Promise<void> {
  // Herda a tarefa em foco como tópico (liga estudo → nota); senão "geral".
  const { currentTodoTitle } = useFocusStore.getState();
  const topic = currentTodoTitle ? currentTodoTitle.slice(0, 60) : "geral";
  const color = STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)];
  const x = 180 + Math.random() * (window.innerWidth * 0.4);
  const y = 80 + Math.random() * (window.innerHeight * 0.35);
  await noteAdd(topic, color, Math.round(x), Math.round(y));
  window.dispatchEvent(new Event("olimpo:notes-changed"));
}
