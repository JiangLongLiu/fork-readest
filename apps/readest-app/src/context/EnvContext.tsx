'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { EnvConfigType } from '../services/environment';
import env from '../services/environment';
import { AppService } from '@/types/system';

interface EnvContextType {
  envConfig: EnvConfigType;
  appService: AppService | null;
  getAppService: (envConfig: EnvConfigType) => Promise<AppService>;
}

const EnvContext = createContext<EnvContextType | undefined>(undefined);

export const EnvProvider = ({ children }: { children: ReactNode }) => {
  const [envConfig] = useState<EnvConfigType>(env);
  const [appService, setAppService] = useState<AppService | null>(null);

  const getAppService = async (envConfig: EnvConfigType): Promise<AppService> => {
    const service = await envConfig.getAppService();
    setAppService(service);
    return service;
  };

  return (
    <EnvContext.Provider value={{ envConfig, appService, getAppService }}>
      {children}
    </EnvContext.Provider>
  );
};

export const useEnv = (): EnvContextType => {
  const context = useContext(EnvContext);
  if (!context) throw new Error('useEnv must be used within EnvProvider');
  return context;
};
