import React, { useState, useEffect, useRef } from 'react';
import { app, authentication } from '@microsoft/teams-js';
import { supabase } from './supabaseClient';
import { Bot, User, Send, BrainCircuit, Loader2, MessageSquare, GitBranch, Lightbulb, UserCheck } from 'lucide-react';

// --- Main App Component ---
export default function App() {
    const [userContext, setUserContext] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [modeSelected, setModeSelected] = useState(null);

    useEffect(() => {
        const initialize = async () => {
            try {
                await app.initialize();
                const context = await app.getContext();
                
                const token = await authentication.getAuthToken({
                    silent: true
                });

                const { data: { user }, error: supabaseError } = await supabase.auth.signInWithIdToken({
                    provider: 'azure',
                    token: token,
                });

                if (supabaseError) throw supabaseError;
                if (!user) throw new Error("Supabase user could not be authenticated.");

                setUserContext(context);
                const savedMode = sessionStorage.getItem('appMode');
                if (savedMode) {
                    setModeSelected(savedMode);
                }
            } catch (e) {
                console.error("Authentication Error:", e);
                setError("Failed to authenticate with Microsoft Teams. Please ensure this app is running inside Teams and you have consented to its permissions.");
            } finally {
                setLoading(false);
            }
        };
        initialize();
    }, []);

    const handleModeSelect = (mode) => {
        setModeSelected(mode);
        sessionStorage.setItem('appMode', mode);
    };

    if (loading) {
        return <div className="flex items-center justify-center h-screen bg-gray-900 text-white"><Loader2 className="animate-spin mr-2" /> Initializing Teams App...</div>;
    }
    
    if (error) {
        return <div className="flex items-center justify-center h-screen bg-red-900 text-white p-4 text-center">{error}</div>;
    }

    if (!modeSelected) {
        return <ModeSelection onSelect={handleModeSelect} />;
    }

    return <MainInterface userContext={userContext} initialMode={modeSelected} onModeChange={handleModeSelect} />;
}

// --- Main Interface ---
function MainInterface({ userContext, initialMode, onModeChange }) {
    const [currentMode, setCurrentMode] = useState(initialMode);

    const handleNavClick = (mode) => {
        setCurrentMode(mode);
        onModeChange(mode);
    };
    
    const isMentorMode = currentMode === 'mentor';

    return (
        <div className={`flex flex-col h-screen text-gray-100 font-sans ${isMentorMode ? 'bg-gray-800' : 'bg-purple-900'}`}>
            <header className={`p-4 border-b flex items-center justify-between ${isMentorMode ? 'bg-gray-900 border-gray-700' : 'bg-purple-950 border-purple-800'}`}>
                <div className="flex items-center">
                    <div className={`p-2 rounded-full ${isMentorMode ? 'bg-blue-500' : 'bg-purple-500'}`}>
                        {isMentorMode ? <BrainCircuit className="h-6 w-6 text-white" /> : <GitBranch className="h-6 w-6 text-white" />}
                    </div>
                    <div className="ml-3">
                        <h1 className="text-lg font-bold text-white">{isMentorMode ? 'AI Mentor' : 'AI Coach'} for {userContext?.user?.displayName || 'User'}</h1>
                        <p className={`text-xs ${isMentorMode ? 'text-green-400' : 'text-purple-300'}`}>Status: Active</p>
                    </div>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                    <NavButton icon={<MessageSquare size={18}/>} label="Mentor" active={currentMode === 'mentor'} onClick={() => handleNavClick('mentor')} mode="mentor" />
                    <NavButton icon={<GitBranch size={18}/>} label="Coach" active={currentMode === 'coach'} onClick={() => handleNavClick('coach')} mode="coach" />
                </div>
            </header>
            
            <div className="flex-1 overflow-y-hidden">
                <ChatInterface mode={currentMode} key={currentMode} />
            </div>
        </div>
    );
}

