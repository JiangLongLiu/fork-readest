'use client';

import React from 'react';
import { FaChevronLeft } from 'react-icons/fa';

interface NavBarProps {
  onBack: () => void;
  isVisible: boolean;
}

const NavBar: React.FC<NavBarProps> = ({ onBack, isVisible }) => {
  return (
    isVisible && (
      <div className='fixed left-0 right-0 top-0 z-10 bg-gray-50 p-6'>
        <div className='flex items-center justify-between'>
          <span className='absolute left-2 text-gray-500' onClick={onBack}>
            <FaChevronLeft className='w-10' />
          </span>
        </div>
      </div>
    )
  );
};

export default NavBar;
