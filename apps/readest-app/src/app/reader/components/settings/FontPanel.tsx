import clsx from 'clsx';
import React, { useState } from 'react';

import NumberInput from './NumberInput';
import FontDropdown from './FontDropDown';

interface FontFaceProps {
  className?: string;
  family: string;
  label: string;
  options: string[];
  selected: string;
  onSelect: (option: string) => void;
}

const fontFamilyOptions = ['Serif', 'Sans-serif'];
const serifFonts = [
  'Literata',
  'Vollkorn',
  'Aleo',
  'Crimson Text',
  'Merriweather',
  'Georgia',
  'Times New Roman',
];
const sansSerifFonts = ['Roboto', 'Open Sans', 'Noto Sans', 'Poppins', 'Helvetica', 'Arial'];
const monospaceFonts = ['Fira Code', 'Lucida Console', 'Consolas', 'Courier New'];

const FontPanel: React.FC = () => {
  const [defaultFontSize, setDefaultFontSize] = useState(18);
  const [minFontSize, setMinFontSize] = useState(1);
  const [overridePublisherFont, setOverridePublisherFont] = useState(true);
  const [defaultFont, setDefaultFont] = useState('Serif');
  const [serifFont, setSerifFont] = useState('Georgia');
  const [sansSerifFont, setSansSerifFont] = useState('Roboto');
  const [monospaceFont, setMonospaceFont] = useState('Consolas');

  const handleFontFamilyFont = (option: string) => {
    switch (option) {
      case 'Serif':
        return `'${serifFont}', serif`;
      case 'Sans-serif':
        return `'${sansSerifFont}', sans-serif`;
      case 'Monospace':
        return `'${monospaceFont}', monospace`;
      default:
        return '';
    }
  };

  const handleFontFaceFont = (option: string, family: string) => {
    return `'${option}', ${family}`;
  };

  const FontFace = ({ className, family, label, options, selected, onSelect }: FontFaceProps) => (
    <div className={clsx('config-item', className)}>
      <span className='text-gray-700'>{label}</span>
      <FontDropdown
        family={family}
        options={options}
        selected={selected}
        onSelect={onSelect}
        onGetFontFamily={handleFontFaceFont}
      />
    </div>
  );

  return (
    <div className='my-4 w-full space-y-6'>
      <div className='cell-font-size w-full'>
        <h2 className='mb-2 font-medium'>Font Size</h2>
        <div className='card bg-base-100 border shadow'>
          <div className='divide-y'>
            <NumberInput
              className='config-item-top'
              label='Default Font Size'
              value={defaultFontSize}
              onChange={setDefaultFontSize}
              min={1}
              max={120}
            />
            <NumberInput
              className='config-item-bottom'
              label='Minimum Font Size'
              value={minFontSize}
              onChange={setMinFontSize}
              min={1}
              max={120}
            />
          </div>
        </div>
      </div>

      <div className='cell-font-family w-full'>
        <h2 className='mb-2 font-medium'>Font Family</h2>
        <div className='card bg-base-100 border shadow'>
          <div className='divide-y'>
            <div className='config-item config-item-top'>
              <span className='text-gray-700'>Default Font</span>
              <FontDropdown
                options={fontFamilyOptions}
                selected={defaultFont}
                onSelect={setDefaultFont}
                onGetFontFamily={handleFontFamilyFont}
              />
            </div>

            <div className='config-item config-item-bottom'>
              <span className='text-gray-700'>Override Publisher Font</span>
              <input
                type='checkbox'
                className='toggle'
                checked={overridePublisherFont}
                onChange={() => setOverridePublisherFont(!overridePublisherFont)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className='cell-font-family w-full'>
        <h2 className='mb-2 font-medium'>Font Face</h2>
        <div className='card bg-base-100 border shadow'>
          <div className='divide-y'>
            <FontFace
              className='config-item-top'
              family='serif'
              label='Serif Font'
              options={serifFonts}
              selected={serifFont}
              onSelect={setSerifFont}
            />
            <FontFace
              family='sans-serif'
              label='Sans-Serif Font'
              options={sansSerifFonts}
              selected={sansSerifFont}
              onSelect={setSansSerifFont}
            />
            <FontFace
              className='config-item-bottom'
              family='monospace'
              label='Monospace Font'
              options={monospaceFonts}
              selected={monospaceFont}
              onSelect={setMonospaceFont}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default FontPanel;
