import React, { useState } from 'react';

const ColorPanel: React.FC = () => {
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
    <div>
      <h2 className='text-lg font-bold'>Color Settings</h2>
      {/* Theme Selection */}
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
  );
};

export default ColorPanel;
