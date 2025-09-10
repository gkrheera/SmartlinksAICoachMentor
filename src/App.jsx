import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { Bot, User, Send, BrainCircuit, Loader2, MessageSquare, GitBranch, Lightbulb, UserCheck, AlertTriangle, LogOut, PlusCircle } from 'lucide-react';

// --- AUTH COMPONENT (No changes) ---
function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleAuthAction = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage('Success! Please check your email for a confirmation link.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold mb-2 text-center">AI Coach & Mentor</h1>
        <p className="text-gray-400 mb-8 text-center">{isSignUp ? 'Create an account to get started.' : 'Sign in to continue.'}</p>

        <form onSubmit={handleAuthAction} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength="6"
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded hover:bg-blue-700 transition-colors disabled:bg-gray-500"
          >
            {loading ? <Loader2 className="animate-spin mx-auto" /> : (isSignUp ? 'Sign Up' : 'Sign In')}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-3 bg-red-800 border border-red-600 rounded-md text-sm flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2" />
            {error}
          </div>
        )}
        {message && (
          <div className="mt-4 p-3 bg-green-800 border border-green-600 rounded-md text-sm text-center">
            {message}
          </div>
        )}

        <div className="mt-6 text-center">
          <button onClick={() => setIsSignUp(!isSignUp)} className="text-gray-400 hover:text-white text-sm">
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
}


// --- APP ENTRY POINT (No changes) ---
export default function App() {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const getSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setSession(session);
            setLoading(false);
        };
        getSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    if (loading) {
        return <div className="flex items-center justify-center h-screen bg-gray-900 text-white"><Loader2 className="animate-spin mr-2" /> Loading...</div>;
    }

    if (!session) {
        return <Auth />;
    }

    return <AuthenticatedApp key={session.user.id} session={session} />;
}

// --- AUTHENTICATED APP WRAPPER (No changes) ---
function AuthenticatedApp({ session }) {
    const [modeSelected, setModeSelected] = useState(sessionStorage.getItem('appMode') || null);
    
    const handleLogout = async () => {
      sessionStorage.removeItem('appMode');
      await supabase.auth.signOut();
    };

    const handleModeSelect = (mode) => {
        setModeSelected(mode);
        sessionStorage.setItem('appMode', mode);
    };

    if (!modeSelected) {
        return <ModeSelection onSelect={handleModeSelect} onLogout={handleLogout} />;
    }

    return <MainInterface session={session} initialMode={modeSelected} onModeChange={handleModeSelect} onLogout={handleLogout} />;
}

// --- MAIN UI ---
function MainInterface({ session, initialMode, onModeChange, onLogout }) {
    const [currentMode, setCurrentMode] = useState(initialMode);
    const chatRef = useRef(null);

    const handleNavClick = (mode) => {
        if (mode !== currentMode) {
          setCurrentMode(mode);
          onModeChange(mode);
        }
    };

    const handleNewConversation = () => {
        if (chatRef.current) {
            chatRef.current.startNewConversation();
        }
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
                        <h1 className="text-lg font-bold text-white">{isMentorMode ? 'AI Mentor' : 'AI Coach'} for {session.user.email}</h1>
                        <p className={`text-xs ${isMentorMode ? 'text-green-400' : 'text-purple-300'}`}>Status: Active</p>
                    </div>
                </div>
                <div className="flex items-center gap-1 sm:gap-4">
                     <button 
                        onClick={handleNewConversation} 
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors bg-gray-700 hover:bg-gray-600 text-white" 
                        title="Start a new conversation"
                    >
                        <PlusCircle size={18} />
                        <span className="hidden sm:inline">New Chat</span>
                    </button>
                    <NavButton icon={<MessageSquare size={18}/>} label="Mentor" active={currentMode === 'mentor'} onClick={() => handleNavClick('mentor')} mode="mentor" />
                    <NavButton icon={<GitBranch size={18}/>} label="Coach" active={currentMode === 'coach'} onClick={() => handleNavClick('coach')} mode="coach" />
                    <button onClick={onLogout} className="text-gray-400 hover:text-white" title="Sign Out"><LogOut size={20}/></button>
                </div>
            </header>
            <div className="flex-1 overflow-y-hidden">
                <ChatInterface ref={chatRef} mode={currentMode} session={session} key={currentMode} />
            </div>
        </div>
    );
}

