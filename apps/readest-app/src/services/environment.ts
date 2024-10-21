import { AppService } from '@/types/system';

let appService: AppService | null = null;

export interface EnvConfigType {
  getAppService: () => Promise<AppService>;
}

const environmentConfig: EnvConfigType = {
  getAppService: async () => {
    if (!appService) {
      const { NativeAppService } = await import('@/services/nativeAppService');
      appService = new NativeAppService();
      await appService.loadSettings();
    }
    return appService;
  },
};

export default environmentConfig;
