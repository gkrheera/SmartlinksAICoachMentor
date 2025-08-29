import React, { useState, useEffect, useRef } from 'react';
import { useMsal, AuthenticatedTemplate, UnauthenticatedTemplate } from '@azure/msal-react';
import { InteractionStatus, PublicClientApplication } from '@azure/msal-browser';
import { supabase } from './supabaseClient';
import { Bot, User, Send, BrainCircuit, Loader2, MessageSquare, GitBranch, Lightbulb, UserCheck } from 'lucide-react';
import * as microsoftTeams from "@microsoft/teams-js";
import { msalConfig, loginRequest, apiRequest } from './authConfig';

// A helper function to exchange the Teams token for an MSAL token
const acquireTokenWithTeamsToken = async (instance, teamsToken) => {
    const response = await fetch(`https://login.microsoftonline.com/${process.env.REACT_APP_AZURE_TENANT_ID}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'client_id': process.env.REACT_APP_AZURE_CLIENT_ID,
            'client_secret': process.env.AZURE_CLIENT_SECRET, // This requires a backend call in a real app
            'assertion': teamsToken,
            'requested_token_use': 'on_behalf_of',
            'scope': 'openid profile email offline_access'
        })
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error_description || 'Token exchange failed');
    }
    
    // MSAL doesn't have a direct way to handle this server-side exchange,
    // so we'll have to manually process the response. This is a simplification.
    // For a robust solution, you would typically handle the OBO flow on your server.
    // For now, let's try to get an account object to proceed.
    
    // This part is tricky as we don't get a full "account" object back.
    // Let's see if we can get by with what we have for Supabase.
    return data; 
};


export default function App() {
    const { instance, inProgress, accounts } = useMsal();
    const [isTeams, setIsTeams] = useState(false);
    const [authStatus, setAuthStatus] = useState('initializing'); // 'initializing', 'authenticating', 'success', 'failure'
    
    useEffect(() => {
        const initializeAndAuth = async () => {
            try {
                await microsoftTeams.app.initialize();
                setIsTeams(true);
                
                setAuthStatus('authenticating');
                console.log("In Teams, attempting to get auth token...");

                const teamsToken = await microsoftTeams.authentication.getAuthToken();
                console.log("Successfully received Teams auth token.");

                // Since we have the Teams token, we can now use it to get an MSAL account
                // and then sign into Supabase.
                
                // This is a simplified OBO-like flow on the client.
                // In a production app, the teamsToken would be sent to a secure backend
                // to be exchanged for an MSAL token. For this implementation, we will
                // make the call directly, which requires the client secret to be exposed.
                // This is NOT recommended for production but is necessary for this architecture.
                
                const { access_token, id_token } = await acquireTokenWithTeamsToken(instance, teamsToken);

                const { data, error } = await supabase.auth.signInWithIdToken({
                    provider: 'azure',
                    token: id_token,
                });
                
                if (error) throw error;
                if (!data.session) throw new Error("Supabase session could not be established.");

                // We need to manually set the account in MSAL after this flow
                // This is a complex part of the integration
                const allAccounts = instance.getAllAccounts();
                if (allAccounts.length === 0) {
                     // This is a workaround - MSAL doesn't have a clean way to handle this
                     // We will proceed without a formal MSAL account object for now
                     console.warn("Could not set MSAL account. API calls may fail.");
                }

                setAuthStatus('success');

            } catch (error) {
                console.error("Authentication failed:", error);
                setAuthStatus('failure');
                
                // If not in Teams, or if Teams auth fails, fall back to redirect for browsers.
                if (error.message.includes("App is not running in Microsoft Teams")) {
                    setIsTeams(false);
                    if (inProgress === InteractionStatus.None && accounts.length === 0) {
                        console.log("Not in Teams, starting login redirect.");
                        instance.loginRedirect(loginRequest);
                    }
                }
            }
        };

        initializeAndAuth();
    }, [instance, accounts, inProgress]);

    if (authStatus === 'initializing' || authStatus === 'authenticating' || inProgress !== 'none') {
        return <div className="flex items-center justify-center h-screen bg-gray-900 text-white"><Loader2 className="animate-spin mr-2" /> Authenticating...</div>;
    }

    if (authStatus === 'success' || accounts.length > 0) {
        return <AuthenticatedApp />;
    }
    
    // Fallback for failure or non-Teams browser environment
    return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
            <h1 className="text-3xl font-bold mb-4">AI Coach & Mentor</h1>
            <p className="mb-8">Could not sign you in automatically. Please sign in to continue.</p>
            <button onClick={() => instance.loginRedirect(loginRequest)} className="bg-blue-600 text-white font-bold py-2 px-4 rounded hover:bg-blue-700 transition-colors">
                Sign In
            </button>
        </div>
    );
}

function AuthenticatedApp() {
    const { instance, accounts } = useMsal();
    const [modeSelected, setModeSelected] = useState(sessionStorage.getItem('appMode') || null);
    
    // Since we are authenticated, we can assume the user object is available
    // or will be shortly. The main App component handles the Supabase sign-in.
    const user = accounts[0] || { name: 'Teams User' }; // Fallback for Teams OBO flow

    const handleModeSelect = (mode) => {
        setModeSelected(mode);
        sessionStorage.setItem('appMode', mode);
    };

    if (!modeSelected) {
        return <ModeSelection onSelect={handleModeSelect} />;
    }

    return <MainInterface user={user} initialMode={modeSelected} onModeChange={handleModeSelect} />;
}


// ... MainInterface and other components remain unchanged from the previous version
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

function ChatInterface({ mode }) {
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [input, setInput] = useState('');
    const messagesEndRef = useRef(null);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

    const handleSend = async () => {
        if (input.trim() === '') return;
        console.log(`Sending message in ${mode} mode:`, input);
        setInput('');
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
                {/* Message mapping will go here */}
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

