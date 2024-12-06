'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { navigateToLibrary } from '@/utils/nav';

import Spinner from '@/components/Spinner';

const HomePage = () => {
  const router = useRouter();

  useEffect(() => {
    navigateToLibrary(router);
  }, [router]);

  return <Spinner loading={true} />;
};

export default HomePage;
