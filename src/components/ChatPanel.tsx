import { useState, useRef, ChangeEvent } from 'react';
import { Send, X, Image as ImageIcon } from 'lucide-react';

interface ChatPanelProps {
  onSendMessage: (msg: string, image?: string) => void;
  onClose: () => void;
  disabled: boolean;
  messages: {role: 'user'|'ai', text: string}[];
}

export default function ChatPanel({ onSendMessage, onClose, disabled, messages }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if ((!input.trim() && !selectedImage) || disabled) return;
    onSendMessage(input, selectedImage || undefined);
    setInput('');
    setSelectedImage(null);
  };

  const handleImageSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="w-full md:w-80 bg-[#202124] border border-gray-700 flex flex-col h-full rounded-xl overflow-hidden shadow-lg md:ml-4 absolute md:relative z-50 md:z-auto inset-0 md:inset-auto">
      <div className="p-4 border-b border-gray-700 flex justify-between items-center">
        <h2 className="text-lg font-semibold text-white">In-call messages</h2>
        <button onClick={onClose} className="p-2 hover:bg-[#3c4043] rounded-full">
          <X className="w-5 h-5 text-gray-300" />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="bg-[#3c4043] p-3 rounded-lg text-sm text-gray-300 text-center">
          Messages can only be seen by people in the call and are deleted when the call ends.
        </div>
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`text-xs text-gray-400 mb-1 ${msg.role === 'user' ? 'mr-1' : 'ml-1'}`}>
              {msg.role === 'user' ? 'You' : 'AI Teacher'}
            </div>
            <div className={`px-4 py-2 rounded-2xl max-w-[90%] ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-[#3c4043] text-white rounded-tl-sm'}`}>
              {msg.text}
            </div>
          </div>
        ))}
      </div>
      
      <div className="p-4 border-t border-gray-700">
        {selectedImage && (
          <div className="mb-2 relative inline-block">
            <img src={selectedImage} alt="Selected" className="h-20 rounded-lg border border-gray-600" />
            <button 
              onClick={() => setSelectedImage(null)}
              className="absolute -top-2 -right-2 bg-gray-800 rounded-full p-1 border border-gray-600 hover:bg-gray-700"
            >
              <X className="w-3 h-3 text-white" />
            </button>
          </div>
        )}
        <div className="flex items-center bg-[#3c4043] rounded-full px-4 py-2">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-1 mr-2 rounded-full text-gray-400 hover:text-white hover:bg-[#4d5155]"
            disabled={disabled}
          >
            <ImageIcon className="w-5 h-5" />
          </button>
          <input 
            type="file" 
            ref={fileInputRef}
            className="hidden" 
            accept="image/*"
            onChange={handleImageSelect}
          />
          <input 
            type="text" 
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Send a message"
            className="flex-1 bg-transparent outline-none text-sm text-white placeholder-gray-400"
            disabled={disabled}
          />
          <button 
            onClick={handleSend}
            disabled={(!input.trim() && !selectedImage) || disabled}
            className={`p-1 rounded-full ${(input.trim() || selectedImage) && !disabled ? 'text-blue-400 hover:bg-[#4d5155]' : 'text-gray-500'}`}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
