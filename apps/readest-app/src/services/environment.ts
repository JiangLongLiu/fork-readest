import { AppService } from '../types/system';

import { nativeAppService } from './nativeAppService';

const environmentConfig: {
  appService: AppService;
} = {
  appService: nativeAppService,
};

export default environmentConfig;
