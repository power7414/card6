import React from 'react';

interface SyntaxHighlighterProps {
  language?: string;
  children: string;
  className?: string;
}

export const SyntaxHighlighter: React.FC<SyntaxHighlighterProps> = ({
  language = 'text',
  children,
  className = ''
}) => {
  // For now, we'll use a simple pre-formatted display
  // In a full implementation, you could integrate with a syntax highlighting library
  // like Prism.js or highlight.js
  
  return (
    <pre className={`syntax-highlighter ${language} ${className}`}>
      <code>{children}</code>
    </pre>
  );
};

export default SyntaxHighlighter;