// --- Refactored Chat Interface (Combined for Coach & Mentor) ---
function ChatInterface({ mode }) {
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [input, setInput] = useState('');
    const messagesEndRef = useRef(null);

    useEffect(() => {
        const fetchMessages = async () => {
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .eq('app_mode', mode)
                .order('created_at', { ascending: true });

            if (error) {
                console.error("Error fetching messages:", error);
            } else if (data.length === 0) {
                const welcomeMessage = { role: 'assistant', content: mode === 'coach' ? "Hello! I'm your AI Master Coach. What would you like to work on today?" : "Hello! I'm your AI Mentor. How can I help you today?", app_mode: mode };
                setMessages([welcomeMessage]);
            } else {
                setMessages(data);
            }
        };
        fetchMessages();

        const channel = supabase.channel(`messages:${mode}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `app_mode=eq.${mode}` }, (payload) => {
                setMessages((prevMessages) => [...prevMessages, payload.new]);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [mode]);
    
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

    const getSystemPrompt = () => {
        if (mode === 'coach') {
            return `You are a master AI coach using the ICF, ACT, and RFT frameworks. Your Primary Directive: Honor the user's stated coaching goal. Your goal is to evoke insight, not give advice.`;
        }
        return `You are MentoraFlex AI, an expert mentor providing clear, actionable advice based on established business and leadership frameworks.`;
    };

    const handleSend = async () => {
        if (input.trim() === '' || isLoading) return;

        const userMessageContent = input;
        setInput('');
        setIsLoading(true);

        const userMessage = { role: 'user', content: userMessageContent, app_mode: mode };
        
        const { error: insertError } = await supabase.from('messages').insert(userMessage);
        if (insertError) {
             console.error('Supabase insert error:', insertError);
             setIsLoading(false);
             return;
        }

        const history = [...messages, userMessage].slice(-10);

        try {
            const response = await fetch('/.netlify/functions/callGemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ history, systemPrompt: getSystemPrompt() })
            });

            if (!response.ok) throw new Error(`Server function failed with status ${response.status}`);
            
            const result = await response.json();
            if (result.error) throw new Error(result.error);
            
            const { error: aiInsertError } = await supabase.from('messages').insert({ role: 'assistant', content: result.response, app_mode: mode });
            if (aiInsertError) console.error('Supabase AI insert error:', aiInsertError);

        } catch (error) {
            console.error("Error calling Gemini function:", error);
            await supabase.from('messages').insert({ role: 'assistant', content: `Error: ${error.message}. Please try again.`, app_mode: mode });
        } finally {
            setIsLoading(false);
        }
    };

    const isMentorMode = mode === 'mentor';
    const bgColor = isMentorMode ? 'bg-gray-800' : 'bg-purple-50';
    const textColor = isMentorMode ? 'text-gray-100' : 'text-gray-900';
    const assistantIconBg = isMentorMode ? 'bg-blue-500' : 'bg-white border-2 border-purple-200';
    const assistantIcon = isMentorMode ? <Bot className="text-white" /> : <GitBranch className="text-purple-600" />;
    const userBubbleBg = isMentorMode ? 'bg-gray-700' : 'bg-purple-600 text-white';
    const assistantBubbleBg = isMentorMode ? 'bg-gray-900 border border-gray-700' : 'bg-purple-100 text-purple-900';
    const footerBg = isMentorMode ? 'bg-gray-900 border-t border-gray-700' : 'bg-white border-t border-gray-200';
    const inputBg = isMentorMode ? 'bg-gray-700' : 'bg-gray-100';
    const sendButtonBg = isMentorMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700';

    return (
        <div className={`flex flex-col h-full ${bgColor} ${textColor}`}>
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                        {msg.role === 'assistant' && <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${assistantIconBg}`}>{assistantIcon}</div>}
                        <div className={`max-w-md md:max-w-lg p-4 rounded-xl ${msg.role === 'user' ? userBubbleBg : assistantBubbleBg}`}>
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        </div>
                        {msg.role === 'user' && <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center"><User className="text-white" /></div>}
                    </div>
                ))}
                {isLoading && (
                    <div className="flex items-start gap-3">
                        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${assistantIconBg}`}><Loader2 className="animate-spin" /></div>
                        <div className={`max-w-lg p-4 rounded-xl ${assistantBubbleBg}`}><div className="w-16 h-4 bg-gray-500 rounded-md animate-pulse"></div></div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </main>
            <footer className={`p-2 sm:p-4 ${footerBg}`}>
                <div className={`flex items-center rounded-lg p-2 ${inputBg}`}>
                    <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSend()} placeholder="Type your message..." className={`flex-1 bg-transparent focus:outline-none px-2 ${isMentorMode ? 'text-white' : 'text-gray-800'}`} disabled={isLoading} />
                    <button onClick={handleSend} disabled={isLoading || !input.trim()} className={`p-2 ml-2 rounded-md text-white disabled:bg-gray-500 transition-colors ${sendButtonBg}`}><Send size={20} /></button>
                </div>
            </footer>
        </div>
    );
}

// --- Mode Selection & UI Components (Unchanged) ---
function ModeSelection({ onSelect }) {
    return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white p-4">
            <h1 className="text-4xl font-bold mb-4 text-center">Welcome to the AI Suite</h1>
            <p className="text-lg text-gray-400 mb-12 text-center">Choose your path for today's session.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
                <ModeCard
                    icon={<UserCheck className="h-12 w-12 text-blue-400 mb-4" />}
                    title="AI Mentor"
                    description="Seek guidance, get expert advice, and learn proven frameworks for your professional challenges."
                    buttonText="Start Mentoring"
                    onClick={() => onSelect('mentor')}
                    color="blue"
                />
                <ModeCard
                    icon={<Lightbulb className="h-12 w-12 text-purple-400 mb-4" />}
                    title="AI Coach"
                    description="Explore your own thinking, uncover new perspectives, and find your own solutions to complex issues."
                    buttonText="Start Coaching"
                    onClick={() => onSelect('coach')}
                    color="purple"
                />
            </div>
        </div>
    );
}

const ModeCard = ({ icon, title, description, buttonText, onClick, color }) => (
    <div className={`bg-gray-800 rounded-2xl p-8 flex flex-col items-center text-center border border-gray-700 hover:border-${color}-500 transition-all duration-300 transform hover:-translate-y-2`}>
        {icon}
        <h2 className="text-2xl font-bold text-white mb-3">{title}</h2>
        <p className="text-gray-400 mb-8 flex-grow">{description}</p>
        <button onClick={onClick} className={`w-full py-3 px-6 rounded-lg font-semibold text-white bg-${color}-600 hover:bg-${color}-700 transition-colors`}>
            {buttonText}
        </button>
    </div>
);

const NavButton = ({ icon, label, active, onClick, mode }) => {
    const mentorActive = 'bg-blue-600 text-white';
    const coachActive = 'bg-purple-600 text-white';
    const inactive = 'text-gray-300 hover:bg-gray-700 hover:text-white';
    const activeClass = mode === 'mentor' ? mentorActive : coachActive;

    return (
        <button onClick={onClick} className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${active ? activeClass : inactive}`}>
            {icon}
            <span className="hidden sm:inline">{label}</span>
        </button>
    );
};
