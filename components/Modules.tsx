import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { ChevronDown, ChevronUp, CheckCircle, BookOpen, Brain, Download, Highlighter, Maximize2, X, Volume2, VolumeX, ArrowLeft, ArrowRight, Sparkles, Loader2, Pencil, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { GoogleGenAI } from '@google/genai';

export function Modules() {
  const { state, updateModuleProgress, addHighlightAndFlashcard, toggleReadingCompletion, addSimulatorQuestion, deleteFlashcard, updateFlashcard } = useAppContext();
  const [expandedId, setExpandedId] = useState<string | null>(state.modules[0].id);
  const [activeFlashcard, setActiveFlashcard] = useState<number>(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [activeReadingIds, setActiveReadingIds] = useState<Record<string, string>>({});

  // Text selection state
  const [selection, setSelection] = useState<{ text: string; x: number; y: number } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [questionInput, setQuestionInput] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  // Flashcard edit/delete state
  const [editingFlashcard, setEditingFlashcard] = useState<{id: string, front: string, back: string} | null>(null);
  const [deletingFlashcardId, setDeletingFlashcardId] = useState<string | null>(null);

  // Magazine & TTS state
  const [magazineReading, setMagazineReading] = useState<{ moduleId: string, readingId: string } | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Clean up TTS on unmount
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Stop speaking when magazine reading or page changes
  useEffect(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [magazineReading, currentPageIndex]);

  const toggleTTS = (text: string) => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-ES';
      utterance.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    }
  };

  const handleToggle = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
    setActiveFlashcard(0);
    setShowAnswer(false);
    setSelection(null);

    // Set default reading if not set
    if (expandedId !== id && !activeReadingIds[id]) {
      const module = state.modules.find(m => m.id === id);
      if (module && module.readings.length > 0) {
        setActiveReadingIds(prev => ({ ...prev, [id]: module.readings[0].id }));
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (text && text.length > 5) {
      setSelection({
        text,
        x: e.clientX,
        y: e.clientY
      });
    } else {
      // Don't clear immediately if they are clicking the floating button
    }
  };

  // Clear selection when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#floating-toolkit') && !target.closest('#flashcard-modal')) {
        const sel = window.getSelection();
        if (!sel || sel.toString().trim().length === 0) {
          setSelection(null);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSaveFlashcard = () => {
    const targetModuleId = magazineReading ? magazineReading.moduleId : expandedId;
    const targetReadingId = magazineReading 
      ? magazineReading.readingId 
      : (targetModuleId ? (activeReadingIds[targetModuleId] || state.modules.find(m => m.id === targetModuleId)?.readings[0]?.id) : null);

    if (targetModuleId && targetReadingId && selection?.text && questionInput.trim()) {
      addHighlightAndFlashcard(targetModuleId, targetReadingId, selection.text, questionInput.trim());
      setShowModal(false);
      setSelection(null);
      setQuestionInput('');
      window.getSelection()?.removeAllRanges();
    }
  };

  const handleGenerateCaseStudy = async () => {
    if (!selection?.text) return;
    
    setIsGeneratingAI(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Actúa como un experto en evaluación docente del Ministerio de Educación Pública (MEP) de Costa Rica.
Basado en el siguiente texto teórico: "${selection.text}"

Crea un caso de estudio corto y realista (estilo Prueba de Idoneidad de Colypro/MEP) donde un docente en Costa Rica enfrenta una situación relacionada con este concepto.
Termina con una pregunta de selección única con 4 opciones (A, B, C, D).

IMPORTANTE: Devuelve la respuesta en formato JSON estricto con la siguiente estructura:
{
  "caseStudy": "El texto del caso de estudio y la pregunta...",
  "options": ["Opción A", "Opción B", "Opción C", "Opción D"],
  "correctAnswerIndex": 0, // El índice de la opción correcta (0 a 3)
  "explanation": "La justificación de por qué esa es la respuesta correcta basada en el MEP..."
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      if (response.text) {
        const data = JSON.parse(response.text);
        
        // Formatear para la flashcard
        const flashcardFront = `${data.caseStudy}\n\nA) ${data.options[0]}\nB) ${data.options[1]}\nC) ${data.options[2]}\nD) ${data.options[3]}`;
        const flashcardBack = `Respuesta correcta: ${['A', 'B', 'C', 'D'][data.correctAnswerIndex]}\n\nJustificación: ${data.explanation}`;
        
        setQuestionInput(flashcardFront);
        setSelection({ ...selection, text: flashcardBack });

        // Agregar al simulador automáticamente
        addSimulatorQuestion({
          id: `ai_${Date.now()}`,
          text: data.caseStudy,
          options: data.options,
          correctAnswer: data.correctAnswerIndex,
          explanation: data.explanation
        });
      }
    } catch (error) {
      console.error("Error generating case study:", error);
      alert("Hubo un error al generar el caso de estudio. Inténtalo de nuevo.");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const renderTextWithHighlights = (text: string, highlights: string[]) => {
    if (!highlights || highlights.length === 0) {
      return <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">{text}</p>;
    }

    // Sort highlights by length descending to match longer phrases first
    const sortedHighlights = [...highlights].sort((a, b) => b.length - a.length);
    let parts = [{ text, isHighlight: false }];

    sortedHighlights.forEach(hl => {
      const newParts: { text: string; isHighlight: boolean }[] = [];
      parts.forEach(part => {
        if (part.isHighlight) {
          newParts.push(part);
          return;
        }
        const split = part.text.split(hl);
        split.forEach((s, i) => {
          if (s) newParts.push({ text: s, isHighlight: false });
          if (i < split.length - 1) newParts.push({ text: hl, isHighlight: true });
        });
      });
      parts = newParts;
    });

    return (
      <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">
        {parts.map((p, i) => p.isHighlight ? 
          <mark key={i} className="bg-emerald-500/30 text-emerald-200 rounded px-1">{p.text}</mark> : 
          <span key={i}>{p.text}</span>
        )}
      </p>
    );
  };

  // Magazine Navigation Logic
  const magModule = magazineReading ? state.modules.find(m => m.id === magazineReading.moduleId) : null;
  const magReadingIndex = magModule ? magModule.readings.findIndex(r => r.id === magazineReading?.readingId) : -1;
  const magReading = magModule && magReadingIndex >= 0 ? magModule.readings[magReadingIndex] : null;
  const magHighlights = magReading ? (state.highlights[magReading.id] || []) : [];
  
  const pages = magReading?.pages && magReading.pages.length > 0 ? magReading.pages : [magReading?.content || ''];
  const totalPages = pages.length;
  const currentPageContent = pages[currentPageIndex] || '';

  const hasPrevPage = currentPageIndex > 0;
  const hasNextPage = currentPageIndex < totalPages - 1;
  const hasPrevReading = magReadingIndex > 0;
  const hasNextReading = magModule ? magReadingIndex < magModule.readings.length - 1 : false;

  const handlePrev = () => {
    if (hasPrevPage) {
      setCurrentPageIndex(prev => prev - 1);
    } else if (hasPrevReading && magModule) {
      const prevReading = magModule.readings[magReadingIndex - 1];
      const prevPages = prevReading.pages && prevReading.pages.length > 0 ? prevReading.pages : [prevReading.content];
      setMagazineReading({ moduleId: magModule.id, readingId: prevReading.id });
      setCurrentPageIndex(prevPages.length - 1);
    }
  };

  const handleNext = () => {
    if (hasNextPage) {
      setCurrentPageIndex(prev => prev + 1);
    } else if (hasNextReading && magModule) {
      setMagazineReading({ moduleId: magModule.id, readingId: magModule.readings[magReadingIndex + 1].id });
      setCurrentPageIndex(0);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 relative">
      <header>
        <h2 className="text-3xl font-bold tracking-tight text-zinc-100">Módulos de Estudio</h2>
        <p className="text-zinc-400 mt-1">Lecturas progresivas y Student Toolbox con recuerdo activo</p>
      </header>

      <div className="space-y-4">
        {state.modules.map((module, index) => {
          const isExpanded = expandedId === module.id;
          const isCompleted = module.progress === 100;
          const flashcards = state.flashcards[module.id] || [];
          
          const activeReadingId = activeReadingIds[module.id] || module.readings[0]?.id;
          const activeReading = module.readings.find(r => r.id === activeReadingId) || module.readings[0];
          const highlights = activeReading ? (state.highlights[activeReading.id] || []) : [];

          return (
            <div 
              key={module.id} 
              className={twMerge(
                "glass-panel rounded-2xl overflow-hidden transition-all duration-300",
                isExpanded ? "ring-1 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.1)]" : "hover:border-white/20"
              )}
            >
              {/* Header */}
              <button 
                onClick={() => handleToggle(module.id)}
                className="w-full flex items-center justify-between p-6 text-left focus:outline-none"
              >
                <div className="flex items-center gap-4">
                  <div className={twMerge(
                    "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm",
                    isCompleted ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-800 text-zinc-400"
                  )}>
                    {isCompleted ? <CheckCircle className="w-5 h-5" /> : index + 1}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-100">{module.title}</h3>
                    <p className="text-sm text-zinc-400 mt-1">{module.description}</p>
                  </div>
                </div>
                {isExpanded ? <ChevronUp className="text-zinc-500" /> : <ChevronDown className="text-zinc-500" />}
              </button>

              {/* Content */}
              {isExpanded && (
                <div className="p-6 pt-0 border-t border-zinc-800/50 animate-in slide-in-from-top-2 duration-300">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6">
                    
                    {/* Reading Material */}
                    <div className="lg:col-span-2 space-y-6">
                      
                      {/* Reading Selector */}
                      <div className="flex flex-col gap-3">
                        <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                          Lecturas Disponibles ({module.readings.length})
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {module.readings.map(reading => (
                            <button
                              key={reading.id}
                              onClick={() => {
                                setActiveReadingIds(prev => ({ ...prev, [module.id]: reading.id }));
                                setSelection(null);
                              }}
                              className={twMerge(
                                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border",
                                activeReadingId === reading.id
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                  : "bg-zinc-800/50 text-zinc-400 border-zinc-700/50 hover:bg-zinc-800 hover:text-zinc-200"
                              )}
                            >
                              {reading.title}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div 
                        className="prose prose-invert prose-zinc max-w-none"
                        onMouseUp={handleMouseUp}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="flex items-center gap-2 text-emerald-400 font-medium">
                            <BookOpen className="w-4 h-4" /> {activeReading?.title}
                          </h4>
                          <button 
                            onClick={() => {
                              if (activeReading) {
                                setMagazineReading({ moduleId: module.id, readingId: activeReading.id });
                                setCurrentPageIndex(0);
                              }
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-lg transition-colors"
                          >
                            <Maximize2 className="w-4 h-4" />
                            Modo Revista
                          </button>
                        </div>
                        <div className="bg-zinc-950/50 p-6 rounded-xl border border-zinc-800/50">
                          {activeReading ? renderTextWithHighlights(activeReading.content, highlights) : <p className="text-zinc-500">No hay contenido disponible.</p>}
                        </div>
                      </div>

                      <div className="pt-6 flex items-center gap-4">
                        <button 
                          onClick={() => {
                            if (activeReading) {
                              toggleReadingCompletion(module.id, activeReading.id);
                            }
                          }}
                          className={twMerge(
                            "px-6 py-2.5 rounded-full font-medium text-sm transition-colors",
                            (state.completedReadings[module.id] || []).includes(activeReading?.id || '')
                              ? "bg-zinc-800 hover:bg-zinc-700 text-emerald-400" 
                              : "bg-emerald-500 hover:bg-emerald-600 text-zinc-950"
                          )}
                        >
                          {(state.completedReadings[module.id] || []).includes(activeReading?.id || '') ? '✓ Lectura Completada (Desmarcar)' : 'Marcar Lectura como Leída'}
                        </button>
                        <button className="flex items-center gap-2 px-4 py-2.5 rounded-full font-medium text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors">
                          <Download className="w-4 h-4" /> Guía APA 7
                        </button>
                      </div>
                    </div>

                    {/* Student Toolbox (Flashcards) */}
                    <div className="bg-zinc-950/50 border border-zinc-800/50 rounded-xl p-5">
                      <h4 className="flex items-center gap-2 text-blue-400 font-medium mb-4">
                        <Brain className="w-4 h-4" /> Student Toolbox
                      </h4>
                      
                      {flashcards.length > 0 ? (
                        <div className="space-y-4">
                          {editingFlashcard && editingFlashcard.id === flashcards[activeFlashcard].id ? (
                            <div className="bg-zinc-800 rounded-lg p-4 flex flex-col gap-3 border border-zinc-700">
                              <label className="text-xs font-medium text-zinc-500 uppercase">Pregunta / Caso</label>
                              <textarea
                                value={editingFlashcard.front}
                                onChange={e => setEditingFlashcard({...editingFlashcard, front: e.target.value})}
                                className="w-full p-2 bg-black/20 border border-white/10 rounded-lg text-sm text-zinc-200 min-h-[80px] focus:outline-none focus:border-emerald-500"
                              />
                              <label className="text-xs font-medium text-zinc-500 uppercase mt-2">Respuesta / Justificación</label>
                              <textarea
                                value={editingFlashcard.back}
                                onChange={e => setEditingFlashcard({...editingFlashcard, back: e.target.value})}
                                className="w-full p-2 bg-black/20 border border-white/10 rounded-lg text-sm text-emerald-400 min-h-[80px] focus:outline-none focus:border-emerald-500"
                              />
                              <div className="flex justify-end gap-2 mt-2">
                                <button 
                                  onClick={() => setEditingFlashcard(null)} 
                                  className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
                                >
                                  Cancelar
                                </button>
                                <button 
                                  onClick={() => {
                                    updateFlashcard(module.id, editingFlashcard.id, editingFlashcard.front, editingFlashcard.back);
                                    setEditingFlashcard(null);
                                  }} 
                                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 text-xs font-medium rounded-md transition-colors"
                                >
                                  Guardar Cambios
                                </button>
                              </div>
                            </div>
                          ) : deletingFlashcardId === flashcards[activeFlashcard].id ? (
                            <div className="min-h-[160px] bg-zinc-800 rounded-lg p-4 flex flex-col items-center justify-center text-center border border-red-500/30">
                              <Trash2 className="w-8 h-8 text-red-400 mb-3" />
                              <p className="text-sm text-zinc-200 mb-4">¿Estás seguro de que deseas eliminar esta tarjeta?</p>
                              <div className="flex gap-3">
                                <button 
                                  onClick={() => setDeletingFlashcardId(null)}
                                  className="px-4 py-2 text-xs font-medium bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-lg transition-colors"
                                >
                                  Cancelar
                                </button>
                                <button 
                                  onClick={() => {
                                    deleteFlashcard(module.id, flashcards[activeFlashcard].id);
                                    setDeletingFlashcardId(null);
                                    if (activeFlashcard >= flashcards.length - 1) {
                                      setActiveFlashcard(Math.max(0, flashcards.length - 2));
                                    }
                                  }}
                                  className="px-4 py-2 text-xs font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                                >
                                  Sí, Eliminar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div 
                              className="min-h-[160px] bg-zinc-800 rounded-lg p-4 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-zinc-700/80 transition-colors relative group"
                              onClick={() => setShowAnswer(!showAnswer)}
                            >
                              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setEditingFlashcard(flashcards[activeFlashcard]); }} 
                                  className="p-1.5 bg-black/40 hover:bg-blue-500/20 text-blue-400 rounded-md transition-colors backdrop-blur-sm"
                                  title="Editar tarjeta"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setDeletingFlashcardId(flashcards[activeFlashcard].id); }} 
                                  className="p-1.5 bg-black/40 hover:bg-red-500/20 text-red-400 rounded-md transition-colors backdrop-blur-sm"
                                  title="Eliminar tarjeta"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              
                              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                                {showAnswer ? 'Respuesta / Apunte' : 'Pregunta'}
                              </span>
                              <p className={twMerge(
                                "text-sm font-medium whitespace-pre-wrap",
                                showAnswer ? "text-emerald-400" : "text-zinc-200"
                              )}>
                                {showAnswer ? flashcards[activeFlashcard].back : flashcards[activeFlashcard].front}
                              </p>
                            </div>
                          )}
                          
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-zinc-500">
                              Tarjeta {activeFlashcard + 1} de {flashcards.length}
                            </span>
                            <div className="flex gap-2">
                              <button 
                                onClick={() => {
                                  setActiveFlashcard((prev) => (prev > 0 ? prev - 1 : flashcards.length - 1));
                                  setShowAnswer(false);
                                }}
                                className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400"
                              >
                                &larr;
                              </button>
                              <button 
                                onClick={() => {
                                  setActiveFlashcard((prev) => (prev < flashcards.length - 1 ? prev + 1 : 0));
                                  setShowAnswer(false);
                                }}
                                className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400"
                              >
                                &rarr;
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-zinc-500 text-sm">
                          No hay flashcards disponibles para este módulo. Selecciona texto de la lectura para crear una.
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Magazine Modal */}
      {magazineReading && magReading && magModule && (
        <div className="fixed inset-0 z-[100] bg-zinc-950 flex flex-col animate-in fade-in duration-300 overflow-hidden">
          {/* Header */}
          <div className="flex-none glass-panel border-b border-white/10 p-4 flex justify-between items-center rounded-t-2xl">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setMagazineReading(null)} 
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              <div>
                <div className="text-xs text-emerald-500 font-medium uppercase tracking-wider">{magModule.title}</div>
                <div className="text-sm text-zinc-300 font-medium">
                  Lectura {magReadingIndex + 1} de {magModule.readings.length} • Página {currentPageIndex + 1} de {totalPages}
                </div>
              </div>
            </div>
            <button 
              onClick={() => toggleTTS(currentPageContent)} 
              className={twMerge(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                isSpeaking ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
              )}
            >
              {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              {isSpeaking ? 'Detener Lectura' : 'Escuchar Página'}
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-8 pb-32" onMouseUp={handleMouseUp}>
            <div className="max-w-3xl mx-auto">
              <h1 className="text-4xl font-bold text-zinc-100 mb-8 leading-tight">{magReading.title}</h1>
              <div className="prose prose-invert prose-lg prose-zinc max-w-none">
                {renderTextWithHighlights(currentPageContent, magHighlights)}
              </div>
            </div>
          </div>

          {/* Footer Navigation */}
          <div className="flex-none glass-panel border-t border-white/10 p-4 flex justify-between items-center px-8 rounded-b-2xl">
            <button 
              onClick={handlePrev} 
              disabled={!hasPrevPage && !hasPrevReading}
              className="flex items-center gap-2 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:hover:bg-zinc-800 text-zinc-200 font-medium rounded-xl transition-colors"
            >
              <ArrowLeft className="w-5 h-5" /> Anterior
            </button>
            
            <div className="text-zinc-400 font-medium text-sm">
              Página {currentPageIndex + 1} de {totalPages}
            </div>

            <button 
              onClick={handleNext} 
              disabled={!hasNextPage && !hasNextReading}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:hover:bg-emerald-500 text-zinc-950 font-medium rounded-xl transition-colors"
            >
              Siguiente <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Toolkit */}
      {selection && !showModal && (
        <div 
          id="floating-toolkit"
          className="fixed z-[110] bg-zinc-800 border border-zinc-700 shadow-xl rounded-lg p-1.5 flex gap-2 animate-in fade-in zoom-in duration-200"
          style={{ top: selection.y - 50, left: selection.x - 60 }}
        >
          <button 
            onClick={(e) => {
              e.preventDefault();
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 text-sm font-medium rounded-md transition-colors"
          >
            <Highlighter className="w-4 h-4" />
            Crear Tarjeta
          </button>
        </div>
      )}

      {/* Flashcard Creation Modal */}
      {showModal && (
        <div id="flashcard-modal" className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-zinc-100 mb-4">Nueva Tarjeta de Estudio</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Apunte / Respuesta</label>
                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-emerald-400 max-h-32 overflow-y-auto">
                  {selection?.text}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Pregunta para recordar</label>
                <textarea 
                  autoFocus
                  value={questionInput}
                  onChange={e => setQuestionInput(e.target.value)}
                  placeholder="Ej: ¿Qué establece el Art. 12?"
                  className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 min-h-[100px] resize-y"
                />
              </div>

              <button
                onClick={handleGenerateCaseStudy}
                disabled={isGeneratingAI}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-xl transition-colors font-medium text-sm"
              >
                {isGeneratingAI ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Generando Caso MEP...</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Generar Caso de Estudio MEP (IA)</>
                )}
              </button>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => { setShowModal(false); setSelection(null); setQuestionInput(''); }}
                className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveFlashcard}
                disabled={!questionInput.trim() || isGeneratingAI}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-950 text-sm font-medium rounded-xl transition-colors"
              >
                Guardar Tarjeta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
