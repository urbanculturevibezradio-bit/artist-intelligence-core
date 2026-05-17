import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();
  useEffect(() => { router.replace('/riddim-studio'); }, [router]);
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 text-sm">Loading Riddim Studio...</p>
      </div>
    </div>
  );
}
