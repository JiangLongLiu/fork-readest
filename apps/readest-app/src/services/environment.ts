import { AppService } from '@/types/system';

export interface EnvConfigType {
  appService: () => Promise<AppService>;
}

const environmentConfig: EnvConfigType = {
  appService: async () => {
    const { NativeAppService } = await import('@/services/nativeAppService');
    const appService = new NativeAppService();
    await appService.loadSettings();
    return appService;
  },
};

export default environmentConfig;
