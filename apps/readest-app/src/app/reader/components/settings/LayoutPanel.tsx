import React, { useEffect, useState } from 'react';
import { useReaderStore } from '@/store/readerStore';
import { getStyles } from '@/utils/style';
import { ONE_COLUMN_MAX_INLINE_SIZE } from '@/services/constants';
import NumberInput from './NumberInput';

const LayoutPanel: React.FC<{ bookKey: string }> = ({ bookKey }) => {
  const { settings, isFontLayoutSettingsGlobal } = useReaderStore();
  const { setSettings, getView, getViewSettings, setViewSettings } = useReaderStore();
  const view = getView(bookKey);
  const viewSettings = getViewSettings(bookKey)!;

  const [lineHeight, setLineHeight] = useState(viewSettings.lineHeight!);
  const [fullJustification, setFullJustification] = useState(viewSettings.fullJustification!);
  const [hyphenation, setHyphenation] = useState(viewSettings.hyphenation!);
  const [marginPx, setMarginPx] = useState(viewSettings.marginPx!);
  const [gapPercent, setGapPercent] = useState(viewSettings.gapPercent!);
  const [maxColumnCount, setMaxColumnCount] = useState(viewSettings.maxColumnCount!);
  const [maxInlineSize, setMaxInlineSize] = useState(viewSettings.maxInlineSize!);
  const [maxBlockSize, setMaxBlockSize] = useState(viewSettings.maxBlockSize!);

  useEffect(() => {
    viewSettings.lineHeight = lineHeight;
    setViewSettings(bookKey, viewSettings);
    if (isFontLayoutSettingsGlobal) {
      settings.globalViewSettings.lineHeight = lineHeight;
      setSettings(settings);
    }
    view?.renderer.setStyles?.(getStyles(viewSettings));
  }, [lineHeight]);

  useEffect(() => {
    viewSettings.fullJustification = fullJustification;
    setViewSettings(bookKey, viewSettings);
    if (isFontLayoutSettingsGlobal) {
      settings.globalViewSettings.fullJustification = fullJustification;
      setSettings(settings);
    }
    view?.renderer.setStyles?.(getStyles(viewSettings));
  }, [fullJustification]);

  useEffect(() => {
    viewSettings.hyphenation = hyphenation;
    setViewSettings(bookKey, viewSettings);
    if (isFontLayoutSettingsGlobal) {
      settings.globalViewSettings.hyphenation = hyphenation;
      setSettings(settings);
    }
    view?.renderer.setStyles?.(getStyles(viewSettings));
  }, [hyphenation]);

  useEffect(() => {
    viewSettings.marginPx = marginPx;
    setViewSettings(bookKey, viewSettings);
    if (isFontLayoutSettingsGlobal) {
      settings.globalViewSettings.marginPx = marginPx;
      setSettings(settings);
    }
    view?.renderer.setAttribute('margin', `${marginPx}px`);
  }, [marginPx]);

  useEffect(() => {
    viewSettings.gapPercent = gapPercent;
    setViewSettings(bookKey, viewSettings);
    if (isFontLayoutSettingsGlobal) {
      settings.globalViewSettings.gapPercent = gapPercent;
      setSettings(settings);
    }
    view?.renderer.setAttribute('gap', `${gapPercent}%`);
  }, [gapPercent]);

  useEffect(() => {
    viewSettings.maxColumnCount = maxColumnCount;
    setViewSettings(bookKey, viewSettings);
    if (isFontLayoutSettingsGlobal) {
      settings.globalViewSettings.maxColumnCount = maxColumnCount;
      setSettings(settings);
    }
    view?.renderer.setAttribute('max-column-count', maxColumnCount);
    view?.renderer.setAttribute(
      'max-inline-size',
      `${maxColumnCount === 1 ? ONE_COLUMN_MAX_INLINE_SIZE : maxInlineSize}px`,
    );
  }, [maxColumnCount]);

  useEffect(() => {
    viewSettings.maxInlineSize = maxInlineSize;
    setViewSettings(bookKey, viewSettings);
    if (isFontLayoutSettingsGlobal) {
      settings.globalViewSettings.maxInlineSize = maxInlineSize;
      setSettings(settings);
    }
    view?.renderer.setAttribute(
      'max-inline-size',
      `${maxColumnCount === 1 ? ONE_COLUMN_MAX_INLINE_SIZE : maxInlineSize}px`,
    );
  }, [maxInlineSize]);

  return (
    <div className='my-4 w-full space-y-6'>
      <div className='w-full'>
        <h2 className='mb-2 font-medium'>Paragraph</h2>
        <div className='card bg-base-100 border shadow'>
          <div className='divide-y'>
            <NumberInput
              className='config-item-top'
              label='Line Height'
              value={lineHeight}
              onChange={setLineHeight}
              min={1.0}
              max={3.0}
              step={0.1}
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

      <div className='w-full'>
        <h2 className='mb-2 font-medium'>Page</h2>
        <div className='card bg-base-100 border shadow'>
          <div className='divide-y'>
            <NumberInput
              className='config-item-top'
              label='Margins (px)'
              value={marginPx}
              onChange={setMarginPx}
              min={0}
              max={88}
              step={4}
            />
            <NumberInput
              label='Gaps (%)'
              value={gapPercent}
              onChange={setGapPercent}
              min={0}
              max={30}
            />
            <NumberInput
              label='Maximum Number of Columns'
              value={maxColumnCount}
              onChange={setMaxColumnCount}
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
