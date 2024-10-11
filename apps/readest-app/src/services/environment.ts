import { AppService } from '@/types/system';

export interface EnvConfigType {
  initAppService: () => Promise<AppService>;
}

const environmentConfig: EnvConfigType = {
  initAppService: async () => {
    const { NativeAppService } = await import('@/services/nativeAppService');
    const appService = new NativeAppService();
    await appService.loadSettings();
    return appService;
  },
};

export default environmentConfig;
