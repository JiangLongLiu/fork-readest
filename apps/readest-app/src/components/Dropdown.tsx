import clsx from 'clsx';
import React, { useRef, useState, isValidElement, ReactElement, useEffect } from 'react';

interface DropdownProps {
  className?: string;
  buttonClassName?: string;
  toggleButton: React.ReactNode;
  children: ReactElement<{ toggleDropdown: () => void }>;
  onToggle?: (isOpen: boolean) => void;
}

const Dropdown: React.FC<DropdownProps> = ({
  className,
  buttonClassName,
  toggleButton,
  children,
  onToggle,
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const toggleDropdown = () => {
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);
    onToggle?.(newIsOpen);
  };

  const closeDropdown = () => {
    setIsOpen(false);
    onToggle?.(false);
  };

  const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (!dropdownRef.current?.contains(event.relatedTarget as Node)) {
      closeDropdown();
    }
  };

  const handleClickOutside = (event: MouseEvent | Event) => {
    if (event instanceof KeyboardEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        closeDropdown();
      }
    } else if (event instanceof MessageEvent) {
      if (event.data && event.data.type === 'iframe-mousedown') {
        closeDropdown();
      }
    }
  };

  useEffect(() => {
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('message', handleClickOutside);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('message', handleClickOutside);
    };
  }, []);

  const childrenWithToggle = isValidElement(children)
    ? React.cloneElement(children, { toggleDropdown })
    : children;

  return (
    <div className={clsx('dropdown', className)} ref={dropdownRef}>
      <div
        tabIndex={-1}
        onClick={toggleDropdown}
        onBlur={handleBlur}
        className={clsx(
          'dropdown-toggle hover:bg-gray-300',
          buttonClassName,
          isOpen && 'bg-base-300',
        )}
      >
        {toggleButton}
      </div>
      {isOpen && childrenWithToggle}
    </div>
  );
};

export default Dropdown;
