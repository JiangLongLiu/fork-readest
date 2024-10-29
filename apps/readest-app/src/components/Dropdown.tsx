import clsx from 'clsx';
import React, { useRef, useState, isValidElement, ReactElement } from 'react';

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

  const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (!dropdownRef.current?.contains(event.relatedTarget as Node)) {
      setIsOpen(false);
      onToggle?.(false);
    }
  };

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
