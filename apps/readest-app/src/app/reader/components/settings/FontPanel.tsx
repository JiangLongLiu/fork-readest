import clsx from 'clsx';
import React, { useEffect, useState } from 'react';

import NumberInput from './NumberInput';
import FontDropdown from './FontDropDown';
import { MONOSPACE_FONTS, SANS_SERIF_FONTS, SERIF_FONTS } from '@/services/constants';
import { useReaderStore } from '@/store/readerStore';
import { getStyles } from '@/utils/style';

interface FontFaceProps {
  className?: string;
  family: string;
  label: string;
  options: string[];
  selected: string;
  onSelect: (option: string) => void;
}

const fontFamilyOptions = ['Serif', 'Sans-serif'];

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

const FontPanel: React.FC<{ bookKey: string }> = ({ bookKey }) => {
  const { settings, isFontLayoutSettingsGlobal } = useReaderStore();
  const { setSettings, getView, getViewSettings, setViewSettings } = useReaderStore();
  const view = getView(bookKey);
  const viewSettings = getViewSettings(bookKey)!;

  const [defaultFontSize, setDefaultFontSize] = useState(viewSettings.defaultFontSize!);
  const [minFontSize, setMinFontSize] = useState(viewSettings.minimumFontSize!);
  const [overrideFont, setOverrideFont] = useState(viewSettings.overrideFont!);
  const [defaultFont, setDefaultFont] = useState(viewSettings.defaultFont!);
  const [serifFont, setSerifFont] = useState(viewSettings.serifFont!);
  const [sansSerifFont, setSansSerifFont] = useState(viewSettings.sansSerifFont!);
  const [monospaceFont, setMonospaceFont] = useState(viewSettings.monospaceFont!);

  useEffect(() => {
    viewSettings.defaultFont = defaultFont;
    setViewSettings(bookKey, viewSettings);
    if (isFontLayoutSettingsGlobal) {
      settings.globalViewSettings.defaultFont = defaultFont;
      setSettings(settings);
    }
    view?.renderer.setStyles?.(getStyles(viewSettings));
  }, [defaultFont]);

  useEffect(() => {
    viewSettings.defaultFontSize = defaultFontSize;
    setViewSettings(bookKey, viewSettings);
    if (isFontLayoutSettingsGlobal) {
      settings.globalViewSettings.defaultFontSize = defaultFontSize;
      setSettings(settings);
    }
    view?.renderer.setStyles?.(getStyles(viewSettings));
  }, [defaultFontSize]);

  useEffect(() => {
    viewSettings.minimumFontSize = minFontSize;
    setViewSettings(bookKey, viewSettings);
    if (isFontLayoutSettingsGlobal) {
      settings.globalViewSettings.minimumFontSize = minFontSize;
      setSettings(settings);
    }
    view?.renderer.setStyles?.(getStyles(viewSettings));
  }, [minFontSize]);

  useEffect(() => {
    viewSettings.serifFont = serifFont;
    setViewSettings(bookKey, viewSettings);
    if (isFontLayoutSettingsGlobal) {
      settings.globalViewSettings.serifFont = serifFont;
      setSettings(settings);
    }
    view?.renderer.setStyles?.(getStyles(viewSettings));
  }, [serifFont]);

  useEffect(() => {
    viewSettings.sansSerifFont = sansSerifFont;
    setViewSettings(bookKey, viewSettings);
    if (isFontLayoutSettingsGlobal) {
      settings.globalViewSettings.sansSerifFont = sansSerifFont;
      setSettings(settings);
    }
    view?.renderer.setStyles?.(getStyles(viewSettings));
  }, [sansSerifFont]);

  useEffect(() => {
    viewSettings.monospaceFont = monospaceFont;
    setViewSettings(bookKey, viewSettings);
    if (isFontLayoutSettingsGlobal) {
      settings.globalViewSettings.monospaceFont = monospaceFont;
      setSettings(settings);
    }
    view?.renderer.setStyles?.(getStyles(viewSettings));
  }, [monospaceFont]);

  useEffect(() => {
    viewSettings.overrideFont = overrideFont;
    setViewSettings(bookKey, viewSettings);
    if (isFontLayoutSettingsGlobal) {
      settings.globalViewSettings.overrideFont = overrideFont;
      setSettings(settings);
    }
    view?.renderer.setStyles?.(getStyles(viewSettings));
  }, [overrideFont]);

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

  return (
    <div className='my-4 w-full space-y-6'>
      <div className='w-full'>
        <h2 className='mb-2 font-medium'>Font Size</h2>
        <div className='card bg-base-100 border shadow'>
          <div className='divide-y'>
            <NumberInput
              className='config-item-top'
              label='Default Font Size'
              value={defaultFontSize}
              onChange={setDefaultFontSize}
              min={minFontSize}
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

      <div className='w-full'>
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
                checked={overrideFont}
                onChange={() => setOverrideFont(!overrideFont)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className='w-full'>
        <h2 className='mb-2 font-medium'>Font Face</h2>
        <div className='card bg-base-100 border shadow'>
          <div className='divide-y'>
            <FontFace
              className='config-item-top'
              family='serif'
              label='Serif Font'
              options={SERIF_FONTS}
              selected={serifFont}
              onSelect={setSerifFont}
            />
            <FontFace
              family='sans-serif'
              label='Sans-Serif Font'
              options={SANS_SERIF_FONTS}
              selected={sansSerifFont}
              onSelect={setSansSerifFont}
            />
            <FontFace
              className='config-item-bottom'
              family='monospace'
              label='Monospace Font'
              options={MONOSPACE_FONTS}
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
