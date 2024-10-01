import { AppService } from '../types/system';

export interface EnvConfigType {
  appService: () => Promise<AppService>;
}

const environmentConfig: EnvConfigType = {
  appService: async () => {
    const { nativeAppService } = await import('./nativeAppService');
    return nativeAppService;
  },
};

export default environmentConfig;
