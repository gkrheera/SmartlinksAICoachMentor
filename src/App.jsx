import React, { useState, useEffect, useRef } from 'react';
import { SignedIn, SignedOut, useUser, useAuth, useClerk } from '@clerk/clerk-react';
import { supabase } from './supabaseClient';
import { Bot, User, Send, BrainCircuit, Loader2, MessageSquare, GitBranch, Lightbulb, UserCheck } from 'lucide-react';

// This component handles the logic after a user is signed in via Clerk.
function AuthenticatedApp() {
    const { user } = useUser();
    const { getToken } = useAuth();
    const [isSupabaseReady, setIsSupabaseReady] = useState(false);
    const [modeSelected, setModeSelected] = useState(null);

    useEffect(() => {
        const setSupabaseSession = async () => {
            try {
                // Get the JWT from Clerk, using the Supabase template
                const supabaseToken = await getToken({ template: 'supabase' });
                if (!supabaseToken) {
                    throw new Error("Could not get Supabase token from Clerk.");
                }
                
                // Set the session in the Supabase client
                const { error } = await supabase.auth.setSession({
                    access_token: supabaseToken,
                });

                if (error) {
                    throw error;
                }
                setIsSupabaseReady(true);
            } catch (e) {
                console.error("Error setting Supabase session:", e);
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

    if (!isSupabaseReady) {
        return <div className="flex items-center justify-center h-screen bg-gray-900 text-white"><Loader2 className="animate-spin mr-2" /> Preparing session...</div>;
    }

    if (!modeSelected) {
        return <ModeSelection onSelect={handleModeSelect} />;
    }

    // Pass the authenticated user object from Clerk to the MainInterface
    return <MainInterface user={user} initialMode={modeSelected} onModeChange={handleModeSelect} />;
}

// This component will automatically redirect to the sign-in page.
function RedirectToSignIn() {
    const { redirectToSignIn } = useClerk();

    useEffect(() => {
        redirectToSignIn();
    }, [redirectToSignIn]);

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
            <Loader2 className="animate-spin mr-2" />
            <p>Redirecting to sign-in...</p>
        </div>
    );
}


// This is the main entry point of the app.
export default function App() {
    return (
        <>
            <SignedIn>
                {/* If the user is signed in, render the main application */}
                <AuthenticatedApp />
            </SignedIn>
            <SignedOut>
                {/* If the user is signed out, automatically redirect them to sign in. */}
                <RedirectToSignIn />
            </SignedOut>
        </>
    );
}

// --- UI Components ---

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
                <div className="flex items-center gap-1 sm-gap-2">
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

    // This effect is omitted as database logic is not part of this snippet
    // In a real app, you would fetch and subscribe to messages from Supabase here.
    
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

    const handleSend = async () => {
        // API call logic would go here
        if (input.trim() === '') return;
        console.log(`Sending message in ${mode} mode:`, input);
        setInput('');
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
                {/* Message mapping would go here */}
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
