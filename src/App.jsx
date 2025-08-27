import React, { useState, useEffect, useRef } from 'react';
import { SignedIn, SignedOut, useUser, useAuth } from '@clerk/clerk-react';
import { supabase } from './supabaseClient';
import { Bot, User, Send, BrainCircuit, Loader2, MessageSquare, GitBranch, Lightbulb, UserCheck } from 'lucide-react';
import * as microsoftTeams from "@microsoft/teams-js";

/**
 * The main App component handles the primary SSO logic. It detects if the
 * app is running within Microsoft Teams and triggers the authentication
 * flow automatically for a seamless user experience.
 */
export default function App({ clerk }) {
    const [isTeams, setIsTeams] = useState(false);
    const [loading, setLoading] = useState(true);
    const authTriggered = useRef(false); // Prevents multiple redirect attempts

    // On component mount, initialize the Teams SDK to check the environment.
    useEffect(() => {
        const initialize = async () => {
            try {
                await microsoftTeams.app.initialize();
                setIsTeams(true);
            } catch (error) {
                console.warn("App is not running in Microsoft Teams.");
                setIsTeams(false);
            } finally {
                setLoading(false);
            }
        };
        initialize();
    }, []);

    /**
     * Programmatically initiates the Clerk SSO redirect flow.
     * This uses the specific SAML strategy configured for Microsoft Entra ID.
     */
    const handleLogin = () => {
        if (!clerk || authTriggered.current) return;
        authTriggered.current = true; // Mark that we've started the auth flow
        clerk.authenticateWithRedirect({
            // IMPORTANT: Replace with your actual strategy name from the Clerk dashboard.
            // It often looks like 'saml_sso_xxxxxxxxxxxx'.
            strategy: 'saml_sso_microsoftentra', 
            redirectUrl: '/',
            redirectUrlComplete: '/'
        });
    };

    // This effect triggers the login flow automatically once the app has initialized,
    // confirmed it's in Teams, and detected the user is signed out.
    useEffect(() => {
        if (!loading && isTeams && clerk && !clerk.user) {
            handleLogin();
        }
    }, [loading, isTeams, clerk]);


    if (loading) {
        return <div className="flex items-center justify-center h-screen bg-gray-900 text-white"><Loader2 className="animate-spin mr-2" /> Initializing App...</div>;
    }

    return (
        <>
            <SignedIn>
                <AuthenticatedApp />
            </SignedIn>
            <SignedOut>
                <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
                    <h1 className="text-3xl font-bold mb-4">AI Coach & Mentor</h1>
                    {isTeams ? (
                        <p className="mb-8">Please wait, attempting to sign you in automatically...</p>
                    ) : (
                        <>
                            <p className="mb-8">Please sign in to continue.</p>
                            <button onClick={handleLogin} className="bg-blue-600 text-white font-bold py-2 px-4 rounded hover:bg-blue-700 transition-colors">
                                Sign In
                            </button>
                        </>
                    )}
                </div>
            </SignedOut>
        </>
    );
}

/**
 * This component renders only when the user is authenticated.
 * It handles the Supabase session setup after Clerk has signed the user in.
 */
function AuthenticatedApp() {
    const { user } = useUser();
    const { getToken } = useAuth();
    const [isSupabaseReady, setIsSupabaseReady] = useState(false);
    const [modeSelected, setModeSelected] = useState(null);
    const [supabaseError, setSupabaseError] = useState(null);

    useEffect(() => {
        const setSupabaseSession = async () => {
            try {
                const supabaseToken = await getToken({ template: 'supabase' });
                if (!supabaseToken) {
                    throw new Error("Could not get Supabase token from Clerk. Please ensure the Supabase JWT template is configured correctly in your Clerk dashboard.");
                }
                const { error } = await supabase.auth.setSession({
                    access_token: supabaseToken,
                });
                if (error) {
                    throw error;
                }
                setIsSupabaseReady(true);
            } catch (e) {
                console.error("Error setting Supabase session:", e);
                setSupabaseError(e.message);
            }
        };
        if (user) {
            setSupabaseSession();
        }
    }, [getToken, user]);

    const handleModeSelect = (mode) => {
        setModeSelected(mode);
        sessionStorage.setItem('appMode', mode);
    };

    if (supabaseError) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-red-900 text-white p-4 text-center">
                <h1 className="text-2xl font-bold mb-4">Error Configuring Session</h1>
                <p>There was a problem authenticating with the backend service.</p>
                <p className="mt-4 text-sm font-mono bg-red-800 p-2 rounded">{supabaseError}</p>
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

/**
 * The main user interface, including the header and chat area.
 */
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
                        <h1 className="text-lg font-bold text-white">{isMentorMode ? 'AI Mentor' : 'AI Coach'} for {user?.fullName || 'User'}</h1>
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

/**
 * The chat interface component where users interact with the AI.
 * (Further implementation for sending/receiving messages is needed here).
 */
function ChatInterface({ mode }) {
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [input, setInput] = useState('');
    const messagesEndRef = useRef(null);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

    const handleSend = async () => {
        if (input.trim() === '') return;
        console.log(`Sending message in ${mode} mode:`, input);
        // TODO: Implement API call to Netlify function and update state
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

/**
 * The initial screen where the user chooses between "Mentor" and "Coach" mode.
 */
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
