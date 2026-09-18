
'use client';

import { Loader2 } from 'lucide-react';

const SocietyPayLogo = () => (
    <svg width="64" height="64" viewBox="0 0 150 150" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M73.5 120.5C89.5 120.5 102.5 110.5 104 95.5C105.5 80.5 98 67 85.5 59.5C73 52 56 55 45.5 65.5C35 76 32.5 92.5 39.5 105C46.5 117.5 59.5 120.5 73.5 120.5Z" fill="#D9E2EC"/>
        <path d="M57.5 115C68.8333 119.5 83.3 115.6 90.5 105.5C97.7 95.4 95.8333 82.3333 87.5 75C79.1667 67.6667 66.5 65.5 56.5 71C46.5 76.5 41.1667 88.1667 44.5 99.5C47.8333 110.833 46.1667 110.5 57.5 115Z" fill="#2E6C8E"/>
        <path d="M72 57C82.4934 57 91 48.4934 91 38C91 27.5066 82.4934 19 72 19C61.5066 19 53 27.5066 53 38C53 48.4934 61.5066 57 72 57Z" fill="#2E6C8E"/>
        <path d="M92.5 40L99 33.5" stroke="#2E6C8E" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M99 40V33.5H92.5" stroke="#2E6C8E" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M60.8431 98.4999C58.3431 93.3332 60.1765 88.4999 66 86.4999C71.8235 84.4999 77.1569 86.8332 80 91.4999C83.5 97.4999 82.8333 103.833 78.5 107.5C74.1667 111.167 67.3431 111.5 62.3431 108C57.3431 104.5 55.3431 99.8332 56.8431 94.9999C58.3431 90.1666 63.8431 87.3332 68.3431 88.9999" stroke="white" strokeWidth="8" strokeLinecap="round"/>
    </svg>
)

const SplashScreen = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground animate-fade-in">
      <div className="flex items-center space-x-4 mb-4">
        <SocietyPayLogo />
        <div className='flex flex-col'>
            <h1 className="text-4xl font-headline font-bold tracking-tighter">
            SocietyPay
            </h1>
            <p className="text-sm text-muted-foreground -mt-1">Aroma Residency</p>
        </div>
      </div>
      <div className="flex items-center space-x-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <p className="text-lg">
            Loading your dashboard...
        </p>
      </div>
    </div>
  );
};

export default SplashScreen;
