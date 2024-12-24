import { AuthProvider } from '@/context/AuthContext';
import { EnvProvider } from '@/context/EnvContext';
import { CSPostHogProvider } from '@/context/PHContext';
import { SyncProvider } from '@/context/SyncContext';

const Providers = ({ children }: { children: React.ReactNode }) => (
  <CSPostHogProvider>
    <EnvProvider>
      <AuthProvider>
        <SyncProvider>{children}</SyncProvider>
      </AuthProvider>
    </EnvProvider>
  </CSPostHogProvider>
);

export default Providers;
