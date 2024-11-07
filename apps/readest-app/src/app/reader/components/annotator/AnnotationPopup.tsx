import React from 'react';
import PopupButton from './PopupButton';
import HighlightOptions from './HighlightOptions';
import { Position } from '@/utils/sel';
import { HighlightColor, HighlightStyle } from '@/types/book';

interface AnnotationPopupProps {
  buttons: Array<{ tooltipText: string; Icon: React.ElementType; onClick: () => void }>;
  position: Position;
  trianglePosition: Position;
  highlightOptionsVisible: boolean;
  selectedStyle: HighlightStyle;
  selectedColor: HighlightColor;
  popupWidth: number;
  popupHeight: number;
  onHighlight: (update?: boolean) => void;
}

const highlightOptionsHeightPx = 28;
const highlightOptionsPaddingPx = 16;

const AnnotationPopup: React.FC<AnnotationPopupProps> = ({
  buttons,
  position,
  trianglePosition,
  highlightOptionsVisible,
  selectedStyle,
  selectedColor,
  popupWidth,
  popupHeight,
  onHighlight,
}) => {
  const isPopupAbove = trianglePosition.dir === 'up';
  return (
    <div>
      <div
        className='triangle absolute'
        style={{
          left: `${trianglePosition.point.x}px`,
          top: `${trianglePosition.point.y}px`,
          borderLeft: '6px solid transparent',
          borderRight: '6px solid transparent',
          borderBottom: isPopupAbove ? 'none' : '6px solid #465563',
          borderTop: isPopupAbove ? '6px solid #465563' : 'none',
          transform: 'translateX(-50%)',
        }}
      />
      <div
        className='selection-popup absolute rounded-lg bg-gray-600 px-4 text-white shadow-lg'
        style={{
          width: `${popupWidth}px`,
          height: `${popupHeight}px`,
          left: `${position.point.x}px`,
          top: `${position.point.y}px`,
        }}
      >
        <div className='selection-buttons flex h-11 items-center justify-between'>
          {buttons.map((button, index) => (
            <PopupButton
              key={index}
              tooltipText={button.tooltipText}
              Icon={button.Icon}
              onClick={button.onClick}
            />
          ))}
        </div>
      </div>
      {highlightOptionsVisible && (
        <HighlightOptions
          style={{
            width: `${popupWidth}px`,
            height: `${popupHeight}px`,
            left: `${position.point.x}px`,
            top: `${
              position.point.y +
              (highlightOptionsHeightPx + highlightOptionsPaddingPx) * (isPopupAbove ? -1 : 1)
            }px`,
          }}
          selectedStyle={selectedStyle}
          selectedColor={selectedColor}
          onHandleHighlight={onHighlight}
        />
      )}
    </div>
  );
};

export default AnnotationPopup;
