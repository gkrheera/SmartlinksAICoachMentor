import React, { useState, useEffect, useRef } from 'react';
import { useMsal, AuthenticatedTemplate, UnauthenticatedTemplate } from '@azure/msal-react';
import { InteractionStatus, InteractionRequiredAuthError } from '@azure/msal-browser';
import { supabase } from './supabaseClient';
import { Bot, User, Send, BrainCircuit, Loader2, MessageSquare, GitBranch, Lightbulb, UserCheck } from 'lucide-react';
import * as microsoftTeams from "@microsoft/teams-js";
import { loginRequest, apiRequest } from './authConfig';

// Helper function to generate a nonce pair for secure authentication
async function generateNoncePair() {
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
  const encoder = new TextEncoder();
  const encodedNonce = encoder.encode(nonce);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encodedNonce);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashedNonce = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return { nonce, hashedNonce };
}

export default function App() {
    const { instance, inProgress, accounts } = useMsal();
    const [isTeams, setIsTeams] = useState(false);
    const authAttempted = useRef(false);

    useEffect(() => {
        const initializeTeams = async () => {
            try {
                await microsoftTeams.app.initialize();
                setIsTeams(true);
            } catch (error) {
                console.warn("App is not running in Microsoft Teams.");
                setIsTeams(false);
            }
        };
        initializeTeams();
    }, []);

    useEffect(() => {
        if (isTeams && accounts.length === 0 && !authAttempted.current && inProgress === InteractionStatus.None) {
            authAttempted.current = true;
            const performSso = async () => {
                const { nonce, hashedNonce } = await generateNoncePair();
                sessionStorage.setItem('ssoNonce', nonce);
                
                instance.ssoSilent({ ...loginRequest, nonce: hashedNonce }).catch((error) => {
                    console.warn("SSO Silent failed, attempting popup:", error);
                    instance.loginPopup({ ...loginRequest, nonce: hashedNonce }).catch(e => {
                        console.error("Popup login failed:", e);
                    });
                });
            };
            performSso();
        }
    }, [isTeams, inProgress, instance, accounts]);
    
    // This effect handles the redirect response from Azure AD
    useEffect(() => {
        instance.handleRedirectPromise().then((response) => {
            if (response) {
                // Handle successful login
            }
        }).catch(err => {
            console.error(err);
        });
    }, [instance]);


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

    useEffect(() => {
        const setSupabaseSession = async () => {
            if (accounts.length > 0) {
                try {
                    const response = await instance.acquireTokenSilent({
                        ...loginRequest,
                        account: accounts[0]
                    });

                    if (!response.idToken) {
                        throw new Error("ID Token not found in MSAL response.");
                    }

                    const nonce = sessionStorage.getItem('ssoNonce');
                    if (!nonce) {
                        console.warn("SSO nonce not found in session storage. This may fail if a nonce is required.");
                    }

                    const { data, error } = await supabase.auth.signInWithIdToken({
                        provider: 'azure',
                        token: response.idToken,
                        nonce: nonce,
                    });

                    if (error) throw error;
                    if (!data.session) throw new Error("Supabase session could not be established.");
                    
                    setIsSupabaseReady(true);
                    sessionStorage.removeItem('ssoNonce'); // Clean up nonce after use

                } catch (e) {
                    console.error("Error acquiring token or setting Supabase session:", e);
                     if (e instanceof InteractionRequiredAuthError) {
                        instance.loginPopup(loginRequest);
                    }
                    setSupabaseError(e.message);
                }
            }
        };
        setSupabaseSession();
    }, [instance, accounts]);

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

    return <MainInterface user={accounts[0]} initialMode={modeSelected} onModeChange={handleModeSelect} />;
}

function MainInterface({ user, initialMode, onModeChange }) {
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
                <ChatInterface mode={currentMode} key={currentMode} />
            </div>
        </div>
    );
}

