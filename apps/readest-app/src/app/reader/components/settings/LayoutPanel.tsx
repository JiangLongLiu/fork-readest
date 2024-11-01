import React, { useState } from 'react';
import NumberInput from './NumberInput';

const LayoutPanel: React.FC = () => {
  const [lineHeight, setLineHeight] = useState(1.5);
  const [fullJustification, setFullJustification] = useState(true);
  const [hyphenation, setHyphenation] = useState(true);
  const [margins, setMargins] = useState(0.05);
  const [maxNumberOfColumns, setMaxNumberOfColumns] = useState(2);
  const [maxInlineSize, setMaxInlineSize] = useState(720);
  const [maxBlockSize, setMaxBlockSize] = useState(1440);

  return (
    <div className='my-4 w-full space-y-6'>
      <div className='cell-font-size w-full'>
        <h2 className='mb-2 font-medium'>Paragraph</h2>
        <div className='card bg-base-100 border shadow'>
          <div className='divide-y'>
            <NumberInput
              className='config-item-top'
              label='Line Height'
              value={lineHeight}
              onChange={setLineHeight}
              min={1}
              max={120}
            />
            <div className='config-item config-item-bottom'>
              <span className='text-gray-700'>Full Justification</span>
              <input
                type='checkbox'
                className='toggle'
                checked={fullJustification}
                onChange={() => setFullJustification(!fullJustification)}
              />
            </div>
            <div className='config-item config-item-bottom'>
              <span className='text-gray-700'>Hyphenation</span>
              <input
                type='checkbox'
                className='toggle'
                checked={hyphenation}
                onChange={() => setHyphenation(!hyphenation)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className='cell-font-family w-full'>
        <h2 className='mb-2 font-medium'>Page</h2>
        <div className='card bg-base-100 border shadow'>
          <div className='divide-y'>
            <NumberInput
              className='config-item-top'
              label='Margins'
              value={margins}
              onChange={setMargins}
              min={0}
              max={0.3}
              step={0.01}
            />
            <NumberInput
              label='Maximum Number of Columns'
              value={maxNumberOfColumns}
              onChange={setMaxNumberOfColumns}
              min={1}
              max={2}
            />
            <NumberInput
              label='Maximum Inline Size'
              value={maxInlineSize}
              onChange={setMaxInlineSize}
              min={500}
              max={9999}
              step={100}
            />
            <NumberInput
              label='Maximum Block Size'
              value={maxBlockSize}
              onChange={setMaxBlockSize}
              min={500}
              max={9999}
              step={100}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LayoutPanel;
