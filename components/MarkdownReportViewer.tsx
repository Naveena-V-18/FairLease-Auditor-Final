import ReactMarkdown from 'react-markdown';

type MarkdownReportViewerProps = {
  content: string;
  compact?: boolean;
};

export default function MarkdownReportViewer({ content, compact = false }: MarkdownReportViewerProps) {
  return (
    <div className={`bg-slate-50/50 rounded-3xl border border-slate-100 ${compact ? 'p-4 md:p-6' : 'p-6 md:p-8'}`}>
      <div className="prose prose-slate max-w-none prose-headings:font-black prose-headings:text-slate-800 prose-p:text-slate-600 prose-p:leading-relaxed">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
}
