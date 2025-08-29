import React, { useState, useEffect, useRef } from 'react';
import { useMsal, AuthenticatedTemplate, UnauthenticatedTemplate } from '@azure/msal-react';
import { InteractionStatus, InteractionRequiredAuthError } from '@azure/msal-browser';
import { supabase } from './supabaseClient';
import { Bot, User, Send, BrainCircuit, Loader2, MessageSquare, GitBranch, Lightbulb, UserCheck } from 'lucide-react';
import * as microsoftTeams from "@microsoft/teams-js";
import { loginRequest, apiRequest } from './authConfig';

/**
 * Generates a raw nonce and a SHA-256 hashed version of it.
 * The hashed nonce is sent to Azure AD during the authentication request.
 * The raw nonce is sent to Supabase for verification.
 * @returns {Promise<{nonce: string, hashedNonce: string}>}
 */
async function generateNoncePair() {
    // Generate a random nonce
    const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
 
    // Hash the nonce for Azure authentication using the Web Crypto API
    const encoder = new TextEncoder();
    const encodedNonce = encoder.encode(nonce);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encodedNonce);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashedNonce = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
 
    return { nonce, hashedNonce };
}

export default function App() {
    const { instance, inProgress } = useMsal();
    const [isTeams, setIsTeams] = useState(false);
    const [authAttempted, setAuthAttempted] = useState(false);

    useEffect(() => {
        microsoftTeams.app.initialize().then(() => {
            setIsTeams(true);
        }).catch(() => setIsTeams(false));
    }, []);

    useEffect(() => {
        if (isTeams && !authAttempted && inProgress === InteractionStatus.None) {
            setAuthAttempted(true);

            const performSso = async () => {
                const { nonce, hashedNonce } = await generateNoncePair();
                // Store the UNHASHED nonce for Supabase verification later.
                sessionStorage.setItem("msal_nonce", nonce);
                
                const request = {
                    ...loginRequest,
                    nonce: hashedNonce, // Use the HASHED nonce for the MSAL request.
                };
    
                instance.ssoSilent(request).catch((error) => {
                    console.warn("SSO Silent failed, attempting popup:", error);
                    instance.loginPopup(request).catch(e => {
                        console.error("Popup login failed:", e);
                    });
                });
            };
            performSso();
        }
    }, [isTeams, inProgress, instance, authAttempted]);

    if (inProgress !== InteractionStatus.None) {
        return <div className="flex items-center justify-center h-screen bg-gray-900 text-white"><Loader2 className="animate-spin mr-2" /> Authenticating...</div>;
    }

    return (
        <>
            <AuthenticatedTemplate>
                <AuthenticatedApp />
            </AuthenticatedTemplate>
            <UnauthenticatedTemplate>
                <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
                    <h1 className="text-3xl font-bold mb-4">AI Coach & Mentor</h1>
                    {isTeams ? (
                        <p className="mb-8">Attempting to sign you in via Microsoft Teams...</p>
                    ) : (
                        <>
                            <p className="mb-8">Please sign in to continue.</p>
                            <button onClick={() => instance.loginRedirect(loginRequest)} className="bg-blue-600 text-white font-bold py-2 px-4 rounded hover:bg-blue-700 transition-colors">
                                Sign In
                            </button>
                        </>
                    )}
                </div>
            </UnauthenticatedTemplate>
        </>
    );
}

function AuthenticatedApp() {
    const { instance, accounts } = useMsal();
    const [isSupabaseReady, setIsSupabaseReady] = useState(false);
    const [modeSelected, setModeSelected] = useState(sessionStorage.getItem('appMode') || null);
    const [supabaseError, setSupabaseError] = useState(null);
    const user = accounts[0] || null;

    useEffect(() => {
        const setSupabaseSession = async () => {
            if (user) {
                try {
                    const response = await instance.acquireTokenSilent({
                        ...loginRequest,
                        account: user
                    });

                    if (!response.idToken) {
                        throw new Error("ID Token not found in MSAL response.");
                    }
                    
                    // Retrieve the original UNHASHED nonce from session storage.
                    const nonce = sessionStorage.getItem("msal_nonce");
                    if (!nonce) {
                        throw new Error("Nonce could not be retrieved from session storage.");
                    }
                    sessionStorage.removeItem("msal_nonce");

                    const { data, error } = await supabase.auth.signInWithIdToken({
                        provider: 'azure',
                        token: response.idToken,
                        nonce: nonce // Pass the UNHASHED nonce to Supabase.
                    });

                    if (error) throw error;
                    if (!data.session) throw new Error("Supabase session could not be established.");
                    
                    setIsSupabaseReady(true);

                } catch (e) {
                    console.error("Error acquiring token or setting Supabase session:", e);
                     if (e instanceof InteractionRequiredAuthError) {
                        const { nonce, hashedNonce } = await generateNoncePair();
                        sessionStorage.setItem("msal_nonce", nonce);
                        instance.loginPopup({...loginRequest, nonce: hashedNonce});
                    }
                    setSupabaseError(e.message);
                }
            }
        };
        setSupabaseSession();
    }, [instance, user]);

    const handleModeSelect = (mode) => {
        setModeSelected(mode);
        sessionStorage.setItem('appMode', mode);
    };

    if (supabaseError) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-red-900 text-white p-4 text-center">
                <h1 className="text-2xl font-bold mb-4">Error Configuring Session</h1>
                <p>{supabaseError}</p>
            </div>
        );
    }

    if (!isSupabaseReady) {
        return <div className="flex items-center justify-center h-screen bg-gray-900 text-white"><Loader2 className="animate-spin mr-2" /> Preparing session...</div>;
    }

    if (!modeSelected) {
        return <ModeSelection onSelect={handleModeSelect} />;
    }

    return <MainInterface user={user} initialMode={modeSelected} onModeChange={handleModeSelect} />;
}

