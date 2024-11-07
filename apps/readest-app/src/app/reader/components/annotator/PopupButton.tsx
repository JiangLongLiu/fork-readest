import React, { useState } from 'react';

interface PopupButtonProps {
  tooltipText: string;
  Icon: React.ElementType;
  onClick: () => void;
}

const PopupButton: React.FC<PopupButtonProps> = ({ tooltipText, Icon, onClick }) => {
  const [buttonClicked, setButtonClicked] = useState(false);
  const handleClick = () => {
    setButtonClicked(true);
    onClick();
  };
  return (
    <div className='tooltip tooltip-bottom' data-tip={!buttonClicked ? tooltipText : null}>
      <button
        onClick={handleClick}
        className='my-2 flex h-8 min-h-8 w-8 items-center justify-center p-0'
      >
        <Icon size={20} />
      </button>
    </div>
  );
};

export default PopupButton;
