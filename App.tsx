
import React, { useState, useEffect } from 'react';
import { AuthScreen } from './components/AuthScreen';
import { ChatScreen } from './components/ChatScreen';
import { MobilePreviewScreen } from './components/MobilePreviewScreen';
import { PublicScreen } from './components/PublicScreen';


const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentView, setCurrentView] = useState<'public' | 'app' | 'mobile_preview'>('public');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('mobile_preview')) {
      setCurrentView('mobile_preview');
    } else if (urlParams.get('view') === 'app') {
      setCurrentView('app');
    } else if (urlParams.get('view') === 'public') {
      setCurrentView('public');
    } else {
      // Default to public screen
      setCurrentView('public');
    }
  }, []);

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
  };

  const handleGetStarted = () => {
    setCurrentView('app');
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('view', 'app');
    window.history.pushState({}, '', newUrl);
  };

  if (currentView === 'public') {
    return <PublicScreen onGetStarted={handleGetStarted} />;
  }

  if (currentView === 'mobile_preview') {
    return <MobilePreviewScreen />;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <main className="h-screen w-screen">
         {isLoggedIn ? <ChatScreen /> : <AuthScreen onLoginSuccess={handleLoginSuccess} />}
      </main>
    </div>
  );
};

export default App;
