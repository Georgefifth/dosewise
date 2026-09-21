"use client";

/* Tiny markdown renderer: headings, tables, bullets, bold. No deps. */
export default function MarkdownLite({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let table: string[][] = [];
  let key = 0;

  const flushTable = () => {
    if (!table.length) return;
    const rows = table.filter((r) => !r.every((c) => /^[-:\s]+$/.test(c)));
    if (rows.length) {
      const [head, ...body] = rows;
      out.push(
        <table key={key++} className="my-3 w-full border-collapse text-sm">
          <thead>
            <tr>
              {head.map((c, i) => (
                <th key={i} className="border-b border-zinc-300 px-2 py-1 text-left font-semibold text-zinc-700">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j} className="border-b border-zinc-100 px-2 py-1 text-zinc-600">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>,
      );
    }
    table = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith("|")) {
      table.push(
        line
          .split("|")
          .slice(1, -1)
          .map((c) => c.trim()),
      );
      continue;
    }
    flushTable();
    if (!line.trim()) {
      out.push(<div key={key++} className="h-2" />);
    } else if (line.startsWith("### ")) {
      out.push(
        <h4 key={key++} className="mt-3 text-sm font-bold text-zinc-800">
          {inline(line.slice(4))}
        </h4>,
      );
    } else if (line.startsWith("## ")) {
      out.push(
        <h3 key={key++} className="mt-4 text-base font-bold text-zinc-900">
          {inline(line.slice(3))}
        </h3>,
      );
    } else if (line.startsWith("# ")) {
      out.push(
        <h2 key={key++} className="text-lg font-bold text-zinc-900">
          {inline(line.slice(2))}
        </h2>,
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      out.push(
        <div key={key++} className="flex gap-2 text-sm leading-relaxed text-zinc-700">
          <span className="text-indigo-500">•</span>
          <span>{inline(line.slice(2))}</span>
        </div>,
      );
    } else {
      out.push(
        <p key={key++} className="text-sm leading-relaxed text-zinc-700">
          {inline(line)}
        </p>,
      );
    }
  }
  flushTable();
  return <div>{out}</div>;
}

function inline(s: string): React.ReactNode {
  const parts = s.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**"))
      return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("*") && p.endsWith("*"))
      return <em key={i}>{p.slice(1, -1)}</em>;
    return p;
  });
}
