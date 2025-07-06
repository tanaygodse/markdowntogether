import React, { forwardRef } from 'react';
import './HighlightOverlay.css';

interface HighlightOverlayProps {
  content: string;
  applyHighlights: (content: string) => React.ReactNode[];
}

const HighlightOverlay = forwardRef<HTMLDivElement, HighlightOverlayProps>(
  ({ content, applyHighlights }, ref) => {
    const highlightedContent = applyHighlights(content);

    return (
      <div ref={ref} className="highlight-overlay">
        {highlightedContent.map((item, index) => (
          <React.Fragment key={index}>{item}</React.Fragment>
        ))}
      </div>
    );
  }
);

HighlightOverlay.displayName = 'HighlightOverlay';

export default HighlightOverlay;