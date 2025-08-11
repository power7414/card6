import React, { ReactNode } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import './shared.scss';

interface CollapsiblePanelProps {
  isOpen: boolean;
  onToggle: () => void;
  position: 'left' | 'right';
  width?: string;
  children: ReactNode;
  className?: string;
}

export const CollapsiblePanel: React.FC<CollapsiblePanelProps> = ({
  isOpen,
  onToggle,
  position,
  width = '300px',
  children,
  className = ''
}) => {
  const toggleIcon = position === 'left' 
    ? (isOpen ? <FiChevronLeft /> : <FiChevronRight />)
    : (isOpen ? <FiChevronRight /> : <FiChevronLeft />);

  return (
    <div 
      className={`collapsible-panel ${position} ${isOpen ? 'open' : 'closed'} ${className}`}
      style={{ width: isOpen ? width : '0' }}
    >
      <button
        className="panel-toggle"
        onClick={onToggle}
        aria-label={`${isOpen ? 'Close' : 'Open'} ${position} panel`}
      >
        {toggleIcon}
      </button>
      
      <div className="panel-content">
        {children}
      </div>
    </div>
  );
};