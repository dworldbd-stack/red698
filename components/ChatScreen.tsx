
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { type TranscriptItem } from '../types';
import { 
    MicrophoneIcon, 
    StopCircleIcon, 
    SparklesIcon, 
    SendIcon, 
    ChevronDownIcon, 
    WhatsappIcon,
    ChatBubbleIcon,
    CodeBracketIcon,
    ShieldExclamationIcon,
    ArrowDownTrayIcon,
    DocumentTextIcon,
    DocumentIcon,
    ShareIcon,
    ClipboardDocumentCheckIcon,
    CloudArrowDownIcon
} from './icons';
import LoadingSpinner from './LoadingSpinner';

type AIMode = 'chat' | 'code' | 'security';

const MODE_CONFIG = {
    chat: {
        title: "Chat",
        icon: ChatBubbleIcon,
        systemInstruction: "You are Red AI, a friendly and helpful AI assistant developed by GM Ripon. Always introduce yourself as Red AI. Be concise and conversational."
    },
    code: {
        title: "Code Helper",
        icon: CodeBracketIcon,
        systemInstruction: "You are an expert software developer and coding assistant named Red AI, developed by GM Ripon. Always introduce yourself as Red AI. Provide clear, efficient, and well-explained code. You can handle requests for any programming language, framework, or technology."
    },
    security: {
        title: "Cybersecurity",
        icon: ShieldExclamationIcon,
        systemInstruction: "You are a specialized cybersecurity expert named Red AI, developed by GM Ripon. Always introduce yourself as Red AI. You provide knowledge on ethical hacking, system security, and tools like Kali Linux, NetHunter, and NH Pro. Your primary goal is to educate on cybersecurity concepts and provide code for security purposes, always emphasizing ethical use. You can draw knowledge from authoritative sources like the official Kali Linux documentation."
    }
}

interface Blob {
  data: string;
  mimeType: string;
}

interface LiveSession {
  close(): void;
  sendRealtimeInput(input: { media: Blob }): void;
}

// A simple component to find and render links in text
const LinkifiedText: React.FC<{ text: string }> = ({ text = '' }) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    if (!text) return null;
  
    const parts = text.split(urlRegex);
  
    return (
      <p className="text-sm leading-relaxed whitespace-pre-wrap font-medium">
        {parts.map((part, index) => {
          if (part.match(urlRegex)) {
            return (
              <a
                key={index}
                href={part}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-300 hover:text-indigo-200 underline break-all"
              >
                {part}
              </a>
            );
          }
          return <React.Fragment key={index}>{part}</React.Fragment>;
        })}
      </p>
    );
};

