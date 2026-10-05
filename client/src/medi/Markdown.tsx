import { Fragment, ReactNode } from 'react';

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = []; const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g; let last = 0; let m: RegExpExecArray | null; let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    out.push(t.startsWith('**') ? <strong key={i++}>{t.slice(2, -2)}</strong> : t.startsWith('`') ? <code key={i++} className="rounded bg-ink/10 px-1 text-[.92em]">{t.slice(1, -1)}</code> : <em key={i++}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Minimal, safe markdown: paragraphs, lists, blockquotes, bold, italic, code. No HTML injection. */
export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, '').split('\n'); const blocks: ReactNode[] = []; let list: string[] = []; let para: string[] = []; let k = 0;
  const flushList = () => { if (list.length) { blocks.push(<ul key={k++}>{list.map((l, i) => <li key={i}>{inline(l)}</li>)}</ul>); list = []; } };
  const flushPara = () => { if (para.length) { blocks.push(<p key={k++}>{para.map((l, i) => <Fragment key={i}>{i > 0 && <br />}{inline(l)}</Fragment>)}</p>); para = []; } };
  for (const line of lines) {
    if (/^\s*[-*•]\s+/.test(line)) { flushPara(); list.push(line.replace(/^\s*[-*•]\s+/, '')); }
    else if (/^\s*>\s?/.test(line)) { flushPara(); flushList(); blocks.push(<blockquote key={k++}>{inline(line.replace(/^\s*>\s?/, ''))}</blockquote>); }
    else if (!line.trim()) { flushPara(); flushList(); }
    else { flushList(); para.push(line); }
  }
  flushPara(); flushList();
  return <div className="md">{blocks}</div>;
}
