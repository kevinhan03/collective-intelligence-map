import { Fragment, type ReactNode } from "react";

// Renders `<tag>chunk</tag>` markup in a translated message with React nodes,
// so a highlighted or linked phrase stays inside one translatable sentence.
export function rich(
  message: string,
  tags: Record<string, (chunk: ReactNode) => ReactNode>,
): ReactNode {
  const parts = message.split(/(<(\w+)>[\s\S]*?<\/\2>)/g);
  const nodes: ReactNode[] = [];
  for (let i = 0; i < parts.length; i++) {
    const match = /^<(\w+)>([\s\S]*)<\/\1>$/.exec(parts[i]);
    if (match && tags[match[1]]) {
      nodes.push(<Fragment key={i}>{tags[match[1]](match[2])}</Fragment>);
      i++;
    } else if (parts[i]) nodes.push(parts[i]);
  }
  return nodes;
}