// Audio utility functions
const decode = (base64: string) => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const encode = (bytes: Uint8Array) => {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

const createBlob = (data: Float32Array): Blob => {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

export const ChatScreen: React.FC = () => {
  const [isConversing, setIsConversing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([
    { speaker: 'AI', text: "Hello! My name is Red AI, developed by GM Ripon. How can I assist you today? Please select a mode to get started." }
  ]);
  const [inputText, setInputText] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<AIMode>('chat');
  const [isLinkCopied, setIsLinkCopied] = useState(false);

  const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
  const audioContextRefs = useRef<{ input: AudioContext | null, output: AudioContext | null, scriptProcessor: ScriptProcessorNode | null, streamSource: MediaStreamAudioSourceNode | null, sources: Set<AudioBufferSourceNode>, stream: MediaStream | null }>({ input: null, output: null, scriptProcessor: null, streamSource: null, sources: new Set(), stream: null });
  const transcriptRefs = useRef({ input: '', output: '' });
  const nextStartTimeRef = useRef(0);
  const aiRef = useRef<GoogleGenAI | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [transcript, isLoading, isListening]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  const initializeAi = useCallback(() => {
    if (!aiRef.current) {
        aiRef.current = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    }
    return aiRef.current;
  }, []);

  const cleanup = useCallback(() => {
    const { input, output, scriptProcessor, streamSource, sources, stream } = audioContextRefs.current;
    
    stream?.getTracks().forEach(track => track.stop());
    
    if (scriptProcessor) scriptProcessor.disconnect();
    if (streamSource) streamSource.disconnect();
    
    if (input && input.state !== 'closed') input.close().catch(console.error);
    if (output && output.state !== 'closed') output.close().catch(console.error);
    
    sources.forEach(source => source.stop());
    audioContextRefs.current.sources.clear();
  }, []);

  const stopConversation = useCallback(async () => {
    setIsListening(false);
    if (sessionPromiseRef.current) {
      try {
        const session = await sessionPromiseRef.current;
        session.close();
      } catch (e) {
        console.error("Error closing session:", e);
      } finally {
        sessionPromiseRef.current = null;
      }
    }
    cleanup();
    setIsConversing(false);
  }, [cleanup]);
  
  useEffect(() => {
    return () => {
      stopConversation();
    };
  }, [stopConversation]);

  const handleSendMessage = async (overrideText?: string) => {
    const textToSend = overrideText || inputText;
    if (!textToSend.trim()) return;

    setInputText('');
    setTranscript(prev => [...prev, { speaker: 'User', text: textToSend }]);
    setIsLoading(true);
    setError(null);

    try {
      const ai = initializeAi();
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: textToSend,
        config: {
          systemInstruction: MODE_CONFIG[activeMode].systemInstruction,
        }
      });
      setTranscript(prev => [...prev, { speaker: 'AI', text: response.text }]);
    } catch (err) {
      console.error(err);
      setError('Sorry, I encountered an error. Please try again.');
      setTranscript(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleShare = () => {
    if (isLinkCopied) return;
    const link = `${window.location.origin}${window.location.pathname}?mobile_preview=true`;
    navigator.clipboard.writeText(link).then(() => {
      setIsLinkCopied(true);
      setTimeout(() => {
        setIsLinkCopied(false);
      }, 2500);
    }).catch(err => {
      console.error('Failed to copy link: ', err);
      alert('Failed to copy link.');
    });
  };

  const handleDownloadApp = async () => {
    try {
        const zip = new JSZip();
        
        // Helpers
        const fetchText = async (path: string) => {
            const res = await fetch(path);
            if (!res.ok) throw new Error(`Failed to fetch ${path}`);
            return await res.text();
        };

        const fetchAsBase64 = async (path: string) => {
            const res = await fetch(path);
            const blob = await res.blob();
            return new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
            });
        };

        // Files to bundle
        const filesToBundle = [
            'types.ts',
            'components/icons.tsx',
            'components/LoadingSpinner.tsx',
            'components/AuthScreen.tsx',
            'components/PublicScreen.tsx',
            'components/MobilePreviewScreen.tsx',
            'components/ChatScreen.tsx',
            'App.tsx'
        ];

        let bundledCode = "";

        // Bundle Source
        for (const file of filesToBundle) {
            let content = await fetchText(file);
            content = content.replace(/^import .*$/gm, '');
            content = content.replace(/^export default .*$/gm, '');
            content = content.replace(/^export /gm, '');
            bundledCode += `\n// --- ${file} ---\n${content}\n`;
        }

        // Fetch Assets
        const manifestContent = await fetchText('manifest.json');
        const viteSvgDataUrl = await fetchAsBase64('vite.svg');

        // Create Index HTML
        const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" type="image/svg+xml" href="${viteSvgDataUrl}" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Red AI - Your AI Assistant</title>
    <link rel="manifest" href="/manifest.json" />
    <meta name="theme-color" content="#1e293b" />
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>body { font-family: 'Inter', sans-serif; }</style>
    <script type="importmap">
    {
      "imports": {
        "react": "https://aistudiocdn.com/react@^19.2.0",
        "react-dom/client": "https://aistudiocdn.com/react-dom@^19.2.0/",
        "@google/genai": "https://aistudiocdn.com/@google/genai@^1.30.0",
        "jspdf": "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm",
        "jszip": "https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm"
      }
    }
    </script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  </head>
  <body class="bg-slate-900">
    <div id="root"></div>
    <script type="text/babel" data-presets="react,typescript" data-type="module">
      import React, { useState, useRef, useCallback, useEffect } from 'react';
      import ReactDOM from 'react-dom/client';
      import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
      import { jsPDF } from 'jspdf';
      import JSZip from 'jszip';

      ${bundledCode}

      const root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(
        <React.StrictMode>
          <App />
        </React.StrictMode>
      );
    </script>
  </body>
</html>`;

        // Create Worker Script (Embedding the HTML)
        const escapedHtml = indexHtml
            .replace(/\\/g, '\\\\')
            .replace(/`/g, '\\`')
            .replace(/\${/g, '\\${');
        
        const workerJs = `
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Serve Manifest
    if (url.pathname === "/manifest.json") {
      return new Response(JSON.stringify(${manifestContent}), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // Serve App
    return new Response(HTML, {
      headers: { 
        "Content-Type": "text/html;charset=UTF-8",
        "Cache-Control": "no-cache"
      }
    });
  }
};

const HTML = \`${escapedHtml}\`;
`;

        // Populate Zip
        zip.file("worker.js", workerJs);
        zip.file("wrangler.toml", `name = "red-ai-worker"\nmain = "worker.js"\ncompatibility_date = "2024-03-20"`);
        zip.file("package.json", `{\n  "name": "red-ai-worker",\n  "private": true,\n  "scripts": {\n    "deploy": "wrangler deploy"\n  },\n  "devDependencies": {\n    "wrangler": "^3.0.0"\n  }\n}`);
        zip.file("README.md", `# Red AI - Cloudflare Worker Deployment

You can deploy this app to get a \`.workers.dev\` link.

## Method 1: Dashboard (Quick Edit)
1. Create a new Worker in Cloudflare Dashboard.
2. Click "Edit Code".
3. Copy the contents of \`worker.js\` from this zip and paste it into the online editor.
4. Save and Deploy.

## Method 2: CLI
1. Run \`npm install\`
2. Run \`npm run deploy\``);
        
        // Keep index.html for backup or Pages drag-and-drop
        zip.file("index.html", indexHtml); 
        zip.file("_redirects", "/* /index.html 200");

        // Download
        const content = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(content);
        const link = document.createElement('a');
        link.href = url;
        link.download = "red-ai-worker.zip";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (e) {
        console.error("Download failed", e);
        alert("Failed to generate deployment package.");
    }
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    let y = 10;
    
    doc.setFontSize(16);
    doc.text("Red AI Conversation Log", 10, y);
    y += 10;

    doc.setFontSize(12);
    
    transcript.forEach(item => {
        const speaker = item.speaker === 'User' ? 'You' : 'Red AI';
        doc.setFont(undefined, 'bold');
        doc.text(`${speaker}:`, 10, y);
        
        doc.setFont(undefined, 'normal');
        const textLines = doc.splitTextToSize(item.text || '', 180);
        doc.text(textLines, 10, y + 5);
        
        y += 5 + (textLines.length * 6) + 5;
        
        if (y > 280) {
            doc.addPage();
            y = 10;
        }
    });

    doc.save('red-ai-conversation.pdf');
    setIsExportMenuOpen(false);
  };

  const handleExportWord = () => {
    const content = transcript.map(t => `
        <div style="margin-bottom: 15px; font-family: 'Arial', sans-serif;">
            <p style="margin: 0; font-weight: bold; color: ${t.speaker === 'AI' ? '#4F46E5' : '#333'}">${t.speaker === 'User' ? 'You' : 'Red AI'}:</p>
            <p style="margin: 5px 0 0 0; white-space: pre-wrap;">${(t.text || '').replace(/\n/g, '<br/>')}</p>
        </div>
    `).join('');

    const header = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' 
                xmlns:w='urn:schemas-microsoft-com:office:word' 
                xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
            <meta charset='utf-8'>
            <title>Red AI Conversation</title>
        </head>
        <body style="font-family: 'Arial', sans-serif; padding: 20px;">
            <h1 style="color: #4F46E5;">Red AI Conversation Log</h1>
            ${content}
        </body>
        </html>
    `;

    const blob = new Blob([header], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'red-ai-conversation.doc';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setIsExportMenuOpen(false);
  };

  const startConversation = useCallback(async () => {
    setIsListening(true);
    setIsConversing(true);
    setError(null);

    const ai = initializeAi();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRefs.current.stream = stream;
      
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const inputAudioContext = new AudioContext({ sampleRate: 16000 });
      const outputAudioContext = new AudioContext({ sampleRate: 24000 });
      audioContextRefs.current.input = inputAudioContext;
      audioContextRefs.current.output = outputAudioContext;
      audioContextRefs.current.sources = new Set();
      nextStartTimeRef.current = 0;

      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          systemInstruction: MODE_CONFIG[activeMode].systemInstruction
        },
        callbacks: {
          onopen: () => {
            const source = inputAudioContext.createMediaStreamSource(stream);
            audioContextRefs.current.streamSource = source;
            const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
            audioContextRefs.current.scriptProcessor = scriptProcessor;

            scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
              const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              if (sessionPromiseRef.current) {
                sessionPromiseRef.current.then((session) => {
                  session.sendRealtimeInput({ media: pcmBlob });
                });
              }
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContext.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.inputTranscription) {
              transcriptRefs.current.input += message.serverContent.inputTranscription.text;
            }
            if (message.serverContent?.outputTranscription) {
              transcriptRefs.current.output += message.serverContent.outputTranscription.text;
            }
            if (message.serverContent?.turnComplete) {
              setIsListening(false);
              const userInput = transcriptRefs.current.input.trim();
              const aiOutput = transcriptRefs.current.output.trim();
              const newItems: TranscriptItem[] = [];
              if (userInput) newItems.push({ speaker: 'User', text: userInput });
              if (aiOutput) newItems.push({ speaker: 'AI', text: aiOutput });
              
              if(newItems.length > 0) {
                 setTranscript(prev => [...prev, ...newItems]);
              }

              transcriptRefs.current.input = '';
              transcriptRefs.current.output = '';
            }

            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              const outCtx = audioContextRefs.current.output!;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outCtx.currentTime);
              const audioBuffer = await decodeAudioData(decode(base64Audio), outCtx, 24000, 1);
              const source = outCtx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outCtx.destination);
              source.addEventListener('ended', () => {
                audioContextRefs.current.sources.delete(source);
              });
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              audioContextRefs.current.sources.add(source);
            }
          },
          onerror: (e: ErrorEvent) => {
            console.error(e);
            setError('An error occurred during the conversation.');
            stopConversation();
          },
          onclose: () => {
             stopConversation();
          },
        }
      });
    } catch (err) {
      console.error(err);
      setError('Could not start the microphone. Please grant permission and try again.');
      setIsListening(false);
      setIsConversing(false);
    }
  }, [stopConversation, cleanup, initializeAi, activeMode]);

  const Sidebar = () => (
    <aside className="w-64 bg-slate-950 p-4 flex flex-col border-r border-slate-800 hidden md:flex">
        <div className="flex items-center gap-2 mb-8">
            <SparklesIcon className="w-8 h-8 text-indigo-400" />
            <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Red AI</h1>
        </div>
        <nav className="flex flex-col gap-2">
            {(Object.keys(MODE_CONFIG) as AIMode[]).map(mode => {
                const { title, icon: Icon } = MODE_CONFIG[mode];
                const isActive = activeMode === mode;
                return (
                    <button 
                        key={mode}
                        onClick={() => setActiveMode(mode)}
                        className={`flex items-center gap-3 p-3 rounded-lg text-sm font-semibold transition-colors ${isActive ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
                    >
                        <Icon className="w-5 h-5" />
                        <span>{title}</span>
                    </button>
                )
            })}
        </nav>
        <div className="mt-auto text-center text-xs text-slate-500 pt-4">
            <p>Developed by GM Ripon</p>
             <a href="https://wa.me/8801711740322" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 hover:text-slate-300 transition-colors mt-2">
                <WhatsappIcon className="w-4 h-4" />
                <span>Contact</span>
            </a>
        </div>
    </aside>
  );

  return (
    <div className="flex h-full w-full bg-slate-900">
      <Sidebar />
      <div className="flex flex-col flex-grow">
        <header className="flex items-center justify-between text-center p-4 border-b border-slate-800 flex-shrink-0 bg-slate-900 z-10 relative">
            <div className="w-12 md:hidden">
                 {/* Placeholder for potential mobile menu icon */}
            </div>
            <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-100 tracking-tight">{MODE_CONFIG[activeMode].title}</h2>
            </div>
            <div className="flex items-center gap-2">
                <button 
                    onClick={handleDownloadApp}
                    className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors hidden sm:flex"
                    title="Download Worker Bundle"
                >
                    <CloudArrowDownIcon className="w-5 h-5" />
                </button>

                <button
                    onClick={handleShare}
                    className={`p-2 rounded-lg transition-colors flex items-center gap-1.5 text-sm ${
                        isLinkCopied 
                        ? 'bg-emerald-500/10 text-emerald-400' 
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                    title="Share App"
                    disabled={isLinkCopied}
                >
                    {isLinkCopied ? (
                        <>
                            <ClipboardDocumentCheckIcon className="w-5 h-5" />
                            <span className="hidden sm:inline">Copied!</span>
                        </>
                    ) : (
                        <>
                            <ShareIcon className="w-5 h-5" />
                            <span className="hidden sm:inline">Share</span>
                        </>
                    )}
                </button>

                 <div className="relative" ref={exportMenuRef}>
                    <button 
                        onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                        className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        title="Export Chat"
                    >
                        <ArrowDownTrayIcon className="w-5 h-5" />
                    </button>
                    {isExportMenuOpen && (
                        <div className="absolute top-full right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
                            <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-700">Export To</div>
                            <button 
                                onClick={handleExportWord}
                                className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2"
                            >
                                <DocumentTextIcon className="w-4 h-4 text-blue-400" />
                                Word (.doc)
                            </button>
                            <button 
                                onClick={handleExportPDF}
                                className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2"
                            >
                                <DocumentIcon className="w-4 h-4 text-red-400" />
                                PDF (.pdf)
                            </button>
                        </div>
                    )}
                </div>

                <div className="relative w-auto flex justify-end" ref={menuRef}>
                    <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white bg-slate-800 px-3 py-2 rounded-md md:hidden">
                        Modes
                        <ChevronDownIcon className="w-4 h-4" />
                    </button>
                    {isMenuOpen && (
                        <div className="absolute top-full right-0 mt-2 w-56 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-20">
                            {(Object.keys(MODE_CONFIG) as AIMode[]).map(mode => (
                                <button 
                                    key={mode}
                                    onClick={() => {
                                        setActiveMode(mode);
                                        setIsMenuOpen(false);
                                    }}
                                    className={`block w-full text-left px-4 py-3 text-sm ${activeMode === mode ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-700'}`}
                                >
                                    {MODE_CONFIG[mode].title}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </header>

        <main ref={chatContainerRef} className="flex-grow p-4 overflow-y-auto space-y-6 scroll-smooth">
            {transcript.map((item, index) => (
            <div key={index}>
                <div className={`flex items-end gap-3 ${item.speaker === 'User' ? 'justify-end' : 'justify-start'}`}>
                {item.speaker === 'AI' && <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-lg shadow-indigo-500/20">AI</div>}
                <div className={`max-w-[85%] md:max-w-[70%] p-4 rounded-2xl shadow-sm ${item.speaker === 'User' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700'}`}>
                    <LinkifiedText text={item.text || ''} />
                </div>
                </div>
            </div>
            ))}
            {isListening && (
                <div className="flex justify-start">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-sm flex-shrink-0">AI</div>
                        <div className="flex items-center gap-1 bg-slate-800 px-4 py-3 rounded-2xl rounded-bl-none border border-slate-700">
                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                    </div>
                </div>
            )}
            {isLoading && (
            <div className="flex justify-start">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-sm flex-shrink-0">AI</div>
                    <LoadingSpinner className="w-6 h-6 text-indigo-400" />
                </div>
            </div>
            )}
            {error && (
                <div className="flex justify-center">
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 rounded-full text-sm flex items-center gap-2">
                        <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                        {error}
                    </div>
                </div>
            )}
        </main>

        <footer className="p-2 sm:p-4 flex-shrink-0 bg-slate-900 border-t border-slate-800">
            <div className="flex items-end gap-2 bg-slate-800 rounded-xl p-2 border border-slate-700 shadow-sm">
                <textarea
                    value={inputText}
                    onChange={(e) => {
                        setInputText(e.target.value);
                        const textarea = e.currentTarget;
                        textarea.style.height = 'auto';
                        textarea.style.height = `${textarea.scrollHeight}px`;
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                        }
                    }}
                    placeholder={`Message ${MODE_CONFIG[activeMode].title}...`}
                    rows={1}
                    className="flex-grow bg-transparent text-slate-100 placeholder-slate-400 resize-none focus:outline-none px-3 py-2 max-h-32 text-sm"
                    disabled={isConversing}
                />
                {isConversing ? (
                    <button
                        onClick={stopConversation}
                        className="w-10 h-10 md:w-12 md:h-12 bg-red-500 text-white rounded-lg flex items-center justify-center hover:bg-red-600 focus:outline-none transition-all shadow-lg shadow-red-500/20 animate-pulse flex-shrink-0"
                        aria-label="Stop conversation"
                    >
                        <StopCircleIcon className="w-6 h-6" />
                    </button>
                ) : (
                    <>
                    {inputText.trim() ? (
                        <button
                            onClick={() => handleSendMessage()}
                            className="w-10 h-10 md:w-12 md:h-12 bg-indigo-600 text-white rounded-lg flex items-center justify-center hover:bg-indigo-700 focus:outline-none transition-all shadow-lg shadow-indigo-500/20 flex-shrink-0"
                            aria-label="Send message"
                        >
                            <SendIcon className="w-5 h-5" />
                        </button>
                    ) : (
                        <button
                            onClick={startConversation}
                            className="w-10 h-10 md:w-12 md:h-12 bg-slate-700 text-slate-300 rounded-lg flex items-center justify-center hover:bg-slate-600 hover:text-white focus:outline-none transition-all flex-shrink-0"
                            aria-label="Start voice conversation"
                        >
                            <MicrophoneIcon className="w-5 h-5" />
                        </button>
                    )}
                    </>
                )}
            </div>
        </footer>
      </div>
    </div>
  );
};