// Function to generate the initial welcome message based on the mode
const getInitialMessage = (mode) => {
    const welcomeMessage = {
        role: 'assistant',
        content: mode === 'coach'
            ? "Hello! I'm your AI Coach. Before we begin, I want to assure you that our conversation is completely confidential. I'm here to provide a safe space for you to explore your thoughts.\n\nWhat's on your mind today?"
            : "Welcome. I'm your AI Mentor. All of our discussions are confidential, so please feel free to speak openly. I'm here to offer guidance and advice.\n\nTo start, could you tell me a bit about the challenge or topic you'd like to work on?"
    };
    return [welcomeMessage];
};

function ChatInterface({ mode }) {
    const { instance, accounts } = useMsal();
    // Initialize messages state with the welcome message
    const [messages, setMessages] = useState(() => getInitialMessage(mode));
    const [isLoading, setIsLoading] = useState(false);
    const [input, setInput] = useState('');
    const messagesEndRef = useRef(null);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

    const handleSend = async () => {
        if (input.trim() === '' || isLoading) return;

        const userMessage = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);
        
        const systemPrompt = mode === 'coach' 
            ? `You are an AI Coach that strictly adheres to the ICF Core Competencies and PCC Markers. Your primary goal is to help the user find their own solutions through powerful questioning and active listening.
            
            **Core Principles:**
            1.  **One Question at a Time:** You MUST only ask ONE open-ended question per response. This is your most important rule.
            2.  **Listen Actively:** Reflect back the user's language and emotions before asking your question. Use phrases like, "What I'm hearing is..." or "It sounds like you're feeling..."
            3.  **Evoke Awareness:** Ask questions about the user's way of thinking, their assumptions, values, and needs.
            4.  **No Advice:** NEVER give direct advice, solutions, or opinions.`
            : `You are an AI Mentor. Your purpose is to provide expert advice and actionable guidance. Your methodology is to first **Inquire**, then **Advise**.

            **Your Process:**
            1.  **Inquire First:** When the user presents a problem, your first priority is to understand their context. Ask 1-2 powerful, open-ended questions to clarify the situation, the goals, and the obstacles. Do NOT offer any advice at this stage.
            2.  **Identify Context:** Based on the user's answers, determine if their challenge relates to Project Management, IT Consulting, Facilitation, or Sales.
            3.  **Advise Second:** Once you have a clear understanding, transition to providing direct advice. Your recommendations should be clear, actionable, and framed within the context you have identified.`;

        try {
            const tokenResponse = await instance.acquireTokenSilent({
                ...apiRequest,
                account: accounts[0],
            });

            const response = await fetch('/.netlify/functions/callGemini', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${tokenResponse.accessToken}`,
                },
                body: JSON.stringify({
                    history: [...messages, userMessage],
                    systemPrompt: systemPrompt
                }),
            });

            if (!response.ok) {
                throw new Error(`API call failed with status: ${response.status}`);
            }

            const data = await response.json();
            setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
        } catch (error) {
            console.error("Failed to send message:", error);
            const errorMessage = { role: 'assistant', content: `Sorry, there was an error: ${error.message}` };
            setMessages(prev => [...prev, errorMessage]);
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
                    <div key={index} className={`flex items-start gap-4 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                        {msg.role === 'assistant' && (
                            <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${assistantIconBg}`}>
                                {assistantIcon}
                            </div>
                        )}
                        <div className={`max-w-lg p-3 rounded-lg ${msg.role === 'user' ? userBubbleBg : assistantBubbleBg}`}>
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        </div>
                         {msg.role === 'user' && (
                            <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-gray-600">
                                <User className="text-white" />
                            </div>
                        )}
                    </div>
                ))}
                {isLoading && (
                    <div className="flex items-start gap-4">
                         <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${assistantIconBg}`}>
                            {assistantIcon}
                        </div>
                        <div className={`max-w-lg p-3 rounded-lg ${assistantBubbleBg}`}>
                           <Loader2 className="animate-spin h-5 w-5" />
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
             {icon}
            <span className="hidden sm:inline">{label}</span>
        </button>
    );
};

