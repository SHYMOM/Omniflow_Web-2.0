'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Eye, EyeOff } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { useUIStore } from '@/store/uiStore';
import { useUserStore } from '@/store/userStore';
import toast from 'react-hot-toast';

// Curated selection of beautiful, high-fidelity anime character profile images
const PORTRAIT_IMAGES = [
  'https://shikimori.one/system/characters/original/139154.jpg', // Ai Hoshino
  'https://shikimori.one/system/characters/original/124381.jpg', // Gojo
  'https://shikimori.one/system/characters/original/88334.jpg',  // Marin
  'https://shikimori.one/system/characters/original/128919.jpg', // Violet
  'https://shikimori.one/system/characters/original/142721.jpg', // Kafka
  'https://shikimori.one/system/characters/original/170474.jpg', // Frieren
  'https://shikimori.one/system/characters/original/156381.jpg', // Power
  'https://shikimori.one/system/characters/original/136979.jpg', // Makima
  'https://shikimori.one/system/characters/original/163273.jpg', // Yor Forger
];

export default function AuthModal() {
  const { authModalOpen, setAuthModalOpen, authMode, setAuthMode } = useUIStore();
  const { signIn, signUp } = useUserStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [currentImage, setCurrentImage] = useState(PORTRAIT_IMAGES[0]);

  // Rotate image randomly every time the modal opens
  useEffect(() => {
    if (authModalOpen) {
      const randomIndex = Math.floor(Math.random() * PORTRAIT_IMAGES.length);
      setCurrentImage(PORTRAIT_IMAGES[randomIndex]);
      // Reset form fields
      setUsername('');
      setPassword('');
    }
  }, [authModalOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) { toast.error('Please fill in all fields'); return; }
    if (authMode === 'signin') {
      const success = signIn(username, password);
      if (success) { toast.success('Welcome back!'); setAuthModalOpen(false); }
      else toast.error('User not found. Try signing up.');
    } else {
      const success = signUp(username, password);
      if (success) { toast.success('Account created!'); setAuthModalOpen(false); }
      else toast.error('Username already taken.');
    }
  };

  return (
    <Modal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} className="max-w-[800px] w-[90vw] overflow-hidden" showClose={false}>
      <div className="flex min-h-[500px]">
        {/* Left: Artwork */}
        <div className="hidden md:block w-1/2 relative bg-surface">
          <Image src={currentImage} alt="Anime profile artwork" fill className="object-cover" unoptimized />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-void/60" />
        </div>

        {/* Right: Form */}
        <div className="flex-1 p-8 md:p-10 flex flex-col justify-center relative bg-void">
          <button onClick={() => setAuthModalOpen(false)} className="absolute top-4 right-4 text-text-secondary hover:text-white text-xl cursor-pointer">✕</button>
          <h2 className="text-2xl font-bold text-white text-center mb-2 font-display">
            {authMode === 'signin' ? 'Welcome back' : 'Create account'}
          </h2>
          <p className="text-sm text-text-secondary text-center mb-8">
            {authMode === 'signin' ? 'Sign in to your OMNISTREAM account' : 'Join OMNISTREAM today'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-white mb-1.5 block">Username</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-accent-green transition-colors" placeholder="Enter your username" />
            </div>
            <div className="relative">
              <label className="text-sm font-semibold text-white mb-1.5 block">Password</label>
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-accent-green transition-colors pr-10" placeholder="Enter your password" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 bottom-3 text-text-secondary hover:text-white cursor-pointer">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <button type="submit" className="w-full bg-white text-black font-semibold py-3 rounded-lg hover:bg-gray-200 transition-colors mt-4 cursor-pointer">
              {authMode === 'signin' ? 'Sign in' : 'Sign up'}
            </button>
          </form>

          <p className="text-sm text-text-secondary text-center mt-6">
            {authMode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')} className="text-white font-semibold underline cursor-pointer">
              {authMode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </Modal>
  );
}
