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
  position?: Position;
  trianglePosition?: Position;
  children: React.ReactNode;
  className?: string;
  triangleClassName?: string;
  additionalStyle?: React.CSSProperties;
}) => (
  <div>
    <div
      className={`triangle text-base-200 absolute z-10 ${triangleClassName}`}
      style={{
        left: `${trianglePosition ? trianglePosition.point.x : -999}px`,
        top: `${trianglePosition ? trianglePosition.point.y : -999}px`,
        borderLeft: '6px solid transparent',
        borderRight: '6px solid transparent',
        borderBottom: trianglePosition && trianglePosition.dir === 'up' ? 'none' : `6px solid`,
        borderTop: trianglePosition && trianglePosition.dir === 'up' ? `6px solid` : 'none',
        transform: 'translateX(-50%)',
      }}
    />
    <div
      className={`bg-base-200 absolute rounded-lg font-sans shadow-xl ${className}`}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        left: `${position ? position.point.x : -999}px`,
        top: `${position ? position.point.y : -999}px`,
        ...additionalStyle,
      }}
    >
      {children}
    </div>
  </div>
);

export default Popup;
