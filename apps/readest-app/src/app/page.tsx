'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import Spinner from '@/components/Spinner';

const HomePage = () => {
  const router = useRouter();

  useEffect(() => {
    router.push('/library');
  }, [router]);

  return <Spinner loading={true} />;
};

export default HomePage;
