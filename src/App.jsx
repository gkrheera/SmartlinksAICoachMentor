// /src/App.jsx

import React, { useState, useEffect, useRef } from 'react';
import { app, authentication } from '@microsoft/teams-js';
import { supabase } from './supabaseClient';
import { Bot, User, Send, BrainCircuit, Loader2, X, MessageSquare, BookOpen, CheckSquare, Users, GitBranch, Lightbulb, UserCheck } from 'lucide-react';

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
                    resources: [`api://${window.location.host}/${import.meta.env.VITE_TEAMS_APP_ID}`],
                    silent: true
                });

                // Sign in to Supabase with the Teams token
                const { error: supabaseError } = await supabase.auth.signInWithIdToken({
                    provider: 'azure',
                    token: token,
                });

                if (supabaseError) throw supabaseError;

                setUserContext(context);
                const savedMode = sessionStorage.getItem('appMode');
                if (savedMode) {
                    setModeSelected(savedMode);
                }
            } catch (e) {
                console.error("Auth Error:", e);
                setError("Failed to authenticate with Microsoft Teams. Please ensure you are running this app within Teams.");
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

// --- Main Interface (Largely Unchanged) ---
function MainInterface({ userContext, initialMode, onModeChange }) {
    const [currentMode, setCurrentMode] = useState(initialMode);
    const [currentView, setCurrentView] = useState(initialMode === 'coach' ? 'coach' : 'chat');
    const [chatInput, setChatInput] = useState('');

    const handleNavClick = (mode, view) => {
        setCurrentMode(mode);
        setCurrentView(view);
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
                    <NavButton icon={<MessageSquare size={18}/>} label="Mentor" active={currentView === 'chat'} onClick={() => handleNavClick('mentor', 'chat')} mode="mentor" />
                    <NavButton icon={<GitBranch size={18}/>} label="Coach" active={currentView === 'coach'} onClick={() => handleNavClick('coach', 'coach')} mode="coach" />
                    {/* Add back other nav buttons as needed */}
                </div>
            </header>
            
            <div className="flex-1 overflow-y-hidden">
                {currentView === 'chat' && <ChatInterface mode="mentor" input={chatInput} setInput={setChatInput} />}
                {currentView === 'coach' && <ChatInterface mode="coach" />}
                {/* Add back Framework/Action views as needed */}
            </div>
        </div>
    );
}

// --- Refactored Chat Interface (Combined for Coach & Mentor) ---
function ChatInterface({ mode, input: controlledInput, setInput: setControlledInput }) {
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [internalInput, setInternalInput] = useState('');
    const messagesEndRef = useRef(null);

    const isControlled = controlledInput !== undefined;
    const input = isControlled ? controlledInput : internalInput;
    const setInput = isControlled ? setControlledInput : setInternalInput;
    
    // Fetch initial messages and set up realtime subscription
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
                const welcomeMessage = { role: 'assistant', content: mode === 'coach' ? "Hello! I'm your AI Master Coach. What would you like to work on?" : "Hello! I'm your AI Mentor. How can I help you today?" };
                setMessages([welcomeMessage]);
            } else {
                setMessages(data);
            }
        };
        fetchMessages();

        const subscription = supabase.channel(`messages:${mode}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `app_mode=eq.${mode}` }, (payload) => {
                setMessages((prevMessages) => [...prevMessages, payload.new]);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [mode]);
    
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

    const getSystemPrompt = () => {
        if (mode === 'coach') {
            return `You are a master AI coach using the ICF, ACT, and RFT frameworks...`; // Add your full coach prompt
        }
        return `You are MentoraFlex AI, an expert mentor...`; // Add your full mentor prompt
    };

    const handleSend = async () => {
        if (input.trim() === '' || isLoading) return;

        const userMessage = { role: 'user', content: input, app_mode: mode };
        setInput('');
        setIsLoading(true);

        // Immediately add user message to UI
        setMessages(prev => [...prev, userMessage]);

        // Save user message to Supabase DB (don't wait)
        supabase.from('messages').insert({ role: 'user', content: userMessage.content, app_mode: mode }).then(({ error }) => {
            if (error) console.error('Supabase insert error:', error);
        });

        const history = [...messages, userMessage].slice(-10); // Send last 10 messages for context

        try {
            const response = await fetch('/.netlify/functions/callGemini', {
                method: 'POST',
                body: JSON.stringify({ history, systemPrompt: getSystemPrompt() })
            });
            if (!response.ok) throw new Error(`Server function failed`);
            
            const result = await response.json();
            
            // The AI message will be added via the realtime subscription, so we don't need to add it here.
            // We just need to save it to the DB.
            const { error } = await supabase.from('messages').insert({ role: 'assistant', content: result.response, app_mode: mode });
            if (error) console.error('Supabase AI insert error:', error);

        } catch (error) {
            console.error("Error calling Gemini function:", error);
            const errorMessage = { role: 'assistant', content: "Error connecting to AI. Please try again." };
            await supabase.from('messages').insert({ ...errorMessage, app_mode: mode });
        } finally {
            setIsLoading(false);
        }
    };

    const isMentorMode = mode === 'mentor';
    
    // UI Styling based on mode
    const bgColor = isMentorMode ? 'bg-gray-800' : 'bg-purple-50';
    const textColor = isMentorMode ? '' : 'text-gray-900';
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
                    <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSend()} placeholder="Type your message..." className="flex-1 bg-transparent focus:outline-none px-2" disabled={isLoading} />
                    <button onClick={handleSend} disabled={isLoading || !input.trim()} className={`p-2 ml-2 rounded-md text-white disabled:bg-gray-500 transition-colors ${sendButtonBg}`}><Send size={20} /></button>
                </div>
            </footer>
        </div>
    );
}

// --- Mode Selection and Other UI Components (Unchanged) ---
function ModeSelection({ onSelect }) { /* ... same as your original code ... */ }
const ModeCard = ({ icon, title, description, buttonText, onClick, color }) => { /* ... same as original ... */ };
const NavButton = ({ icon, label, active, onClick, mode }) => { /* ... same as original ... */ };
