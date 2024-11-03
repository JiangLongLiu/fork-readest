import React, { useState } from 'react';

const ColorPanel: React.FC<{ bookKey: string }> = () => {
  const [selectedTheme, setSelectedTheme] = useState('Default');
  const themes = [
    'Default',
    'Gray',
    'Sepia',
    'Grass',
    'Cherry',
    'Sky',
    'Nord',
    'Solarized',
    'Gruvbox',
  ];

  return (
    <div className='my-4 w-full space-y-6'>
      <div className='w-full'>
        <h2 className='mb-2 font-medium'>Color Settings</h2>
        <div className='mt-4 grid grid-cols-3 gap-2'>
          {themes.map((theme) => (
            <button
              key={theme}
              className={`btn ${selectedTheme === theme ? 'btn-active' : ''}`}
              onClick={() => setSelectedTheme(theme)}
            >
              {theme}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ColorPanel;
