import React from 'react';
import { Utensils, Lock } from 'lucide-react';

interface Props {
  onStart: () => void;
  onAdmin: () => void;
}

export default function LandingPage({ onStart, onAdmin }: Props) {
  return (
    <div className="relative flex min-h-screen w-full max-w-md mx-auto flex-col overflow-hidden bg-background-dark shadow-2xl">
      <div className="absolute inset-0 z-0">
        <div 
          className="w-full h-full bg-center bg-no-repeat bg-cover" 
          style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuCZUabo1GiJZGv-JPezWZx4KBFeBset35ZEmszH3HMPncIVzKpQkchu3_hBUaytRTwhxy7LpWdNLxCNGFivdjAWwtcC8h9a4zWU0c8SwVNFBRHjT_IAuFn2HnmcKH8gvTohX-DH2yKbg3AAGeUOABoIaXkrqlqV1iJKccAlXh5liGjuKYeU-ss9KO3sq01tKPkAf-Br-CJMsHcmWAj7NvIqid2AdYApRPxoGHLbgPJWJjPBzKunUBmEHlL2O4d799cPtRJVywFp_KtI")' }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background-dark/20 to-background-dark/90" />
      </div>
      
      <div className="relative z-10 flex flex-col items-center justify-end flex-1 pb-24 px-6">
        <div className="text-center mb-10">
          <h1 className="text-white tracking-tight text-[40px] md:text-[56px] font-extrabold leading-tight mb-2 drop-shadow-lg">
            Golden Sea Laksa
          </h1>
          <p className="text-white/90 text-2xl font-medium tracking-wide drop-shadow-md">
            金海叻沙
          </p>
        </div>
        
        <div className="w-full">
          <button 
            onClick={onStart} 
            className="w-full flex items-center justify-center gap-3 rounded-xl h-16 px-8 bg-primary text-white text-lg font-bold shadow-2xl active:scale-95 transition-transform"
          >
            <Utensils className="w-6 h-6" />
            <span>Start Ordering / 开始点单</span>
          </button>
        </div>
      </div>
      
      <div className="absolute bottom-0 left-0 right-0 p-8 flex justify-center z-20">
        <button 
          onClick={onAdmin} 
          className="flex items-center gap-1 text-white/40 hover:text-white/80 text-[10px] uppercase tracking-widest font-semibold transition-colors"
        >
          <Lock className="w-3 h-3" />
          <span>Admin Login</span>
        </button>
      </div>
    </div>
  );
}
