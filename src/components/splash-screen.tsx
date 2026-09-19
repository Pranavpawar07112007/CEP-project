'use client';

import { Loader2 } from 'lucide-react';

const SplashScreen = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground animate-pulse">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
};

export default SplashScreen;
