import { ORDER_PATH } from "../lib/content";

export function OrderPath({ id }: { id: string }) {
  return (
    <ol className="path" aria-labelledby={id}>
      {ORDER_PATH.map((s, i) => (
        <li key={s.name}>
          <span className="path-n">{i + 1}</span>
          <b>{s.name}</b>
          <small>{s.text}</small>
        </li>
      ))}
    </ol>
  );
}
