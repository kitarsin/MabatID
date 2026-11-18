import { Fragment } from "react";

/** Renders **bold** markers from the card content as real <strong> text. */
export function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
        i % 2 ? <strong key={i} className="font-extrabold text-navy">{part}</strong> : <Fragment key={i}>{part}</Fragment>,
      )}
    </>
  );
}
