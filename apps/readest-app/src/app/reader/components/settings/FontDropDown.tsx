import React from 'react';
import { FiChevronDown } from 'react-icons/fi';
import { MdCheck } from 'react-icons/md';

interface DropdownProps {
  family?: string;
  selected: string;
  options: string[];
  onSelect: (option: string) => void;
  onGetFontFamily: (option: string, family: string) => string;
}

const FontDropdown: React.FC<DropdownProps> = ({
  family,
  selected,
  options,
  onSelect,
  onGetFontFamily,
}) => {
  return (
    <div className='dropdown dropdown-end'>
      <button
        tabIndex={0}
        className='btn btn-sm flex items-center gap-1 px-[20px] font-normal normal-case'
      >
        <span style={{ fontFamily: onGetFontFamily(selected, family ?? '') }}>{selected}</span>
        <FiChevronDown className='h-4 w-4' />
      </button>
      <ul
        tabIndex={0}
        className='dropdown-content dropdown-right menu bg-base-100 rounded-box z-[1] mt-4 w-44 shadow'
      >
        {options.map((option) => (
          <li key={option} onClick={() => onSelect(option)}>
            <div className='flex items-center px-0'>
              <span style={{ minWidth: '20px' }}>
                {selected === option && <MdCheck size={20} className='text-base-content' />}
              </span>
              <span style={{ fontFamily: onGetFontFamily(option, family ?? '') }}>{option}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default FontDropdown;
