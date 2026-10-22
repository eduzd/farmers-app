import React from "react";
import { Feather } from "@expo/vector-icons";
import { ChatIcon } from "./ChatIcon";

/** Feather icon names that mean chat / message / comment. They all draw the app's own ChatIcon. */
export const CHAT_ICON_NAMES = new Set<string>(["message-circle", "message-square"]);

export function isChatIconName(name: unknown): boolean {
  return typeof name === "string" && CHAT_ICON_NAMES.has(name);
}

type Props = React.ComponentProps<typeof Feather>;

/**
 * Drop-in for <Feather name=...>: same props. Chat / message / comment names render the shared
 * ChatIcon (the Chats tab icon), every other name renders Feather as before.
 */
export function AppIcon(props: Props) {
  const { name, size = 20, color, style, testID } = props as any;
  if (isChatIconName(name)) {
    return <ChatIcon size={size} color={typeof color === "string" ? color : undefined} style={style} testID={testID} />;
  }
  return <Feather {...props} />;
}

export default AppIcon;
