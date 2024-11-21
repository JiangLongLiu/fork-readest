import { Position } from '@/utils/sel';

const Popup = ({
  width,
  height,
  position,
  trianglePosition,
  children,
  className = '',
  triangleClassName = '',
  additionalStyle = {},
}: {
  width: number;
  height: number;
  position: Position;
  trianglePosition: Position;
  children: React.ReactNode;
  className?: string;
  triangleClassName?: string;
  additionalStyle?: React.CSSProperties;
}) => (
  <div>
    <div
      className={`triangle absolute z-10 ${triangleClassName}`}
      style={{
        left: `${trianglePosition.point.x}px`,
        top: `${trianglePosition.point.y}px`,
        borderLeft: '6px solid transparent',
        borderRight: '6px solid transparent',
        borderBottom: trianglePosition.dir === 'up' ? 'none' : `6px solid`,
        borderTop: trianglePosition.dir === 'up' ? `6px solid` : 'none',
        transform: 'translateX(-50%)',
      }}
    />
    <div
      className={`absolute rounded-lg font-sans shadow-lg ${className}`}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        left: `${position.point.x}px`,
        top: `${position.point.y}px`,
        ...additionalStyle,
      }}
    >
      {children}
    </div>
  </div>
);

export default Popup;
