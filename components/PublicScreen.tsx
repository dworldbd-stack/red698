import React from 'react';
import { SparklesIcon, ChatBubbleIcon, CodeBracketIcon, ShieldExclamationIcon } from './icons';

interface PublicScreenProps {
    onGetStarted?: () => void;
}

const FeatureCard: React.FC<{ icon: React.ElementType, title: string, description: string }> = ({ icon: Icon, title, description }) => (
    <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50 backdrop-blur-sm hover:bg-slate-800/80 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-indigo-500/10">
        <div className="flex items-center justify-center w-12 h-12 bg-indigo-600/20 rounded-lg border border-indigo-500/30 mb-4">
            <Icon className="w-6 h-6 text-indigo-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-100 mb-2">{title}</h3>
        <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
    </div>
);

export const PublicScreen: React.FC<PublicScreenProps> = ({ onGetStarted }) => {
    return (
        <div className="min-h-screen w-full bg-slate-900 text-slate-100 selection:bg-indigo-500 selection:text-white relative overflow-hidden font-sans">
            {/* Background Effects */}
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px] opacity-30"></div>
                <div className="absolute bottom-0 right-0 w-[800px] h-[600px] bg-cyan-600/10 rounded-full blur-[100px] opacity-20"></div>
            </div>
            
            <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-6 text-center max-w-6xl mx-auto">
                <header className="mb-16 flex flex-col items-center">
                    <div className="inline-flex items-center justify-center gap-3 mb-8 px-6 py-2 rounded-full bg-slate-800/50 border border-slate-700/50 backdrop-blur-sm">
                        <SparklesIcon className="w-5 h-5 text-indigo-400" />
                        <span className="text-sm font-medium text-slate-300">Next Generation AI Assistant</span>
                    </div>
                    
                    <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight">
                        Meet <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Red AI</span>
                    </h1>
                    
                    <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
                        Your intelligent companion for secure coding, cybersecurity insights, and fluid natural conversations. Powered by advanced Gemini models.
                    </p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16 w-full max-w-5xl px-4">
                    <FeatureCard 
                        icon={ChatBubbleIcon}
                        title="Natural Chat"
                        description="Engage in fluid, context-aware conversations. Red AI understands nuance and maintains context."
                    />
                    <FeatureCard 
                        icon={CodeBracketIcon}
                        title="Code Expert"
                        description="Get assistance with complex programming, debugging, and software architecture design."
                    />
                    <FeatureCard 
                        icon={ShieldExclamationIcon}
                        title="Cybersecurity"
                        description="Specialized knowledge in ethical hacking, system security, and protection strategies."
                    />
                </div>

                <button 
                    onClick={onGetStarted}
                    className="group relative px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-full text-lg shadow-xl shadow-indigo-600/20 transition-all hover:scale-105 hover:shadow-indigo-600/40 flex items-center gap-3"
                >
                    <span>Launch Application</span>
                    <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                </button>

                <footer className="mt-24 text-slate-600 text-sm flex flex-col gap-2">
                    <p>&copy; 2024 Red AI. All rights reserved.</p>
                    <p className="text-xs opacity-70">Developed by GM Ripon</p>
                </footer>
            </div>
        </div>
    );
};