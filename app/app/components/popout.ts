import { useEffect, useState } from "react";

/**
 * The terminals of a topic in a window of their own. The window says it is open on a BroadcastChannel,
 * so the topic's page knows after a reload or a trip to another topic, and the page's own panel stops
 * showing the same shells.
 */
const CHANNEL = "cka-terminal";
type Message = { open?: string; closed?: string; ping?: true };

/** For a topic page: whether its terminals have a window of their own, and opening one. */
export function usePopout(topic: string) {
  const [popped, setPopped] = useState(false);
  useEffect(() => {
    setPopped(false);
    const ch = new BroadcastChannel(CHANNEL);
    ch.onmessage = (e: MessageEvent<Message>) => {
      if (e.data.open === topic) setPopped(true);
      if (e.data.closed === topic) setPopped(false);
    };
    ch.postMessage({ ping: true } satisfies Message);
    return () => ch.close();
  }, [topic]);
  const open = () => {
    if (window.open(`/terminal?topic=${encodeURIComponent(topic)}`, "cka-terminal", "popup,width=960,height=640")) setPopped(true);
  };
  return { popped, open };
}

/** For the window itself: answers each page that asks, and says so when it closes. */
export function useAnnouncePopout(topic: string) {
  useEffect(() => {
    const ch = new BroadcastChannel(CHANNEL);
    const open = () => ch.postMessage({ open: topic } satisfies Message);
    ch.onmessage = (e: MessageEvent<Message>) => e.data.ping && open();
    open();
    const closed = () => ch.postMessage({ closed: topic } satisfies Message);
    addEventListener("pagehide", closed);
    return () => {
      removeEventListener("pagehide", closed);
      closed();
      ch.close();
    };
  }, [topic]);
}
