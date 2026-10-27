import React from "react";
import { TextStyle, StyleProp } from "react-native";
import { Text } from "@/components/MayaText";
import { ThemedText } from "@/components/ThemedText";

export interface MentionPerson {
  id?: string;
  name: string;
  initials?: string;
  avatar?: string;
}

type Part = { text: string; person?: MentionPerson; mention?: boolean };

const BOUNDARY = /[\s.,!?;:।)\]}'"’”-]/;

/**
 * Split text into plain parts and @mentions. A mention of someone in `people` (matched by full
 * name, longest first, so "@Abdul Karim" wins over "@Abdul") is linked to that person; any other
 * "@word" is only coloured.
 */
export function splitMentions(text: string, people: MentionPerson[]): Part[] {
  const known = [...people].filter((p) => p.name).sort((a, b) => b.name.length - a.name.length);
  const out: Part[] = [];
  let buf = "";
  let i = 0;
  const flush = () => {
    if (buf) out.push({ text: buf });
    buf = "";
  };
  while (i < text.length) {
    const ch = text[i];
    const startOk = ch === "@" && (i === 0 || /\s|\(/.test(text[i - 1]));
    if (startOk) {
      const rest = text.slice(i + 1);
      const hit = known.find((p) => {
        if (rest.slice(0, p.name.length).toLowerCase() !== p.name.toLowerCase()) return false;
        const next = rest.charAt(p.name.length);
        return next === "" || BOUNDARY.test(next);
      });
      if (hit) {
        flush();
        out.push({ text: "@" + rest.slice(0, hit.name.length), person: hit, mention: true });
        i += 1 + hit.name.length;
        continue;
      }
      const word = /^[\p{L}\p{N}\p{M}_.]+/u.exec(rest);
      if (word) {
        flush();
        out.push({ text: "@" + word[0].replace(/\.+$/, ""), mention: true });
        i += 1 + word[0].replace(/\.+$/, "").length;
        continue;
      }
    }
    buf += ch;
    i++;
  }
  flush();
  return out;
}

/** Text where @mentions stand out in `mentionColor`; tapping a known person calls onPressPerson. */
export function MentionText({
  text,
  people,
  onPressPerson,
  style,
  mentionColor,
}: {
  text: string;
  people: MentionPerson[];
  onPressPerson: (p: MentionPerson) => void;
  style?: StyleProp<TextStyle>;
  mentionColor: string;
}) {
  const parts = splitMentions(text || "", people);
  return (
    <ThemedText style={style}>
      {parts.map((p, idx) =>
        p.mention ? (
          <Text
            key={idx}
            style={{ color: mentionColor, fontWeight: "700" }}
            onPress={p.person ? () => onPressPerson(p.person!) : undefined}
            suppressHighlighting
            accessibilityRole={p.person ? "link" : undefined}
            testID={p.person ? "mention-link" : "mention"}
          >
            {p.text}
          </Text>
        ) : (
          <Text key={idx}>{p.text}</Text>
        ),
      )}
    </ThemedText>
  );
}

export default MentionText;
