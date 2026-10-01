import { Fragment } from 'react';

/** "**bold**" inside a line → <strong>. */
function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4
      ? <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
      : <Fragment key={i}>{part}</Fragment>);
}

const BULLET = /^\s*(?:[-*•])\s+/;

/**
 * AI text with the little formatting it uses — paragraphs, bullet lines
 * ("- ", "* ", "• ") and **bold** — rendered as React nodes, never as HTML.
 */
export default function RichText({ text, className }: { text: string; className?: string }) {
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) {
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="list-disc ps-5 space-y-0.5">
          {bullets.map((b, i) => <li key={i}>{inline(b)}</li>)}
        </ul>,
      );
      bullets = [];
    }
  };

  for (const line of text.split('\n')) {
    if (BULLET.test(line)) { bullets.push(line.replace(BULLET, '')); continue; }
    flush();
    if (line.trim() === '') continue;
    const heading = /^#{1,4}\s+/.test(line);
    blocks.push(<p key={`p-${blocks.length}`} className={heading ? 'font-semibold' : undefined}>{inline(line.replace(/^#{1,4}\s+/, ''))}</p>);
  }
  flush();

  return <div className={`space-y-1.5 ${className ?? ''}`}>{blocks}</div>;
}