function MainInterface({ user, initialMode, onModeChange }) {
    const { instance } = useMsal();
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
                        <h1 className="text-lg font-bold text-white">{isMentorMode ? 'AI Mentor' : 'AI Coach'} for {user?.name || 'User'}</h1>
                        <p className={`text-xs ${isMentorMode ? 'text-green-400' : 'text-purple-300'}`}>Status: Active</p>
                    </div>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                    <NavButton icon={<MessageSquare size={18}/>} label="Mentor" active={currentMode === 'mentor'} onClick={() => handleNavClick('mentor')} mode="mentor" />
                    <NavButton icon={<GitBranch size={18}/>} label="Coach" active={currentMode === 'coach'} onClick={() => handleNavClick('coach')} mode="coach" />
                </div>
            </header>
            <div className="flex-1 overflow-y-hidden">
                <ChatInterface mode={currentMode} user={user} instance={instance} key={currentMode} />
            </div>
        </div>
    );
}

function ChatInterface({ mode, user, instance }) {
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [input, setInput] = useState('');
    const messagesEndRef = useRef(null);

    useEffect(() => { 
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); 
    }, [messages]);

    const handleSend = async () => {
        if (input.trim() === '' || isLoading) return;

        const newMessage = { role: 'user', content: input };
        setMessages(prev => [...prev, newMessage]);
        setInput('');
        setIsLoading(true);

        try {
            // Acquire access token to authorize the call to the Netlify function
            const tokenResponse = await instance.acquireTokenSilent({
                ...apiRequest,
                account: user
            });

            const systemPrompt = mode === 'mentor' 
                ? 'You are an AI Mentor. Provide expert advice and proven frameworks.'
                : 'You are an AI Coach. Help the user explore their own thinking and find their own solutions.';

            const response = await fetch('/.netlify/functions/callGemini', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${tokenResponse.accessToken}`
                },
                body: JSON.stringify({ 
                    history: [...messages, newMessage], 
                    systemPrompt 
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to get a response from the AI.');
            }

            const data = await response.json();
            setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);

        } catch (error) {
            console.error(`Error in ${mode} mode:`, error);
            setMessages(prev => [...prev, { role: 'assistant', content: `Sorry, there was an error: ${error.message}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    const isMentorMode = mode === 'mentor';
    const bgColor = isMentorMode ? 'bg-gray-800' : 'bg-purple-50';
    const textColor = isMentorMode ? 'text-gray-100' : 'text-gray-900';
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
                        {msg.role === 'assistant' && (
                            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isMentorMode ? 'bg-blue-500' : 'bg-purple-200'}`}>
                                {isMentorMode ? <Bot className="text-white" size={20} /> : <GitBranch className="text-purple-600" size={20} />}
                            </div>
                        )}
                        <div className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-xl ${msg.role === 'user' ? userBubbleBg : assistantBubbleBg}`}>
                            <p className="text-sm">{msg.content}</p>
                        </div>
                        {msg.role === 'user' && (
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
                                <User className="text-white" size={20} />
                            </div>
                        )}
                    </div>
                ))}
                {isLoading && (
                    <div className="flex items-start gap-3">
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isMentorMode ? 'bg-blue-500' : 'bg-purple-200'}`}>
                            {isMentorMode ? <Bot className="text-white" size={20} /> : <GitBranch className="text-purple-600" size={20} />}
                        </div>
                        <div className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-xl ${assistantBubbleBg}`}>
                            <Loader2 className="animate-spin" />
                        </div>
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
            <span className="hidden sm:inline">{label}</span>
        </button>
    );
};

