import React, { useState, useCallback } from 'react';
import { Header } from './components/Header';
import { ImageUploader } from './components/ImageUploader';
import { StyleDashboard, STYLES_LIST, COLORS_LIST } from './components/StyleDashboard';
import { ResultDisplay } from './components/ResultDisplay';
import { generateHairstyle } from './services/geminiService';
import { AppState, GeneratedPreview } from './types';
import { AlertCircle } from 'lucide-react';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('image/jpeg');
  const [error, setError] = useState<string | null>(null);
  
  // New State for Grid/Batch Flow
  const [previews, setPreviews] = useState<Record<string, GeneratedPreview>>({});

  const handleImageSelect = useCallback((base64: string, mime: string) => {
    setOriginalImage(base64);
    setMimeType(mime);
    setGeneratedImage(null);
    setPreviews({}); // Clear previous previews on new upload
    setError(null);
    setAppState(AppState.READY_TO_GENERATE);
  }, []);

  const handleClear = useCallback(() => {
    setOriginalImage(null);
    setGeneratedImage(null);
    setPreviews({});
    setAppState(AppState.IDLE);
    setError(null);
  }, []);

  // 1. Batch Generate all styles (SEQUENTIAL)
  const handleBatchGenerate = async () => {
    if (!originalImage) return;
    
    setAppState(AppState.BATCH_GENERATING);
    setError(null);
    
    // Initialize previews
    const initialPreviews: Record<string, GeneratedPreview> = {};
    STYLES_LIST.forEach(style => {
      // Only reset if not already success
      if (previews[style.id]?.status !== 'success') {
        initialPreviews[style.id] = { styleId: style.id, status: 'loading' };
      } else {
        initialPreviews[style.id] = previews[style.id];
      }
    });
    setPreviews(initialPreviews);

    // Sequential Execution
    for (const style of STYLES_LIST) {
      if (previews[style.id]?.status === 'success') continue; // Skip already done
      if (!originalImage) break;

      try {
        const prompt = `Change hair to ${style.prompt}`;
        // Increase delay to 1.5s to be safe
        await new Promise(r => setTimeout(r, 1500));
        
        // isHighQuality = false (Batch mode uses low res for speed/stability)
        const result = await generateHairstyle(originalImage, prompt, null, mimeType, false);
        
        setPreviews(prev => ({
          ...prev,
          [style.id]: { 
            styleId: style.id, 
            status: 'success', 
            imageUrl: result.imageUrl! 
          }
        }));
      } catch (err: any) {
        console.error(`Failed to generate ${style.id}`, err);
        setPreviews(prev => ({
          ...prev,
          [style.id]: { 
            styleId: style.id, 
            status: 'error',
            error: err.message || "Generation failed"
          }
        }));
      }
    }

    setAppState(AppState.READY_TO_GENERATE);
  };

  // 1b. Retry Single Style
  const handleRetryStyle = async (styleId: string) => {
    if (!originalImage) return;
    
    // Set this specific style to loading
    setPreviews(prev => ({
      ...prev,
      [styleId]: { styleId, status: 'loading', error: undefined }
    }));

    const style = STYLES_LIST.find(s => s.id === styleId);
    if (!style) return;

    try {
      const prompt = `Change hair to ${style.prompt}`;
      // isHighQuality = false (Previews are low res)
      const result = await generateHairstyle(originalImage, prompt, null, mimeType, false);
      
      setPreviews(prev => ({
        ...prev,
        [styleId]: { 
          styleId, 
          status: 'success', 
          imageUrl: result.imageUrl! 
        }
      }));
    } catch (err: any) {
       setPreviews(prev => ({
          ...prev,
          [styleId]: { 
            styleId, 
            status: 'error',
            error: err.message || "Retry failed"
          }
        }));
    }
  };

  // 2. Refine a selected style with color
  const handleRefine = async (styleId: string, colorId: string) => {
    if (!originalImage) return;

    setAppState(AppState.REFINING);
    setError(null);

    const style = STYLES_LIST.find(s => s.id === styleId);
    const color = COLORS_LIST.find(c => c.id === colorId);

    if (!style || !color) return;

    try {
      const prompt = `Change hair to ${style.prompt}, dyed ${color.prompt}`;
      // isHighQuality = true (Final result should be sharp)
      const result = await generateHairstyle(originalImage, prompt, null, mimeType, true);
      
      if (result.imageUrl) {
        setGeneratedImage(result.imageUrl);
        setAppState(AppState.SUCCESS);
      }
    } catch (err: any) {
      setError(err.message || "Failed to apply color.");
      setAppState(AppState.READY_TO_GENERATE);
    }
  };

  // 3. Custom Generation
  const handleCustomGenerate = async (prompt: string, referenceImage: string | null) => {
    if (!originalImage) return;

    setAppState(AppState.CUSTOM_GENERATING);
    setError(null);

    try {
      // isHighQuality = true (Custom generation should be sharp)
      const result = await generateHairstyle(originalImage, prompt, referenceImage, mimeType, true);
      
      if (result.imageUrl) {
        setGeneratedImage(result.imageUrl);
        setAppState(AppState.SUCCESS);
      }
    } catch (err: any) {
      setError(err.message || "Custom generation failed.");
      setAppState(AppState.READY_TO_GENERATE);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />

      <main className="flex-grow max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Intro Text */}
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl mb-3">
            Find your perfect <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-purple-600">hairstyle</span>
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Upload a photo to compare different styles instantly. Refine with colors or upload your own reference.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 items-start">
          
          {/* Left Column: Input & Controls */}
          <div className="space-y-6">
            <div className="bg-white p-1 rounded-2xl shadow-sm border border-slate-100">
               <ImageUploader 
                onImageSelect={handleImageSelect} 
                selectedImage={originalImage}
                onClear={handleClear}
              />
            </div>

            {/* Dashboard */}
            {(appState !== AppState.IDLE && appState !== AppState.UPLOADING) && (
              <div className={`transition-all duration-500 ease-in-out transform ${originalImage ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                 <StyleDashboard 
                   onBatchGenerate={handleBatchGenerate}
                   onRefine={handleRefine}
                   onCustomGenerate={handleCustomGenerate}
                   onRetry={handleRetryStyle}
                   previews={previews}
                   isBatchLoading={appState === AppState.BATCH_GENERATING}
                   isRefining={appState === AppState.REFINING}
                   isCustomLoading={appState === AppState.CUSTOM_GENERATING}
                 />
              </div>
            )}
          </div>

          {/* Right Column: Output */}
          <div className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 text-red-700 animate-in fade-in slide-in-from-top-2">
                <AlertCircle size={20} className="shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold">Generation Failed</h4>
                  <p className="text-sm mt-1">{error}</p>
                </div>
              </div>
            )}

            {!generatedImage && !Object.values(previews).some((p: GeneratedPreview) => p.status === 'success') && (
               <div className="hidden lg:flex h-[600px] border-2 border-dashed border-slate-200 rounded-3xl items-center justify-center bg-slate-50/50">
                  <div className="text-center text-slate-400 max-w-xs">
                     <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-4xl">✨</span>
                     </div>
                     <p className="font-medium">Your new look will appear here</p>
                     <p className="text-sm mt-2">Generate styles to see previews, or use Custom mode.</p>
                  </div>
               </div>
            )}

            {(generatedImage || appState === AppState.REFINING || appState === AppState.CUSTOM_GENERATING) && (
              <ResultDisplay 
                imageUrl={generatedImage || ''} 
                originalImage={originalImage || ''}
                isLoading={appState === AppState.REFINING || appState === AppState.CUSTOM_GENERATING}
              />
            )}
          </div>
        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 py-8 mt-12">
        <div className="max-w-5xl mx-auto px-4 text-center text-slate-500 text-sm">
          <p>© {new Date().getFullYear()} HairGenius AI. Powered by Google Gemini.</p>
        </div>
      </footer>
    </div>
  );
};

export default App;