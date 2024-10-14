import { AppService } from '@/types/system';

let appService: AppService | null = null;

export interface EnvConfigType {
  initAppService: () => Promise<AppService>;
}

const environmentConfig: EnvConfigType = {
  initAppService: async () => {
    if (!appService) {
      const { NativeAppService } = await import('@/services/nativeAppService');
      appService = new NativeAppService();
      await appService.loadSettings();
    }
    return appService;
  },
};

export default environmentConfig;