// --- CHAT INTERFACE ---
const ChatInterface = forwardRef(({ mode, session }, ref) => {
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [input, setInput] = useState('');
    const [conversationId, setConversationId] = useState(null);
    const messagesEndRef = useRef(null);

    const startNewConversation = useCallback(async () => {
        if (conversationId) {
            const { error } = await supabase
                .from('conversations')
                .delete()
                .eq('id', conversationId);

            if (error) {
                console.error("Error deleting conversation:", error);
            }
        }

        const welcomeMessage = {
            role: 'assistant',
            content: `Hello! I'm your AI ${mode}. Our conversation is confidential. What's on your mind today?`
        };
        setMessages([welcomeMessage]);
        setConversationId(null);
    }, [mode, conversationId]);
    
    useImperativeHandle(ref, () => ({
        startNewConversation
    }));

    useEffect(() => {
        const loadConversation = async () => {
            setIsLoading(true);
            const { data, error } = await supabase
                .from('conversations')
                .select('id, messages')
                .eq('user_id', session.user.id)
                .eq('mode', mode)
                .order('updated_at', { ascending: false })
                .limit(1);

            if (error) {
                console.error("Error loading conversation:", error);
            }

            if (data && data.length > 0 && data[0].messages) {
                setMessages(data[0].messages);
                setConversationId(data[0].id);
            } else {
                startNewConversation();
            }
            setIsLoading(false);
        };

        loadConversation();
    }, [mode, session.user.id, startNewConversation]);


    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

    const handleSend = async () => {
        if (input.trim() === '' || isLoading) return;
        
        const userMessage = { role: 'user', content: input };
        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setInput('');
        setIsLoading(true);

        const systemPrompt = mode === 'coach' 
            ? `You are an AI Coach that strictly adheres to the ICF Core Competencies and PCC Markers. Your primary goal is to help the user find their own solutions through powerful questioning and active listening. **Core Principles:** 1. **One Question at a Time:** You MUST only ask ONE open-ended question per response. This is your most important rule. 2. **Listen Actively:** Reflect back the user's language and emotions before asking your question. Use phrases like, "What I'm hearing is..." or "It sounds like you're feeling..." 3. **Evoke Awareness:** Ask questions about the user's way of thinking, their assumptions, values, and needs. 4. **No Advice:** NEVER give direct advice, solutions, or opinions.`
            : `You are an AI Mentor. Your purpose is to provide expert advice and actionable guidance. Your methodology is to first **Inquire**, then **Advise**. **Your Process:** 1. **Inquire First:** When the user presents a problem, your first priority is to understand their context. Ask 1-2 powerful, open-ended questions to clarify the situation, the goals, and the obstacles. Do NOT offer any advice at this stage. 2. **Identify Context:** Based on the user's answers, determine if their challenge relates to Project Management, IT Consulting, Facilitation, or Sales. 3. **Advise Second:** Once you have a clear understanding, transition to providing direct advice. Your recommendations should be clear, actionable, and framed within the context you have identified.`;

        try {
            const response = await fetch('/.netlify/functions/callGemini', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ history: newMessages, systemPrompt }),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to get a response from the server.');
            }

            const data = await response.json();
            const assistantMessage = { role: 'assistant', content: data.response };
            const finalMessages = [...newMessages, assistantMessage];
            setMessages(finalMessages);

            if (conversationId) {
                const { error } = await supabase
                    .from('conversations')
                    .update({ messages: finalMessages })
                    .eq('id', conversationId);
                if (error) console.error("Error updating conversation:", error);
            } else {
                const { data: newData, error } = await supabase
                    .from('conversations')
                    .insert({
                        user_id: session.user.id,
                        mode: mode,
                        messages: finalMessages
                    })
                    .select('id')
                    .single(); // Using .single() here is safe because we expect one row back after insert
                if (error) console.error("Error creating conversation:", error);
                if (newData) setConversationId(newData.id);
            }

        } catch (error) {
            console.error("Error calling Netlify function:", error);
            const errorMessage = { role: 'assistant', content: `Sorry, there was an error: ${error.message}` };
            setMessages(prev => [...prev, errorMessage]);
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
                        {msg.role === 'assistant' && <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${isMentorMode ? 'bg-blue-500' : 'bg-white border-2 border-purple-200'}`}>{isMentorMode ? <Bot className="text-white" /> : <GitBranch className="text-purple-600" />}</div>}
                        <div className={`max-w-md p-3 rounded-2xl ${msg.role === 'user' ? userBubbleBg : assistantBubbleBg}`}>
                           <p className="text-sm" style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                        </div>
                         {msg.role === 'user' && <div className="h-8 w-8 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0"><User className="text-white" size={20}/></div>}
                    </div>
                ))}
                {isLoading && <div className="flex items-start gap-3"><div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${isMentorMode ? 'bg-blue-500' : 'bg-white border-2 border-purple-200'}`}><Loader2 className="animate-spin" /></div><div className={`max-w-md p-3 rounded-2xl ${assistantBubbleBg}`}><p className="text-sm">...</p></div></div>}
                <div ref={messagesEndRef} />
            </main>
            <footer className={`p-2 sm:p-4 ${footerBg}`}>
                <div className={`flex items-center rounded-lg p-2 ${inputBg}`}>
                    <input type="text" value={input} onChange={e => setInput(e.value)} onKeyPress={e => e.key === 'Enter' && handleSend()} placeholder="Type your message..." className={`flex-1 bg-transparent focus:outline-none px-2 ${isMentorMode ? 'text-white' : 'text-gray-800'}`} disabled={isLoading} />
                    <button onClick={handleSend} disabled={isLoading || !input.trim()} className={`p-2 ml-2 rounded-md text-white disabled:bg-gray-500 transition-colors ${sendButtonBg}`}><Send size={20} /></button>
                </div>
            </footer>
        </div>
    );
});

// --- MODE SELECTION & OTHER COMPONENTS (No changes) ---
function ModeSelection({ onSelect, onLogout }) {
    return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white p-4">
            <div className="absolute top-4 right-4">
              <button onClick={onLogout} className="text-gray-400 hover:text-white flex items-center gap-2 text-sm" title="Sign Out"><LogOut size={16}/> Sign Out</button>
            </div>
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

