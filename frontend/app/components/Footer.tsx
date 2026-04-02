import React from 'react';
import Link from 'next/link';

export const Footer = () => {
  return (
    <footer className="w-full border-t border-white/5 py-12 bg-background relative z-10">
      <div className="max-w-7xl mx-auto px-8 grid grid-cols-1 md:grid-cols-4 gap-12">
        <div className="col-span-1 md:col-span-1">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-6 h-6 rounded-md premium-gradient-bg flex items-center justify-center font-bold text-[10px] text-white">P</div>
            <span className="text-lg font-black text-white">PodClip</span>
          </div>
          <p className="text-slate-500 text-sm leading-relaxed mb-6">Atmospheric Intelligence for the modern creator economy.</p>
          <p className="font-inter text-[10px] tracking-widest uppercase text-slate-500">© 2026 PodClip. Atmospheric Intelligence.</p>
        </div>
        
        <div>
          <h4 className="font-inter text-xs tracking-widest uppercase text-white font-bold mb-6">Product</h4>
          <ul className="space-y-4 text-xs font-inter tracking-widest uppercase">
            <li><Link className="text-slate-500 hover:text-white transition-all" href="#">Features</Link></li>
            <li><Link className="text-slate-500 hover:text-white transition-all" href="#">Pricing</Link></li>
            <li><Link className="text-slate-500 hover:text-white transition-all" href="#">API</Link></li>
            <li><Link className="text-slate-500 hover:text-white transition-all" href="#">Integrations</Link></li>
          </ul>
        </div>
        
        <div>
          <h4 className="font-inter text-xs tracking-widest uppercase text-white font-bold mb-6">Resources</h4>
          <ul className="space-y-4 text-xs font-inter tracking-widest uppercase">
            <li><Link className="text-slate-500 hover:text-white transition-all" href="#">Blog</Link></li>
            <li><Link className="text-slate-500 hover:text-white transition-all" href="#">Guides</Link></li>
            <li><Link className="text-slate-500 hover:text-white transition-all" href="#">Wall of Love</Link></li>
            <li><Link className="text-slate-500 hover:text-white transition-all" href="#">Support</Link></li>
          </ul>
        </div>
        
        <div>
          <h4 className="font-inter text-xs tracking-widest uppercase text-white font-bold mb-6">Legal</h4>
          <ul className="space-y-4 text-xs font-inter tracking-widest uppercase">
            <li><Link className="text-slate-500 hover:text-white transition-all" href="#">Privacy</Link></li>
            <li><Link className="text-slate-500 hover:text-white transition-all" href="#">Terms</Link></li>
            <li><Link className="text-slate-500 hover:text-white transition-all" href="#">Security</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
};
