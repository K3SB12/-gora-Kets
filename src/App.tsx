/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppProvider } from './context/AppContext';
import { Dashboard } from './components/Dashboard';
import { Modules } from './components/Modules';
import { Simulator } from './components/Simulator';
import { Admin } from './components/Admin';
import { TimerWidget } from './components/TimerWidget';
import { Chatbot } from './components/Chatbot';
import { BookOpen, LayoutDashboard, Settings, FileText, BrainCircuit } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { AnimatePresence, motion } from 'motion/react';

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={twMerge(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 text-sm font-medium relative overflow-hidden group",
        active 
          ? "text-emerald-400" 
          : "text-zinc-400 hover:text-zinc-200"
      )}
    >
      {active && (
        <motion.div
          layoutId="activeTab"
          className="absolute inset-0 bg-emerald-500/10 border border-emerald-500/20 rounded-xl"
          initial={false}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      )}
      {!active && (
        <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
      )}
      <span className="relative z-10 flex items-center gap-3">
        {React.cloneElement(icon as React.ReactElement, { className: "w-5 h-5" })}
        {label}
      </span>
    </button>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <AppProvider>
      <div className="min-h-screen text-zinc-100 font-sans selection:bg-emerald-500/30 flex relative">
        {/* Background */}
        <div className="atmosphere-bg" />

        {/* Sidebar / Navigation */}
        <nav className="fixed top-0 left-0 h-full w-64 glass-panel border-r border-white/10 p-4 z-40 flex flex-col">
          <div className="flex items-center gap-3 mb-8 px-2 mt-4">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              <BrainCircuit className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-100 leading-none drop-shadow-md">Idonet+</h1>
              <p className="text-[10px] text-emerald-400/80 font-medium uppercase tracking-widest mt-1">Zero-Friction</p>
            </div>
          </div>
          
          <div className="space-y-2 flex-1">
            <NavItem icon={<LayoutDashboard />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
            <NavItem icon={<BookOpen />} label="Módulos" active={activeTab === 'modules'} onClick={() => setActiveTab('modules')} />
            <NavItem icon={<FileText />} label="Simulador" active={activeTab === 'simulator'} onClick={() => setActiveTab('simulator')} />
          </div>

          <div className="mt-auto pt-4 border-t border-white/10">
            <NavItem icon={<Settings />} label="Admin" active={activeTab === 'admin'} onClick={() => setActiveTab('admin')} />
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 ml-64 p-8 lg:p-12 min-h-screen overflow-y-auto relative z-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'dashboard' && <Dashboard />}
              {activeTab === 'modules' && <Modules />}
              {activeTab === 'simulator' && <Simulator />}
              {activeTab === 'admin' && <Admin />}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Floating Timer Widget */}
        <TimerWidget />
        
        {/* AI Chatbot */}
        <Chatbot />
      </div>
    </AppProvider>
  );
}
