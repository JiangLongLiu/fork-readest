import React, { useEffect, useState } from 'react';
import { useReaderStore } from '@/store/readerStore';

const MiscPanel: React.FC<{ bookKey: string }> = ({ bookKey }) => {
  const { books, settings, setSettings, setConfig, getFoliateView } = useReaderStore();
  const { isFontLayoutSettingsGlobal } = useReaderStore();
  const bookState = books[bookKey]!;
  const config = bookState.config!;

  const [animated, setAnimated] = useState(config.viewSettings!.animated!);

  useEffect(() => {
    config.viewSettings!.animated = animated;
    setConfig(bookKey, config);
    if (isFontLayoutSettingsGlobal) {
      settings.globalViewSettings.animated = animated;
      setSettings(settings);
    }
    if (animated) {
      getFoliateView(bookKey)?.renderer.setAttribute('animated', '');
    } else {
      getFoliateView(bookKey)?.renderer.removeAttribute('animated');
    }
  }, [animated]);

  return (
    <div className='my-4 w-full space-y-6'>
      <div className='cell-font-size w-full'>
        <h2 className='mb-2 font-medium'>Animation</h2>
        <div className='card bg-base-100 border shadow'>
          <div className='divide-y'>
            <div className='config-item config-item-top config-item-bottom'>
              <span className='text-gray-700'>Paging Animation</span>
              <input
                type='checkbox'
                className='toggle'
                checked={animated}
                onChange={() => setAnimated(!animated)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MiscPanel;
