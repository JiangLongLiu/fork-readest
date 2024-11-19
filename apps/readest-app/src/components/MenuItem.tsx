import clsx from 'clsx';
import React from 'react';

interface MenuItemProps {
  label: string;
  shortcut?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

const MenuItem: React.FC<MenuItemProps> = ({ label, shortcut, icon, onClick, disabled }) => {
  return (
    <button
      className={clsx(
        'hover:bg-neutral text-base-content flex w-full items-center justify-between rounded-md p-2',
        disabled && 'btn-disabled text-gray-400',
      )}
      onClick={onClick}
      disabled={disabled}
    >
      <div className='flex items-center'>
        {<span style={{ minWidth: '20px' }}>{icon}</span>}
        <span className='ml-2'>{label}</span>
      </div>
      {shortcut && <span className='text-neutral-content text-sm'>{shortcut}</span>}
    </button>
  );
};

export default MenuItem;
