import React from 'react';

const Toast: React.FC<{ message: string }> = ({ message }) => (
  <div className='toast toast-center toast-middle'>
    <div className='alert flex items-center justify-center border-0 bg-gray-600 text-white'>
      <span>{message}</span>
    </div>
  </div>
);

export default Toast;
