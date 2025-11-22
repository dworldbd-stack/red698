
import React from 'react';
import { SparklesIcon } from './icons';

export const MobilePreviewScreen: React.FC = () => {
    return (
        <div className="bg-slate-950 min-h-screen flex flex-col items-center justify-center p-4 selection:bg-indigo-500 selection:text-white">
            <div className="text-center mb-6">
                <div className="flex items-center justify-center gap-2 mb-2">
                    <SparklesIcon className="w-6 h-6 text-indigo-400" />
                    <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Red AI Live Preview</h1>
                </div>
                <p className="text-slate-400 text-sm">A public, shareable link for your application.</p>
            </div>
            
            {/* Phone Mockup */}
            <div className="relative mx-auto border-gray-800 dark:border-gray-800 bg-gray-800 border-[14px] rounded-[2.5rem] h-[600px] w-[300px] shadow-xl">
                <div className="w-[148px] h-[18px] bg-gray-800 top-0 rounded-b-[1rem] left-1/2 -translate-x-1/2 absolute"></div>
                <div className="h-[46px] w-[3px] bg-gray-800 absolute -start-[17px] top-[72px] rounded-s-lg"></div>
                <div className="h-[46px] w-[3px] bg-gray-800 absolute -start-[17px] top-[124px] rounded-s-lg"></div>
                <div className="h-[64px] w-[3px] bg-gray-800 absolute -end-[17px] top-[142px] rounded-e-lg"></div>
                <div className="rounded-[2rem] overflow-hidden w-full h-full bg-slate-900">
                    <iframe
                        src="/index.html?view=public" // Load the public view of the app
                        title="Red AI App Preview"
                        className="w-full h-full border-0"
                    />
                </div>
            </div>
             <div className="text-center mt-6">
                <p className="text-slate-500 text-xs">&copy; 2024 Red AI by GM Ripon. All rights reserved.</p>
            </div>
        </div>
    );
}
